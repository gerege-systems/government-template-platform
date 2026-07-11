# Database & Data Layer

> 🌐 **English** · [Монгол](DATABASE_MN.md)

How the platform stores data: PostgreSQL schema, the migration runner, Row-Level
Security (RLS), the ORM-free pgx access pattern, Redis/Ristretto caches, and
seed data.

- **Engine:** PostgreSQL 16 (+ `uuid-ossp`), driver [`jackc/pgx/v5`](https://github.com/jackc/pgx) via `pgxpool` — **no ORM**, hand-written parameterized SQL.
- **Caches:** Redis 7 (`redis/go-redis/v9`) for auth/session/OTP state; Ristretto in-process cache for hot reads.
- **Isolation:** Postgres Row-Level Security on every per-user table, enforced with a boot-time guard.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [BACKEND.md](BACKEND.md) · [SECURITY.md](SECURITY.md)

---

## 1. Migration system

Migrations are numbered pairs `N_name.up.sql` / `N_name.down.sql` under
`backend/migrations/`. The runner lives in
`backend/internal/datasources/migration/migration.go` and is invoked by the
`cmd/migration` CLI binary (`/app/migrate` in the image).

Key behaviours:

| Property | Detail |
|----------|--------|
| **Numeric ordering** | Files sort by the leading integer before `_`, not lexicographically — so `10_` correctly runs after `1_` (`'0' < '_'`). Ties break by basename. |
| **Idempotent** | Applied files are recorded in a `schema_migrations(name TEXT PK, applied_at)` table; `-up` skips names already present. |
| **One tx per file** | Each file's SQL + the bookkeeping insert/delete run in a single transaction — no half-applied file. |
| **Advisory lock** | `pg_advisory_lock(947328461230)` serializes concurrent runners (CI + a laptop can't collide). |
| **Down** | `-down` runs `*.down.sql` in reverse and deletes the tracking row. |

**In the compose stack** the one-off `migrate` service (`docker-compose.yml`)
runs `/app/migrate -up`, waits for `db` to be healthy, then exits; `api` starts
only after `migrate` completes successfully (`service_completed_successfully`).
`migrate` connects as the **superuser** because `CREATE EXTENSION`,
`FORCE ROW LEVEL SECURITY` and `CREATE POLICY` require owner/superuser rights —
only `api` uses the least-privilege role (see §3).

### Migration timeline

| # | File | What it creates / changes |
|---|------|---------------------------|
| 1 | `create_tables_users` | `users` base table + `idx_role_id` |
| 2 | `create_extensions_uuid` | `CREATE EXTENSION "uuid-ossp"` |
| 3 | `partial_unique_users` | Partial unique indexes on email/username `WHERE deleted_at IS NULL` (soft-deleted values reusable) |
| 4 | `normalize_email_username` | Lowercases emails; case-insensitive username index |
| 5 | `users_password_changed_at` | `password_changed_at TIMESTAMPTZ` |
| 6 | `users_deleted_at_index` | `idx_users_deleted_at` |
| 7 | `enable_rls_users` | **ENABLE + FORCE RLS** on `users`; policies `users_service`, `users_admin`, `users_self` |
| 8 | `rbac_roles_permissions` | `roles`, `permissions`, `role_permissions`; seeds base permissions + roles; FK `users.role_id → roles.id` |
| 9 | `users_name` | `first_name`, `last_name` |
| 10 | `users_name_en` | `first_name_en`, `last_name_en` |
| 11 | `ai_prompts_knowledge` | `ai_prompts` (scope/instructions) + `ai_knowledge` (KB corpus), seeded |
| 12 | `users_eid` | eID columns `national_id`, `civil_id`, `kyc_level`; drops NOT NULL on password/email |
| 13 | `users_eid_civil_id` | Partial unique index on `lower(civil_id)` |
| 14 | `organizations` | `organizations` + `organization_memberships`; RLS on both |
| 15 | `audit_log` | `audit_log` (hash-chained) + `security_events` (RASP ingest); RLS |
| 16 | `users_eid_certificate` | X.509 cert columns (`cert_serial`, `cert_not_before/after`, `cert_issuer`, …) |
| 17 | `least_privilege_config_grants` | REVOKEs write grants on RLS-less config tables from `app_user` |
| 17 | `org_rls_recursion_fix` | `SECURITY DEFINER` fn `app_is_org_member()` to break RLS recursion (SQLSTATE 42P17) |
| 18 | `users_google_sub` | `google_sub` + partial unique index |
| 19 | `users_google_profile` | `google_email`, `google_name`, `google_picture`, … |
| 20 | `gov_services` | Public `gov_services` catalog + 5 per-user tables (applications, references, notifications, payments, appointments); RLS; seeds 8 services |
| 21 | `user_integrations` | `user_integrations` (encrypted 3rd-party OAuth tokens); RLS |
| 22 | `api_gateway` | 6 gateway tables (services, routes, consumers, api_keys, policies, request_logs); adds `gateway.manage` permission |
| 23 | `superadmin_role` | **Breaking:** renumbers roles → superadmin=1, admin=2, manager=3, user=4 (rotate `JWT_SECRET` after) |
| 24 | `users_sso_sub` | `sso_sub` (dgov OIDC pairwise subject) + partial unique index |
| 25 | `signatures_stamps` | `users.signature_image` + `org_stamps` (org seal images) |

> **Note** — there are **two** migration-17 files; both apply (numeric tie broken
> by basename). Migration 23 is intentionally breaking: because `role_id` is
> embedded in JWTs, rotate `JWT_SECRET` when deploying past it.

---

## 2. Schema by domain

| Domain | Tables | Purpose |
|--------|--------|---------|
| **Identity** | `users` | The central table (~35 columns). One row supports **four** login paths: password (`username`/`email`/`password`), eID (`national_id`/`civil_id`/certificate), Google (`google_sub`), dgov SSO (`sso_sub`). Names stored mn + en. Soft-deleted via `deleted_at`. |
| **RBAC** | `roles`, `permissions`, `role_permissions` | Dynamic role/permission catalogue. `superadmin`(1)/`admin`(2) resolve to the full catalogue in the usecase layer (no explicit rows). |
| **Organizations** | `organizations`, `organization_memberships`, `org_stamps` | Orgs a citizen represents; per-org role (owner/admin/member); org seal images keyed by register number. |
| **AI** | `ai_prompts`, `ai_knowledge` | `ai_prompts` holds the configurable `scope`/`instructions` prompt layers (UPDATE-only); `ai_knowledge` is the `search_knowledge` corpus. |
| **Audit / security** | `audit_log`, `security_events` | `audit_log` is hash-chained append-only (admin/service only); `security_events` is the RASP ingest (users insert-own only). |
| **Citizen portal** | `gov_services` (public) + `gov_applications`, `gov_references`, `gov_notifications`, `gov_payments`, `gov_appointments` (per-user) | Government service catalogue and each citizen's applications/history. |
| **Integrations** | `user_integrations` | Per-user encrypted third-party OAuth tokens (Google Drive/Meet, Dropbox). |
| **API Gateway** | `gateway_services`, `gateway_routes`, `gateway_consumers`, `gateway_api_keys`, `gateway_policies`, `gateway_request_logs` | Config + telemetry for the built-in API gateway. API keys stored as SHA-256 `key_hash` + `key_prefix` only. |
| **Meta** | `schema_migrations` | Migration-runner bookkeeping. |

> **Auth/OTP/refresh tokens are not Postgres tables** — they live in Redis
> (§5). There is no session or refresh-token table.

---

## 3. Row-Level Security (RLS)

RLS is the core tenant-isolation mechanism. Because Postgres **silently
bypasses RLS for superusers**, the platform runs two DB roles:

- **`migrate`** connects as the superuser (`POSTGRES_USER`) — needed for DDL, `CREATE EXTENSION`, and `FORCE ROW LEVEL SECURITY`.
- **`api`** connects as a least-privilege role (`APP_DB_USER`, created `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` by `backend/deploy/initdb/10-create-app-user.sh`).

**Boot guard** — `internal/datasources/drivers/driver_pgx.go`
(`guardRLSEnforceable`) queries `pg_roles` for `current_user` after the pool
pings. If the api's role is `rolsuper` or `rolbypassrls`, it **fails to boot in
production** and only warns in development. This makes a misconfigured
privileged connection a hard startup failure, not a silent security hole.

Every RLS table uses `ENABLE` **+** `FORCE ROW LEVEL SECURITY` (FORCE applies
the policies to the table owner too).

### Identity plumbing — `withRLS`

`internal/datasources/rls/rls.go` is a leaf package (imports only `context`).
It defines the `Role` constants (`service`/`admin`/`user`, matching the SQL
literals), an `Identity{UserID, Role}`, and context helpers. Repositories run
queries inside a `withRLS` transaction that sets per-transaction GUCs:

```go
tx, _ := r.pool.Begin(ctx)
tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true),
                     set_config('app.user_role', $2, true)`,
        id.UserID, string(id.Role))
// ... queries run here; policies read current_setting('app.user_id' / 'app.user_role')
```

The `true` third argument = `SET LOCAL`: the setting is scoped to the
transaction only. This is **critical** — pgx pools connections, so a plain
`SET` would leak one request's identity onto the next. A missing `Identity`
leaves the GUCs empty, every policy fails, and the query returns **zero rows**
(fail-closed).

### Policy shapes

| Policy | Rule |
|--------|------|
| `*_service` | Full access — pre-auth flows (login lookup, register INSERT, OTP, password reset, seeding) run under the `service` role. |
| `*_admin` | Full access to all rows. |
| `*_self` | `role='user' AND <col> = NULLIF(current_setting('app.user_id',true),'')::uuid` — the `NULLIF(...,'')` guards against `''::uuid` raising. Applies to `users`, `gov_*`, `user_integrations`. |
| `organizations_member` | Membership-scoped SELECT via the `app_is_org_member()` `SECURITY DEFINER` function (breaks recursion). Org writes go through the usecase under the `service` GUC. |
| `audit_log` | service + admin only — **no user policy** (users can neither read nor insert). |
| `security_events` | service/admin full; `security_events_user_insert` is `FOR INSERT WITH CHECK` only (users insert their own event, never read). |

Example (`users_self`, migration 7):

```sql
CREATE POLICY users_self ON users
  USING (current_setting('app.user_role', true) = 'user'
         AND id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (current_setting('app.user_role', true) = 'user'
         AND id = NULLIF(current_setting('app.user_id', true), '')::uuid);
```

> **Adding a per-user table?** Enable + FORCE RLS and add the three-policy set
> (service / admin / self) in the same migration, or the api role will read
> zero rows.

---

## 4. pgx access pattern (no ORM)

- **Pool** — `internal/datasources/drivers/driver_pgx.go`: `InitializePgxPool` parses the DSN, sets pool sizes/lifetimes, installs the `otelpgx` tracer (an OpenTelemetry span per Query/Exec), pings, then runs the RLS boot guard. `SetupPgxPostgres` picks the DSN by environment (dev DSN vs. prod URL).
- **Records** — `internal/datasources/records/`: plain structs with `db:"snake_case"` tags scanned via `pgx.RowToStructByName`. Nullable columns are pointers (`*string`, `*time.Time`) so `NULL` → `nil`. Column-list constants (e.g. `UserColumns`) centralize the SELECT/RETURNING lists.
- **Mappers** — `record_*_mapper.go` convert records ↔ `domain` models, keeping domain free of DB tags.
- **Convention** — one method per file under `repositories/postgres/<domain>/` (e.g. `users_get_by_email.go`, `users_eid.go`) to keep diffs narrow.
- **Soft-delete is manual** — every query adds `deleted_at IS NULL` explicitly. `pgUniqueViolation = "23505"` is the conflict sentinel. All queries are parameterized (`$1, $2, …`).
- Repos implement interfaces in `repositories/interface/` (package `_interface`) and are wired by manual DI in `cmd/api/server/server.go`.

---

## 5. Caches

### Redis — the auth/session store (`caches/cache_redis.go`)

`RedisCache` wraps `go-redis/v9` (with `redisotel` tracing, 3s op timeout).
`GetDel` gives atomic read-and-delete for one-time tokens. Keys are centralized
in `usecases/auth/auth_redis_keys.go`:

| Key | Meaning |
|-----|---------|
| `refresh:<jti>` | Valid refresh-token jti; absent ⇒ revoked. Rotated via `GetDel` on refresh, deleted on logout. |
| `access_deny:<jti>` | Logged-out access-token jti, held for its remaining TTL (denylist checked every request). |
| `pwd_cutoff:<userID>` | Token cutoff unix-sec — password change invalidates older access tokens. |
| `user_otp:<email>` / `pwd_reset_req:<email>` | Live registration / password-reset OTP request_id. |
| `otp_attempts:` / `login_attempts:` / `forgot_attempts:<email>` | Brute-force counters. |
| `google_link:<token>` | Short-lived Google-first-login → eID linking token. |
| SSO `state` / id-token / refresh-jti | dgov OIDC flow state (`usecases/sso`). |

### Ristretto — in-process hot cache (`caches/cache_ristretto.go`)

`dgraph-io/ristretto`, 5-minute TTL. Used by `usecases/users/users_get_by_email.go`
under `user/<email>` to cache the `domain.User`, guarded by a `singleflight`
group to avoid a thundering herd on cache miss; invalidated explicitly on
Activate / UpdatePassword mutations (the TTL is only the safety net).

---

## 6. Seed data

- **`cmd/seed`** seeds **users only** — two demo accounts (both password `12345`, bcrypt-hashed): an active admin and an inactive standard user. Runs inside one transaction.
- **Everything else is seeded by the migrations themselves**: base permissions + roles (migration 8), `ai_prompts` + `ai_knowledge` (11), the `gov_services` catalogue (20), and the gateway demo data (22).

---

## 7. initdb — how RLS is made to bind

`backend/deploy/initdb/10-create-app-user.sh` runs once on an empty data volume
(as the superuser). It:

1. Creates `${APP_DB_USER}` as `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`.
2. `GRANT CONNECT` on the DB, `GRANT USAGE ON SCHEMA public`.
3. `ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER}` so tables the superuser `migrate` creates **later** auto-grant DML (SELECT/INSERT/UPDATE/DELETE) + sequence usage to the app role.
4. Grants on all existing tables/sequences too (for re-runs against a populated schema).

This is the mechanism that makes RLS actually enforce: the superuser
`migrate` owns and creates everything; the non-superuser `api` role gets only
DML, so its policies bind. Migration `17_least_privilege_config_grants` then
tightens these broad grants (it hard-codes the name `app_user`; a custom
`APP_DB_USER` must mirror the REVOKEs by hand).

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

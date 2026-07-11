# Өгөгдлийн сан ба өгөгдлийн давхарга

> 🌐 [English](DATABASE.md) · **Монгол**

Платформ өгөгдлийг хэрхэн хадгалдаг вэ: PostgreSQL schema, миграцийн ажиллуулагч,
Row-Level Security (RLS), ORM-гүй pgx хандалтын загвар, Redis/Ristretto кэш болон
seed өгөгдөл.

- **Хөдөлгүүр:** PostgreSQL 16 (+ `uuid-ossp`), драйвер [`jackc/pgx/v5`](https://github.com/jackc/pgx) нь `pgxpool`-оор дамжина — **ORM ашиглахгүй**, гараар бичсэн параметржүүлсэн SQL.
- **Кэш:** auth/session/OTP төлөвт зориулсан Redis 7 (`redis/go-redis/v9`); халуун уншилтад зориулсан процесс доторх Ristretto кэш.
- **Тусгаарлалт:** хэрэглэгч тус бүрийн бүх хүснэгт дээр Postgres Row-Level Security, boot үеийн хамгаалагчаар хэрэгжүүлнэ.

Холбоотой: [ARCHITECTURE.md](ARCHITECTURE_MN.md) · [BACKEND.md](BACKEND_MN.md) · [SECURITY.md](SECURITY_MN.md)

---

## 1. Миграцийн систем

Миграциуд нь `backend/migrations/` доорх `N_name.up.sql` / `N_name.down.sql`
дугаартай хосууд юм. Ажиллуулагч нь
`backend/internal/datasources/migration/migration.go`-д байрлах бөгөөд
`cmd/migration` CLI binary (image дотор `/app/migrate`)-аар дуудагдана.

Гол зан төлөв:

| Шинж чанар | Дэлгэрэнгүй |
|----------|--------|
| **Тоон эрэмбэ** | Файлууд нь `_`-ийн өмнөх эхний бүхэл тоогоор эрэмбэлэгдэнэ, лексикографоор биш — тиймээс `10_` нь `1_`-ийн дараа зөв ажиллана (`'0' < '_'`). Тэнцвэл basename-ээр ялгагдана. |
| **Idempotent** | Хэрэгжүүлсэн файлууд нь `schema_migrations(name TEXT PK, applied_at)` хүснэгтэд бүртгэгдэнэ; `-up` нь аль хэдийн байгаа нэрсийг алгасна. |
| **Файл тутам нэг tx** | Файл бүрийн SQL + бүртгэлийн insert/delete нь нэг транзакцид ажиллана — хагас хэрэгжсэн файл гэж байхгүй. |
| **Advisory lock** | `pg_advisory_lock(947328461230)` нь зэрэгцээ ажиллуулагчдыг цувуулна (CI болон laptop мөргөлдөхгүй). |
| **Down** | `-down` нь `*.down.sql`-г урвуу дарааллаар ажиллуулж, хянах мөрийг устгана. |

**Compose стек дотор** нэг удаагийн `migrate` үйлчилгээ (`docker-compose.yml`) нь
`/app/migrate -up`-г ажиллуулж, `db` эрүүл болтол хүлээгээд гарна; `api` нь
`migrate` амжилттай дуусаж байж эхэлнэ (`service_completed_successfully`).
`migrate` нь **superuser**-ээр холбогддог, учир нь `CREATE EXTENSION`,
`FORCE ROW LEVEL SECURITY` болон `CREATE POLICY` нь owner/superuser эрх шаарддаг —
зөвхөн `api` нь хамгийн бага эрхтэй role ашигладаг (§3-г үзнэ үү).

### Миграцийн он цагийн хэлхээс

| # | Файл | Юу үүсгэдэг / өөрчилдөг вэ |
|---|------|---------------------------|
| 1 | `create_tables_users` | `users` суурь хүснэгт + `idx_role_id` |
| 2 | `create_extensions_uuid` | `CREATE EXTENSION "uuid-ossp"` |
| 3 | `partial_unique_users` | email/username дээр `WHERE deleted_at IS NULL` нөхцөлтэй хэсэгчилсэн unique индексүүд (soft-delete хийсэн утгуудыг дахин ашиглах боломжтой) |
| 4 | `normalize_email_username` | email-ийг жижиг үсэг болгоно; том/жижиг үсэг үл ялгах username индекс |
| 5 | `users_password_changed_at` | `password_changed_at TIMESTAMPTZ` |
| 6 | `users_deleted_at_index` | `idx_users_deleted_at` |
| 7 | `enable_rls_users` | `users` дээр **ENABLE + FORCE RLS**; `users_service`, `users_admin`, `users_self` policy-ууд |
| 8 | `rbac_roles_permissions` | `roles`, `permissions`, `role_permissions`; суурь permission-ууд + role-уудыг seed хийнэ; FK `users.role_id → roles.id` |
| 9 | `users_name` | `first_name`, `last_name` |
| 10 | `users_name_en` | `first_name_en`, `last_name_en` |
| 11 | `ai_prompts_knowledge` | `ai_prompts` (scope/instructions) + `ai_knowledge` (KB corpus), seed хийсэн |
| 12 | `users_eid` | eID баганууд `national_id`, `civil_id`, `kyc_level`; password/email дээрх NOT NULL-ийг хасна |
| 13 | `users_eid_civil_id` | `lower(civil_id)` дээр хэсэгчилсэн unique индекс |
| 14 | `organizations` | `organizations` + `organization_memberships`; хоёул дээр RLS |
| 15 | `audit_log` | `audit_log` (hash-гинжлэгдсэн) + `security_events` (RASP ingest); RLS |
| 16 | `users_eid_certificate` | X.509 гэрчилгээний баганууд (`cert_serial`, `cert_not_before/after`, `cert_issuer`, …) |
| 17 | `least_privilege_config_grants` | RLS-гүй config хүснэгтүүд дээрх бичих grant-уудыг `app_user`-ээс REVOKE хийнэ |
| 17 | `org_rls_recursion_fix` | RLS рекурсийг (SQLSTATE 42P17) таслах `SECURITY DEFINER` функц `app_is_org_member()` |
| 18 | `users_google_sub` | `google_sub` + хэсэгчилсэн unique индекс |
| 19 | `users_google_profile` | `google_email`, `google_name`, `google_picture`, … |
| 20 | `gov_services` | Нийтийн `gov_services` каталог + хэрэглэгч тус бүрийн 5 хүснэгт (applications, references, notifications, payments, appointments); RLS; 8 үйлчилгээ seed хийнэ |
| 21 | `user_integrations` | `user_integrations` (шифрлэсэн 3rd-party OAuth токенууд); RLS |
| 22 | `api_gateway` | 6 gateway хүснэгт (services, routes, consumers, api_keys, policies, request_logs); `gateway.manage` permission нэмнэ |
| 23 | `superadmin_role` | **Эвдэрхий (breaking):** role-уудыг дахин дугаарлана → superadmin=1, admin=2, manager=3, user=4 (дараа нь `JWT_SECRET`-ийг эргүүлнэ) |
| 24 | `users_sso_sub` | `sso_sub` (dgov OIDC pairwise subject) + хэсэгчилсэн unique индекс |
| 25 | `signatures_stamps` | `users.signature_image` + `org_stamps` (байгууллагын тамганы зурагнууд) |

> **Тэмдэглэл** — migration-17 файл **хоёр** байгаа; хоёул хэрэгждэг (тоон
> тэнцлийг basename-ээр таслана). Migration 23 нь зориудаар эвдэрхий: `role_id` нь
> JWT дотор шигтгэгддэг тул үүнийг давж deploy хийхдээ `JWT_SECRET`-ийг эргүүлнэ.

---

## 2. Домэйнээр ангилсан schema

| Домэйн | Хүснэгтүүд | Зорилго |
|--------|--------|---------|
| **Identity** | `users` | Төв хүснэгт (~35 багана). Нэг мөр нь **дөрвөн** нэвтрэх замыг дэмжинэ: password (`username`/`email`/`password`), eID (`national_id`/`civil_id`/гэрчилгээ), Google (`google_sub`), dgov SSO (`sso_sub`). Нэрс mn + en-ээр хадгалагдана. `deleted_at`-аар soft-delete хийнэ. |
| **RBAC** | `roles`, `permissions`, `role_permissions` | Динамик role/permission каталог. `superadmin`(1)/`admin`(2) нь usecase давхаргад бүрэн каталог руу шийдэгдэнэ (тодорхой мөр байхгүй). |
| **Organizations** | `organizations`, `organization_memberships`, `org_stamps` | Иргэний төлөөлдөг байгууллагууд; байгууллага тус бүрийн role (owner/admin/member); регистрийн дугаараар түлхүүрлэсэн байгууллагын тамганы зурагнууд. |
| **AI** | `ai_prompts`, `ai_knowledge` | `ai_prompts` нь тохируулж болох `scope`/`instructions` prompt давхаргуудыг агуулна (зөвхөн UPDATE); `ai_knowledge` нь `search_knowledge` corpus юм. |
| **Audit / security** | `audit_log`, `security_events` | `audit_log` нь hash-гинжлэгдсэн зөвхөн нэмэх (append-only) (зөвхөн admin/service); `security_events` нь RASP ingest (хэрэглэгчид зөвхөн өөрийнхөө мөрийг insert хийнэ). |
| **Иргэний портал** | `gov_services` (нийтийн) + `gov_applications`, `gov_references`, `gov_notifications`, `gov_payments`, `gov_appointments` (хэрэглэгч тус бүр) | Төрийн үйлчилгээний каталог болон иргэн бүрийн өргөдөл/түүх. |
| **Integrations** | `user_integrations` | Хэрэглэгч тус бүрийн шифрлэсэн 3rd-party OAuth токенууд (Google Drive/Meet, Dropbox). |
| **API Gateway** | `gateway_services`, `gateway_routes`, `gateway_consumers`, `gateway_api_keys`, `gateway_policies`, `gateway_request_logs` | Суурилуулсан API gateway-ийн config + telemetry. API түлхүүрүүд зөвхөн SHA-256 `key_hash` + `key_prefix` хэлбэрээр хадгалагдана. |
| **Meta** | `schema_migrations` | Миграцийн ажиллуулагчийн бүртгэл. |

> **Auth/OTP/refresh токенууд нь Postgres хүснэгт биш** — тэдгээр нь Redis-д
> амьдардаг (§5). Session эсвэл refresh-token хүснэгт байхгүй.

---

## 3. Row-Level Security (RLS)

RLS нь tenant тусгаарлалтын гол механизм юм. Postgres нь **superuser-ийн хувьд RLS-ийг
чимээгүй тойрдог** тул платформ нь хоёр DB role ажиллуулдаг:

- **`migrate`** нь superuser-ээр (`POSTGRES_USER`) холбогддог — DDL, `CREATE EXTENSION`, `FORCE ROW LEVEL SECURITY`-д шаардлагатай.
- **`api`** нь хамгийн бага эрхтэй role-ээр (`APP_DB_USER`, `backend/deploy/initdb/10-create-app-user.sh`-аар `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` гэж үүсгэгдсэн) холбогддог.

**Boot guard** — `internal/datasources/drivers/driver_pgx.go`
(`guardRLSEnforceable`) нь pool ping хийсний дараа `current_user`-ийн хувьд
`pg_roles`-ийг асуулга хийнэ. Хэрэв api-ийн role нь `rolsuper` эсвэл
`rolbypassrls` бол production дээр **boot хийж чадахгүй** бөгөөд development дээр
зөвхөн анхааруулна. Энэ нь буруу тохируулсан эрхтэй холболтыг чимээгүй аюулгүй
байдлын нүх биш, харин хатуу эхлэлийн алдаа болгодог.

RLS хүснэгт бүр нь `ENABLE` **+** `FORCE ROW LEVEL SECURITY` ашигладаг (FORCE нь
policy-уудыг хүснэгтийн owner-т ч мөн хэрэгжүүлдэг).

### Identity холболт — `withRLS`

`internal/datasources/rls/rls.go` нь leaf package (зөвхөн `context`-ийг import
хийдэг). Энэ нь `Role` тогтмолуудыг (`service`/`admin`/`user`, SQL литералтай
таарна), `Identity{UserID, Role}` болон context туслагчдыг тодорхойлдог.
Репозиторнууд нь транзакц тус бүрийн GUC-уудыг тохируулдаг `withRLS`
транзакцийн дотор асуулга ажиллуулдаг:

```go
tx, _ := r.pool.Begin(ctx)
tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true),
                     set_config('app.user_role', $2, true)`,
        id.UserID, string(id.Role))
// ... queries run here; policies read current_setting('app.user_id' / 'app.user_role')
```

`true` гэсэн гурав дахь аргумент = `SET LOCAL`: тохиргоо нь зөвхөн транзакцид
хамаарна. Энэ нь **чухал** — pgx нь холболтуудыг pool хийдэг тул энгийн `SET` нь
нэг хүсэлтийн identity-г дараагийнх руу алдагдуулна. `Identity` дутуу бол GUC-ууд
хоосон үлдэж, policy бүр амжилтгүй болж, асуулга нь **тэг мөр** буцаана
(fail-closed).

### Policy-ийн хэлбэрүүд

| Policy | Дүрэм |
|--------|------|
| `*_service` | Бүрэн хандалт — auth-ийн өмнөх урсгалууд (login хайлт, register INSERT, OTP, нууц үг сэргээх, seed) нь `service` role-ийн дор ажиллана. |
| `*_admin` | Бүх мөр рүү бүрэн хандалт. |
| `*_self` | `role='user' AND <col> = NULLIF(current_setting('app.user_id',true),'')::uuid` — `NULLIF(...,'')` нь `''::uuid` алдаа өгөхөөс хамгаална. `users`, `gov_*`, `user_integrations`-д хамаарна. |
| `organizations_member` | `app_is_org_member()` `SECURITY DEFINER` функцээр (рекурсийг таслана) гишүүнчлэлээр хязгаарласан SELECT. Байгууллагын бичилтүүд нь `service` GUC-ийн дор usecase-аар дамжина. |
| `audit_log` | зөвхөн service + admin — **user policy байхгүй** (хэрэглэгчид уншиж ч, insert хийж ч чадахгүй). |
| `security_events` | service/admin бүрэн; `security_events_user_insert` нь зөвхөн `FOR INSERT WITH CHECK` (хэрэглэгчид өөрийнхөө event-ийг insert хийнэ, хэзээ ч уншихгүй). |

Жишээ (`users_self`, migration 7):

```sql
CREATE POLICY users_self ON users
  USING (current_setting('app.user_role', true) = 'user'
         AND id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (current_setting('app.user_role', true) = 'user'
         AND id = NULLIF(current_setting('app.user_id', true), '')::uuid);
```

> **Хэрэглэгч тус бүрийн хүснэгт нэмэх үү?** RLS-ийг ENABLE + FORCE хийж, гурван
> policy-ийн багцыг (service / admin / self) нэг миграцид нэмнэ, эс бөгөөс api role
> тэг мөр уншина.

---

## 4. pgx хандалтын загвар (ORM-гүй)

- **Pool** — `internal/datasources/drivers/driver_pgx.go`: `InitializePgxPool` нь DSN-ийг задалж, pool хэмжээ/насыг тохируулж, `otelpgx` tracer-ийг (Query/Exec тус бүрд OpenTelemetry span) суулгаж, ping хийгээд, дараа нь RLS boot guard-ийг ажиллуулдаг. `SetupPgxPostgres` нь орчноор DSN-ийг сонгодог (dev DSN эсвэл prod URL).
- **Records** — `internal/datasources/records/`: `db:"snake_case"` таг бүхий энгийн struct-ууд, `pgx.RowToStructByName`-аар scan хийгддэг. NULL болох баганууд нь pointer (`*string`, `*time.Time`) тул `NULL` → `nil`. Багана-жагсаалтын тогтмолууд (жишээ нь `UserColumns`) нь SELECT/RETURNING жагсаалтуудыг төвлөрүүлдэг.
- **Mappers** — `record_*_mapper.go` нь record-уудыг ↔ `domain` загвар руу хөрвүүлж, domain-ийг DB тагаас чөлөөтэй байлгадаг.
- **Конвенц** — diff-ийг нарийн байлгахын тулд `repositories/postgres/<domain>/` доор файл тутам нэг method (жишээ нь `users_get_by_email.go`, `users_eid.go`).
- **Soft-delete нь гараар** — асуулга бүр `deleted_at IS NULL`-ийг тодорхой нэмдэг. `pgUniqueViolation = "23505"` нь conflict-ийн sentinel. Бүх асуулга параметржүүлсэн (`$1, $2, …`).
- Репозиторнууд нь `repositories/interface/` (package `_interface`) дахь интерфэйсүүдийг хэрэгжүүлж, `cmd/api/server/server.go` дахь гараар DI-аар холбогддог.

---

## 5. Кэш

### Redis — auth/session store (`caches/cache_redis.go`)

`RedisCache` нь `go-redis/v9`-г (`redisotel` tracing, 3s op timeout-той) боож
өгдөг. `GetDel` нь нэг удаагийн токенуудад атомик унших-ба-устгах өгдөг.
Түлхүүрүүд нь `usecases/auth/auth_redis_keys.go`-д төвлөрсөн:

| Түлхүүр | Утга |
|-----|---------|
| `refresh:<jti>` | Хүчинтэй refresh-token jti; байхгүй бол ⇒ хүчингүй болсон. Refresh дээр `GetDel`-аар эргэлддэг, logout дээр устгагдана. |
| `access_deny:<jti>` | Гарсан access-token jti, үлдсэн TTL-ийн турш хадгалагдана (хүсэлт бүрд denylist шалгагдана). |
| `pwd_cutoff:<userID>` | Токены cutoff unix-sec — нууц үг өөрчлөх нь хуучин access токенуудыг хүчингүй болгоно. |
| `user_otp:<email>` / `pwd_reset_req:<email>` | Идэвхтэй бүртгэл / нууц үг сэргээх OTP request_id. |
| `otp_attempts:` / `login_attempts:` / `forgot_attempts:<email>` | Brute-force тоолуурууд. |
| `google_link:<token>` | Богино настай Google-эхний-нэвтрэлт → eID холбох токен. |
| SSO `state` / id-token / refresh-jti | dgov OIDC урсгалын төлөв (`usecases/sso`). |

### Ristretto — процесс доторх халуун кэш (`caches/cache_ristretto.go`)

`dgraph-io/ristretto`, 5 минутын TTL. `usecases/users/users_get_by_email.go`-д
`user/<email>` доор `domain.User`-ийг кэшлэхэд ашиглагдана, cache miss дээр
thundering herd-ээс сэргийлэхийн тулд `singleflight` group-ээр хамгаалагдсан;
Activate / UpdatePassword мутацуудад тодорхой хүчингүй болгогдоно (TTL нь зөвхөн
аюулгүй байдлын сүлжээ).

---

## 6. Seed өгөгдөл

- **`cmd/seed`** нь **зөвхөн users**-ийг seed хийдэг — хоёр demo бүртгэл (хоёул нууц үг `12345`, bcrypt-hash хийсэн): идэвхтэй admin болон идэвхгүй энгийн хэрэглэгч. Нэг транзакцийн дотор ажиллана.
- **Бусад бүх зүйлийг миграциуд өөрсдөө seed хийнэ**: суурь permission-ууд + role-ууд (migration 8), `ai_prompts` + `ai_knowledge` (11), `gov_services` каталог (20), болон gateway-ийн demo өгөгдөл (22).

---

## 7. initdb — RLS-ийг хэрхэн хүчинтэй болгодог вэ

`backend/deploy/initdb/10-create-app-user.sh` нь хоосон data volume дээр нэг удаа
(superuser-ээр) ажилладаг. Энэ нь:

1. `${APP_DB_USER}`-ийг `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` гэж үүсгэнэ.
2. DB дээр `GRANT CONNECT`, `GRANT USAGE ON SCHEMA public`.
3. `ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER}` — ингэснээр superuser `migrate` **дараа нь** үүсгэх хүснэгтүүд нь app role-д DML (SELECT/INSERT/UPDATE/DELETE) + sequence ашиглалтыг автоматаар олгодог.
4. Байгаа бүх хүснэгт/sequence дээр ч grant хийнэ (populate хийсэн schema дээр дахин ажиллуулахад зориулж).

Энэ бол RLS-ийг үнэхээр хэрэгжүүлдэг механизм юм: superuser `migrate` нь бүх
зүйлийг эзэмшиж, үүсгэдэг; superuser бус `api` role нь зөвхөн DML авдаг тул түүний
policy-ууд хүчинтэй болно. Дараа нь `17_least_privilege_config_grants` migration
нь эдгээр өргөн grant-уудыг чангаруулдаг (энэ нь `app_user` нэрийг hard-code
хийдэг; өөрчилсөн `APP_DB_USER` нь REVOKE-уудыг гараар тусгах ёстой).

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

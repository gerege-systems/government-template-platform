# Deployment Runbook

> 🌐 **English** · [Монгол](DEPLOYMENT_MN.md)

How to deploy the full stack (Postgres + Redis + Go API + Next.js web) to a
single VPS with Docker Compose behind nginx. This is the runbook used for the
reference deployment at `https://template.dgov.mn`.

Related: [CONFIGURATION.md](CONFIGURATION.md) (full env-var reference) · [DATABASE.md](DATABASE.md) · [SECURITY.md](SECURITY.md)

---

## Topology

```
Internet ──▶ nginx (80/443, TLS via Let's Encrypt)
                │ proxy_pass
                ▼
        web  127.0.0.1:${WEB_PORT}   (Next.js BFF — the ONLY exposed container)
                │ BACKEND_URL=http://api:8080   (internal compose network)
                ▼
        api ──▶ db (Postgres 16) + redis (7)    (no public ports)
```

The browser only ever reaches `web`; `api`, `db`, `redis` stay on the internal
compose network. A one-off `migrate` container applies SQL migrations on every
`up` and exits.

---

## Compose stack (`docker-compose.yml`)

Project name `temp-gerege-mn`, one named volume `dbdata`. Only `web` publishes a
host port (loopback only).

| Service | Image / build | Exposed | depends_on | Notes |
|---------|---------------|---------|------------|-------|
| **db** | `postgres:16-alpine` | internal 5432 | — | `dbdata` volume + `initdb` mount; `pg_isready` healthcheck |
| **redis** | `redis:7-alpine` (`--requirepass`, no persistence) | internal 6379 | — | in-memory only |
| **migrate** | build `./backend` | — | `db: healthy` | one-off `/app/migrate -up`, then exits (`restart: "no"`); connects as the **superuser** |
| **api** | build `./backend` (`/app/api`) | internal 8080 | db, redis healthy + `migrate: completed` | connects as the **non-superuser** `app_user` (compose overrides its DSN) |
| **web** | build `./frontend` | `127.0.0.1:${WEB_PORT:-3007}:3000` | `api: healthy` | Next.js standalone |

**Boot order:** db + redis healthy → `migrate` runs and must exit 0 → `api`
starts and passes its healthcheck → `web` starts.

**RLS-critical override:** compose sets the api's DB DSN to `${APP_DB_DSN}` (the
least-privilege role) while `migrate` keeps the superuser DSN from `backend.env`.
This is what makes RLS actually enforce — see [DATABASE.md](DATABASE.md) §3 & §7.

---

## 1. Prerequisites

- A VPS with Docker + the compose plugin (`docker compose version`).
- nginx + certbot on the host (or any reverse proxy that terminates TLS).
- A DNS A record pointing at the server.

## 2. Get the code

```bash
git clone <repo-url> /srv/template-gerege-mn
cd /srv/template-gerege-mn
```

## 3. Create the two env files (both gitignored)

Generate secrets with `openssl rand -hex 24`. See [CONFIGURATION.md](CONFIGURATION.md)
for every variable.

**`./.env`** — compose interpolation (`${...}` in docker-compose.yml):

```env
POSTGRES_USER=postgres            # superuser — used by migrate only
POSTGRES_PASSWORD=<random>
POSTGRES_DB=gerege_template
APP_DB_USER=app_user              # least-privilege role the api connects as
APP_DB_PASSWORD=<random>
APP_DB_DSN=host=db port=5432 user=app_user password=<same> dbname=gerege_template sslmode=disable
REDIS_PASS=<random>
APP_ORIGIN=https://your.domain.mn # exact public origin (CSRF origin check)
WEB_PORT=3007                     # loopback port nginx proxies to
```

**`./backend.env`** — mounted into `api` + `migrate` at `/app/.env`:

```env
PORT=8080
ENVIRONMENT=development           # dev mode on purpose: internal DB has no TLS
                                  # (the prod guard requires sslmode=verify-full);
                                  # TLS terminates at nginx
DB_POSTGRE_DRIVER=postgres
DB_POSTGRE_DSN=postgres://postgres:<POSTGRES_PASSWORD>@db:5432/gerege_template?sslmode=disable
                                  # ^ superuser DSN, used by MIGRATE; api overrides with APP_DB_DSN
JWT_SECRET=<≥32 random chars>
JWT_EXPIRED=24                    # hours (1–24)
JWT_ISSUER=your.domain.mn
JWT_REFRESH_EXPIRED=7             # days
BCRYPT_COST=12
REDIS_HOST=redis:6379
REDIS_PASS=<same as .env>
REDIS_EXPIRED=5                   # minutes
ALLOWED_ORIGINS=https://your.domain.mn
TRUSTED_PROXIES=172.16.0.0/12,127.0.0.1   # REQUIRED behind nginx, else per-IP
                                  # rate limits collapse into one bucket
# feature keys — blank = feature inert (not a boot failure) unless prod-required:
VERIFY_API_BASE=https://verify.gecloud.mn/v1
VERIFY_API_KEY=<gck_live_…>       # OTP; required in production
EID_RP_UUID=…  EID_RP_SECRET=…    # eID login
GEMINI_API_KEY=<AIza…>            # AI features
```

> Why `ENVIRONMENT=development`? The internal compose Postgres has no TLS, and the
> production guard rejects `sslmode=disable`. TLS is terminated at nginx instead,
> so the stack runs the backend in dev mode on purpose. Everything else (RLS boot
> guard, security headers except HSTS) still applies.

## 4. Why two DB roles (read before first boot)

RLS is **silently bypassed by superusers**, so the stack uses two roles:

- `migrate` → `POSTGRES_USER` (superuser — needed for `CREATE EXTENSION`, RLS DDL).
- `api` → `APP_DB_USER` (`NOSUPERUSER NOBYPASSRLS`), created automatically by `backend/deploy/initdb/10-create-app-user.sh` **on first init of an empty data volume**.

The api **verifies this at boot**: a superuser/BYPASSRLS role fails startup in
production and warns in development. On an *existing* database, create the role +
grants by hand (mirror the initdb script). See [DATABASE.md](DATABASE.md) §7.

## 5. First deploy

```bash
docker compose up -d --build      # builds api+web, runs migrations, starts all
docker compose ps                 # expect db/redis/api/web healthy, migrate Exited (0)
```

**nginx vhost (host):**

```nginx
upstream gerege_web { server 127.0.0.1:3007; }   # = WEB_PORT
server {
    server_name your.domain.mn;
    location / {
        proxy_pass http://gerege_web;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `certbot --nginx -d your.domain.mn` for TLS. The stack sets
`COOKIE_SECURE=true`, so the site **must** be served over HTTPS or browsers drop
the auth cookies.

## 6. Verify

```bash
docker compose ps                                      # all healthy
docker logs temp-gerege-mn-migrate-1 | tail -3         # "migration [up] success"
curl -s -o /dev/null -w '%{http_code}\n' https://your.domain.mn/   # 200
BASE=https://your.domain.mn scripts/smoke-test.sh      # external black-box checks
```

`scripts/smoke-test.sh` asserts HTTPS 200, HTTP→HTTPS redirect, HSTS/CSP/nosniff
headers, eID QR + РД push start, CSRF 403 without the `x-dgov-csrf` header, and
`/api/rbac/me` 401 when unauthenticated.

## 7. Updating

```bash
git pull --ff-only origin main
docker compose build              # api + web + migrate
docker compose up -d              # recreates changed containers; migrate re-runs
                                  # (already-applied files are skipped)
```

`db` and `redis` keep running — data is untouched. Config-only change? Edit the
env file and `docker compose up -d api web`.

## 8. Rollback

```bash
git log --oneline                 # find the last good commit
git checkout <commit> -- .        # or: git reset --hard <commit>
docker compose build && docker compose up -d
```

SQL migrations are forward-only in this flow; to revert one, apply the matching
`N_*.down.sql` by hand before rolling code back past it.

## Health & operator endpoints (api :8080)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — always 200 (no dependency check). |
| `GET /ready` | Readiness — pings pgx + redis; 503 if either is down. |
| `GET /metrics` | Prometheus (incl. DB pool stats). In prod, behind `Bearer OBSERVABILITY_TOKEN` (404 otherwise). |
| `GET /swagger/doc.json` | OpenAPI spec. Same gate as `/metrics`. |

The container healthcheck is a tiny stdlib-only `/app/healthcheck` binary (the
distroless image has no shell/curl) that GETs `/health`.

---

## CI / CD

> **Reality note:** there is **no `.github/` directory** in this repo. The CI
> pipeline described in CLAUDE.md and the older deploy runbook (gofmt, `go test
> -race`, swag drift, frontend lint/build, gitleaks, and an SSH deploy job) is
> **not present as workflow files**. Add a workflow before relying on automated
> gates.

The authoritative, reproducible CI gates live in **`backend/Makefile`** — run
them locally with `make pre-push` (= `ci-lint ci-test ci-swag-check ci-build`):

| Target | Runs |
|--------|------|
| `ci-lint` | `golangci-lint run ./...` |
| `ci-test` | `go test -race -coverprofile=coverage.out ./...` |
| `ci-test-integration` | testcontainers (Postgres + Redis; needs Docker) |
| `ci-swag-check` | regenerate the OpenAPI spec and fail on drift (`git diff --exit-code -- docs/`) |
| `ci-build` | build the api binary |

Frontend equivalent: `cd frontend && npm run lint && npm run build`.

**`deploy/deploy.sh`** is the intended remote deploy step (also runnable by hand):
it builds, `up -d --remove-orphans`, waits up to 150s for `api` + `web` to become
healthy (dumping logs on failure), and prunes dangling images. Its header
references `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`/`DEPLOY_PORT` GitHub
secrets for a CD workflow that would need to be added.

---

## Secrets hygiene

- `.env` and `backend.env` are gitignored — never commit them.
- Rotate `JWT_SECRET` to force-logout everyone (all tokens invalidate). **Note:** migration 23 renumbers roles, which changes `role_id` meaning inside JWTs — rotate the secret when deploying past it.
- Rotate `GEMINI_API_KEY` / `VERIFY_API_KEY` / eID + SSO secrets from their consoles, update `backend.env`, then `docker compose up -d api`.

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

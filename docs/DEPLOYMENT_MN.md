# Deployment Runbook

> 🌐 [English](DEPLOYMENT.md) · **Монгол**

Бүрэн стекийг (Postgres + Redis + Go API + Next.js web) Docker Compose ашиглан
nginx-ийн ард нэг VPS дээр хэрхэн deploy хийх талаар. Энэ бол `https://template.dgov.mn`
дахь лавлагаа deployment-д ашигласан runbook юм.

Холбоотой: [CONFIGURATION_MN.md](CONFIGURATION_MN.md) (env-var-ийн бүрэн лавлагаа) · [DATABASE_MN.md](DATABASE_MN.md) · [SECURITY_MN.md](SECURITY_MN.md)

---

## Топологи

```
Internet ──▶ nginx (80/443, TLS via Let's Encrypt)
                │ proxy_pass
                ▼
        web  127.0.0.1:${WEB_PORT}   (Next.js BFF — the ONLY exposed container)
                │ BACKEND_URL=http://api:8080   (internal compose network)
                ▼
        api ──▶ db (Postgres 16) + redis (7)    (no public ports)
```

Хөтөч зөвхөн `web`-т хүрдэг; `api`, `db`, `redis` нь дотоод compose network дээр
хэвээр үлддэг. Нэг удаагийн `migrate` container нь `up` бүрд SQL migration-уудыг
хэрэгжүүлээд гарна.

---

## Compose стек (`docker-compose.yml`)

Project name нь `temp-gerege-mn`, нэрлэсэн нэг volume `dbdata`. Зөвхөн `web` нь
host port нийтэлдэг (зөвхөн loopback).

| Service | Image / build | Exposed | depends_on | Тэмдэглэл |
|---------|---------------|---------|------------|-------|
| **db** | `postgres:16-alpine` | internal 5432 | — | `dbdata` volume + `initdb` mount; `pg_isready` healthcheck |
| **redis** | `redis:7-alpine` (`--requirepass`, persistence байхгүй) | internal 6379 | — | зөвхөн санах ойд |
| **migrate** | build `./backend` | — | `db: healthy` | нэг удаагийн `/app/migrate -up`, дараа нь гарна (`restart: "no"`); **superuser**-ээр холбогдоно |
| **api** | build `./backend` (`/app/api`) | internal 8080 | db, redis healthy + `migrate: completed` | **non-superuser** `app_user`-ээр холбогдоно (compose нь түүний DSN-г дарж бичдэг) |
| **web** | build `./frontend` | `127.0.0.1:${WEB_PORT:-3007}:3000` | `api: healthy` | Next.js standalone |

**Ачаалах дараалал:** db + redis healthy → `migrate` ажиллаж, 0-ээр гарах ёстой →
`api` эхэлж, healthcheck-ээ давна → `web` эхэлнэ.

**RLS-д чухал override:** compose нь api-ийн DB DSN-г `${APP_DB_DSN}` (хамгийн бага
эрхтэй role) болгож тохируулдаг бол `migrate` нь `backend.env`-ээс superuser DSN-г
хадгална. Яг энэ л RLS-ийг бодитоор хэрэгжүүлдэг — [DATABASE_MN.md](DATABASE_MN.md) §3 & §7-г үзнэ үү.

---

## 1. Урьдчилсан шаардлага

- Docker + compose plugin суулгасан VPS (`docker compose version`).
- Host дээр nginx + certbot (эсвэл TLS-ийг терминаци хийдэг ямар ч reverse proxy).
- Server-руу заасан DNS A record.

## 2. Кодыг татах

```bash
git clone <repo-url> /srv/template-gerege-mn
cd /srv/template-gerege-mn
```

## 3. Хоёр env файл үүсгэх (хоёулаа gitignored)

Нууц түлхүүрүүдийг `openssl rand -hex 24`-ээр үүсгэ. Хувьсагч бүрийн талаар
[CONFIGURATION_MN.md](CONFIGURATION_MN.md)-г үзнэ үү.

**`./.env`** — compose interpolation (`${...}` docker-compose.yml дотор):

```env
POSTGRES_USER=postgres            # superuser — зөвхөн migrate ашигладаг
POSTGRES_PASSWORD=<random>
POSTGRES_DB=gerege_template
APP_DB_USER=app_user              # api холбогддог хамгийн бага эрхтэй role
APP_DB_PASSWORD=<random>
APP_DB_DSN=host=db port=5432 user=app_user password=<same> dbname=gerege_template sslmode=disable
REDIS_PASS=<random>
APP_ORIGIN=https://your.domain.mn # яг нийтийн origin (CSRF origin шалгалт)
WEB_PORT=3007                     # nginx proxy хийдэг loopback port
```

**`./backend.env`** — `api` + `migrate`-т `/app/.env` дээр mount хийгдэнэ:

```env
PORT=8080
ENVIRONMENT=development           # dev горим зориудаар: дотоод DB-д TLS байхгүй
                                  # (prod guard нь sslmode=verify-full шаарддаг);
                                  # TLS нь nginx дээр терминаци хийгдэнэ
DB_POSTGRE_DRIVER=postgres
DB_POSTGRE_DSN=postgres://postgres:<POSTGRES_PASSWORD>@db:5432/gerege_template?sslmode=disable
                                  # ^ superuser DSN, MIGRATE ашигладаг; api нь APP_DB_DSN-ээр дарж бичнэ
JWT_SECRET=<≥32 random chars>
JWT_EXPIRED=24                    # цаг (1–24)
JWT_ISSUER=your.domain.mn
JWT_REFRESH_EXPIRED=7             # хоног
BCRYPT_COST=12
REDIS_HOST=redis:6379
REDIS_PASS=<same as .env>
REDIS_EXPIRED=5                   # минут
ALLOWED_ORIGINS=https://your.domain.mn
TRUSTED_PROXIES=172.16.0.0/12,127.0.0.1   # nginx-ийн ард ЗААВАЛ шаардлагатай, эс бөгөөс per-IP
                                  # rate limit-ууд нэг bucket болж нурна
# feature түлхүүрүүд — хоосон = feature идэвхгүй (boot алдаа биш) хэрэв prod-д шаардлагатай биш бол:
VERIFY_API_BASE=https://verify.gecloud.mn/v1
VERIFY_API_KEY=<gck_live_…>       # OTP; production-д шаардлагатай
EID_RP_UUID=…  EID_RP_SECRET=…    # eID login
GEMINI_API_KEY=<AIza…>            # AI features
```

> Яагаад `ENVIRONMENT=development` гэж? Дотоод compose Postgres-д TLS байхгүй бөгөөд
> production guard нь `sslmode=disable`-г татгалздаг. Оронд нь TLS нь nginx дээр
> терминаци хийгддэг тул стек нь backend-ийг зориудаар dev горимд ажиллуулдаг.
> Бусад бүх зүйл (RLS boot guard, HSTS-ээс бусад security header-ууд) хэвээр
> үйлчилнэ.

## 4. Яагаад хоёр DB role (эхний boot-оос өмнө уншина уу)

RLS нь **superuser-ууд дээр чимээгүйхэн алгасагддаг** тул стек хоёр role ашигладаг:

- `migrate` → `POSTGRES_USER` (superuser — `CREATE EXTENSION`, RLS DDL-д шаардлагатай).
- `api` → `APP_DB_USER` (`NOSUPERUSER NOBYPASSRLS`), `backend/deploy/initdb/10-create-app-user.sh`-аар **хоосон data volume анх init хийгдэх үед** автоматаар үүсгэгдэнэ.

api нь **энэ зүйлийг boot дээр шалгадаг**: superuser/BYPASSRLS role нь production-д
эхлэлт бүтэлгүйтүүлж, development-д анхааруулдаг. *Одоо байгаа* database дээр role +
grant-уудыг гараар үүсгэнэ (initdb script-ийг хуулбарла). [DATABASE_MN.md](DATABASE_MN.md) §7-г үзнэ үү.

## 5. Эхний deploy

```bash
docker compose up -d --build      # api+web build, migration ажиллуулж, бүгдийг эхлүүлнэ
docker compose ps                 # db/redis/api/web healthy, migrate Exited (0) байхыг хүлээ
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

Дараа нь TLS-ийн тулд `certbot --nginx -d your.domain.mn`. Стек нь
`COOKIE_SECURE=true` тохируулдаг тул site нь **заавал** HTTPS-ээр үйлчлэгдэх ёстой,
эс бөгөөс хөтчүүд auth cookie-г хаядаг.

## 6. Баталгаажуулах

```bash
docker compose ps                                      # бүгд healthy
docker logs temp-gerege-mn-migrate-1 | tail -3         # "migration [up] success"
curl -s -o /dev/null -w '%{http_code}\n' https://your.domain.mn/   # 200
BASE=https://your.domain.mn scripts/smoke-test.sh      # гадаад black-box шалгалтууд
```

`scripts/smoke-test.sh` нь HTTPS 200, HTTP→HTTPS redirect, HSTS/CSP/nosniff
header-ууд, eID QR + РД push эхлэлт, `x-dgov-csrf` header-гүй үед CSRF 403, болон
нэвтрээгүй үед `/api/rbac/me` 401 гэдгийг баталгаажуулдаг.

## 7. Шинэчлэх

```bash
git pull --ff-only origin main
docker compose build              # api + web + migrate
docker compose up -d              # өөрчлөгдсөн container-уудыг дахин үүсгэнэ; migrate дахин ажиллана
                                  # (аль хэдийн хэрэгжсэн файлууд алгасагдана)
```

`db` болон `redis` ажилласаар байна — өгөгдөл хөндөгдөхгүй. Зөвхөн config өөрчлөлт
үү? env файлыг засаад `docker compose up -d api web`.

## 8. Rollback

```bash
git log --oneline                 # сүүлийн зөв commit-ийг ол
git checkout <commit> -- .        # эсвэл: git reset --hard <commit>
docker compose build && docker compose up -d
```

Энэ урсгалд SQL migration-ууд зөвхөн урагшаа явдаг; нэгийг нь буцаахын тулд кодыг
буцаахаас өмнө тохирох `N_*.down.sql`-г гараар хэрэгжүүл.

## Health & operator endpoint-ууд (api :8080)

| Endpoint | Зорилго |
|----------|---------|
| `GET /health` | Liveness — үргэлж 200 (dependency шалгалтгүй). |
| `GET /ready` | Readiness — pgx + redis-т ping илгээдэг; аль нэг нь унасан бол 503. |
| `GET /metrics` | Prometheus (DB pool статистиктай). Prod-д `Bearer OBSERVABILITY_TOKEN`-ий ард (эс бөгөөс 404). |
| `GET /swagger/doc.json` | OpenAPI spec. `/metrics`-тэй ижил хамгаалалт. |

Container healthcheck нь `/health`-руу GET хийдэг зөвхөн stdlib-т суурилсан жижигхэн
`/app/healthcheck` binary (distroless image-д shell/curl байхгүй).

---

## CI / CD

> **Бодит байдлын тэмдэглэл:** энэ repo-д **`.github/` directory байхгүй**. CLAUDE.md
> болон хуучин deploy runbook-д тайлбарласан CI pipeline (gofmt, `go test -race`,
> swag drift, frontend lint/build, gitleaks, болон SSH deploy job) нь **workflow
> файл болж байхгүй**. Автомат хамгаалалтад найдахаасаа өмнө workflow нэмнэ үү.

Албан ёсны, дахин давтагдах боломжтой CI гэйтүүд **`backend/Makefile`** дотор байдаг
— тэдгээрийг локалаар `make pre-push`-ээр ажиллуул (= `ci-lint ci-test ci-swag-check ci-build`):

| Target | Ажиллуулдаг |
|--------|------|
| `ci-lint` | `golangci-lint run ./...` |
| `ci-test` | `go test -race -coverprofile=coverage.out ./...` |
| `ci-test-integration` | testcontainers (Postgres + Redis; Docker шаардлагатай) |
| `ci-swag-check` | OpenAPI spec-ийг дахин үүсгэж, drift дээр бүтэлгүйтдэг (`git diff --exit-code -- docs/`) |
| `ci-build` | api binary build хийдэг |

Frontend-ийн адилтгал: `cd frontend && npm run lint && npm run build`.

**`deploy/deploy.sh`** нь зорьсон remote deploy алхам (гараар бас ажиллуулж болно):
энэ нь build хийж, `up -d --remove-orphans` хийж, `api` + `web` healthy болтол 150s
хүртэл хүлээж (бүтэлгүйтэл дээр log-уудыг хэвлэдэг), сул dangling image-уудыг цэвэрлэдэг.
Түүний header нь нэмэх шаардлагатай CD workflow-д зориулсан
`DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`/`DEPLOY_PORT` GitHub secret-уудыг лавладаг.

---

## Нууц мэдээллийн эрүүл ахуй

- `.env` болон `backend.env` нь gitignored — тэдгээрийг хэзээ ч commit хийж болохгүй.
- Бүгдийг албадан гаргахын тулд `JWT_SECRET`-г эргүүл (бүх token хүчингүй болно). **Тэмдэглэл:** migration 23 нь role-уудыг дахин дугаарладаг бөгөөд энэ нь JWT доторх `role_id`-ийн утгыг өөрчилдөг — үүнийг давж deploy хийхдээ secret-ийг эргүүлээрэй.
- `GEMINI_API_KEY` / `VERIFY_API_KEY` / eID + SSO secret-уудыг тэдгээрийн console-оос эргүүлж, `backend.env`-г шинэчлээд дараа нь `docker compose up -d api`.

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

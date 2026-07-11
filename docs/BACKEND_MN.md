# Backend-ийн гүнзгий судалгаа

> 🌐 [English](BACKEND.md) · **Монгол**

Go API: Clean Architecture, гар аргаар хийсэн dependency injection, chi HTTP давхарга,
middleware-үүд, domain загварууд болон `pkg/` client-үүд. Технологийн стек: **chi (net/http) ·
pgx (pgxpool) · PostgreSQL · Redis**, ORM ашиглаагүй.

Холбоотой: [ARCHITECTURE.md](ARCHITECTURE_MN.md) · [DATABASE.md](DATABASE_MN.md) · [SECURITY.md](SECURITY_MN.md) · [API_REFERENCE.md](API_REFERENCE_MN.md)

Гарал үүсэл: backend нь [snykk/go-rest-boilerplate](https://github.com/snykk/go-rest-boilerplate)
(MIT)-оос гаралтай бөгөөд Gin → chi, sqlx → pgx болгон шилжүүлсэн.

---

## 1. Clean Architecture ба dependency-ийн урсгал

```
handler ─▶ usecase ─▶ repository (interface) ─▶ domain
   │            │              ▲
   │            │              └── postgres adapter-ууд interface-үүдийг хэрэгжүүлдэг
   │            └── external системүүд pkg/* client-ээр (inject хийгддэг)
   └── зөвхөн HTTP асуудлууд (decode, validate, respond)
```

Бүтцийн зохион байгуулалтаар мөрдүүлдэг дүрмүүд:

- **Usecase-ууд зөвхөн `repositories/interface`-ээс хамаардаг** (package `_interface`), Postgres adapter-уудаас хэзээ ч биш.
- **`domain` дотоод юу ч import хийдэггүй** — цэвэр struct-ууд + тогтмолууд.
- External системүүд (eID, Gemini, Google, XYP, Verify OTP, SFTP) нь usecase-уудад inject хийгдсэн `pkg/*` client-үүдээр дамжин хүрдэг.

### Гар аргаар хийсэн DI — `cmd/api/server/server.go` `NewApp()`

DI framework байхгүй; холболт нь тодорхой бөгөөд дээрээс доош уншигддаг:

1. **Tracing** эхэлнэ (`observability.SetupTracing`).
2. **pgx pool** (`drivers.SetupPgxPostgres`) + DB pool-ийн статистик `/metrics`-д бүртгэгдэнэ.
3. **JWT service** (`jwt.NewJWTServiceWithRefresh`).
4. **Cache-ууд** — Redis + Ristretto.
5. **Router** (`chi.NewRouter()`) + глобал middleware гинжин холбоос (§4).
6. **AuthMiddleware** нэг удаа бүтээгдэж хуваалцагдана.
7. `/api`-ийн гадна дэд бүтцийн endpoint-ууд: `/health`, `/ready` (нээлттэй); `/metrics`, `/swagger/doc.json` (`ObservabilityGate`-ээр хамгаалагдсан).
8. **Context тус бүрийн угсралт** — жигд `repo := xpostgres.New…(pool)` → `uc := x.NewUsecase(repo, …)`. External client-ууд (`verify`, `eid`, `google`, `xyp`, `oidc`) бүтээгдэж inject хийгдэнэ. Зарим usecase нь бусад usecase-ыг нэгтгэдэг (жишээ нь `superadmin` нь `users` + `audit`-ыг ороодог; `auth` нь `users` usecase-ээс хамаардаг болохоос repo-оос нь биш).
9. **Rate limiter-ууд** бүтээгдэнэ (auth 5/мин, ai 20/мин, eID poll ~60/мин, gov-write 30/мин).
10. **Route-ууд** `/api`-ийн дор mount хийгдэнэ — тус бүр `routes.NewXRoute(...).Routes()`. Энэ бол usecase-уудыг HTTP-тэй холбодог цорын ганц цэг юм.
11. **`http.Server`** нь чангатгасан timeout-уудтай (`ReadHeaderTimeout 10s`, `ReadTimeout 30s`, `WriteTimeout 2×`, `IdleTimeout 120s`, `MaxHeaderBytes 16 KiB`).

`Run()` нь goroutine дотор үйлчилж, SIGINT/SIGTERM-ыг хүлээж, дараа нь 5 секундын graceful `Shutdown` хийж, rate-limiter goroutine-уудыг зогсоож, pool + Redis-ыг хааж, tracer-ыг flush хийдэг.

---

## 2. Директорын зураглал

### `internal/`

| Зам | Зорилго |
|------|---------|
| `apperror/` | Usecase-уудаас буцаадаг төрөлжсөн `DomainError` дугтуй (§3). |
| `business/domain/` | Цэвэр domain struct-ууд + тогтмолууд (§5). |
| `business/usecases/` | Бизнес логик — bounded context тус бүрд нэг package (доорх §-ыг үз). |
| `config/` | viper-д суурилсан config ачаалалт, default утга, шалгалт ([CONFIGURATION.md](CONFIGURATION_MN.md)-ыг үз). |
| `constants/` | Env нэрс, endpoint-ууд, error sentinel-үүд, role/user тогтмолууд. |
| `datasources/caches/` | `cache_redis.go` (auth/session төлөв), `cache_ristretto.go` (процесс доторх хэрэглэгчийн cache). |
| `datasources/drivers/` | `driver_pgx.go` — pool builder + `guardRLSEnforceable` boot guard. |
| `datasources/migration/` | SQL migration ажиллуулагч. |
| `datasources/records/` | DB мөрийн struct-ууд + record↔domain mapper-ууд. |
| `datasources/repositories/interface/` | Repository interface-үүд (package `_interface`). |
| `datasources/repositories/postgres/` | Гараар бичсэн pgx adapter-ууд (domain тус бүрд нэг директор). |
| `datasources/rls/` | Context дотор RLS identity-г зөөдөг leaf package. |
| `http/auth/` | `CurrentUserFromContext` туслах функц. |
| `http/datatransfers/{requests,responses}/` | HTTP DTO-ууд. |
| `http/handlers/v1/` | Base response туслахууд + domain тус бүрийн handler фолдерууд. |
| `http/middlewares/` | chi middleware-үүд (§4). |
| `http/routes/` | domain тус бүрд нэг `route_*.go` — mount + middleware/limiter хавсаргах. |
| `test/{mocks,testenv}/` | Mock-ууд + testcontainer туслахууд. |

### `pkg/` — external client-ууд ба primitive-үүд

| Package | Үүрэг |
|---------|------|
| `jwt` | HS256 access + refresh token-ууд; `ParseToken` нь `UserID`, `ID`(jti), `IsAdmin`, `RoleID`-г буцаана. |
| `gemini` | SDK-гүй Gemini REST client (chat + function-calling + TTS); `wav.go` нь PCM → WAV болгон ороодог. |
| `eid` | eID Mongolia RP client (start/poll, хүний хураангуй/certs/devices/activity, org reps/signers); `eid_pki.go` cert туслахууд. |
| `oidc` | Хамгийн бага dgov SSO (Ory Hydra) Authorization-Code + PKCE client. |
| `google` | SDK-гүй Google OAuth2/OIDC (code exchange, userinfo). |
| `xyp` | xyp.dgov.mn org-registry хайлт (HTTP Basic; сонголттой). |
| `gspace` | Хэрэглэгч тус бүрийн зам тусгаарлалттай SFTP хадгалалтын client. |
| `verify` | GeregeCloud Verify OTP илгээх/шалгах client. |
| `audit` | Hash-гинжлэсэн зөвхөн-нэмэх audit primitive-үүд (`chain.go`). |
| `observability` | Prometheus collector-ууд + OTel tracer тохиргоо. |
| `validators` | Struct-tag payload шалгалт → `*ValidationErrors` (HTTP 422). |
| `logger` | zap-д суурилсан бүтэцтэй логжуулалт (dev дээр console, prod дээр JSON). |
| `clock` | Тестэд зориулсан `time.Now()` абстракц. |
| `helpers` | bcrypt hash/compare, OTP үүсгэх, бусад. |

### Usecase-ууд (`internal/business/usecases/`)

`ai`, `assets`, `audit`, `auth`, `core`, `gateway`, `gov`, `gspace`,
`integrations`, `org`, `rbac`, `security`, `sign`, `sso`, `superadmin`, `users`.
Онцлохууд:

- **auth** — хамгийн том; eID нэвтрэлтийн амьдралын мөчлөг (`EIDStart`, `EIDStartByNationalID`, `EIDPoll`), session (`Refresh`, `Logout`), Google (`GoogleLogin`, холболт салгах), eID org холболт + signers, eID профайл унших. Үндсэн буух хуудасны нэвтрэлт нь DAN SSO (`usecases/sso`-г үзнэ үү), энэ нь өөрөө eID-д тулгуурладаг; шууд eID нэвтрэлт мөн холбогдсон.
- **users** — хэрэглэгчийн хадгалалт/хайлт, eID upsert (`UpsertFromEID`), Google холбох/салгах, role/active/delete admin үйлдлүүд (Ristretto-оор cache-зөв).
- **ai** — function-calling бүхий Gemini chat, prompt admin, ярианы `Transcribe`/`Speak`, `Translate`.
- **rbac** — role/permission CRUD + `Resolve(roleID)` (RBAC middleware ашигладаг).
- **gov** — иргэний үйлчилгээний портал (үйлчилгээний каталог + хэрэглэгч тус бүрийн өргөдөл/лавлагаа/мэдэгдэл/төлбөр/цаг захиалга).
- **gateway** — API-gateway admin CRUD + request-log жагсаалт + тойм.
- **integrations** — гуравдагч талын OAuth token-ий сан, AES-256-GCM-ээр шифрлэгдсэн (`integrations_crypto.go`).
- **sign** — eID `/v3`-ээр PAdES PDF гарын үсэг (`Init`, `Poll`, `Download`).
- **sso** — dgov OIDC нэвтрэлт (`Start`, `Complete`, `CompleteNative` PKCE).
- **superadmin** — admin хэрэглэгчдийг удирдах (audit бичдэг).

### Repository-ууд (`datasources/repositories/postgres/`)

`ai`, `audit`, `gateway`, `gov`, `org`, `orgstamp`, `rbac`, `security`,
`ssouser`, `userintegrations`, `users`. Бүгд гараар бичсэн pgx. Канон
`withRLS` transaction wrapper нь `users/users_postgres.go`-д байрладаг.
"Нэг файлд нэг method" гэсэн конвенц нь diff-ийг нарийн байлгадаг (жишээ нь
`users_get_by_email.go`, `users_eid.go`, `users_update_role.go`).

---

## 3. HTTP давхарга

Base туслахууд: `internal/http/handlers/v1/handler_base_response.go`.

- **`HandlerFunc = func(w, r) error`**, **`Wrap(h)`**-ээр `http.HandlerFunc` болгон дасгагдана. Handler-ууд өөрийн хариултаа бичээд зөвхөн write/encode алдаануудыг буцаадаг (`Wrap` тэдгээрийг логждог).
- **`BaseResponse`** дугтуй: `{status, message, data, request_id}`.
- **`DecodeBody(r, dst)`** — `io.LimitReader(body, 1 MiB)` дээрх `json.Decoder`, `DisallowUnknownFields()` бүхий; тодорхойгүй талбар болон nil body-г татгалздаг.
- **Response туслахууд** — `NewSuccessResponse`, `NewErrorResponse`, `NewAbortResponse` (401).
- **Шалгалт** — `validators.ValidatePayloads` (struct tag-ууд); `RespondWithError` нь `*ValidationErrors`-ыг тусгайлан → **422** болгож talбар тус бүрийн `data.errors`-той болгодог.

### Алдааны загвар (`internal/apperror/error.go`)

`DomainError{Type, Message, Cause}` нь `ErrorType` enum-тай. `mapDomainErrorToHTTP` дараах байдлаар зурагладаг:

| Төрөл | HTTP |
|------|------|
| NotFound | 404 |
| Unauthorized | 401 |
| Forbidden | 403 |
| Conflict | 409 |
| BadRequest | 400 |
| Internal / DomainError биш | 500 |

Аливаа status ≥ 500-ийн хувьд `RespondWithError` нь **бодит `Cause`-ыг логждог** (зам + request_id-тай) бөгөөд **client-ийн мессежийг `"internal server error"`-оор солино**. `apperror.InternalCause(cause)` constructor нь лог-д зориулсан дотоод шалтгааныг хадгалж, гадагш нь тогтмол, аюулгүй мессеж харуулдаг — ингэснээр library-ийн алдаа client-үүдэд хэзээ ч хүрэхгүй.

### Routing

chi. Domain тус бүрд struct (handler + dependency-үүд) болон `/v1/<domain>`-ийн дор mount хийж middleware/limiter хавсаргадаг `Routes()` method-той `route_*.go` файл байдаг. Жишээ — `route_auth.go`: group-түвшний 4 KiB body хязгаар + `ServiceRLSContext()`, rate-хязгаартай дэд групп (`/eid/start`, `/eid/start-id`, `/google`, `/refresh`, `/logout`), auth-хамгаалагдсан дэд групп, болон илүү сул хязгаартай `/eid/poll` дэд групп. `routes_authz_matrix_test.go` нь эрх олголтын матрицыг баталгаажуулдаг.

---

## 4. Middleware-үүд (`internal/http/middlewares/`)

Глобал гинжин холбоосын дараалал (санаатай):

```
Tracing → RequestID → Recoverer → Metrics → SecurityHeaders → CORS
        → BodySizeLimit(default) → AccessLog → Timeout
```

| Middleware | Зан төлөв |
|------------|-----------|
| `TracingMiddleware` | Хүсэлт тус бүрд нэг OpenTelemetry span. |
| `RequestIDMiddleware` | Client-ийн `X-Request-ID`-г шалгаж/хязгаарлаж (лог-injection-ээс сэргийлэх); correlation id inject хийдэг. |
| `RecovererMiddleware` | panic-уудыг барьж, stack + request_id-г логжиж, нэгдсэн 500 буцаана. |
| `MetricsMiddleware` | Route pattern тус бүрд Prometheus тоолол + үргэлжлэх хугацаа. |
| `SecurityHeadersMiddleware` | Хариулт бүр дээр browser-ийн аюулгүй байдлын header-ууд ([SECURITY.md](SECURITY_MN.md)-ыг үз). |
| `CORSMiddleware` | `AllowedOriginsList()`-ээс CORS; ганц-origin тусгал. |
| `BodySizeLimitMiddleware(max)` | Body-г хязгаарлана — глобалд `DefaultBodyMaxBytes`, auth дээр `AuthBodyMaxBytes` (4 KiB). |
| `AccessLogMiddleware` | Хүсэлт тус бүрд нэг access-log мөр. |
| `TimeoutMiddleware(d)` | Хүсэлт тус бүрийн хязгаар (`DefaultRequestTimeout` 30s) — slowloris / OWASP API4. |
| `NewAuthMiddleware(jwt, redis, isAdmin)` | Bearer parse → validate; fail-closed Redis шалгалтууд (logout deny-list, нууц үг эргэлтийн cutoff → Redis алдаа гарвал 503); `CurrentUser` **болон** RLS identity-г inject хийдэг. |
| `RequirePermission` / `RequireAdmin` / `RequireSuperAdmin` | RBAC эрх олголт (403 fail-closed; permission шалгалт дээр admin bypass; superadmin gate нь энгийн admin-уудыг ч татгалздаг). |
| `ServiceRLSContext` | pre-auth урсгалуудад `rls.WithService`-ыг тамгалдаг; хамгаалагдсан route дээр AuthMiddleware-ээр давхарлан бичигдэнэ. |
| `ObservabilityGate(isProd, token)` | `/metrics` + `/swagger/doc.json`-ыг хамгаалдаг — prod дээр bearer шаардана, эс бөгөөс 404. |
| `RateLimiter` | client-IP тус бүрийн `x/time/rate` limiter + цэвэрлэх goroutine. |
| `clientIP` | `X-Forwarded-For`-ыг зөвхөн `TRUSTED_PROXIES` CIDR-ээс итгэдэг, эс бөгөөс peer `RemoteAddr`. |

---

## 5. Domain загварууд (`internal/business/domain/`)

Цэвэр struct-ууд, дотоод import байхгүй. Онцлох: `User` + `GoogleAccount`
(`domain_users.go`) нь role тогтмолуудтай **`RoleSuperAdmin=1, RoleAdmin=2,
RoleUser=4`** (бит-маягийн завсрыг анзаар; manager=3). Бусад файлууд:
`domain_ai.go`, `domain_gateway.go`, `domain_rbac.go`, `domain_org.go`,
`domain_gov.go`, `domain_user_integrations.go`.

---

## 6. Config ба entrypoint-ууд

- **Config** (`internal/config/config.go`) — viper нь `.env` файлыг уншдаг (файл байхгүй байсан ч зүгээр, 12-factor); env-only нууцуудад `AutomaticEnv` + тодорхой `BindEnv`. Урсгал: read → unmarshal → `applyDefaults` → `validate`. Хувьсагчийн бүрэн лавлагаа болон production guard-уудын хувьд [CONFIGURATION.md](CONFIGURATION_MN.md)-ыг үз.
- **`cmd/api`** — API server. `main()` нь `GOMAXPROCS = NumCPU/2` тохируулж, `server.NewApp()` бүтээж, ажиллуулна. swagger `@title`/`@BasePath /api/v1`/`BearerAuth` annotation-уудыг агуулна.
- **`cmd/migration`** — `-up`/`-down` flag-ууд; дугаарласан SQL migration-уудыг ажиллуулна. AutoMigrate байхгүй.
- **`cmd/seed`** — нэг transaction дотор хоёр demo хэрэглэгч seed хийдэг (бусад бүх seed өгөгдөл migration-уудад байдаг).
- **`cmd/healthcheck`** — distroless image-д зориулсан stdlib-only жижигхэн probe (GET `/health`, exit 0/1).

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

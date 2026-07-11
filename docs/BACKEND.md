# Backend Deep Dive

> 🌐 **English** · [Монгол](BACKEND_MN.md)

The Go API: Clean Architecture, manual dependency injection, the chi HTTP layer,
middlewares, domain models, and the `pkg/` clients. Stack: **chi (net/http) ·
pgx (pgxpool) · PostgreSQL · Redis**, no ORM.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE.md](DATABASE.md) · [SECURITY.md](SECURITY.md) · [API_REFERENCE.md](API_REFERENCE.md)

Origin: the backend is derived from [snykk/go-rest-boilerplate](https://github.com/snykk/go-rest-boilerplate)
(MIT), ported Gin → chi and sqlx → pgx.

---

## 1. Clean Architecture & dependency flow

```
handler ─▶ usecase ─▶ repository (interface) ─▶ domain
   │            │              ▲
   │            │              └── postgres adapters implement the interfaces
   │            └── external systems via pkg/* clients (injected)
   └── HTTP concerns only (decode, validate, respond)
```

Rules enforced by the layout:

- **Usecases depend only on `repositories/interface`** (package `_interface`), never on Postgres adapters.
- **`domain` imports nothing internal** — pure structs + constants.
- External systems (eID, Gemini, Google, XYP, Verify OTP, SFTP) are reached through `pkg/*` clients injected into usecases.

### Manual DI — `cmd/api/server/server.go` `NewApp()`

There is no DI framework; wiring is explicit and reads top-to-bottom:

1. **Tracing** first (`observability.SetupTracing`).
2. **pgx pool** (`drivers.SetupPgxPostgres`) + DB pool-stats registered for `/metrics`.
3. **JWT service** (`jwt.NewJWTServiceWithRefresh`).
4. **Caches** — Redis + Ristretto.
5. **Router** (`chi.NewRouter()`) + the global middleware chain (§4).
6. **AuthMiddleware** built once and shared.
7. Infra endpoints outside `/api`: `/health`, `/ready` (open); `/metrics`, `/swagger/doc.json` (gated by `ObservabilityGate`).
8. **Per-context assembly** — uniform `repo := xpostgres.New…(pool)` → `uc := x.NewUsecase(repo, …)`. External clients (`verify`, `eid`, `google`, `xyp`, `oidc`) are constructed and injected. Some usecases compose other usecases (e.g. `superadmin` wraps `users` + `audit`; `auth` depends on the `users` usecase, not its repo).
9. **Rate limiters** created (auth 5/min, ai 20/min, eID poll ~60/min, gov-write 30/min).
10. **Routes** mounted under `/api` — each `routes.NewXRoute(...).Routes()`. This is the single point tying usecases to HTTP.
11. **`http.Server`** with hardened timeouts (`ReadHeaderTimeout 10s`, `ReadTimeout 30s`, `WriteTimeout 2×`, `IdleTimeout 120s`, `MaxHeaderBytes 16 KiB`).

`Run()` serves in a goroutine, waits for SIGINT/SIGTERM, then does a graceful 5s `Shutdown`, stops rate-limiter goroutines, closes the pool + Redis, and flushes the tracer.

---

## 2. Directory map

### `internal/`

| Path | Purpose |
|------|---------|
| `apperror/` | Typed `DomainError` envelope returned by usecases (§3). |
| `business/domain/` | Pure domain structs + constants (§5). |
| `business/usecases/` | Business logic — one package per bounded context (§ below). |
| `config/` | viper-based config load, defaults, validation (see [CONFIGURATION.md](CONFIGURATION.md)). |
| `constants/` | Env names, endpoints, error sentinels, role/user constants. |
| `datasources/caches/` | `cache_redis.go` (auth/session state), `cache_ristretto.go` (in-process user cache). |
| `datasources/drivers/` | `driver_pgx.go` — pool builder + `guardRLSEnforceable` boot guard. |
| `datasources/migration/` | SQL migration runner. |
| `datasources/records/` | DB row structs + record↔domain mappers. |
| `datasources/repositories/interface/` | Repository interfaces (package `_interface`). |
| `datasources/repositories/postgres/` | Hand-written pgx adapters (one dir per domain). |
| `datasources/rls/` | Leaf package carrying RLS identity in context. |
| `http/auth/` | `CurrentUserFromContext` helper. |
| `http/datatransfers/{requests,responses}/` | HTTP DTOs. |
| `http/handlers/v1/` | Base response helpers + per-domain handler folders. |
| `http/middlewares/` | chi middlewares (§4). |
| `http/routes/` | One `route_*.go` per domain — mounts + attaches middleware/limiters. |
| `test/{mocks,testenv}/` | Mocks + testcontainer helpers. |

### `pkg/` — external clients & primitives

| Package | Role |
|---------|------|
| `jwt` | HS256 access + refresh tokens; `ParseToken` returns `UserID`, `ID`(jti), `IsAdmin`, `RoleID`. |
| `gemini` | SDK-free Gemini REST client (chat + function-calling + TTS); `wav.go` wraps PCM → WAV. |
| `eid` | eID Mongolia RP client (start/poll, person summary/certs/devices/activity, org reps/signers); `eid_pki.go` cert helpers. |
| `oidc` | Minimal dgov SSO (Ory Hydra) Authorization-Code + PKCE client. |
| `google` | SDK-free Google OAuth2/OIDC (code exchange, userinfo). |
| `xyp` | xyp.dgov.mn org-registry lookup (HTTP Basic; optional). |
| `gspace` | SFTP storage client with per-user path isolation. |
| `verify` | GeregeCloud Verify OTP send/check client. |
| `audit` | Hash-chained append-only audit primitives (`chain.go`). |
| `observability` | Prometheus collectors + OTel tracer setup. |
| `validators` | Struct-tag payload validation → `*ValidationErrors` (HTTP 422). |
| `logger` | zap-backed structured logging (console in dev, JSON in prod). |
| `clock` | `time.Now()` abstraction for tests. |
| `helpers` | bcrypt hash/compare, OTP generation, misc. |

### Usecases (`internal/business/usecases/`)

`ai`, `assets`, `audit`, `auth`, `core`, `gateway`, `gov`, `gspace`,
`integrations`, `org`, `rbac`, `security`, `sign`, `sso`, `superadmin`, `users`.
Highlights:

- **auth** — the largest; eID login lifecycle (`EIDStart`, `EIDStartByNationalID`, `EIDPoll`), session (`Refresh`, `Logout`), Google (`GoogleLogin`, unlink), eID org linking + signers, eID profile reads. eID is the primary login path.
- **users** — user store/lookup, eID upsert (`UpsertFromEID`), Google link/unlink, role/active/delete admin ops (cache-correct via Ristretto).
- **ai** — Gemini chat with function-calling, prompt admin, speech `Transcribe`/`Speak`, `Translate`.
- **rbac** — role/permission CRUD + `Resolve(roleID)` (used by the RBAC middleware).
- **gov** — citizen services portal (services catalogue + per-user applications/references/notifications/payments/appointments).
- **gateway** — API-gateway admin CRUD + request-log listing + overview.
- **integrations** — third-party OAuth token vault, AES-256-GCM encrypted (`integrations_crypto.go`).
- **sign** — PAdES PDF signing via eID `/v3` (`Init`, `Poll`, `Download`).
- **sso** — dgov OIDC login (`Start`, `Complete`, `CompleteNative` PKCE).
- **superadmin** — manage admin users (writes audit).

### Repositories (`datasources/repositories/postgres/`)

`ai`, `audit`, `gateway`, `gov`, `org`, `orgstamp`, `rbac`, `security`,
`ssouser`, `userintegrations`, `users`. All hand-written pgx. The canonical
`withRLS` transaction wrapper lives in `users/users_postgres.go`. The
"one method per file" convention keeps diffs narrow (e.g.
`users_get_by_email.go`, `users_eid.go`, `users_update_role.go`).

---

## 3. HTTP layer

Base helpers: `internal/http/handlers/v1/handler_base_response.go`.

- **`HandlerFunc = func(w, r) error`**, adapted by **`Wrap(h)`** into `http.HandlerFunc`. Handlers write their own response and return only write/encode errors (which `Wrap` logs).
- **`BaseResponse`** envelope: `{status, message, data, request_id}`.
- **`DecodeBody(r, dst)`** — `json.Decoder` over `io.LimitReader(body, 1 MiB)` with `DisallowUnknownFields()`; rejects unknown fields and nil bodies.
- **Response helpers** — `NewSuccessResponse`, `NewErrorResponse`, `NewAbortResponse` (401).
- **Validation** — `validators.ValidatePayloads` (struct tags); `RespondWithError` special-cases `*ValidationErrors` → **422** with per-field `data.errors`.

### Error model (`internal/apperror/error.go`)

`DomainError{Type, Message, Cause}` with an `ErrorType` enum. `mapDomainErrorToHTTP` maps:

| Type | HTTP |
|------|------|
| NotFound | 404 |
| Unauthorized | 401 |
| Forbidden | 403 |
| Conflict | 409 |
| BadRequest | 400 |
| Internal / non-DomainError | 500 |

For any status ≥ 500, `RespondWithError` **logs the real `Cause`** (with path + request_id) and **replaces the client message with `"internal server error"`**. The `apperror.InternalCause(cause)` constructor keeps the internal cause for logs while presenting a fixed, safe message — so library errors never reach clients.

### Routing

chi. Each domain has a `route_*.go` file with a struct (handler + deps) and a
`Routes()` method that mounts under `/v1/<domain>` and attaches
middleware/limiters. Example — `route_auth.go`: a group-level 4 KiB body limit +
`ServiceRLSContext()`, a rate-limited subgroup (`/eid/start`, `/eid/start-id`,
`/google`, `/refresh`, `/logout`), an auth-protected subgroup, and a
looser-limited `/eid/poll` subgroup. `routes_authz_matrix_test.go` asserts the
authorization matrix.

---

## 4. Middlewares (`internal/http/middlewares/`)

Global chain order (intentional):

```
Tracing → RequestID → Recoverer → Metrics → SecurityHeaders → CORS
        → BodySizeLimit(default) → AccessLog → Timeout
```

| Middleware | Behaviour |
|------------|-----------|
| `TracingMiddleware` | One OpenTelemetry span per request. |
| `RequestIDMiddleware` | Validates/limits client `X-Request-ID` (anti log-injection); injects correlation id. |
| `RecovererMiddleware` | Catches panics, logs stack + request_id, returns a unified 500. |
| `MetricsMiddleware` | Prometheus count + duration per route pattern. |
| `SecurityHeadersMiddleware` | Browser security headers on every response (see [SECURITY.md](SECURITY.md)). |
| `CORSMiddleware` | CORS from `AllowedOriginsList()`; single-origin reflection. |
| `BodySizeLimitMiddleware(max)` | Caps body — `DefaultBodyMaxBytes` global, `AuthBodyMaxBytes` (4 KiB) on auth. |
| `AccessLogMiddleware` | One access-log line per request. |
| `TimeoutMiddleware(d)` | Per-request cap (`DefaultRequestTimeout` 30s) — slowloris / OWASP API4. |
| `NewAuthMiddleware(jwt, redis, isAdmin)` | Bearer parse → validate; fail-closed Redis checks (logout deny-list, password-rotation cutoff → 503 on Redis error); injects `CurrentUser` **and** RLS identity. |
| `RequirePermission` / `RequireAdmin` / `RequireSuperAdmin` | RBAC authz (403 fail-closed; admin bypass on permission checks; superadmin gate rejects even plain admins). |
| `ServiceRLSContext` | Stamps `rls.WithService` for pre-auth flows; overridden by AuthMiddleware on protected routes. |
| `ObservabilityGate(isProd, token)` | Guards `/metrics` + `/swagger/doc.json` — prod requires bearer, else 404. |
| `RateLimiter` | `x/time/rate` per-client-IP limiter + cleanup goroutine. |
| `clientIP` | Trusts `X-Forwarded-For` only from `TRUSTED_PROXIES` CIDRs, else peer `RemoteAddr`. |

---

## 5. Domain models (`internal/business/domain/`)

Pure structs, no internal imports. Notable: `User` + `GoogleAccount`
(`domain_users.go`) with role constants **`RoleSuperAdmin=1, RoleAdmin=2,
RoleUser=4`** (note the bit-style gap; manager=3). Other files:
`domain_ai.go`, `domain_gateway.go`, `domain_rbac.go`, `domain_org.go`,
`domain_gov.go`, `domain_user_integrations.go`.

---

## 6. Config & entrypoints

- **Config** (`internal/config/config.go`) — viper reads a `.env` file (missing file is fine, 12-factor); `AutomaticEnv` + explicit `BindEnv` for env-only secrets. Flow: read → unmarshal → `applyDefaults` → `validate`. See [CONFIGURATION.md](CONFIGURATION.md) for the full variable reference and the production guards.
- **`cmd/api`** — the API server. `main()` sets `GOMAXPROCS = NumCPU/2`, builds `server.NewApp()`, runs it. Holds the swagger `@title`/`@BasePath /api/v1`/`BearerAuth` annotations.
- **`cmd/migration`** — `-up`/`-down` flags; runs the numbered SQL migrations. No AutoMigrate.
- **`cmd/seed`** — seeds two demo users in one transaction (all other seed data is in the migrations).
- **`cmd/healthcheck`** — a tiny stdlib-only probe for the distroless image (GET `/health`, exit 0/1).

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

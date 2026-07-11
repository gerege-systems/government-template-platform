# Security

> 🌐 **English** · [Монгол](SECURITY_MN.md)

Implemented security controls across the stack: the JWT auth model, RLS
tenant isolation, security headers, CORS, rate limiting, CSRF, audit logging,
input validation, and secrets handling. All facts here are verified against the
code.

> To **report** a vulnerability, see the root [SECURITY.md](../SECURITY.md).
> For the backend's ASVS roadmap and known gaps, see
> [backend/docs/SECURITY.md](../backend/docs/SECURITY.md).

Related: [BACKEND.md](BACKEND.md) · [DATABASE.md](DATABASE.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 1. Authentication model — JWT with rotation & revocation

Core: `backend/pkg/jwt/jwt.go`.

- **HS256** (HMAC-SHA256), single shared `JWT_SECRET`.
- **Two token kinds** distinguished by a signed `Kind` claim. `ParseToken` rejects refresh tokens and `ParseRefreshToken` rejects access tokens — a stolen refresh token can't be replayed as an access token because `Kind` is inside the signed payload.
- **Parse hardening**: the keyfunc rejects any non-HMAC method (alg-confusion defense), plus `WithValidMethods(["HS256"])`, `WithIssuer(...)` (blocks cross-service token reuse under a shared secret), and `WithExpirationRequired()`.
- **Claims**: access carries `UserID`, `IsAdmin`, `RoleID`, `Email`, `jti`, `exp`, `iss`, `iat`; refresh deliberately carries **no** role/admin flag.
- **Lifetimes**: access = `JWT_EXPIRED` hours (bound 1–24), refresh = `JWT_REFRESH_EXPIRED` days (bound 1–365, default 7).

### Issuance / rotation / revocation

| Action | Behaviour |
|--------|-----------|
| **Login** | Mints a pair; stores the refresh jti in Redis `refresh:<jti>` (TTL = refresh lifetime). |
| **Refresh** | **Atomic `GetDel` of `refresh:<jti>`** makes refresh single-use and closes the replay/TOCTOU window; re-checks the user (deactivated accounts stop refreshing) and the password cutoff; mints + stores a new pair. |
| **Logout** | Deletes `refresh:<jti>` (primary revocation) **and** best-effort adds the access jti to `access_deny:<jti>` (TTL = access lifetime). |
| **Password change/reset** | Writes `pwd_cutoff:<userID>` = unix-sec; refresh and the auth middleware reject any token with `iat <= cutoff` (`<=` because JWT `iat` is second-truncated). |

Refresh tokens live in **Redis only** (presence = valid); there is no
refresh-token table in Postgres.

### Login lockout & enumeration resistance

- **Per-account lockout**: a Redis counter `login_attempts:<email>` is incremented **before** user lookup (so unknown emails also count); default 10 attempts / 15-min lockout → `403`. Catches slow distributed brute-force that per-IP limiting misses.
- **Enumeration mitigation**: the unknown-email path runs a **dummy bcrypt compare** to equalize timing; "no such user" and "wrong password" both return the identical generic `401 invalid email or password`.

### Passwords & OTP

- **bcrypt** with cost from `BCRYPT_COST` (bound 10–31, default 12). Out-of-range cost falls back to `bcrypt.DefaultCost` (never panics). Password DTO rules: `min=12,max=72,strongpassword` (upper+lower+digit+special). eID/passwordless users have `Password=""` and can never log in by password.
- **OTP-verified registration**: `Register` creates an **inactive** user; code generation/hashing/sending is delegated to the GeregeCloud **Verify API** (the app only stores the returned `request_id`). A second per-email attempt counter caps OTP tries; `ForgotPassword`/`ResetPassword` follow the same pattern.

> **Current wiring note.** The password / OTP / classic register+login flows are
> fully implemented and unit-tested (`usecases/auth/*`, `handlers/v1/auth/*`) but
> are **not mounted as HTTP routes** in this build — `route_auth.go` exposes only
> eID + Google login and the session lifecycle (`refresh`/`logout`/`poll`). eID
> is the primary login. To re-enable classic login, mount the existing handlers.

---

## 2. Auth middleware (`middleware_auth.go`)

Per authenticated request, in order:

1. Require `Authorization: Bearer <token>` (exact scheme).
2. `ParseToken` (sig, issuer, exp; rejects refresh kind).
3. **Access deny-list** check `access_deny:<jti>` — **fail-closed**: a real Redis error (not a miss) returns **503**, not access.
4. **Password-rotation cutoff** `pwd_cutoff:<userID>` with `iat <= cutoff` → revoked; same fail-closed 503.
5. Privilege gate (admin mounts).
6. Injects `CurrentUser` into context **and** the RLS identity (`WithAdmin`/`WithUser`).

The revocation *checks* are fail-closed (503 on Redis error); the logout deny-list
and cutoff *writes* are best-effort (non-fatal). This asymmetry is intentional.

---

## 3. Security headers (`middleware_security.go`, global)

Set on every backend response:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-site` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` — **production only** (omitted in dev to avoid pinning HSTS on `http://localhost`) |

The **frontend** sets its own richer CSP for HTML responses (see [FRONTEND.md](FRONTEND.md) §7); the backend serves JSON APIs so its CSP is locked to `'none'`.

---

## 4. CORS (`middleware_cors.go`, global)

- Allow-list from `ALLOWED_ORIGINS` (production **requires** it non-empty).
- Reflects only exact-match origins, adds `Vary: Origin`, sets `Access-Control-Allow-Credentials: true` in allow-list mode.
- **Wildcard safety**: if the single configured origin is `*`, credentials are disabled — never `*` + credentials together.
- Methods `GET, POST, PUT, PATCH, DELETE, OPTIONS`; preflight `max-age` 12h; OPTIONS short-circuits with 204.

---

## 5. Rate limiting (`middleware_ratelimit.go`)

**In-memory** token bucket per client IP (`golang.org/x/time/rate`) — **not Redis**,
so limits are per-process, not shared across replicas. Client IP is resolved by
the trusted-proxy-aware `clientIP` (X-Forwarded-For honored only when the peer is
in `TRUSTED_PROXIES`, else `RemoteAddr` — prevents XFF spoofing of limits/audit).

| Limiter | Rate | Applied to |
|---------|------|------------|
| auth | ~5/min, burst 5 | `/v1/auth` start/google/refresh/logout |
| AI | ~20/min, burst 10 | `/v1/ai/*` (sized for ~8–10 live-translation chunks/min) |
| eID poll | 1/s, burst 30 | `/v1/auth/eid/poll` (25s long-polls) |
| gov write | ~30/min, burst 15 | gov/assets/gspace/eid-profile mutations |

Emits `X-RateLimit-*` headers and a JSON `429` + `Retry-After` when the bucket
empties. The server warns at boot if `TRUSTED_PROXIES` is empty behind a proxy
(all IPs would collapse into one bucket).

---

## 6. CSRF

The Go API is a stateless **Bearer-token** API — no cookie session auth on the
backend — so classic CSRF does not apply to token-authenticated endpoints. CSRF
protection lives in the **frontend BFF**: mutating browser calls add an
`x-dgov-csrf` header and `lib/bff.ts checkOrigin` enforces it (+ an `Origin`
match) on every mutating route. See [FRONTEND.md](FRONTEND.md) §1.

---

## 7. Row-Level Security

The core tenant-isolation mechanism — full detail in [DATABASE.md](DATABASE.md) §3. Summary:

- `ENABLE` + **`FORCE ROW LEVEL SECURITY`** on every per-user table; three-policy set (service / admin / self). No matching policy ⇒ zero rows (**fail-closed**).
- Identity is carried in context (`rls.Identity`) and published per-transaction via `SET LOCAL` GUCs (`app.user_id` / `app.user_role`) inside a `withRLS` transaction — scoped to the transaction so it can't leak across pooled connections.
- **Boot guard** (`driver_pgx.go`): if the api's DB role is `rolsuper`/`rolbypassrls` (which would silently bypass RLS), boot **fails in production**, warns in development.
- **Production TLS guard** (`config.go`): production `DB_POSTGRE_URL` must use `sslmode=verify-full` or `verify-ca`.

---

## 8. Input validation & SQL

- **Struct-tag validation** (`go-playground/validator/v10` via `ValidatePayloads`); errors reported by JSON field name → HTTP **422**; custom `strongpassword` rule.
- **Parameterized queries only** — hand-written SQL over pgx, `$N` bind params everywhere, even for dynamic filters (never string-concatenated values). No ORM. Unique-violation `23505` → Conflict.
- Emails normalized (lowercase+trim) before lookup/store.
- Body limits: global **1 MiB**, `/v1/auth` group **4 KiB** — enforced by both a Content-Length pre-check and `http.MaxBytesReader`.
- HTTP server hardening: `ReadHeaderTimeout 10s`, `ReadTimeout 30s`, `IdleTimeout 120s`, `MaxHeaderBytes 16 KiB`, plus a 30s per-request `TimeoutMiddleware` that propagates to pgx (slowloris / OWASP API4 defense).

---

## 9. Audit logging

Three independent mechanisms:

1. **Streaming security-event log** (`pkg/audit/audit.go`) — JSON lines to an `io.Writer` (default stderr). Events: register, login success/failure, logout, refresh, otp_sent/verify, password change/forgot/reset. Fields include user_id, email, ip, user_agent, request_id, trace_id.
2. **Persisted hash-chained `audit_log` table** (`pkg/audit/chain.go`) — each row's `chain_hash = SHA-256(prevHash || canonical_json(entry))`; writes serialized via `pg_advisory_xact_lock`. `VerifyChain` recomputes from genesis and returns the first tampered row. Admin-only read API; used by superadmin mutations. The frontend exposes an `/audit/verify` action.
3. **RASP-style `security_events` table** — authenticated users ingest their own events (RLS-enforced); admins list all.

---

## 10. Secrets & operator endpoints

- **Gitignored env files**: `.env`, `.env.*`, `*.env`, `backend.env` (the `*.env.example` templates are kept). Never commit secrets.
- **`JWT_SECRET` ≥ 32 chars** or config validation fails (HS256 256-bit entropy). Rotating it force-logs-out everyone.
- **Production-mandatory**: `DB_POSTGRE_URL` (verify-full/verify-ca), `ALLOWED_ORIGINS`, `VERIFY_API_KEY`; `REDIS_PASSWORD` required in all envs.
- **Operator-endpoint gate** (`middleware_observability_gate.go`): in production `/metrics` + `/swagger/doc.json` require `Authorization: Bearer <OBSERVABILITY_TOKEN>` (constant-time compared); any miss returns **404** (hides existence); empty token = fully closed. `/health` + `/ready` stay public.
- **`apperror.InternalCause`** — wherever a library/internal failure would surface (token gen, DB errors, Verify-API errors), it produces a fixed client-facing `"internal server error"` (HTTP 500) while retaining the real cause for logs. Typed errors (NotFound/Unauthorized/…) are intentionally generic.
- **Third-party OAuth tokens** in `user_integrations` are **AES-256-GCM** encrypted (`INTEGRATION_ENC_KEY`); decrypted server-side only, never sent to the browser.

---

## 11. Documentation vs. reality gaps

Two things are described elsewhere but **not present in this repo** — call them out
when hardening for production:

1. **No CI / secrets scan in-repo.** There is no `.github/` directory. The CI gates (gofmt, `go test -race`, gitleaks, govulncheck) are described in CLAUDE.md and mirrored by `backend/Makefile` (`make pre-push`), but no workflow file exists here — add one before relying on automated gates. See [DEPLOYMENT.md](DEPLOYMENT.md) §CI.
2. **Classic password/OTP login is unrouted** (see §1) — eID/Google/SSO only in this build.

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

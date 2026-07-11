# Architecture

> 🌐 **English** · [Монгол](ARCHITECTURE_MN.md)

The full-stack picture: how a request flows from the browser through the Next.js
BFF to the Go API, down to PostgreSQL/Redis and out to the national eID/SSO/AI
services — and the boundaries that keep each layer honest.

> A backend-only deep dive lives in
> [backend/docs/ARCHITECTURE.md](../backend/docs/ARCHITECTURE.md). This chapter is
> the platform view. See also [BACKEND.md](BACKEND.md), [FRONTEND.md](FRONTEND.md),
> [DATABASE.md](DATABASE.md), [SECURITY.md](SECURITY.md).

---

## 1. System overview

```
                    ┌─────────────────────────────────────────────┐
 Browser / iOS ───▶ │  Next.js 15 BFF (web)                       │
   (httpOnly        │  • same-origin /api/* route handlers only    │
    cookies,        │  • tokens in httpOnly cookies (never in JS)  │
    x-dgov-csrf)    │  • CSRF: custom header + Origin check        │
                    │  • TanStack Query data layer                 │
                    └───────────────┬─────────────────────────────┘
                                    │ server-side proxy (Bearer token)
                                    │ BACKEND_URL + /api/v1
                                    ▼
                    ┌─────────────────────────────────────────────┐
                    │  Go API (chi · net/http)                     │
                    │  handler → usecase → repository → domain     │
                    │  • JWT auth, RBAC, RLS identity              │
                    │  • middlewares: security headers, CORS,      │
                    │    rate limit, tracing, timeouts             │
                    └──────┬───────────────────────┬──────────────┘
                           │                       │
              ┌────────────▼─────┐        ┌────────▼──────────────────────┐
              │ PostgreSQL 16    │        │ External services              │
              │ • pgx, no ORM    │        │ • eID Mongolia (RP)            │
              │ • Row-Level Sec. │        │ • dgov SSO (OIDC / Hydra)      │
              │ Redis 7          │        │ • XYP registry, Gemini AI,     │
              │ • auth/session   │        │   Google OAuth, Verify OTP,    │
              │   state, OTP     │        │   Gerege Space (SFTP)          │
              └──────────────────┘        └────────────────────────────────┘
```

Two properties define the architecture:

1. **The browser never talks to the Go API directly.** It calls same-origin `/api/*` handlers; those proxy server-side. Tokens live in httpOnly cookies, so client JS can't read them (XSS-resistant), and the browser CSP `connect-src 'self'` enforces the boundary. See [FRONTEND.md](FRONTEND.md) §1.
2. **The business core never imports the web framework.** Clean Architecture keeps dependencies pointing inward. See §3.

---

## 2. Components

| Component | Tech | Role |
|-----------|------|------|
| **web** | Next.js 15, React 19, TypeScript | BFF — proxies to the API, holds the session cookies, serves the UI. No Tailwind (hand-written CSS). |
| **api** | Go, chi (net/http), pgx | The business API — auth, RBAC, RLS, all domain logic, external-service clients. |
| **db** | PostgreSQL 16 | System of record; Row-Level Security per user. |
| **redis** | Redis 7 | Auth/session state: refresh-token registry, access deny-list, OTP, rate-limit counters, password-cutoff. |
| **migrate** | Go (one-off) | Applies numbered SQL migrations, then exits. Runs as the DB superuser. |
| **iOS app** | SwiftUI | Native RP-consumer that drives eID/SSO login through the same BFF. |

---

## 3. Clean Architecture (backend)

```
handler ─▶ usecase ─▶ repository (interface) ─▶ domain
   │           │              ▲
   │           │              └── postgres adapters implement the interfaces
   │           └── external systems via pkg/* clients (injected)
   └── HTTP concerns only (decode, validate, respond)
```

- **Usecases** depend only on `repositories/interface` (package `_interface`), never on the Postgres adapters.
- **`domain`** imports nothing internal — pure structs + constants.
- Wiring is **manual DI** in `cmd/api/server/server.go` (`repo → usecase → route`), no framework. Full detail in [BACKEND.md](BACKEND.md).

---

## 4. Request lifecycle (an authenticated read)

1. A React component calls `getJSON('/api/gov/applications')` (with the `x-dgov-csrf` header for mutations).
2. The Next.js route handler runs server-side, reads the `dgov_access` cookie, and calls `authedFetch('/gov/applications')` → `BACKEND_URL/api/v1/gov/applications` with `Authorization: Bearer …`.
3. The Go middleware chain runs: tracing → request-id → recoverer → metrics → security headers → CORS → body limit → access log → timeout.
4. The **auth middleware** validates the JWT, checks the Redis deny-list + password cutoff (fail-closed), and injects the **RLS identity** into the context.
5. The handler decodes/validates, calls the usecase, which calls a repository.
6. The repository opens a `withRLS` transaction that sets `SET LOCAL app.user_id/app.user_role`, so PostgreSQL RLS policies return **only that user's rows**.
7. The response is wrapped in the `{status, message, data, request_id}` envelope; the BFF unwraps it and returns clean JSON to the browser (stripping tokens where relevant).

If the access token is expired, the BFF transparently refreshes once (rotating the
refresh token) and retries — but only in a context that can persist the new cookie
pair. See [FRONTEND.md](FRONTEND.md) §1 and [SECURITY.md](SECURITY.md) §1.

---

## 5. Cross-cutting concerns

| Concern | Where | Reference |
|---------|-------|-----------|
| **Auth** | JWT (HS256) access + refresh with rotation; Redis-backed revocation | [SECURITY.md](SECURITY.md) §1 |
| **Authorization** | RBAC (dynamic roles/permissions) at the HTTP layer; RLS at the DB layer | [SECURITY.md](SECURITY.md) §2, §7 |
| **Tenant isolation** | Postgres RLS + non-superuser role + boot guard | [DATABASE.md](DATABASE.md) §3 |
| **Observability** | OpenTelemetry tracing + Prometheus metrics + Zap logs | [BACKEND.md](BACKEND.md) §4 |
| **Error handling** | `apperror.DomainError` → HTTP status; internals hidden via `InternalCause` | [BACKEND.md](BACKEND.md) §3 |
| **Config** | viper, with hard production guards | [CONFIGURATION.md](CONFIGURATION.md) |
| **AI + integrations** | Gemini, eID, SSO, XYP, sign, Google, SFTP | [AI_AND_INTEGRATIONS.md](AI_AND_INTEGRATIONS.md) |

---

## 6. Deployment shape

A single Docker Compose stack — `web` is the only container with a (loopback)
host port; nginx terminates TLS in front of it; `api`/`db`/`redis` stay on the
internal network. The `migrate` service applies schema changes on every `up` and
exits. Full runbook in [DEPLOYMENT.md](DEPLOYMENT.md).

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

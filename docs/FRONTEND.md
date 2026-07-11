# Frontend (BFF) Deep Dive

> 🌐 **English** · [Монгол](FRONTEND_MN.md)

The Next.js 15 App Router frontend runs as a **Backend-for-Frontend (BFF)**: the
browser only ever calls same-origin `/api/*` route handlers, which run
server-side and proxy to the Go backend. Tokens live in httpOnly cookies and
never reach client JavaScript.

Stack: **Next.js 15.5 · React 19.2 · TypeScript · TanStack Query**. Styling is
hand-written CSS (`globals.css` + CSS variables + inline styles) — **no
Tailwind**.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [SECURITY.md](SECURITY.md) · [API_REFERENCE.md](API_REFERENCE.md)

---

## 1. The BFF model

```
Browser ──(same-origin fetch, x-dgov-csrf header)──▶ Next.js /api/* route handler
                                                          │  (server-side, server-only)
                                                          ▼
                                            BACKEND_URL + /api/v1/*  (Go API)
```

The browser never talks to the Go backend directly — the CSP `connect-src 'self'`
(in `next.config.mjs`) enforces this at the browser level. All egress to the
backend goes through one module, `src/lib/api.ts` (`import 'server-only'`).

### `src/lib/api.ts` — the single server→backend egress point

- `BASE = (process.env.BACKEND_URL ?? 'http://localhost:8080') + '/api/v1'`.
- `forwardedForHeaders()` — forwards the incoming `x-forwarded-for` / `x-real-ip` so the backend's per-IP rate limiting doesn't collapse all traffic onto the web container's IP.
- `backendFetch<T>` — base fetch (`cache: 'no-store'`), unwraps the backend `Envelope<T>` (`{status, message, data, request_id}`) into a normalized `ApiResult<T>` (`ApiOk` | `ApiErr`); network failure → synthetic `503`; normalizes field-error arrays into a `Record<field,message>`.
- `authedFetch<T>` — attaches `Authorization: Bearer <accessToken>`; on `401` performs **one** reactive refresh via `tryRefresh()` then retries.
- `authedRaw` — same auth+refresh but returns the raw `Response` (binary/file downloads).
- Convenience: `getMe()` (distinguishes 401/403 dead-session vs 5xx backend-down), `fetchMyPermissions()` (`GET /rbac/me` → `string[]`).

### Token storage & rotation (`src/lib/session.ts`, `cookies.ts`)

- Cookies: `dgov_access` (5h) and `dgov_refresh` (7d), plus `dgov_sso_logout`. All `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, and `secure` **fail-closed** (true unless `COOKIE_SECURE=false` explicitly).
- httpOnly means browser JS can **never** read tokens (XSS-resistant).
- `tryRefresh()` calls `POST /auth/refresh`, which **rotates** the refresh token (old jti consumed). It first calls `canPersistSession()` — a probe that throws in an RSC render context — so refresh only runs where the new pair can actually be written back (a route handler / server action). This avoids burning a valid session on a read-only render.

### CSRF — double defense (`src/lib/bff.ts`, `client.ts`)

Every mutating BFF route calls `checkOrigin(req)` first:

1. Requires the custom header `x-dgov-csrf: 1` — a cross-site form POST can't set custom headers, and a cross-origin `fetch` is blocked by CORS preflight.
2. If an `Origin` header is present, it must match `APP_ORIGIN` (or the request origin).

The browser side (`src/lib/client.ts`) always adds that header:
`sendJSON`/`postJSON` (mutations) and `getJSON` (reads, throws on non-ok — used as a TanStack Query `queryFn`).

### Proxy helpers

- `proxyResult<T>(r)` — maps an `ApiResult` to client JSON **including** `data` (non-secret list/detail responses).
- `toClientResponse(r)` — maps **without** `data` (token-bearing / secret responses, e.g. the eID poll result).

---

## 2. Route structure (`src/app/`)

There are no parenthesized route groups; areas are plain path segments, each
re-using a shared server layout (`AreaShell`). Root `layout.tsx` wraps everything
in `<Providers>` (TanStack Query) + `<LangProvider>` (i18n), self-hosts fonts
(strict CSP), and injects `/theme-bootstrap.js` to avoid a theme flash.

| Area | Purpose | Notable pages |
|------|---------|---------------|
| `/` | Public landing (redirects to `/me/dashboard` if a session exists) | single **"DAN-аар нэвтрэх"** button → `/api/auth/sso/start` |
| `login/` | Direct eID login UI (QR / РД) | `LoginForm.tsx`, `login/verify` (App2App return) |
| `me/` | End-user area — **"Миний систем" / "My System"** | Nav is **Gov services** first (`services`, `applications`, `references`, `appointments`, `payments`, `notifications`), then **Personal** (`dashboard`, `integrations`, `ai`, `translate`, `eid/sign`); `profile`/`settings` live in the top-right menu; `organizations` and the `eid/` pages (`id`, `certificates`, `devices`, `logs`, `security`, `sign`) still exist as routes (the dedicated eID nav group was dropped) |
| `admin/` | Admin area | `dashboard`, `users`, `core`, `roles`, `settings`, `superadmin`, `audit`, `security`, `gateway/*` (with server guard) |
| `manager/` | Manager area | `dashboard`, `users` |
| `sso/callback` | OIDC redirect_uri handler (route, not page) | — |
| `auth/eid/callback`, `app/eid/callback` | App2App / native-app return bridges | — |

All area layouts + root/login pages declare `export const dynamic = 'force-dynamic'`.

---

## 3. `/api/*` route handler groups

Each group under `src/app/api/` proxies to a backend `/api/v1` path. Mutating
routes call `checkOrigin` first; GET routes use `proxyResult(authedFetch(...))`.

| Group | Proxies |
|-------|---------|
| `auth/` | eID (`eid/start`, `eid/start-id`, `eid/poll`), `logout`, `change-password`, `expired` (local cookie clear), Google (`google/start`, `google/callback`), SSO (`sso/start`, `sso/native`) |
| `rbac/` | `me`, `permissions`, `roles*` |
| `admin/` | `users*`, `ai/prompts*` |
| `superadmin/` | `admins*` |
| `core/` | `users`, `organizations` (Gerege Core lookup) |
| `security/` | `events` |
| `audit/` | `route`, `verify` (hash-chain check) |
| `gateway/` | `overview`, `services`, `routes`, `consumers`, `keys/*`, `policies`, `logs` |
| `org/` | `route`, `[id]/members*`, `lookup/[regNo]` |
| `me/` | `route` (`/users/me`), `latin-name`, `signature`, `eid/*` (summary, certificates, devices, activity, organizations…) |
| `gov/` | `overview`, `services`, `applications`, `appointments`, `payments`, `references`, `notifications` |
| `gspace/` | `route`, `upload`, `download` (streams binary via `authedRaw`) |
| `integrations/` | `[provider]/connect\|callback\|disconnect`, `dropbox/*`, `google-drive/*`, `google-meet/*` |
| `ai/` | `chat` (validates text ≤4000 chars, trims history to 20 turns), `translate`, `stt`, `tts` |
| `aasa/` | Serves the Apple App Site Association JSON (`force-static`) |

---

## 4. Data layer — TanStack Query

- `src/components/Providers.tsx` — a single `QueryClient` (`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`).
- **Read**: `useQuery({ queryKey, queryFn: () => getJSON('/api/...') })`. `getJSON` throws on non-ok so `isError`/`error` surface backend messages.
- **Mutate**: call `sendJSON(url, method, body)`; on `ok`, `queryClient.invalidateQueries({ queryKey })` to refetch. Example keys: `['admin-users', page]`, `['rbac-me']`.
- Server Components fetch directly via `src/lib/api.ts` (`getMe`, `fetchMyPermissions`), **not** TanStack Query.

---

## 5. i18n (`src/lib/i18n.ts`, `lang.tsx`)

- A single `dict` object with `mn` + `en` sub-objects, dotted keys (`sys.admin`, `nav.dashboard`, …). Every key must exist in both languages — enforced by `i18n.test.ts` (per the CLAUDE.md convention).
- `useT()` returns `{ lang, T(key), tRole(key,fallback), tPerm(key,fallback) }`. `LangProvider` defaults to `mn`, syncs from `localStorage['gerege.lang']`, and sets `<html lang>`.

---

## 6. Auth / session flow end to end

Role constants (`src/lib/types.ts`): superadmin=1, admin=2, manager=3, user=4.

- **DAN SSO (primary landing login):** the landing page's only sign-in button, **"DAN-аар нэвтрэх"**, links to `/api/auth/sso/start` → the DAN IdP (dgov's national SSO, dan.dgov.mn), where the citizen authenticates with their eID app → `sso/callback` sets the session. Native iOS uses `/api/auth/sso/native` (PKCE, no secret).
- **Direct eID login:** `LoginForm.tsx` (at `/login`) still offers **РД/National ID** (`POST /api/auth/eid/start-id` → push to the citizen's eID app) or **QR/device-link** (`POST /api/auth/eid/start` → rendered as a QR). Desktop polls `POST /api/auth/eid/poll` every 2.5s; mobile deep-links the eID app and returns via `auth/eid/callback`. On `COMPLETE`, the poll route sets the httpOnly cookies and **strips the tokens** from the browser-facing response.
- **Google login (secondary + eID linking):** `/api/auth/google/start` → Google consent → `/api/auth/google/callback`. If already linked → session; if first-time → a short-lived `g_link` cookie forces an eID verification that links the accounts.
- **Protected pages:** each area `layout.tsx` renders `AreaShell`, which calls `getMe()` server-side. On 401/403 (dead session) it redirects to `/api/auth/expired` (a GET route that can actually clear cookies — an RSC cannot) → `/login?notice=expired`, avoiding a redirect loop. On 5xx it renders `<BackendUnavailable>` and preserves the session.
- **RBAC in the shell:** `AppShell` fetches `/api/rbac/me` (permission keys) and filters the nav (`canSeeItem`). Admin/gateway pages **also** enforce server-side guards (e.g. `admin/gateway/guard.ts`). UI gates are convenience only — the backend re-validates every route.
- **Logout:** `signOut()` → `POST /api/auth/logout` (backend revokes refresh + deny-lists access) → clears cookies → RP-initiated SSO logout if `dgov_sso_logout` is present.

---

## 7. Build, tooling & security headers

- Scripts: `dev` (port 3000), `build`, `start`, `lint` (`next lint`), `test` (`vitest run`). CI runs `lint` + `build`.
- `next.config.mjs`: `output: 'standalone'` (slim Docker image), a `rewrites()` mapping the AASA well-known path → `/api/aasa`, and `headers()` applying to all paths: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, a full **CSP** (`default-src 'self'`, `connect-src 'self'` — the BFF-only rule, `frame-ancestors 'none'`, image/frame allow-lists for Google/Dropbox previews), and HSTS in production.
- Tests: `vitest` (`src/lib/*.test.ts` — `bff.test.ts`, `i18n.test.ts`, `navigation.test.ts`).

### Frontend env vars (`frontend/.env.example`)

| Var | Purpose |
|-----|---------|
| `BACKEND_URL` | Server-only; the Go API base (`/api/v1` appended in `lib/api.ts`). Default `http://localhost:8080`. |
| `COOKIE_SECURE` | `true`/`false`; fail-closed to secure in production. |
| `APP_ORIGIN` | (referenced in code) CSRF origin check + OAuth redirect base. |
| `GOOGLE_CLIENT_ID` | (public) Google login button. |

All OAuth/SSO **secrets** live only on the Go backend, never in the frontend.

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

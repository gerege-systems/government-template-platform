# API Reference

> 🌐 **English** · [Монгол](API_REFERENCE_MN.md)

The REST surface of the Go backend. All routes are mounted under
**`/api/v1`**. The authoritative, always-current contract is the generated
OpenAPI spec — this page is the hand-written map.

> **OpenAPI spec:** `GET /swagger/doc.json` (in production, behind
> `Bearer OBSERVABILITY_TOKEN`). Regenerate with `make swag`. The static spec
> also lives at `backend/docs/swagger.json` / `swagger.yaml`.
> A prose contract is in [backend/docs/API_CONTRACT.md](https://github.com/gerege-systems/government-template-platform/blob/main/backend/docs/API_CONTRACT.md).

Related: [BACKEND.md](BACKEND.md) · [SECURITY.md](SECURITY.md) · [AI_AND_INTEGRATIONS.md](AI_AND_INTEGRATIONS.md)

---

## Conventions

- **Base path:** `/api/v1`.
- **Auth:** `Authorization: Bearer <access_token>` for protected routes (the frontend BFF supplies this from the httpOnly cookie).
- **Response envelope** — every response is `{ "status": bool, "message": string, "data": <payload|null>, "request_id": string }`.
- **Errors** — mapped from `apperror`: 400 BadRequest · 401 Unauthorized · 403 Forbidden · 404 NotFound · 409 Conflict · 422 validation (per-field `data.errors`) · 500 internal (message always `"internal server error"`; real cause is logged, never returned).
- **Body limits** — 1 MiB global, 4 KiB on `/auth`.
- **Rate limits** — auth ~5/min, `/ai/*` ~20/min, `/auth/eid/poll` 1/s, gov writes ~30/min.

---

## Infrastructure (outside `/api/v1`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | — | Liveness (always 200). |
| GET | `/ready` | — | Readiness (pings pgx + redis; 503 if down). |
| GET | `/metrics` | prod: `Bearer OBSERVABILITY_TOKEN` | Prometheus metrics. |
| GET | `/swagger/doc.json` | prod: `Bearer OBSERVABILITY_TOKEN` | OpenAPI spec. |

---

## Auth & session — `/auth`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/eid/start` | — | Start eID QR / device-link login → session id + device-link URL. |
| POST | `/auth/eid/start-id` | — | Start eID login by national id (РД push). |
| POST | `/auth/eid/poll` | — | Poll the eID session; on `COMPLETE` issues the token pair. |
| POST | `/auth/google` | — | Google login / eID-link exchange. |
| DELETE | `/auth/google/link` | ✅ | Unlink Google from the current user. |
| POST | `/auth/refresh` | — (refresh token) | Rotate the token pair (single-use refresh). |
| POST | `/auth/logout` | ✅ | Revoke refresh + deny-list the access token. |

> The classic password/OTP/register endpoints are implemented and tested but
> **not routed** in this build (eID/Google/SSO login only) — see
> [SECURITY.md](SECURITY.md) §1.

## DAN / dgov SSO (OIDC) — `/sso`

The primary landing login (DAN, dgov's eID-backed national SSO).

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sso/start` | Begin DAN/dgov OIDC login (returns the auth URL; state stored in Redis). |
| POST | `/sso/callback` | Web redirect exchange (validates + consumes state). |
| POST | `/sso/native` | Native/mobile PKCE code exchange. |
| POST | `/sso/logout` | Build the RP-initiated logout URL. |

---

## Users & profile — `/users`, `/me`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/users/me` | ✅ | Current user profile. |
| POST | `/me/latin-name` | ✅ | Set the Latin-script name. |
| GET/POST/DELETE | `/me/signature` | ✅ | Personal signature image. |
| GET | `/users/me/eid/summary` | ✅ | eID person summary. |
| GET | `/users/me/eid/certificates` | ✅ | eID certificate list + counts. |
| GET | `/users/me/eid/devices` | ✅ | Linked eID devices. |
| GET | `/users/me/eid/activity` | ✅ | RP-scoped auth/sign history. |
| GET/POST/DELETE | `/users/me/eid/organizations…` | ✅ | Represented organizations + signers + stamp. |

## RBAC — `/rbac`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/rbac/me` | ✅ | Current user's permission keys. |
| GET | `/rbac/permissions` | `roles.manage` | Permission catalogue. |
| GET/POST/PUT/DELETE | `/rbac/roles…` | `roles.manage` | Role CRUD + role→permission sets. |

## Admin & superadmin — `/admin`, `/superadmin`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/admin/users` | `users.manage` | List users (paginated). |
| PUT | `/admin/users/{id}/role` · `/active` | `users.manage` | Change role / activation. |
| GET/PUT | `/admin/ai/prompts…` | `settings.manage` | View/update the AI `scope`/`instructions` prompt layers. |
| GET/POST | `/superadmin/admins…` | superadmin | List/create admins; grant/revoke (audited). |

## Audit & security — `/audit`, `/security`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/audit` | admin | Hash-chained audit log. |
| GET | `/audit/verify` | admin | Verify the audit hash chain. |
| GET/POST | `/security/events` | ✅ | RASP security events (users ingest own; admins list all). |

---

## AI — `/ai`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/ai/chat` | ✅ | Function-calling chat; returns `{reply, steps, degraded}`. |
| POST | `/ai/stt` | ✅ | Speech-to-text. |
| POST | `/ai/tts` | ✅ | Text-to-speech (WAV). |
| POST | `/ai/translate` | ✅ | Live translation (+ optional TTS). |

## Government services — `/gov`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/gov/services` · `/overview` | ✅ | Catalogue + dashboard. |
| GET/POST | `/gov/applications` (+ `/{id}/cancel`) | ✅ | Citizen applications. |
| GET/POST | `/gov/references` | ✅ | Reference requests. |
| GET | `/gov/notifications` (+ `/{id}/read`, `/read-all`) | ✅ | Notifications. |
| GET/POST | `/gov/payments` (+ `/{id}/pay`) | ✅ | Payments. |
| GET/POST | `/gov/appointments` (+ `/{id}/cancel`) | ✅ | Appointments. |

## Integrations & storage — `/integrations`, `/gspace`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST/DELETE | `/integrations…` | ✅ | Connect/list/disconnect third-party OAuth (`google-drive`, `dropbox`, `google-meet`); tokens AES-256-GCM encrypted. |
| GET/POST/DELETE | `/gspace…` | ✅ | Gerege Space SFTP file storage (quota-limited). |

## Digital signing — `/sign`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/sign/init` | ✅ | Start a PAdES PDF signing session (individual or on-behalf-of org). |
| GET | `/sign/{id}` | ✅ | Poll the signing session (ownership-checked). |
| GET | `/sign/{id}/download` | ✅ | Download the signed PDF. |

## Organizations — `/org`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/org` | ✅ | List / create organizations. |
| GET | `/org/{id}` · `/org/lookup/{regNo}` | ✅ | Detail / registry lookup. |
| POST/PUT/DELETE | `/org/{id}/members…` | ✅ | Membership management. |

## API Gateway console — `/gateway`

All require `gateway.manage`. CRUD for `services`, `routes`, `consumers`
(+ `/keys`), `policies`, plus `GET /gateway/overview` and `/gateway/logs`. API
keys are `gk_live_…`; only the SHA-256 hash is stored and the plaintext is
returned exactly once.

## Core lookup — `/core`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/core/users` · `/core/organizations` | admin | Proxied Gerege Core registry search. |

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

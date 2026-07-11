# Platform Overview

> 🌐 **English** · [Монгол](OVERVIEW_MN.md)

Government Template Platform V3.0 is a **production-ready, security-hardened
full-stack template** for building eID-based, AI-enabled government services. It
pairs a Go backend on Clean Architecture with a Next.js Backend-for-Frontend, and
integrates Mongolia's national identity, registry, and SSO systems.

The backend is derived from the open-source
[snykk/go-rest-boilerplate](https://github.com/snykk/go-rest-boilerplate) (MIT),
ported Gin → chi and sqlx → pgx.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [README.md](README.md)

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Go · chi (net/http) · pgx (pgxpool) · **no ORM** |
| Data | PostgreSQL 16 (+ Row-Level Security) · Redis 7 |
| Frontend | Next.js 15 · React 19 · TypeScript · TanStack Query |
| AI | Google Gemini (SDK-free REST client) |
| Identity | eID Mongolia (RP) · DAN / dgov SSO (OIDC/Hydra) · Google OAuth |
| National | XYP registry · digital signing (PAdES) · Gerege Core |
| Observability | OpenTelemetry · Prometheus · Zap |
| Delivery | Docker Compose · nginx · distroless images |

---

## What's in the box

- **Clean Architecture backend** — `handler → usecase → repository → domain`, no back-imports; the business core never imports the web framework. Manual DI, hand-written SQL.
- **DAN SSO login, eID-backed** — the landing sign-in is **DAN** (dgov's national SSO at dan.dgov.mn), which authenticates the citizen through their eID app; direct eID login (QR/device-link or РД push) is also implemented. JWT access + refresh with rotation, Redis-backed revocation, login lockout, and enumeration-resistant flows.
- **Dynamic RBAC** — roles/permissions catalogue with super-admin/admin/manager/user tiers, enforced at the HTTP layer and re-checked server-side.
- **Row-Level Security** — every per-user table is RLS-isolated; the API connects as a non-superuser role, with a boot-time enforceability guard.
- **AI assistant (Gemini)** — function-calling chat, speech-to-text, text-to-speech, and live translation. A layered system prompt (hardcoded guardrails + admin-configurable scope/instructions) keeps it in-domain; a `search_knowledge` tool grounds answers in the database. Chat degrades gracefully instead of erroring.
- **National integrations** — dgov SSO (OIDC + PKCE), XYP organization lookup, PAdES digital signing, Google OAuth, and Gerege Space SFTP storage.
- **BFF frontend** — the browser only talks to same-origin Next.js routes; tokens live in httpOnly cookies; double CSRF defense (custom header + origin check); TanStack Query data layer; mn/en i18n.
- **iOS companion** — a native SwiftUI RP-consumer that drives eID/SSO login through the same BFF (universal links via AASA).
- **Security-hardened** — strict security headers, CORS allow-list, in-memory rate limiting, full HTTP server timeouts, parameterized queries, hash-chained audit log, and AES-256-GCM encryption for stored third-party tokens.
- **Observability** — OpenTelemetry tracing, Prometheus metrics (incl. DB pool stats), structured logs, and `/health` + `/ready` probes.

---

## Repository layout

```
government-template-platform/
├── backend/          # Go API (chi · pgx · PostgreSQL · Redis)
│   ├── cmd/          # api · migration · seed · healthcheck
│   ├── internal/     # business (domain/usecases) · datasources · http · config
│   ├── pkg/          # jwt · gemini · eid · oidc · google · xyp · gspace · …
│   ├── migrations/   # numbered N_name.up.sql / .down.sql
│   └── docs/         # backend-only deep dives + OpenAPI spec
├── frontend/         # Next.js 15 BFF
│   └── src/          # app (routes + /api handlers) · components · lib
├── ios/              # SwiftUI companion (eID/SSO consumer)
├── deploy/           # deploy.sh
├── scripts/          # smoke-test.sh
├── docs/             # ← this whole-platform documentation set
└── docker-compose.yml
```

---

## Feature map by user area

| Area | Who | Highlights |
|------|-----|-----------|
| **My System** (`/me`) | Citizens | Gov services first (services, applications, references, appointments, payments, notifications), then Personal (dashboard, integrations, AI assistant, live translate, digital signing); plus profile, organizations, and eID identity pages. |
| **Admin** (`/admin`) | Admins | User management, RBAC roles, AI prompt config, audit log + verification, security events, Core search, API gateway console. |
| **Manager** (`/manager`) | Managers | Team dashboard + user views. |
| **Superadmin** | Super admins | Manage admin accounts (audited). |

---

## Where to go next

- Understand the design → [ARCHITECTURE.md](ARCHITECTURE.md)
- Build on the backend → [BACKEND.md](BACKEND.md) · [DATABASE.md](DATABASE.md)
- Build on the frontend → [FRONTEND.md](FRONTEND.md)
- Deploy it → [DEPLOYMENT.md](DEPLOYMENT.md) · [CONFIGURATION.md](CONFIGURATION.md)

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

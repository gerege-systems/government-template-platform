# Documentation — Government Template Platform V3.0

> 🌐 **English** · [Монгол](README_MN.md)

> **eID based · AI enabled** government services platform.
> A production-ready, security-hardened full-stack template on Clean Architecture:
> a Go (chi · pgx · PostgreSQL · Redis) backend and a Next.js BFF frontend.

This directory is the **whole-platform documentation set**, reviewed fresh from
the code. For the project intro and quick start, see the root
[README.md](../README.md).

---

## Start here

| If you want to… | Read |
|-----------------|------|
| Understand the platform end to end | [OVERVIEW.md](OVERVIEW.md) → [ARCHITECTURE.md](ARCHITECTURE.md) |
| Work on the Go API | [BACKEND.md](BACKEND.md) + [DATABASE.md](DATABASE.md) |
| Work on the web UI | [FRONTEND.md](FRONTEND.md) |
| Call or extend the API | [API_REFERENCE.md](API_REFERENCE.md) |
| Understand AI / eID / SSO / signing | [AI_AND_INTEGRATIONS.md](AI_AND_INTEGRATIONS.md) |
| Review the security posture | [SECURITY.md](SECURITY.md) |
| Deploy or operate it | [DEPLOYMENT.md](DEPLOYMENT.md) + [CONFIGURATION.md](CONFIGURATION.md) |
| Contribute | [CONTRIBUTING.md](CONTRIBUTING.md) + [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |

---

## The full set

| Doc | What it covers |
|-----|----------------|
| [OVERVIEW.md](OVERVIEW.md) · [_MN](OVERVIEW_MN.md) | Feature tour, tech stack, repo layout. |
| [ARCHITECTURE.md](ARCHITECTURE.md) · [_MN](ARCHITECTURE_MN.md) | Full-stack architecture, request lifecycle, boundaries. |
| [BACKEND.md](BACKEND.md) · [_MN](BACKEND_MN.md) | Go API: layering, DI, HTTP layer, middlewares, packages. |
| [FRONTEND.md](FRONTEND.md) · [_MN](FRONTEND_MN.md) | Next.js BFF: routes, proxy, cookies/CSRF, TanStack Query, i18n. |
| [DATABASE.md](DATABASE.md) · [_MN](DATABASE_MN.md) | Schema, migrations, RLS, caches, seed data. |
| [API_REFERENCE.md](API_REFERENCE.md) · [_MN](API_REFERENCE_MN.md) | REST endpoints by domain, envelope, error model. |
| [AI_AND_INTEGRATIONS.md](AI_AND_INTEGRATIONS.md) · [_MN](AI_AND_INTEGRATIONS_MN.md) | Gemini AI, eID, SSO, XYP, signing, Google, iOS. |
| [SECURITY.md](SECURITY.md) · [_MN](SECURITY_MN.md) | Auth, RLS, headers, CORS, rate limiting, CSRF, audit. |
| [DEPLOYMENT.md](DEPLOYMENT.md) · [_MN](DEPLOYMENT_MN.md) | VPS runbook, compose stack, CI, health endpoints. |
| [CONFIGURATION.md](CONFIGURATION.md) · [_MN](CONFIGURATION_MN.md) | Every environment variable + production guards. |
| [EID_ENDPOINT_REQUESTS.md](EID_ENDPOINT_REQUESTS.md) | RP-facing eID endpoints this platform requests. |
| [secure_system_guide_mn.md](secure_system_guide_mn.md) | Long-form secure web+mobile+API build guide (standards-based reference, MN). |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | How to contribute. |

### Backend-only deep dives (`backend/docs/`)

The `backend/docs/` folder keeps the low-level backend references (EN/MN pairs):
[ARCHITECTURE](../backend/docs/ARCHITECTURE.md), [DEVELOPMENT](../backend/docs/DEVELOPMENT.md)
(add-a-feature guide), [API_CONTRACT](../backend/docs/API_CONTRACT.md),
[AI_PIPELINE](../backend/docs/AI_PIPELINE.md), [SECURITY](../backend/docs/SECURITY.md),
and the generated OpenAPI spec.

---

## Two things to know up front

Documented elsewhere but **not present in this repo** — verified during the code
review, flagged so operators aren't surprised:

1. **No CI workflows in-repo.** There is no `.github/` directory. The CI gates are reproducible via `backend/Makefile` (`make pre-push`) — see [DEPLOYMENT.md](DEPLOYMENT.md) § CI/CD.
2. **Classic password/OTP login is unrouted.** Those flows are implemented and tested but only eID/Google/SSO login is wired — see [SECURITY.md](SECURITY.md) §1.

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

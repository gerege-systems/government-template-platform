# Архитектур

> 🌐 [English](ARCHITECTURE.md) · **Монгол**

Full-stack бүтэн зураглал: хүсэлт хэрхэн browser-оос Next.js BFF-ээр дамжин Go API руу, тэндээс доош PostgreSQL/Redis, гадагш үндэсний eID/SSO/AI үйлчилгээ рүү урсдаг вэ — мөн давхарга бүрийг цэвэр байлгадаг хил заагууд.

> Зөвхөн backend-д зориулсан гүнзгий тайлбар
> [backend/docs/ARCHITECTURE.md](../backend/docs/ARCHITECTURE.md) дотор байдаг. Энэ бүлэг нь
> платформын түвшний харагдац юм. Мөн [BACKEND_MN.md](BACKEND_MN.md), [FRONTEND_MN.md](FRONTEND_MN.md),
> [DATABASE_MN.md](DATABASE_MN.md), [SECURITY_MN.md](SECURITY_MN.md)-г үзнэ үү.

---

## 1. Системийн ерөнхий тойм

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

Архитектурыг тодорхойлох хоёр шинж чанар:

1. **Browser Go API-тай хэзээ ч шууд харьцдаггүй.** Тэр нь same-origin `/api/*` handler-уудыг дуудаж, тэдгээр нь server талд proxy хийдэг. Token-ууд httpOnly cookie дотор байрладаг тул client JS тэдгээрийг уншиж чадахгүй (XSS-д тэсвэртэй), мөн browser-ийн CSP `connect-src 'self'` нь хил заагийг мөрдүүлдэг. [FRONTEND_MN.md](FRONTEND_MN.md) §1-г үзнэ үү.
2. **Бизнесийн цөм нь web framework-ийг хэзээ ч import хийдэггүй.** Clean Architecture нь хамаарлыг дотогшоо чиглүүлж байлгадаг. §3-г үзнэ үү.

---

## 2. Бүрэлдэхүүн хэсгүүд

| Бүрэлдэхүүн | Технологи | Үүрэг |
|-----------|------|------|
| **web** | Next.js 15, React 19, TypeScript | BFF — API руу proxy хийж, session cookie-г хадгалж, UI-г үйлчилдэг. Tailwind байхгүй (гараар бичсэн CSS). |
| **api** | Go, chi (net/http), pgx | Бизнесийн API — auth, RBAC, RLS, бүх domain логик, гадаад үйлчилгээний client-ууд. |
| **db** | PostgreSQL 16 | Бүртгэлийн эх систем; хэрэглэгч бүрд Row-Level Security. |
| **redis** | Redis 7 | Auth/session төлөв: refresh-token бүртгэл, access deny-list, OTP, rate-limit тоолуур, password-cutoff. |
| **migrate** | Go (нэг удаагийн) | Дугаарласан SQL migration-уудыг хэрэглээд гардаг. DB superuser эрхээр ажилладаг. |
| **iOS app** | SwiftUI | Ижил BFF-ээр дамжуулан eID/SSO нэвтрэлтийг ажиллуулдаг native RP-consumer. |

---

## 3. Clean Architecture (backend)

```
handler ─▶ usecase ─▶ repository (interface) ─▶ domain
   │           │              ▲
   │           │              └── postgres adapters implement the interfaces
   │           └── external systems via pkg/* clients (injected)
   └── HTTP concerns only (decode, validate, respond)
```

- **Usecase-ууд** зөвхөн `repositories/interface` (package `_interface`)-ээс хамаардаг бөгөөд Postgres adapter-ууд дээр хэзээ ч хамаардаггүй.
- **`domain`** дотоод юуг ч import хийдэггүй — цэвэр struct + тогтмолууд.
- Холболт нь `cmd/api/server/server.go` дотор **гар DI** (`repo → usecase → route`) бөгөөд ямар ч framework байхгүй. Дэлгэрэнгүйг [BACKEND_MN.md](BACKEND_MN.md)-ээс.

---

## 4. Хүсэлтийн амьдралын мөчлөг (нэвтэрсэн уншилт)

1. React component `getJSON('/api/gov/applications')`-г дуудна (mutation-уудад `x-dgov-csrf` header-тэй хамт).
2. Next.js route handler нь server талд ажиллаж, `dgov_access` cookie-г уншаад `authedFetch('/gov/applications')` → `BACKEND_URL/api/v1/gov/applications`-г `Authorization: Bearer …`-тэй дуудна.
3. Go middleware гинжин хэлхээ ажиллана: tracing → request-id → recoverer → metrics → security headers → CORS → body limit → access log → timeout.
4. **Auth middleware** нь JWT-г шалгаж, Redis deny-list + password cutoff-г шалгаад (fail-closed), context руу **RLS identity**-г оруулна.
5. Handler нь decode/validate хийж, usecase-г дуудна, тэр нь repository-г дуудна.
6. Repository нь `SET LOCAL app.user_id/app.user_role`-г тохируулдаг `withRLS` transaction нээж, ингэснээр PostgreSQL RLS policy-ууд нь **зөвхөн тухайн хэрэглэгчийн мөрүүдийг** буцаана.
7. Хариу нь `{status, message, data, request_id}` дугтуйнд боогдоно; BFF нь түүнийг задлаад browser руу цэвэр JSON буцаана (шаардлагатай газарт token-уудыг арилгаж).

Хэрэв access token-ий хугацаа дууссан бол BFF нь ил тод байдлаар нэг удаа refresh хийж (refresh token-г эргүүлж), дахин оролдоно — гэхдээ зөвхөн шинэ cookie хосыг хадгалж чадах context дотор. [FRONTEND_MN.md](FRONTEND_MN.md) §1 болон [SECURITY_MN.md](SECURITY_MN.md) §1-г үзнэ үү.

---

## 5. Хөндлөн огтлолын асуудлууд

| Асуудал | Хаана | Лавлагаа |
|---------|-------|-----------|
| **Auth** | JWT (HS256) access + эргэлттэй refresh; Redis-д тулгуурласан хүчингүй болголт | [SECURITY_MN.md](SECURITY_MN.md) §1 |
| **Authorization** | HTTP давхаргад RBAC (динамик role/permission); DB давхаргад RLS | [SECURITY_MN.md](SECURITY_MN.md) §2, §7 |
| **Түрээслэгчийн тусгаарлалт** | Postgres RLS + non-superuser role + boot guard | [DATABASE_MN.md](DATABASE_MN.md) §3 |
| **Ажиглалт (Observability)** | OpenTelemetry tracing + Prometheus metrics + Zap logs | [BACKEND_MN.md](BACKEND_MN.md) §4 |
| **Алдаа зохицуулалт** | `apperror.DomainError` → HTTP status; дотоод зүйлс `InternalCause`-аар нуугдана | [BACKEND_MN.md](BACKEND_MN.md) §3 |
| **Config** | viper, production-ийн хатуу хамгаалалттай | [CONFIGURATION_MN.md](CONFIGURATION_MN.md) |
| **AI + интеграцууд** | Gemini, eID, SSO, XYP, sign, Google, SFTP | [AI_AND_INTEGRATIONS_MN.md](AI_AND_INTEGRATIONS_MN.md) |

---

## 6. Deployment-ийн бүтэц

Ганц Docker Compose stack — `web` нь (loopback) host port-той цорын ганц container; nginx түүний өмнө TLS-г төгсгөдөг; `api`/`db`/`redis` нь дотоод сүлжээнд үлддэг. `migrate` үйлчилгээ нь `up` бүрд schema-ийн өөрчлөлтийг хэрэглээд гардаг. Бүрэн ажиллагааны заавар [DEPLOYMENT_MN.md](DEPLOYMENT_MN.md) дотор.

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

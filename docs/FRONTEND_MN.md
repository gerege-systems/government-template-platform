# Frontend (BFF) гүнзгий тайлбар

> 🌐 [English](FRONTEND.md) · **Монгол**

Next.js 15 App Router frontend нь **Backend-for-Frontend (BFF)** байдлаар ажилладаг:
browser зөвхөн ижил гарал үүсэлтэй (same-origin) `/api/*` route handler-үүд рүү
хандах бөгөөд эдгээр нь server талд ажиллаж, Go backend руу proxy хийдэг. Token-ууд
httpOnly cookie дотор хадгалагдаж, client JavaScript руу хэзээ ч хүрдэггүй.

Технологийн стек: **Next.js 15.5 · React 19.2 · TypeScript · TanStack Query**.
Загварчлалыг гараар бичсэн CSS-ээр (`globals.css` + CSS хувьсагчид + inline style)
хийсэн — **Tailwind ашиглаагүй**.

Холбоотой: [ARCHITECTURE.md](ARCHITECTURE_MN.md) · [SECURITY.md](SECURITY_MN.md) · [API_REFERENCE.md](API_REFERENCE_MN.md)

---

## 1. BFF загвар

```
Browser ──(same-origin fetch, x-dgov-csrf header)──▶ Next.js /api/* route handler
                                                          │  (server-side, server-only)
                                                          ▼
                                            BACKEND_URL + /api/v1/*  (Go API)
```

Browser нь Go backend-тэй шууд харьцдаггүй — CSP `connect-src 'self'`
(`next.config.mjs` доторх) нь үүнийг browser түвшинд албадан хэрэгжүүлдэг. Backend
руу гарах бүх урсгал нэг модулиар, `src/lib/api.ts` (`import 'server-only'`)-аар
дамждаг.

### `src/lib/api.ts` — server→backend руу гарах цорын ганц цэг

- `BASE = (process.env.BACKEND_URL ?? 'http://localhost:8080') + '/api/v1'`.
- `forwardedForHeaders()` — ирж буй `x-forwarded-for` / `x-real-ip`-г дамжуулж, backend-ийн IP тус бүрийн rate limiting нь бүх урсгалыг web container-ийн IP дээр нэгтгэн задлахаас сэргийлдэг.
- `backendFetch<T>` — үндсэн fetch (`cache: 'no-store'`), backend-ийн `Envelope<T>` (`{status, message, data, request_id}`)-г нэгдсэн `ApiResult<T>` (`ApiOk` | `ApiErr`) болгон задалдаг; сүлжээний алдаа → зохиомол `503`; field-error массивуудыг `Record<field,message>` болгон хэвийнжүүлдэг.
- `authedFetch<T>` — `Authorization: Bearer <accessToken>`-г хавсаргадаг; `401` дээр `tryRefresh()`-аар **нэг** удаагийн reactive refresh хийж, дараа нь дахин оролддог.
- `authedRaw` — ижил auth+refresh хийдэг боловч түүхий `Response`-г буцаадаг (binary/файл татах).
- Тохь ашиглалт: `getMe()` (401/403 үхсэн сешн болон 5xx backend унасныг ялгадаг), `fetchMyPermissions()` (`GET /rbac/me` → `string[]`).

### Token хадгалалт ба солилцоо (`src/lib/session.ts`, `cookies.ts`)

- Cookie-нүүд: `dgov_access` (5h) ба `dgov_refresh` (7d), мөн `dgov_sso_logout`. Бүгд `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure` нь **fail-closed** (`COOKIE_SECURE=false` гэж тодорхой заагаагүй бол true).
- httpOnly гэдэг нь browser JS token-уудыг **хэзээ ч** уншиж чадахгүй гэсэн үг (XSS-д тэсвэртэй).
- `tryRefresh()` нь `POST /auth/refresh`-г дуудаж, refresh token-г **сольдог** (хуучин jti хэрэглэгдэж дуусдаг). Энэ нь эхлээд `canPersistSession()`-г дуудна — RSC render контекст дотор алдаа шиддэг тандалт — тиймээс refresh нь зөвхөн шинэ хос token-г буцааж бичиж болох газарт (route handler / server action) л ажилладаг. Ингэснээр read-only render дээр хүчинтэй сешнийг үрэн таран хийхээс сэргийлдэг.

### CSRF — давхар хамгаалалт (`src/lib/bff.ts`, `client.ts`)

Өгөгдөл өөрчилдөг (mutating) BFF route бүр эхлээд `checkOrigin(req)`-г дуудна:

1. Захиалгат `x-dgov-csrf: 1` header шаарддаг — cross-site form POST нь захиалгат header тохируулж чадахгүй, cross-origin `fetch` нь CORS preflight-аар хаагддаг.
2. Хэрэв `Origin` header байвал `APP_ORIGIN` (эсвэл хүсэлтийн origin)-той таарах ёстой.

Browser тал (`src/lib/client.ts`) энэ header-г үргэлж нэмдэг:
`sendJSON`/`postJSON` (mutation) ба `getJSON` (унших, ok биш үед алдаа шиднэ — TanStack Query-ийн `queryFn` болгон ашигладаг).

### Proxy туслах функцууд

- `proxyResult<T>(r)` — `ApiResult`-г `data`-г **оруулан** client JSON руу хөрвүүлдэг (нууц бус жагсаалт/дэлгэрэнгүй хариултууд).
- `toClientResponse(r)` — `data`-**гүйгээр** хөрвүүлдэг (token агуулсан / нууц хариултууд, ж.нь eID poll-ийн үр дүн).

---

## 2. Route бүтэц (`src/app/`)

Хаалттай хаалтанд бичсэн route group байхгүй; хэсгүүд нь энгийн path segment-ууд
бөгөөд тус бүр нь хуваалцсан server layout (`AreaShell`)-г дахин ашигладаг. Үндсэн
`layout.tsx` нь бүх зүйлийг `<Providers>` (TanStack Query) + `<LangProvider>`
(i18n)-ээр ороож, фонтуудыг өөрөө host хийж (хатуу CSP), theme-ийн анивчилтаас
сэргийлэхийн тулд `/theme-bootstrap.js`-г оруулдаг.

| Хэсэг | Зорилго | Онцлох хуудсууд |
|------|---------|-----------------|
| `/` | Нийтийн буух хуудас (сешн байвал `/me/dashboard` руу чиглүүлнэ) | eID + SSO нэвтрэх товчнууд |
| `login/` | eID нэвтрэх UI | `LoginForm.tsx`, `login/verify` (App2App буцах) |
| `me/` | Эцсийн хэрэглэгчийн хэсэг ("Миний Гэрэгэ") | `dashboard`, `profile`, `settings`, `ai`, `translate`, `integrations`, `notifications`, `applications`, `appointments`, `payments`, `references`, `services`, `organizations`, болон `eid/` дэд мод (`id`, `certificates`, `devices`, `logs`, `security`, `sign`) |
| `admin/` | Админ хэсэг | `dashboard`, `users`, `core`, `roles`, `settings`, `superadmin`, `audit`, `security`, `gateway/*` (server хамгаалалттай) |
| `manager/` | Менежерийн хэсэг | `dashboard`, `users` |
| `sso/callback` | OIDC redirect_uri handler (хуудас биш, route) | — |
| `auth/eid/callback`, `app/eid/callback` | App2App / native-app буцах гүүрнүүд | — |

Бүх хэсгийн layout-ууд + үндсэн/login хуудсууд `export const dynamic = 'force-dynamic'`-г зарладаг.

---

## 3. `/api/*` route handler бүлгүүд

`src/app/api/` доторх бүлэг бүр backend-ийн `/api/v1` зам руу proxy хийдэг.
Mutating route-ууд эхлээд `checkOrigin`-г дуудна; GET route-ууд `proxyResult(authedFetch(...))`-г ашигладаг.

| Бүлэг | Proxy хийдэг |
|-------|-------------|
| `auth/` | eID (`eid/start`, `eid/start-id`, `eid/poll`), `logout`, `change-password`, `expired` (локал cookie цэвэрлэх), Google (`google/start`, `google/callback`), SSO (`sso/start`, `sso/native`) |
| `rbac/` | `me`, `permissions`, `roles*` |
| `admin/` | `users*`, `ai/prompts*` |
| `superadmin/` | `admins*` |
| `core/` | `users`, `organizations` (Gerege Core хайлт) |
| `security/` | `events` |
| `audit/` | `route`, `verify` (hash-chain шалгалт) |
| `gateway/` | `overview`, `services`, `routes`, `consumers`, `keys/*`, `policies`, `logs` |
| `org/` | `route`, `[id]/members*`, `lookup/[regNo]` |
| `me/` | `route` (`/users/me`), `latin-name`, `signature`, `eid/*` (summary, certificates, devices, activity, organizations…) |
| `gov/` | `overview`, `services`, `applications`, `appointments`, `payments`, `references`, `notifications` |
| `gspace/` | `route`, `upload`, `download` (`authedRaw`-аар binary дамжуулдаг) |
| `integrations/` | `[provider]/connect\|callback\|disconnect`, `dropbox/*`, `google-drive/*`, `google-meet/*` |
| `ai/` | `chat` (текстийг ≤4000 тэмдэгт болгон шалгаж, түүхийг 20 эргэлт болгон тайрдаг), `translate`, `stt`, `tts` |
| `aasa/` | Apple App Site Association JSON-г дамжуулдаг (`force-static`) |

---

## 4. Өгөгдлийн давхарга — TanStack Query

- `src/components/Providers.tsx` — ганц `QueryClient` (`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`).
- **Унших**: `useQuery({ queryKey, queryFn: () => getJSON('/api/...') })`. `getJSON` нь ok биш үед алдаа шиддэг тул `isError`/`error` нь backend-ийн мессежийг гаргаж ирдэг.
- **Өөрчлөх**: `sendJSON(url, method, body)`-г дуудна; `ok` дээр дахин татахын тулд `queryClient.invalidateQueries({ queryKey })`. Жишээ key-үүд: `['admin-users', page]`, `['rbac-me']`.
- Server Component-ууд `src/lib/api.ts`-аар (`getMe`, `fetchMyPermissions`) шууд татдаг, TanStack Query-ээр **биш**.

---

## 5. i18n (`src/lib/i18n.ts`, `lang.tsx`)

- `mn` + `en` дэд объект бүхий ганц `dict` объект, цэгээр тусгаарласан key-үүд (`sys.admin`, `nav.dashboard`, …). Key бүр хоёр хэл дээр байх ёстой — үүнийг `i18n.test.ts` албадан хэрэгжүүлдэг (CLAUDE.md конвенцийн дагуу).
- `useT()` нь `{ lang, T(key), tRole(key,fallback), tPerm(key,fallback) }`-г буцаадаг. `LangProvider` нь default-оор `mn` бөгөөд `localStorage['gerege.lang']`-аас синк хийж, `<html lang>`-г тохируулдаг.

---

## 6. Auth / сешний урсгал эхнээс дуустал

Role тогтмолууд (`src/lib/types.ts`): superadmin=1, admin=2, manager=3, user=4.

- **eID нэвтрэлт (үндсэн):** `LoginForm.tsx` нь **РД/National ID** (`POST /api/auth/eid/start-id` → иргэний eID апп руу push) эсвэл **QR/төхөөрөмж холбох** (`POST /api/auth/eid/start` → QR болгон харуулна) сонголтыг санал болгодог. Desktop нь `POST /api/auth/eid/poll`-г 2.5 секунд тутам poll хийдэг; mobile нь eID аппыг deep-link хийж, `auth/eid/callback`-аар буцдаг. `COMPLETE` үед poll route нь httpOnly cookie-нуудыг тохируулж, browser руу чиглэсэн хариултаас token-уудыг **хасдаг**.
- **Google нэвтрэлт (нэмэлт + eID холбох):** `/api/auth/google/start` → Google зөвшөөрөл → `/api/auth/google/callback`. Хэрэв аль хэдийн холбогдсон бол → сешн; хэрэв анх удаа бол → богино хугацааны `g_link` cookie нь бүртгэлүүдийг холбох eID баталгаажуулалтыг албаддаг.
- **dgov SSO (OIDC):** `/api/auth/sso/start` → IdP → `sso/callback` нь сешнийг тохируулдаг. Native iOS нь `/api/auth/sso/native`-г ашигладаг (PKCE, secret-гүй).
- **Хамгаалагдсан хуудсууд:** хэсэг бүрийн `layout.tsx` нь `AreaShell`-г render хийдэг бөгөөд энэ нь server талд `getMe()`-г дуудна. 401/403 (үхсэн сешн) дээр `/api/auth/expired` (cookie-г бодитоор цэвэрлэж чадах GET route — RSC чадахгүй) → `/login?notice=expired` руу чиглүүлж, redirect давталтаас сэргийлдэг. 5xx дээр `<BackendUnavailable>`-г render хийж, сешнийг хадгалдаг.
- **Shell доторх RBAC:** `AppShell` нь `/api/rbac/me` (permission key-үүд)-г татаж, nav-г шүүдэг (`canSeeItem`). Admin/gateway хуудсууд **бас** server талын хамгаалалтыг хэрэгжүүлдэг (ж.нь `admin/gateway/guard.ts`). UI gate-үүд зөвхөн тохь ашиглалтын зорилготой — backend route бүрийг дахин баталгаажуулдаг.
- **Гарах:** `signOut()` → `POST /api/auth/logout` (backend refresh-г цуцалж, access-г deny-list хийдэг) → cookie-нуудыг цэвэрлэдэг → `dgov_sso_logout` байвал RP-initiated SSO гарах.

---

## 7. Build, хэрэгсэл ба аюулгүй байдлын header-үүд

- Script-ууд: `dev` (port 3000), `build`, `start`, `lint` (`next lint`), `test` (`vitest run`). CI нь `lint` + `build`-г ажиллуулна.
- `next.config.mjs`: `output: 'standalone'` (нимгэн Docker image), AASA well-known зам → `/api/aasa` руу mapping хийдэг `rewrites()`, болон бүх зам дээр хэрэгжих `headers()`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, бүрэн **CSP** (`default-src 'self'`, `connect-src 'self'` — BFF-only дүрэм, `frame-ancestors 'none'`, Google/Dropbox preview-ийн image/frame allow-list), болон production дээр HSTS.
- Тестүүд: `vitest` (`src/lib/*.test.ts` — `bff.test.ts`, `i18n.test.ts`, `navigation.test.ts`).

### Frontend env хувьсагчид (`frontend/.env.example`)

| Хувьсагч | Зорилго |
|-----|---------|
| `BACKEND_URL` | Server-only; Go API-ийн суурь (`/api/v1`-г `lib/api.ts` дотор нэмдэг). Default `http://localhost:8080`. |
| `COOKIE_SECURE` | `true`/`false`; production дээр secure руу fail-closed. |
| `APP_ORIGIN` | (кодод ашиглагддаг) CSRF origin шалгалт + OAuth redirect суурь. |
| `GOOGLE_CLIENT_ID` | (нийтийн) Google нэвтрэх товч. |

Бүх OAuth/SSO **secret**-үүд зөвхөн Go backend дээр байдаг, frontend дээр хэзээ ч биш.

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

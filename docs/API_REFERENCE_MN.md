# API Reference

> 🌐 [English](API_REFERENCE.md) · **Монгол**

Go backend-ийн REST интерфейс. Бүх маршрутууд **`/api/v1`** дор холбогдоно.
Албан ёсны, үргэлж хамгийн сүүлийн үеийн гэрээ нь автоматаар үүсгэгдсэн
OpenAPI спек юм — энэ хуудас нь гар аргаар бичсэн зураглал.

> **OpenAPI спек:** `GET /swagger/doc.json` (production-д
> `Bearer OBSERVABILITY_TOKEN`-ийн ард). `make swag`-аар дахин үүсгэнэ. Статик
> спек нь мөн `backend/docs/swagger.json` / `swagger.yaml`-д байрладаг.
> Текстэн гэрээ [backend/docs/API_CONTRACT.md](https://github.com/gerege-systems/government-template-platform/blob/main/backend/docs/API_CONTRACT.md)-д байгаа.

Холбоотой: [BACKEND.md](BACKEND_MN.md) · [SECURITY.md](SECURITY_MN.md) · [AI_AND_INTEGRATIONS.md](AI_AND_INTEGRATIONS_MN.md)

---

## Конвенцууд

- **Суурь зам (Base path):** `/api/v1`.
- **Auth:** хамгаалагдсан маршрутуудад `Authorization: Bearer <access_token>` (frontend BFF үүнийг httpOnly cookie-оос нийлүүлдэг).
- **Хариултын дугтуй (Response envelope)** — бүх хариулт нь `{ "status": bool, "message": string, "data": <payload|null>, "request_id": string }`.
- **Алдаанууд** — `apperror`-оос буулгасан: 400 BadRequest · 401 Unauthorized · 403 Forbidden · 404 NotFound · 409 Conflict · 422 validation (талбар тус бүрийн `data.errors`) · 500 internal (message үргэлж `"internal server error"`; жинхэнэ шалтгааныг лог-д бичдэг, хэзээ ч буцаадаггүй).
- **Body-ийн хязгаар** — глобал 1 MiB, `/auth`-д 4 KiB.
- **Хурдны хязгаар (Rate limits)** — auth ~5/мин, `/ai/*` ~20/мин, `/auth/eid/poll` 1/сек, gov бичилтүүд ~30/мин.

---

## Дэд бүтэц (Infrastructure) (`/api/v1`-ийн гадна)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | — | Амьд эсэх (Liveness) (үргэлж 200). |
| GET | `/ready` | — | Бэлэн эсэх (Readiness) (pgx + redis-ийг шалгана; уналттай бол 503). |
| GET | `/metrics` | prod: `Bearer OBSERVABILITY_TOKEN` | Prometheus метрикүүд. |
| GET | `/swagger/doc.json` | prod: `Bearer OBSERVABILITY_TOKEN` | OpenAPI спек. |

---

## Нэвтрэлт ба сесс (Auth & session) — `/auth`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/eid/start` | — | eID QR / төхөөрөмж холбох нэвтрэлт эхлүүлэх → session id + device-link URL. |
| POST | `/auth/eid/start-id` | — | Иргэний РД-аар eID нэвтрэлт эхлүүлэх (РД push). |
| POST | `/auth/eid/poll` | — | eID сесс-ийг санал асуух; `COMPLETE` үед token хос олгоно. |
| POST | `/auth/google` | — | Google нэвтрэлт / eID-link солилцоо. |
| DELETE | `/auth/google/link` | ✅ | Одоогийн хэрэглэгчээс Google-ийг салгах. |
| POST | `/auth/refresh` | — (refresh token) | Token хосыг эргүүлэх (нэг удаагийн refresh). |
| POST | `/auth/logout` | ✅ | Refresh-ийг хүчингүй болгож access token-ийг deny-list-д оруулах. |

> Сонгодог нууц үг/OTP/бүртгэлийн endpoint-ууд хэрэгжсэн бөгөөд тестлэгдсэн ч
> энэ build-д **маршрутлагдаагүй** (зөвхөн eID/Google/SSO нэвтрэлт) —
> [SECURITY.md](SECURITY_MN.md) §1-ийг үзнэ үү.

## DAN / dgov SSO (OIDC) — `/sso`

Үндсэн буух нэвтрэлт (DAN — dgov-ийн eID-д суурилсан үндэсний SSO).

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sso/start` | DAN/dgov OIDC нэвтрэлтийг эхлүүлэх (auth URL буцаана; state-ийг Redis-д хадгална). |
| POST | `/sso/callback` | Вэб чиглүүлэлтийн (redirect) солилцоо (state-ийг баталгаажуулж, зарцуулна). |
| POST | `/sso/native` | Native/mobile PKCE код солилцоо. |
| POST | `/sso/logout` | RP-initiated logout URL байгуулах. |

---

## Хэрэглэгчид ба профайл (Users & profile) — `/users`, `/me`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/users/me` | ✅ | Одоогийн хэрэглэгчийн профайл. |
| POST | `/me/latin-name` | ✅ | Латин бичгийн нэр тохируулах. |
| GET/POST/DELETE | `/me/signature` | ✅ | Хувийн гарын үсгийн зураг. |
| GET | `/users/me/eid/summary` | ✅ | eID хүний товч мэдээлэл. |
| GET | `/users/me/eid/certificates` | ✅ | eID сертификатын жагсаалт + тоо. |
| GET | `/users/me/eid/devices` | ✅ | Холбогдсон eID төхөөрөмжүүд. |
| GET | `/users/me/eid/activity` | ✅ | RP-хүрээт нэвтрэлт/гарын үсгийн түүх. |
| GET/POST/DELETE | `/users/me/eid/organizations…` | ✅ | Төлөөлдөг байгууллагууд + гарын үсэг зурагчид + тамга. |

## RBAC — `/rbac`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/rbac/me` | ✅ | Одоогийн хэрэглэгчийн зөвшөөрлийн түлхүүрүүд. |
| GET | `/rbac/permissions` | `roles.manage` | Зөвшөөрлийн каталог. |
| GET/POST/PUT/DELETE | `/rbac/roles…` | `roles.manage` | Role CRUD + role→permission багцууд. |

## Админ ба супер-админ (Admin & superadmin) — `/admin`, `/superadmin`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/admin/users` | `users.manage` | Хэрэглэгчид жагсаах (хуудаслалттай). |
| PUT | `/admin/users/{id}/role` · `/active` | `users.manage` | Role солих / идэвхжүүлэлт. |
| GET/PUT | `/admin/ai/prompts…` | `settings.manage` | AI `scope`/`instructions` prompt давхаргуудыг харах/шинэчлэх. |
| GET/POST | `/superadmin/admins…` | superadmin | Админ жагсаах/үүсгэх; олгох/цуцлах (аудитлагдана). |

## Аудит ба аюулгүй байдал (Audit & security) — `/audit`, `/security`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/audit` | admin | Hash-гинжлэгдсэн аудит лог. |
| GET | `/audit/verify` | admin | Аудитын hash гинжийг баталгаажуулах. |
| GET/POST | `/security/events` | ✅ | RASP аюулгүй байдлын үйл явдлууд (хэрэглэгчид өөрсдийнхийг оруулна; админууд бүгдийг жагсаана). |

---

## AI — `/ai`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/ai/chat` | ✅ | Function-calling чат; `{reply, steps, degraded}` буцаана. |
| POST | `/ai/stt` | ✅ | Яриаг текст болгох (Speech-to-text). |
| POST | `/ai/tts` | ✅ | Текстийг яриа болгох (Text-to-speech, WAV). |
| POST | `/ai/translate` | ✅ | Шууд орчуулга (+ сонголтоор TTS). |

## Төрийн үйлчилгээ (Government services) — `/gov`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/gov/services` · `/overview` | ✅ | Каталог + хяналтын самбар. |
| GET/POST | `/gov/applications` (+ `/{id}/cancel`) | ✅ | Иргэдийн өргөдлүүд. |
| GET/POST | `/gov/references` | ✅ | Лавлагааны хүсэлтүүд. |
| GET | `/gov/notifications` (+ `/{id}/read`, `/read-all`) | ✅ | Мэдэгдлүүд. |
| GET/POST | `/gov/payments` (+ `/{id}/pay`) | ✅ | Төлбөрүүд. |
| GET/POST | `/gov/appointments` (+ `/{id}/cancel`) | ✅ | Цаг захиалгууд. |

## Интеграцууд ба хадгалалт (Integrations & storage) — `/integrations`, `/gspace`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST/DELETE | `/integrations…` | ✅ | Гуравдагч талын OAuth холбох/жагсаах/салгах (`google-drive`, `dropbox`, `google-meet`); токенууд AES-256-GCM-ээр шифрлэгддэг. |
| GET/POST/DELETE | `/gspace…` | ✅ | Gerege Space SFTP файл хадгалалт (квотоор хязгаарлагдсан). |

## Тоон гарын үсэг (Digital signing) — `/sign`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/sign/init` | ✅ | PAdES PDF гарын үсгийн сесс эхлүүлэх (хувь хүн эсвэл байгууллагыг төлөөлж). |
| GET | `/sign/{id}` | ✅ | Гарын үсгийн сесс-ийг санал асуух (эзэмшил шалгагдана). |
| GET | `/sign/{id}/download` | ✅ | Гарын үсэг зурсан PDF-ийг татах. |

## Байгууллагууд (Organizations) — `/org`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/org` | ✅ | Байгууллагууд жагсаах / үүсгэх. |
| GET | `/org/{id}` · `/org/lookup/{regNo}` | ✅ | Дэлгэрэнгүй / регистрийн лавлалт. |
| POST/PUT/DELETE | `/org/{id}/members…` | ✅ | Гишүүнчлэлийн удирдлага. |

## API Gateway консол — `/gateway`

Бүгд `gateway.manage` шаарддаг. `services`, `routes`, `consumers`
(+ `/keys`), `policies`-ийн CRUD, түүнчлэн `GET /gateway/overview` ба
`/gateway/logs`. API түлхүүрүүд нь `gk_live_…`; зөвхөн SHA-256 hash хадгалагдах
бөгөөд plaintext-ийг яг нэг л удаа буцаана.

## Гол лавлалт (Core lookup) — `/core`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/core/users` · `/core/organizations` | admin | Прокси хийсэн Gerege Core регистрийн хайлт. |

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

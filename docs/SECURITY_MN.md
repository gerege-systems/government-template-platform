# Аюулгүй байдал

> 🌐 [English](SECURITY.md) · **Монгол**

Стекийн турш хэрэгжүүлсэн аюулгүй байдлын хяналтууд: JWT нэвтрэлтийн загвар, RLS
түрээслэгч тусгаарлалт, аюулгүй байдлын толгойнууд (headers), CORS, хурд
хязгаарлалт, CSRF, аудит бүртгэл, оролтын шалгалт болон нууц түлхүүр удирдлага.
Энд бичигдсэн бүх баримт кодтой тулган баталгаажуулагдсан.

> Эмзэг цоорхойг **мэдээлэхийн** тулд язгуур [SECURITY.md](https://github.com/gerege-systems/government-template-platform/blob/main/SECURITY.md)-ыг үзнэ үү.
> Backend-ийн ASVS замын зураглал болон мэдэгдэж буй цоорхойнуудыг
> [backend/docs/SECURITY.md](https://github.com/gerege-systems/government-template-platform/blob/main/backend/docs/SECURITY.md)-аас үзнэ үү.

Холбоотой: [BACKEND.md](BACKEND_MN.md) · [DATABASE.md](DATABASE_MN.md) · [ARCHITECTURE.md](ARCHITECTURE_MN.md)

---

## 1. Нэвтрэлтийн загвар — эргэлт (rotation) ба хүчингүйжүүлэлт (revocation) бүхий JWT

Гол хэсэг: `backend/pkg/jwt/jwt.go`.

- **HS256** (HMAC-SHA256), нэг ширхэг хуваалцсан `JWT_SECRET`.
- **Хоёр төрлийн токен**-ыг гарын үсэг зурсан `Kind` claim-ээр ялгадаг. `ParseToken` нь refresh токенийг татгалзаж, `ParseRefreshToken` нь access токенийг татгалзана — `Kind` нь гарын үсэг зурсан payload дотор байдаг тул хулгайлагдсан refresh токеныг access токен болгон дахин ашиглах боломжгүй.
- **Задлан шинжлэх (parse) хатууруулалт**: keyfunc нь HMAC биш аргыг татгалзана (alg-confusion хамгаалалт), нэмээд `WithValidMethods(["HS256"])`, `WithIssuer(...)` (хуваалцсан нууц түлхүүрийн доор үйлчилгээ хооронд токен дахин ашиглахыг блоклоно), болон `WithExpirationRequired()`.
- **Claim-ууд**: access нь `UserID`, `IsAdmin`, `RoleID`, `Email`, `jti`, `exp`, `iss`, `iat` хадгалдаг; refresh нь санаатайгаар ямар ч role/admin тэмдэглэгээ **агуулдаггүй**.
- **Хугацаа**: access = `JWT_EXPIRED` цаг (хязгаар 1–24), refresh = `JWT_REFRESH_EXPIRED` хоног (хязгаар 1–365, анхдагч 7).

### Гаргалт / эргэлт / хүчингүйжүүлэлт

| Үйлдэл | Зан төлөв |
|--------|-----------|
| **Login** | Хос токен гаргана; refresh jti-г Redis `refresh:<jti>`-д хадгална (TTL = refresh хугацаа). |
| **Refresh** | **`refresh:<jti>`-ийн атомик `GetDel`** нь refresh-ийг нэг удаагийн болгож, replay/TOCTOU цонхыг хаана; хэрэглэгчийг дахин шалгана (идэвхгүй болсон бүртгэл refresh хийхээ зогсооно), нууц үгийн cutoff-ыг шалгана; шинэ хос токен гаргаж хадгална. |
| **Logout** | `refresh:<jti>`-ийг устгана (үндсэн хүчингүйжүүлэлт) **ба** access jti-г `access_deny:<jti>`-д хамгийн боломжийн хэмжээнд (best-effort) нэмнэ (TTL = access хугацаа). |
| **Нууц үг солих/шинэчлэх** | `pwd_cutoff:<userID>` = unix-sec-ыг бичнэ; refresh болон auth middleware нь `iat <= cutoff` бүхий аливаа токеныг татгалзана (JWT `iat` нь секундээр таслагддаг тул `<=`). |

Refresh токенууд зөвхөн **Redis-д** амьдардаг (байгаа нь = хүчинтэй); Postgres-д
refresh-токены хүснэгт байхгүй.

### Login түгжээ (lockout) ба тоолол (enumeration) эсэргүүцэл

- **Бүртгэл тус бүрийн түгжээ**: Redis тоолуур `login_attempts:<email>`-ыг хэрэглэгчийг хайхаас **өмнө** нэмэгдүүлдэг (тиймээс мэдэгдээгүй email-үүд бас тоологдоно); анхдагчаар 10 оролдлого / 15 минутын түгжээ → `403`. IP тус бүрийн хязгаарлалт алдаж болзошгүй удаан тархсан brute-force-ыг барьж авна.
- **Enumeration бууруулалт**: мэдэгдэхгүй email-ийн зам нь цагийг тэгшитгэхийн тулд **хуурамч bcrypt харьцуулалт** ажиллуулна; "ийм хэрэглэгч байхгүй" болон "буруу нууц үг" аль аль нь ижил ерөнхий `401 invalid email or password` буцаана.

### Нууц үг ба OTP

- **bcrypt** нь `BCRYPT_COST`-оос авсан cost-той (хязгаар 10–31, анхдагч 12). Хязгаараас гарсан cost нь `bcrypt.DefaultCost` руу шилжинэ (хэзээ ч panic хийдэггүй). Нууц үгийн DTO дүрэм: `min=12,max=72,strongpassword` (том+жижиг+тоо+тусгай тэмдэгт). eID/passwordless хэрэглэгчид `Password=""` бөгөөд хэзээ ч нууц үгээр нэвтэрч чадахгүй.
- **OTP-баталгаажсан бүртгэл**: `Register` нь **идэвхгүй** хэрэглэгч үүсгэдэг; код үүсгэх/хэшлэх/илгээх ажлыг GeregeCloud **Verify API**-д даатгадаг (апп нь зөвхөн буцаагдсан `request_id`-г хадгалдаг). Email тус бүрийн хоёр дахь тоолуур OTP оролдлогыг хязгаарладаг; `ForgotPassword`/`ResetPassword` ижил загварыг дагадаг.

> **Одоогийн холболтын тэмдэглэл.** Нууц үг / OTP / сонгодог бүртгэл+нэвтрэлтийн урсгалууд
> бүрэн хэрэгжсэн бөгөөд unit тестээр шалгагдсан (`usecases/auth/*`, `handlers/v1/auth/*`) ч
> энэ бүтээцэд HTTP маршрут болгон **холбогдоогүй** байгаа — `route_auth.go` нь зөвхөн
> eID + Google login, SSO маршрутууд болон сессийн амьдралын мөчлөгийг
> (`refresh`/`logout`/`poll`) ил гаргадаг. **Үндсэн буух хуудасны нэвтрэлт нь DAN SSO**
> (dgov-ийн үндэсний SSO, eID-д тулгуурласан); шууд eID нэвтрэлт хэвээр байна. Сонгодог
> нэвтрэлтийг дахин идэвхжүүлэхийн тулд одоо байгаа handler-уудыг холбоно уу.

---

## 2. Auth middleware (`middleware_auth.go`)

Баталгаажсан хүсэлт бүрд, дарааллаар:

1. `Authorization: Bearer <token>` шаардана (яг таарах scheme).
2. `ParseToken` (гарын үсэг, issuer, exp; refresh төрлийг татгалзана).
3. **Access deny-list** шалгалт `access_deny:<jti>` — **fail-closed**: жинхэнэ Redis алдаа (алдаа биш, miss биш) нь access биш **503** буцаана.
4. **Нууц үг эргэлтийн cutoff** `pwd_cutoff:<userID>`-той `iat <= cutoff` → хүчингүйжүүлнэ; мөн адил fail-closed 503.
5. Эрхийн хаалга (admin холболтууд).
6. `CurrentUser`-ыг контекстэд **ба** RLS-ийн таних тэмдэг (`WithAdmin`/`WithUser`)-ийг оруулна.

Хүчингүйжүүлэлтийн *шалгалтууд* нь fail-closed (Redis алдаанд 503); logout deny-list
болон cutoff *бичилтүүд* нь best-effort (үхэлд хүргэдэггүй). Энэ тэгш бус байдал санаатай.

---

## 3. Аюулгүй байдлын толгойнууд (`middleware_security.go`, глобал)

Backend-ийн хариулт бүрд тавигдана:

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
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` — **зөвхөн production** (`http://localhost` дээр HSTS-ыг бэхлэхээс зайлсхийхийн тулд dev-д орхигдоно) |

**Frontend** нь HTML хариултуудад өөрийн илүү баялаг CSP тавьдаг ([FRONTEND.md](FRONTEND_MN.md) §7-г үзнэ үү); backend нь JSON API үйлчилдэг тул түүний CSP нь `'none'`-д түгжигдсэн.

---

## 4. CORS (`middleware_cors.go`, глобал)

- `ALLOWED_ORIGINS`-оос авсан зөвшөөрлийн жагсаалт (production нь түүнийг хоосон биш байхыг **шаарддаг**).
- Зөвхөн яг таарах origin-уудыг тусгана, `Vary: Origin` нэмнэ, зөвшөөрлийн жагсаалтын горимд `Access-Control-Allow-Credentials: true` тавина.
- **Wildcard аюулгүй байдал**: тохируулсан ганц origin нь `*` бол credentials идэвхгүй болно — хэзээ ч `*` + credentials хамт биш.
- Аргууд `GET, POST, PUT, PATCH, DELETE, OPTIONS`; preflight `max-age` 12 цаг; OPTIONS нь 204-өөр богиносгож таслана.

---

## 5. Хурд хязгаарлалт (`middleware_ratelimit.go`)

Клиент IP тус бүрийн **санах ойн доторх** token bucket (`golang.org/x/time/rate`) — **Redis биш**,
тиймээс хязгаарууд нь процесс тус бүрийнх бөгөөд репликууд хооронд хуваалцдаггүй. Клиент IP-г
итгэмжлэгдсэн proxy-г мэддэг `clientIP` шийддэг (X-Forwarded-For нь эсрэг тал
`TRUSTED_PROXIES`-д байгаа үед л хүндэтгэгддэг, эс бөгөөс `RemoteAddr` — хязгаарлалт/аудитын XFF хуурмаглалаас сэргийлнэ).

| Limiter | Rate | Хамрах хүрээ |
|---------|------|-------------|
| auth | ~5/мин, burst 5 | `/v1/auth` start/google/refresh/logout |
| AI | ~20/мин, burst 10 | `/v1/ai/*` (~8–10 live-translation chunk/мин-д тааруулсан) |
| eID poll | 1/сек, burst 30 | `/v1/auth/eid/poll` (25 секундын long-poll) |
| gov write | ~30/мин, burst 15 | gov/assets/gspace/eid-profile өөрчлөлтүүд |

`X-RateLimit-*` толгойнууд болон bucket хоосрох үед JSON `429` + `Retry-After` гаргана. Сервер нь
proxy-ийн ард `TRUSTED_PROXIES` хоосон байвал boot-д анхааруулна (бүх IP нэг bucket-д нийлнэ).

---

## 6. CSRF

Go API нь төлөвгүй (stateless) **Bearer-token** API — backend дээр cookie сессийн auth
байхгүй — тиймээс сонгодог CSRF нь токеноор баталгаажсан endpoint-уудад хамаарахгүй. CSRF
хамгаалалт нь **frontend BFF**-д амьдардаг: browser-ийн өөрчлөлт хийх дуудлагууд
`x-dgov-csrf` толгой нэмдэг бөгөөд `lib/bff.ts checkOrigin` нь өөрчлөлт хийх маршрут бүрд
түүнийг (+ `Origin` таарцыг) хэрэгжүүлдэг. [FRONTEND.md](FRONTEND_MN.md) §1-г үзнэ үү.

---

## 7. Мөр түвшний аюулгүй байдал (Row-Level Security)

Түрээслэгч тусгаарлалтын гол механизм — бүрэн дэлгэрэнгүйг [DATABASE.md](DATABASE_MN.md) §3-т үзнэ үү. Хураангуй:

- Хэрэглэгч тус бүрийн хүснэгт бүрд `ENABLE` + **`FORCE ROW LEVEL SECURITY`**; гурван бодлогын багц (service / admin / self). Таарах бодлого байхгүй ⇒ тэг мөр (**fail-closed**).
- Таних тэмдгийг контекстэд (`rls.Identity`) авч явдаг бөгөөд `withRLS` гүйлгээ дотор `SET LOCAL` GUC-ээр (`app.user_id` / `app.user_role`) гүйлгээ тус бүрд нийтэлдэг — гүйлгээнд хамааруулсан тул pool-ийн холболтуудаар алдагдах боломжгүй.
- **Boot guard** (`driver_pgx.go`): api-ийн DB role нь `rolsuper`/`rolbypassrls` (энэ нь RLS-ыг чимээгүйхэн тойрч гарна) байвал boot нь **production-д амжилтгүй болно**, development-д анхааруулна.
- **Production TLS guard** (`config.go`): production `DB_POSTGRE_URL` нь `sslmode=verify-full` эсвэл `verify-ca` ашиглах ёстой.

---

## 8. Оролтын шалгалт ба SQL

- **Struct-tag шалгалт** (`go-playground/validator/v10` нь `ValidatePayloads`-аар); алдаанууд JSON талбарын нэрээр мэдээлэгдэнэ → HTTP **422**; захиалгат `strongpassword` дүрэм.
- **Зөвхөн параметржүүлсэн query** — pgx дээрх гараар бичсэн SQL, хаа сайгүй `$N` bind param (динамик шүүлтүүрт ч гэсэн, хэзээ ч мөрөөр залгасан утга биш). ORM байхгүй. Давхардлын зөрчил `23505` → Conflict.
- Email-үүдийг хайх/хадгалахаас өмнө хэвийн болгодог (жижигрүүлж + тайрдаг).
- Биеийн (body) хязгаар: глобал **1 MiB**, `/v1/auth` бүлэг **4 KiB** — Content-Length урьдчилсан шалгалт болон `http.MaxBytesReader` хоёулаа хэрэгжүүлдэг.
- HTTP серверийн хатууруулалт: `ReadHeaderTimeout 10s`, `ReadTimeout 30s`, `IdleTimeout 120s`, `MaxHeaderBytes 16 KiB`, нэмээд pgx руу тархдаг хүсэлт тус бүрийн 30 секундын `TimeoutMiddleware` (slowloris / OWASP API4 хамгаалалт).

---

## 9. Аудит бүртгэл

Гурван бие даасан механизм:

1. **Урсгал аюулгүй байдлын үйл явдлын бүртгэл** (`pkg/audit/audit.go`) — `io.Writer` руу JSON мөрүүд (анхдагч stderr). Үйл явдлууд: register, login амжилт/бүтэлгүйтэл, logout, refresh, otp_sent/verify, нууц үг change/forgot/reset. Талбарууд нь user_id, email, ip, user_agent, request_id, trace_id багтаана.
2. **Тогтвортой хадгалагдсан хэш-гинжлэгдсэн `audit_log` хүснэгт** (`pkg/audit/chain.go`) — мөр бүрийн `chain_hash = SHA-256(prevHash || canonical_json(entry))`; бичилтүүд `pg_advisory_xact_lock`-оор цувралжсан. `VerifyChain` нь genesis-ээс дахин тооцоолж, эвдэрсэн эхний мөрийг буцаана. Зөвхөн admin-ийн унших API; superadmin-ийн өөрчлөлтүүдэд ашиглагддаг. Frontend нь `/audit/verify` үйлдлийг ил гаргадаг.
3. **RASP хэв маягийн `security_events` хүснэгт** — баталгаажсан хэрэглэгчид өөрсдийн үйл явдлыг оруулдаг (RLS хэрэгжүүлдэг); admin-ууд бүгдийг жагсаадаг.

---

## 10. Нууц түлхүүр ба оператор endpoint-ууд

- **Gitignore хийсэн env файлууд**: `.env`, `.env.*`, `*.env`, `backend.env` (`*.env.example` загварууд хадгалагддаг). Хэзээ ч нууцаа commit хийж болохгүй.
- **`JWT_SECRET` ≥ 32 тэмдэгт** эсвэл config шалгалт амжилтгүй болно (HS256 256-бит энтропи). Түүнийг эргүүлэх нь бүх хүнийг албадан logout хийнэ.
- **Production-д заавал**: `DB_POSTGRE_URL` (verify-full/verify-ca), `ALLOWED_ORIGINS`, `VERIFY_API_KEY`; `REDIS_PASSWORD` нь бүх орчинд шаардлагатай.
- **Оператор-endpoint хаалга** (`middleware_observability_gate.go`): production-д `/metrics` + `/swagger/doc.json` нь `Authorization: Bearer <OBSERVABILITY_TOKEN>` шаарддаг (тогтмол хугацаагаар харьцуулдаг); аливаа таарахгүй нь **404** буцаана (оршин байгааг нуудаг); хоосон токен = бүрэн хаалттай. `/health` + `/ready` нь нээлттэй хэвээр байна.
- **`apperror.InternalCause`** — сан/дотоод бүтэлгүйтэл ил гарах болгонд (токен гаргах, DB алдаа, Verify-API алдаа), бодит шалтгааныг лог-д хадгалахын зэрэгцээ клиент рүү харсан тогтмол `"internal server error"` (HTTP 500) үүсгэдэг. Төрөлжсөн алдаанууд (NotFound/Unauthorized/…) нь санаатайгаар ерөнхий байдаг.
- **Гуравдагч талын OAuth токенууд** `user_integrations`-д **AES-256-GCM** шифрлэгдсэн (`INTEGRATION_ENC_KEY`); зөвхөн сервер талд тайлагддаг, хэзээ ч browser руу илгээгддэггүй.

---

## 11. Баримт бичиг ба бодит байдлын хоорондын зөрүү

Хоёр зүйл өөр газар тайлбарлагдсан ч энэ repo-д **байхгүй** — production-д зориулан хатууруулах үед
эдгээрийг онцлон анхаарна уу:

1. **Repo дотор CI / нууц скан байхгүй.** `.github/` директор байхгүй. CI хаалганууд (gofmt, `go test -race`, gitleaks, govulncheck) нь CLAUDE.md-д тайлбарлагдсан бөгөөд `backend/Makefile` (`make pre-push`)-оор тусгагдсан ч энд workflow файл байхгүй — автомат хаалганд найдахаас өмнө нэгийг нэмнэ үү. [DEPLOYMENT.md](DEPLOYMENT_MN.md) §CI-г үзнэ үү.
2. **Сонгодог нууц үг/OTP нэвтрэлт маршрутгүй** (§1-г үзнэ үү) — энэ бүтээцэд зөвхөн eID/Google/SSO.

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

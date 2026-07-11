# Тохиргооны лавлах

> 🌐 [English](CONFIGURATION.md) · **Монгол**

Платформын уншдаг бүх орчны хувьсагчийг файл/үйлчилгээгээр нь бүлэглэн, зорилго,
анхны утга, түүнчлэн нууц эсэх эсвэл production-д заавал шаардлагатай эсэхийг нь
харуулав.

Тохиргоог `backend/internal/config/config.go` (viper) ачаална: энэ нь `.env`
файлыг уншиж (файл байхгүй байсан ч зүгээр — 12-factor зарчим), `AutomaticEnv` +
тодорхой `BindEnv`-ийг хэрэглээд, дараа нь `applyDefaults` болон `validate`
гүйцэтгэнэ. Frontend нь орчноо шууд `process.env`-ээс уншина.

Холбоотой: [DEPLOYMENT_MN.md](DEPLOYMENT_MN.md) · [SECURITY_MN.md](SECURITY_MN.md)

---

## Файлуудын товч тойм

| File | Loaded by | Committed? |
|------|-----------|-----------|
| `./.env` | Зөвхөн Docker Compose интерполяци (`${...}`) | **gitignored** |
| `./backend.env` | `api` + `migrate`-д `/app/.env` болгон холбогдож, viper уншина | **gitignored** |
| `backend/internal/config/.env.example` | backend-ийн бүрэн схемийн загвар | committed |
| `frontend/.env.example` | frontend-ийн загвар | committed |

Gitignore нь `.env`, `.env.*`, `*.env`, `backend.env`, `*.pem`, `*.key`-г
хамардаг (`*.env.example` загваруудыг үлдээдэг).

---

## `./.env` — compose интерполяци

| Var | Purpose | Example / default | Secret |
|-----|---------|-------------------|:------:|
| `POSTGRES_USER` | DB superuser (зөвхөн `migrate` ашигладаг) | `postgres` | |
| `POSTGRES_PASSWORD` | superuser-ийн нууц үг | `openssl rand -hex 24` | ✅ |
| `POSTGRES_DB` | өгөгдлийн сангийн нэр | `gerege_template` | |
| `APP_DB_USER` | initdb-ийн үүсгэдэг хамгийн бага эрхтэй role | `app_user` | |
| `APP_DB_PASSWORD` | app_user-ийн нууц үг | random | ✅ |
| `APP_DB_DSN` | api холбогдох keyword DSN (api үйлчилгээн дээр `DB_POSTGRE_DSN`-г дарж бичдэг) | `host=db port=5432 user=app_user password=… dbname=gerege_template sslmode=disable` | ✅ |
| `REDIS_PASS` | redis `requirepass` | random | ✅ |
| `APP_ORIGIN` | яг нийтийн origin (BFF CSRF origin шалгалт + OAuth redirect суурь) | `https://your.domain.mn` | |
| `WEB_PORT` | nginx прокси хийдэг loopback host порт | `3007` | |
| `GOOGLE_CLIENT_ID` | Google нэвтрэх товч (нийтийн; хоосон → идэвхгүй) | — | |
| `GOOGLE_DRIVE_*`, `DROPBOX_*`, `GOOGLE_MEET_*` (id/secret) | гуравдагч талын интеграцийн OAuth; хоосон → тухайн карт идэвхгүй | — | ✅ (secret хэсэг) |

---

## `./backend.env` — backend (api + migrate)

### Гол (заавал — хоосон бол boot амжилтгүй болно)

| Var | Purpose | Default / bounds | Secret |
|-----|---------|------------------|:------:|
| `PORT` | сонсох порт | `8080` (1–65535) | |
| `ENVIRONMENT` | `development` эсвэл `production` (яг таг) | — | |
| `DEBUG` | дэлгэрэнгүй лог | `false` | |
| `DB_POSTGRE_DRIVER` | driver-ийн нэр | `postgres` | |
| `DB_POSTGRE_DSN` | **dev** DSN (`sslmode=disable` зүгээр) | — | ✅ |
| `DB_POSTGRE_URL` | **prod** DSN — заавал `sslmode=verify-full` эсвэл `verify-ca` байх ёстой | — | ✅ |
| `JWT_SECRET` | HS256 гарын үсгийн түлхүүр — **≥ 32 тэмдэгт** | — | ✅ |
| `JWT_EXPIRED` | access-token-ийн ашиглалтын хугацаа (цаг) | 1–24 | |
| `JWT_ISSUER` | token-ийг олгогч | ж.нь `your.domain.mn` | |
| `REDIS_HOST` | `host:port` | `redis:6379` | |
| `REDIS_PASS` | redis нууц үг | — | ✅ |
| `REDIS_EXPIRED` | анхны cache TTL (минут) | ≥1 | |

### Гол (анхны утгатай)

| Var | Purpose | Default |
|-----|---------|---------|
| `JWT_REFRESH_EXPIRED` | refresh-ийн ашиглалтын хугацаа (хоног) | 7 (1–365) |
| `BCRYPT_COST` | bcrypt cost | 12 (10–31) |
| `OTP_MAX_ATTEMPTS` | OTP баталгаажуулах оролдлого | 5 |
| `ALLOWED_ORIGINS` | таслалаар тусгаарласан CORS жагсаалт; хоосон → dev-д `*`; **prod-д заавал** | — |
| `TRUSTED_PROXIES` | XFF-г итгэх таслалаар тусгаарласан IP/CIDR; хоосон → битгий итгэ (nginx-ийн ард заавал тохируул) | — |
| `DB_MAX_OPEN_CONNS` / `DB_MAX_IDLE_CONNS` / `DB_CONN_MAX_LIFE_MINS` | pool-ийн хэмжээ | 25 / 5 / 15 |
| `OTEL_EXPORTER` | `` (noop) / `stdout` / `otlp` | noop |
| `OTEL_SAMPLE_RATIO` | trace-ийн түүврийн харьцаа | 1.0 |
| `OBSERVABILITY_TOKEN` | prod-д `/metrics` + `/swagger`-г хамгаалах bearer (хоосон → 404) | — ✅ |

### Гадаад үйлчилгээ (хоосон → prod-д шаардлагагүй бол функц идэвхгүй)

| Var(s) | Feature | Notes |
|--------|---------|-------|
| `VERIFY_API_BASE`, `VERIFY_API_KEY`, `VERIFY_CHANNEL` | OTP (GeregeCloud Verify) | `VERIFY_API_KEY` **production-д заавал** |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_VOICE`, `GEMINI_API_BASE`, `AI_SCOPE_PROMPT` | AI pipeline | хоосон түлхүүр → AI endpoint-ууд 500 буцаана |
| `XYP_API_BASE`, `XYP_CLIENT_ID`, `XYP_CLIENT_SECRET` | байгууллагын бүртгэлийн хайлт | сонголттой |
| `EID_BASE_URL`, `EID_RP_UUID`, `EID_RP_NAME`, `EID_RP_SECRET`, `EID_CERT_LEVEL`, `EID_CALLBACK_URL`, `EID_DISPLAY_TEXT` | eID нэвтрэлт | `EID_BASE_URL`-ийн анхны утга `https://eidmongolia.mn/v3`, cert level `ADVANCED` |
| `SSO_ISSUER`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `SSO_REDIRECT_URI`, `SSO_SCOPE`, `SSO_NATIVE_CLIENT_ID` | DAN / dgov SSO (OIDC) — үндсэн нэвтрэлт | issuer-ийн анхны утга `https://sso.dgov.mn` (prod-д DAN issuer-ээр тохируулна); `SSO_NATIVE_CLIENT_ID`-ийн анхны утга `template-dgov-mn-ios` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google нэвтрэлт | |
| `GSPACE_HOST`, `GSPACE_PORT`, `GSPACE_USER`, `GSPACE_PASSWORD`, `GSPACE_BASE_PATH`, `GSPACE_QUOTA_BYTES` | Gerege Space SFTP | порт 22, квот 2 MB-ийн анхны утгууд |
| `CORE_API_BASE`, `CORE_API_TOKEN` | Gerege Core хайлт | суурь `https://core.dgov.mn` |
| `INTEGRATION_ENC_KEY` | хадгалсан 3rd-party token-уудад зориулсан AES-256-GCM түлхүүр | prod-д хүчтэй утга тохируул |
| `SIGN_SIGNER_CERT_FILE`, `SIGN_SIGNER_KEY_FILE` | PAdES Document-Signer PEM | **prod-д заавал**; dev өөрөө self-sign хийнэ |
| `SUPERADMIN_EMAIL` | boot үед байгаа хэрэглэгчийг super admin болгож дэвшүүлнэ (best-effort) | |

---

## `web` (frontend)

| Var | Purpose | Default |
|-----|---------|---------|
| `BACKEND_URL` | Go API суурь (BFF `/api/v1`-г залгана); compose дотор дотоод `http://api:8080` | `http://localhost:8080` |
| `NODE_ENV` | cookie-secure анхны утга + HSTS | — |
| `HOSTNAME` | Next standalone-ийн bind хаяг | `0.0.0.0` |
| `PORT` | frontend порт | `3000` |
| `COOKIE_SECURE` | httpOnly cookie-ийн `Secure` тэмдэг (HTTPS дээр заавал `true`) | prod: true |
| `APP_ORIGIN` | CSRF origin шалгалт + OAuth redirect суурь | — |
| `GOOGLE_CLIENT_ID` | Google нэвтрэх товч (нийтийн) | — |

Бүх OAuth/SSO **нууцууд** зөвхөн backend дээр л байрлана.

---

## Production хамгаалалтууд (`config.go`-д хэрэгжсэн)

`ENVIRONMENT=production` үед дараах нөхцөлүүд хангагдаагүй бол boot **амжилтгүй**
болно:

- `DB_POSTGRE_URL` нь `sslmode=verify-full` (эсвэл `verify-ca`)-тай хүчинтэй URL байх.
- `ALLOWED_ORIGINS` хоосон биш байх.
- `VERIFY_API_KEY` тохируулагдсан байх.
- api-ийн DB role нь superuser / BYPASSRLS role **биш** байх (boot үед `pg_roles`-той шалгагдана — эс тэгвэл RLS чимээгүйхэн алгасагдана).

Үргэлж хэрэгждэг (бүх орчинд): `JWT_SECRET` ≥ 32 тэмдэгт; `JWT_EXPIRED` 1–24 цаг;
`JWT_REFRESH_EXPIRED` 1–365 хоног; `BCRYPT_COST` 10–31; `REDIS_PASS`
тохируулагдсан; pool `idle ≤ open`; `ENVIRONMENT` яг таг `development` эсвэл
`production`.

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон
Claude AI хамтран бүтээв, 2026.

# Configuration Reference

> 🌐 **English** · [Монгол](CONFIGURATION_MN.md)

Every environment variable the platform reads, grouped by file/service, with
purpose, default, and whether it is a secret or production-required.

Config is loaded by `backend/internal/config/config.go` (viper): it reads a `.env`
file (a missing file is fine — 12-factor), applies `AutomaticEnv` + explicit
`BindEnv`, then `applyDefaults` and `validate`. The frontend reads its env
directly from `process.env`.

Related: [DEPLOYMENT.md](DEPLOYMENT.md) · [SECURITY.md](SECURITY.md)

---

## Files at a glance

| File | Loaded by | Committed? |
|------|-----------|-----------|
| `./.env` | Docker Compose interpolation only (`${...}`) | **gitignored** |
| `./backend.env` | mounted into `api` + `migrate` at `/app/.env`; read by viper | **gitignored** |
| `backend/internal/config/.env.example` | the full backend schema template | committed |
| `frontend/.env.example` | frontend template | committed |

Gitignore covers `.env`, `.env.*`, `*.env`, `backend.env`, `*.pem`, `*.key`
(the `*.env.example` templates are kept).

---

## `./.env` — compose interpolation

| Var | Purpose | Example / default | Secret |
|-----|---------|-------------------|:------:|
| `POSTGRES_USER` | DB superuser (used by `migrate` only) | `postgres` | |
| `POSTGRES_PASSWORD` | superuser password | `openssl rand -hex 24` | ✅ |
| `POSTGRES_DB` | database name | `gerege_template` | |
| `APP_DB_USER` | least-privilege role created by initdb | `app_user` | |
| `APP_DB_PASSWORD` | app_user password | random | ✅ |
| `APP_DB_DSN` | keyword DSN the api connects with (overrides `DB_POSTGRE_DSN` on the api service) | `host=db port=5432 user=app_user password=… dbname=gerege_template sslmode=disable` | ✅ |
| `REDIS_PASS` | redis `requirepass` | random | ✅ |
| `APP_ORIGIN` | exact public origin (BFF CSRF origin check + OAuth redirect base) | `https://your.domain.mn` | |
| `WEB_PORT` | loopback host port nginx proxies to | `3007` | |
| `GOOGLE_CLIENT_ID` | Google login button (public; blank → inert) | — | |
| `GOOGLE_DRIVE_*`, `DROPBOX_*`, `GOOGLE_MEET_*` (id/secret) | third-party integration OAuth; blank → that card is inert | — | ✅ (secret half) |

---

## `./backend.env` — backend (api + migrate)

### Core (required — boot fails if empty)

| Var | Purpose | Default / bounds | Secret |
|-----|---------|------------------|:------:|
| `PORT` | listen port | `8080` (1–65535) | |
| `ENVIRONMENT` | `development` or `production` (exact) | — | |
| `DEBUG` | verbose logging | `false` | |
| `DB_POSTGRE_DRIVER` | driver name | `postgres` | |
| `DB_POSTGRE_DSN` | **dev** DSN (`sslmode=disable` OK) | — | ✅ |
| `DB_POSTGRE_URL` | **prod** DSN — must be `sslmode=verify-full` or `verify-ca` | — | ✅ |
| `JWT_SECRET` | HS256 signing key — **≥ 32 chars** | — | ✅ |
| `JWT_EXPIRED` | access-token lifetime (hours) | 1–24 | |
| `JWT_ISSUER` | token issuer | e.g. `your.domain.mn` | |
| `REDIS_HOST` | `host:port` | `redis:6379` | |
| `REDIS_PASS` | redis password | — | ✅ |
| `REDIS_EXPIRED` | default cache TTL (minutes) | ≥1 | |

### Core (defaulted)

| Var | Purpose | Default |
|-----|---------|---------|
| `JWT_REFRESH_EXPIRED` | refresh lifetime (days) | 7 (1–365) |
| `BCRYPT_COST` | bcrypt cost | 12 (10–31) |
| `OTP_MAX_ATTEMPTS` | OTP verify attempts | 5 |
| `ALLOWED_ORIGINS` | comma CORS list; empty → `*` in dev; **required in prod** | — |
| `TRUSTED_PROXIES` | comma IP/CIDR to trust XFF from; empty → don't trust (must set behind nginx) | — |
| `DB_MAX_OPEN_CONNS` / `DB_MAX_IDLE_CONNS` / `DB_CONN_MAX_LIFE_MINS` | pool sizing | 25 / 5 / 15 |
| `OTEL_EXPORTER` | `` (noop) / `stdout` / `otlp` | noop |
| `OTEL_SAMPLE_RATIO` | trace sample ratio | 1.0 |
| `OBSERVABILITY_TOKEN` | bearer guarding `/metrics` + `/swagger` in prod (empty → 404) | — ✅ |

### External services (blank → feature inert unless prod-required)

| Var(s) | Feature | Notes |
|--------|---------|-------|
| `VERIFY_API_BASE`, `VERIFY_API_KEY`, `VERIFY_CHANNEL` | OTP (GeregeCloud Verify) | `VERIFY_API_KEY` **required in production** |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_VOICE`, `GEMINI_API_BASE`, `AI_SCOPE_PROMPT` | AI pipeline | blank key → AI endpoints 500 |
| `XYP_API_BASE`, `XYP_CLIENT_ID`, `XYP_CLIENT_SECRET` | org registry lookup | optional |
| `EID_BASE_URL`, `EID_RP_UUID`, `EID_RP_NAME`, `EID_RP_SECRET`, `EID_CERT_LEVEL`, `EID_CALLBACK_URL`, `EID_DISPLAY_TEXT` | eID login | `EID_BASE_URL` defaults to `https://eidmongolia.mn/v3`, cert level `ADVANCED` |
| `SSO_ISSUER`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `SSO_REDIRECT_URI`, `SSO_SCOPE`, `SSO_NATIVE_CLIENT_ID` | DAN / dgov SSO (OIDC) — the primary login | issuer defaults to `https://sso.dgov.mn` (set to the DAN issuer in prod); `SSO_NATIVE_CLIENT_ID` defaults to `template-dgov-mn-ios` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google login | |
| `GSPACE_HOST`, `GSPACE_PORT`, `GSPACE_USER`, `GSPACE_PASSWORD`, `GSPACE_BASE_PATH`, `GSPACE_QUOTA_BYTES` | Gerege Space SFTP | port 22, quota 2 MB defaults |
| `CORE_API_BASE`, `CORE_API_TOKEN` | Gerege Core lookup | base `https://core.dgov.mn` |
| `INTEGRATION_ENC_KEY` | AES-256-GCM key for stored 3rd-party tokens | set a strong value in prod |
| `SIGN_SIGNER_CERT_FILE`, `SIGN_SIGNER_KEY_FILE` | PAdES Document-Signer PEM | **required in prod**; dev self-signs |
| `SUPERADMIN_EMAIL` | promotes an existing user to super admin at boot (best-effort) | |

---

## `web` (frontend)

| Var | Purpose | Default |
|-----|---------|---------|
| `BACKEND_URL` | Go API base (BFF appends `/api/v1`); internal `http://api:8080` in compose | `http://localhost:8080` |
| `NODE_ENV` | cookie-secure default + HSTS | — |
| `HOSTNAME` | bind address for Next standalone | `0.0.0.0` |
| `PORT` | frontend port | `3000` |
| `COOKIE_SECURE` | httpOnly cookie `Secure` flag (must be `true` over HTTPS) | prod: true |
| `APP_ORIGIN` | CSRF origin check + OAuth redirect base | — |
| `GOOGLE_CLIENT_ID` | Google login button (public) | — |

All OAuth/SSO **secrets** live only on the backend.

---

## Production guards (enforced in `config.go`)

When `ENVIRONMENT=production`, boot **fails** unless:

- `DB_POSTGRE_URL` is a valid URL with `sslmode=verify-full` (or `verify-ca`).
- `ALLOWED_ORIGINS` is non-empty.
- `VERIFY_API_KEY` is set.
- The api's DB role is **not** a superuser / BYPASSRLS role (checked against `pg_roles` at boot — RLS would otherwise be silently bypassed).

Always enforced (all environments): `JWT_SECRET` ≥ 32 chars; `JWT_EXPIRED` 1–24h;
`JWT_REFRESH_EXPIRED` 1–365d; `BCRYPT_COST` 10–31; `REDIS_PASS` set; pool
`idle ≤ open`; `ENVIRONMENT` exactly `development` or `production`.

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

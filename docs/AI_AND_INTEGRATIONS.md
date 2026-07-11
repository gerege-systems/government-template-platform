# AI Pipeline & National Integrations

> 🌐 **English** · [Монгол](AI_AND_INTEGRATIONS_MN.md)

The AI assistant (Gemini) and the external-system integrations: eID Mongolia,
dgov SSO (OIDC), XYP state registry, digital signing (PAdES), Google OAuth,
Gerege Space (SFTP), third-party OAuth vault, and the iOS companion.

> The backend deep-dive of the AI internals lives in
> [backend/docs/AI_PIPELINE.md](../backend/docs/AI_PIPELINE.md) — this chapter is
> the platform-level view. All backend routes are mounted under `/api`, so
> `/v1/ai/chat` is reachable at `/api/v1/ai/chat`.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [BACKEND.md](BACKEND.md) · [API_REFERENCE.md](API_REFERENCE.md)

---

## 1. AI pipeline (Gemini)

### SDK-free REST client (`backend/pkg/gemini`)

One endpoint does everything: `POST {base}/models/{model}:generateContent`
(auth header `x-goog-api-key`). Chat, STT, TTS, and translation all use the
**same** call — the difference is entirely in the request body (system
instruction, inline audio parts, `ResponseModalities`).

- Retry: 3 attempts, exponential backoff (500ms → 1s); retryable = network / 429 / ≥500; other 4xx not retried. `ErrNotConfigured` if the key is empty. 4 MiB response cap, 60s timeout.
- `wav.go` wraps Gemini's raw PCM TTS output (`audio/L16;rate=24000`) into a playable WAV.

### Chat flow & function-calling loop (`usecases/ai/ai_impl.go`)

`Run(prompt, audio?, history)`:

1. Build contents — history truncated to the last **20 turns**; the new user turn may carry text and/or an inline base64 audio blob (voice messages are understood directly by the multimodal model — no separate STT step).
2. Attach the layered system instruction + tool declarations.
3. Loop up to `MaxSteps` (default 4): call Gemini → if it returns function calls, execute each server-side, append the results as a `functionResponse` turn, and loop; if it returns text, return it. Each executed call is reported as a `Step{Tool, Args, Result}` so the UI can show "what the AI did".

**Failure semantics:** a missing key → 500. Any other transient failure (after
retries), empty text, or hitting `MaxSteps` → a Mongolian **fallback reply** with
`degraded: true` — never a 5xx. Tool errors are handed back to the model as a
`functionResponse` (so it can apologize) and never reach the client directly.

### Layered system prompt (`usecases/ai/ai_prompts.go`)

Three layers, assembled per request:

1. **`baseInstruction`** — hardcoded, **never configurable**: Mongolian-only replies, scope enforcement, prompt-injection resistance (requests to "forget instructions" / "reveal the system prompt" are treated as plain text and refused), and an instruction to call `search_knowledge` before answering platform questions.
2. **Scope** — from the `ai_prompts` table key `scope` → falls back to `AI_SCOPE_PROMPT` env → hardcoded `defaultScope`. Fail-open (a DB read error keeps chat alive).
3. **Instructions** — optional extra tone/rules (`ai_prompts` key `instructions`).

The prompt cache has a 1-minute TTL; `SetPrompt` invalidates it immediately on
the writing instance. The DB layer is **UPDATE-only** against migration-seeded
keys, so the configurable surface cannot grow via the API — the guardrail layer
stays hardcoded.

### Tools (`ai.ToolDef`)

`ToolDef{Declaration, Execute}` runs server-side with the request context (RLS +
timeouts apply). Built-in tools:

- **`get_server_time`** — zero-dependency demo, returns Ulaanbaatar time.
- **`search_knowledge`** — takes a Mongolian `query`, calls `repo.SearchKnowledge` (an `ILIKE`/tag search over `ai_knowledge`, capped at 5 rows), returns `{results, count}`.

**Register a new tool** in `server.go`:

```go
aiTools := append(ai.DefaultTools(), ai.KnowledgeSearchTool(aiRepo), myTool())
aiUC := ai.NewUsecase(geminiClient, geminiTTSClient, aiRepo, aiTools, ai.Config{...})
```

### Voice (`usecases/ai/ai_speech.go`)

Unlike chat, voice methods return real errors (no `degraded`).

| Endpoint | Method | Behaviour |
|----------|--------|-----------|
| `POST /v1/ai/stt` | `Transcribe` | Verbatim transcription of an inline audio blob. |
| `POST /v1/ai/tts` | `Speak` | Uses `GEMINI_TTS_MODEL` with an `AUDIO` response modality + prebuilt voice; returns WAV. |
| `POST /v1/ai/translate` | `Translate` | Audio → STT → translate (two-step); optional TTS of the translation (TTS failure degrades silently, text still returned). Target language via a `mn/en/ru/zh/ja/ko/de` map. |
| `POST /v1/ai/chat` | `Chat` | The function-calling loop above. |

`/v1/ai/*` is behind the auth middleware and a dedicated ~20/min rate limiter.

---

## 2. eID Mongolia (`backend/pkg/eid`)

eID = **eidmongolia.mn v3** identity provider; this platform is the **Relying
Party (RP)**. "Login with eID" is the primary login. It is a Smart-ID-compatible
v3 API (signature protocol `ACSP_V2`), RP-authenticated with
`Authorization: Bearer <rp_sk_…>` + `relyingPartyUUID`.

### Wire protocol

| Call | Endpoint |
|------|----------|
| QR / device-link auth | `POST /authentication/device-link/anonymous` |
| National-ID (РД) push auth | `POST /authentication/notification/etsi/PNOMN-{civilID}` |
| Long-poll session | `GET /session/{sessionID}?timeoutMs=25000` |

The session's `state` + `result.endResult` map to `RUNNING` / `COMPLETE` /
`EXPIRED` / `REFUSED`. On `COMPLETE`+OK the `person` block yields the identity
(civil id, national id/reg-no, given/surname mn+en) and `cert.value` (base64 DER)
is parsed into certificate details. Trust model: TLS + RP Bearer + COMPLETE+OK;
full ACSP_V2 signature verification is noted as optional future hardening.

### eID login flow (`usecases/auth/auth_eid.go`)

1. `EIDStart` (QR) or `EIDStartByNationalID` (РД push) → `POST /api/v1/auth/eid/start[-id]`.
2. Client polls `POST /api/v1/auth/eid/poll` (loose limiter; frontend ~2.5s). On `COMPLETE`: subject key = civil id → `users.UpsertFromEID` → JWT pair minted → refresh remembered in Redis → returns `{state, user, access_token, refresh_token}` (the BFF strips the tokens into cookies).

### Organization representation & signers

Via XYP + eID together: `RegisterEIDOrganization(userID, regNo)` looks the org up
in XYP, builds an authorized-party list (CEO → founders → stakeholders), and
calls eID `AddRepresentation`. eidmongolia (which knows the citizen's РД) verifies
the citizen is actually authorized; otherwise `Forbidden`. Signer management
(`/organizations/{regNo}/signers`) sends eID sign-push approvals.

### eID PKI dashboard (`eid_pki.go`, require RP `PKI_READ`)

`PersonSummary`, `PersonCertificates` (+ counts), `PersonDevices`,
`PersonActivity` (RP-scoped auth/sign history) — surfaced under
`/v1/users/me/eid/*`.

> The RP-facing endpoints this platform would like eID to add are documented in
> [EID_ENDPOINT_REQUESTS.md](EID_ENDPOINT_REQUESTS.md).

---

## 3. dgov SSO — OIDC (`backend/pkg/oidc`, `usecases/sso`)

Minimal Authorization-Code client for **sso.dgov.mn (Ory Hydra)**. Endpoints
derived from the issuer (`/oauth2/auth`, `/oauth2/token`, `/userinfo`,
`/oauth2/sessions/logout`).

- Confidential web client (`client_secret_basic`) + a **PKCE public-client** variant for native/mobile (no secret).
- Reads claims from `/userinfo` over TLS (does not verify id_token JWKS).
- `Start` stores a one-time `state` in Redis (`GetDel` on callback = CSRF/replay protection). `finish`: if the userinfo carries a register number (civil id), `UpsertByCivilID` **merges with an existing eID account** (one person = one account); else `UpsertBySSOSub` (pairwise sub). Mints a JWT pair and stashes the id_token behind a short Redis ref for RP-initiated logout.
- Routes: `POST /v1/sso/{start,callback,native,logout}`.

---

## 4. XYP — state registry (`backend/pkg/xyp`)

Client for **xyp.dgov.mn** (ХУР) — real-time organization lookup from the state
registry (HTTP Basic, server-side only). Single endpoint `POST /v1/org/lookup
{reg_no}` returns the org: name, type, capital, CEO, industry, founders, and
stakeholders. Used by the eID org-representation flow (§2) to build the
authorized-party list. Optional — no creds → org-link disabled.

---

## 5. Digital signing — PAdES (`usecases/sign`)

Signs PDFs (PAdES) via eidmongolia `/v3`, as an individual (PIN2) or on behalf of
an organization (`NTRMN-<regNo>`).

- `Init` — overlays the visual signature/stamp images onto the last page (best-effort), SHA-256 hashes the PDF, and starts an eID sign session (`certificateLevel: QUALIFIED`). Returns `{session_id, document_hash, verification_code, filename}`.
- `Poll` — ownership-checked (IDOR guard); `COMPLETE`+OK → captures signer cert; `USER_REFUSED` → rejected.
- `Download` — prefers eID's official `stamp` endpoint (PAdES-T + verify page); on failure falls back to embedding a PAdES signature with the server's own **Document-Signer** cert (`SIGN_SIGNER_CERT_FILE`/`_KEY_FILE`; production requires it, dev self-signs).
- Routes: `POST /v1/sign/init`, `GET /v1/sign/{id}`, `GET /v1/sign/{id}/download`.

---

## 6. Google, Gerege Space & third-party integrations

| Integration | What |
|-------------|------|
| **Google OAuth** (`pkg/google`) | SDK-free OAuth2/OIDC (scope `openid email profile`); reads `id_token` claims (trusts Google's TLS token endpoint, no JWKS). Links a Google account to an eID user or logs in directly (`POST /api/v1/auth/google`). |
| **Gerege Space** (`pkg/gspace`, `usecases/gspace`) | The app's **own SFTP storage** — single SFTP account, per-user path isolation (`basePath/users/<userID>/`), quota (default 2 MB). Routes `/v1/gspace/*`. |
| **Integrations vault** (`usecases/integrations`) | Per-user **third-party OAuth tokens** for `google-drive`, `dropbox`, `google-meet`. Tokens are **AES-256-GCM** encrypted (`INTEGRATION_ENC_KEY`), decrypted server/BFF-side only. Routes `/v1/integrations/*`. |

---

## 7. API Gateway (`usecases/gateway`)

A Kong-style **API-gateway config store** (config + telemetry only). All routes
require the `gateway.manage` permission. Manages **services**, **routes**,
**consumers**, **API keys** (32-byte `gk_live_…` keys — only the SHA-256 hash is
stored, plaintext returned once), and **policies** (`rate-limit`, `key-auth`,
`cors`, `ip-restrict`, `transform`). `Overview` + `ListRequestLogs` provide
telemetry. Endpoints under `/v1/gateway/*`.

---

## 8. Government services portal (`usecases/gov`)

The citizen-facing "Government Services" portal — a public services catalogue plus
per-user (RLS-isolated) **applications**, **references** (residence/birth/marriage/
tax/social-ins/criminal, 30-day validity), **notifications**, **payments**, and
**appointments** (future-time + ≤1-year validation). Reference/application numbers
use `crypto/rand`. Endpoints under `/v1/gov/*` (mutations are write-rate-limited).

---

## 9. iOS companion (`ios/TemplateApp/`)

A native SwiftUI **RP-consumer** app (bundle id `mn.gerege.temp`) — **not** the
citizen eID app; it drives eID login through this platform's backend.

- **BFF-only**: talks to `https://template.dgov.mn/api/*`, never the Go backend directly. Session in httpOnly cookies via `HTTPCookieStorage`; mutations set `x-dgov-csrf: 1`.
- **eID login**: РД push or "this phone" App2App (opens the eID app via `geregesmartid://approve?sessionId=…`, QR fallback), polling `/api/auth/eid/poll`. App2App returns via the `geregetemp://eid/callback` deep link.
- **SSO login**: native OIDC + PKCE via `ASWebAuthenticationSession` → `POST /api/auth/sso/native`.
- **Universal Links / AASA**: `frontend/src/app/api/aasa/route.ts` serves the Apple App Site Association (`APP_ID = CQTHTD6YJQ.mn.gerege.temp`) so the eID app's callback URL routes straight into the app instead of Safari.

---

## Configuration reference

See [CONFIGURATION.md](CONFIGURATION.md) for the full env-var table. Integration
keys: `GEMINI_*`, `EID_*`, `SSO_*`, `XYP_*`, `GOOGLE_CLIENT_*`, `GSPACE_*`,
`INTEGRATION_ENC_KEY`, `SIGN_SIGNER_CERT_FILE`/`_KEY_FILE`. Each is optional at
boot except where the [CONFIGURATION.md](CONFIGURATION.md) production guards
require it — a blank key simply makes that feature inert rather than breaking boot.

---

**Government Template Platform V3.0** — Co-developed by the Gerege Systems
Development Team and Claude AI, 2026.

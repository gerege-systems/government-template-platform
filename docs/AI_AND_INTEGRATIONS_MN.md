# AI Pipeline ба Үндэсний интеграцууд

> 🌐 [English](AI_AND_INTEGRATIONS.md) · **Монгол**

AI туслах (Gemini) болон гадаад системүүдтэй хийх интеграцууд: eID Mongolia,
dgov SSO (OIDC), XYP улсын бүртгэл, тоон гарын үсэг (PAdES), Google OAuth,
Gerege Space (SFTP), гуравдагч талын OAuth хадгалалт (vault), болон iOS хамтрагч апп.

> AI-ийн дотоод механизмын бэкэнд түвшний нарийвчилсан задаргаа
> [backend/docs/AI_PIPELINE.md](../backend/docs/AI_PIPELINE_MN.md) файлд байдаг — энэ бүлэг нь
> платформ түвшний харагдац юм. Бүх бэкэнд route-ууд `/api` доор холбогддог тул
> `/v1/ai/chat` нь `/api/v1/ai/chat` хаягаар хандах боломжтой.

Холбоотой: [ARCHITECTURE.md](ARCHITECTURE_MN.md) · [BACKEND.md](BACKEND_MN.md) · [API_REFERENCE.md](API_REFERENCE_MN.md)

---

## 1. AI pipeline (Gemini)

### SDK-free REST client (`backend/pkg/gemini`)

Нэг endpoint бүх зүйлийг гүйцэтгэдэг: `POST {base}/models/{model}:generateContent`
(auth header нь `x-goog-api-key`). Chat, STT, TTS болон орчуулга бүгд **ижил**
дуудлагыг ашигладаг — ялгаа нь бүхэлдээ request body-д (system
instruction, inline audio parts, `ResponseModalities`) байдаг.

- Retry: 3 оролдлого, экспоненциал backoff (500ms → 1s); retry хийж болох тохиолдол = сүлжээ / 429 / ≥500; бусад 4xx-ийг retry хийхгүй. Түлхүүр хоосон бол `ErrNotConfigured`. Хариултын дээд хэмжээ 4 MiB, timeout 60s.
- `wav.go` нь Gemini-ийн түүхий PCM TTS гаралтыг (`audio/L16;rate=24000`) тоглуулах боломжтой WAV болгон боож өгдөг.

### Chat урсгал ба function-calling давталт (`usecases/ai/ai_impl.go`)

`Run(prompt, audio?, history)`:

1. Contents бүрдүүлэх — түүхийг сүүлийн **20 эргэлт** хүртэл тайрдаг; шинэ хэрэглэгчийн эргэлт нь текст болон/эсвэл inline base64 аудио блоб авч явж болно (дуут мессежийг олон-модаль загвар шууд ойлгодог тул тусад нь STT алхам шаардлагагүй).
2. Давхаргалсан system instruction + tool declaration-уудыг хавсаргах.
3. `MaxSteps` (default 4) хүртэл давтах: Gemini-г дуудах → хэрэв function call буцаавал тус бүрийг server-side гүйцэтгэж, үр дүнг `functionResponse` эргэлт болгон нэмээд давтах; хэрэв текст буцаавал түүнийг буцаах. Гүйцэтгэсэн дуудлага бүрийг `Step{Tool, Args, Result}` хэлбэрээр тайлагнадаг тул UI нь "AI юу хийсэн"-ийг харуулж чадна.

**Алдааны семантик:** түлхүүр байхгүй бол → 500. Бусад ямар ч түр зуурын алдаа
(retry-ийн дараа), хоосон текст, эсвэл `MaxSteps`-т хүрэх → монгол хэл дээрх **fallback хариулт**
`degraded: true`-тэй — хэзээ ч 5xx болохгүй. Tool-ийн алдааг загварт `functionResponse`
хэлбэрээр буцааж өгдөг (ингэснээр загвар уучлалт гуйж чадна) бөгөөд шууд клиент рүү очдоггүй.

### Давхаргалсан system prompt (`usecases/ai/ai_prompts.go`)

Гурван давхарга, хүсэлт бүрд угсрагддаг:

1. **`baseInstruction`** — hardcoded, **хэзээ ч тохируулах боломжгүй**: зөвхөн монголоор хариулах, хамрах хүрээг сахиулах, prompt-injection эсэргүүцэх ("зааврыг март" / "system prompt-ыг ил гарга" гэсэн хүсэлтийг энгийн текст мэт үзэж татгалздаг), болон платформтой холбоотой асуултад хариулахаас өмнө `search_knowledge`-г дуудах заавар.
2. **Scope** — `ai_prompts` хүснэгтийн `scope` түлхүүрээс → `AI_SCOPE_PROMPT` env рүү → hardcoded `defaultScope` руу шаталж буцдаг. Fail-open (DB унших алдаа гарсан ч chat амьд хэвээр).
3. **Instructions** — сонголтоор нэмэлт өнгө аяс/дүрэм (`ai_prompts` түлхүүр `instructions`).

Prompt cache нь 1 минутын TTL-тэй; `SetPrompt` нь бичиж буй instance дээр түүнийг
даруй хүчингүй болгодог. DB давхарга нь migration-аар seed хийгдсэн түлхүүрүүдийн эсрэг
**зөвхөн UPDATE** хийдэг тул тохируулах боломжтой гадаргуу API-аар өсөж чадахгүй — сахиур
давхарга hardcoded хэвээр үлддэг.

### Tool-ууд (`ai.ToolDef`)

`ToolDef{Declaration, Execute}` нь хүсэлтийн контексттэй server-side ажилладаг (RLS +
timeout үйлчилнэ). Суурин tool-ууд:

- **`get_server_time`** — хамааралгүй демо, Улаанбаатарын цагийг буцаана.
- **`search_knowledge`** — монгол `query` авч, `repo.SearchKnowledge`-г дуудна (`ai_knowledge` дээрх `ILIKE`/tag хайлт, 5 мөрөөр хязгаарлагдана), `{results, count}` буцаана.

**Шинэ tool бүртгэх** нь `server.go`-д:

```go
aiTools := append(ai.DefaultTools(), ai.KnowledgeSearchTool(aiRepo), myTool())
aiUC := ai.NewUsecase(geminiClient, geminiTTSClient, aiRepo, aiTools, ai.Config{...})
```

### Дуу хоолой (`usecases/ai/ai_speech.go`)

Chat-аас ялгаатай нь дуут аргууд жинхэнэ алдаа буцаадаг (`degraded` байхгүй).

| Endpoint | Method | Үйлдэл |
|----------|--------|-----------|
| `POST /v1/ai/stt` | `Transcribe` | Inline аудио блобыг үг үсгээр нь буулгах. |
| `POST /v1/ai/tts` | `Speak` | `GEMINI_TTS_MODEL`-г `AUDIO` response modality + урьдчилан бэлдсэн хоолойтой ашиглаж WAV буцаана. |
| `POST /v1/ai/translate` | `Translate` | Аудио → STT → орчуулга (хоёр алхам); орчуулгын сонголтоор TTS (TTS алдаа чимээгүйхэн доройтдог, текст нь буцсан хэвээр). Зорилтот хэлийг `mn/en/ru/zh/ja/ko/de` map-аар. |
| `POST /v1/ai/chat` | `Chat` | Дээрх function-calling давталт. |

`/v1/ai/*` нь auth middleware болон тусгай ~20/мин rate limiter-ийн ард байрладаг.

---

## 2. eID Mongolia (`backend/pkg/eid`)

eID = **eidmongolia.mn v3** identity provider; энэ платформ нь **Relying
Party (RP)** юм. "eID-ээр нэвтрэх" нь үндсэн нэвтрэлт. Энэ нь Smart-ID-тэй нийцтэй
v3 API (гарын үсгийн протокол `ACSP_V2`), `Authorization: Bearer <rp_sk_…>` +
`relyingPartyUUID`-ээр RP-баталгаажуулалттай.

### Wire протокол

| Дуудлага | Endpoint |
|------|----------|
| QR / device-link auth | `POST /authentication/device-link/anonymous` |
| Регистрийн дугаар (РД) push auth | `POST /authentication/notification/etsi/PNOMN-{civilID}` |
| Long-poll session | `GET /session/{sessionID}?timeoutMs=25000` |

Session-ий `state` + `result.endResult` нь `RUNNING` / `COMPLETE` /
`EXPIRED` / `REFUSED` руу mapping хийгддэг. `COMPLETE`+OK үед `person` блок нь өвөрмөц
мэдээллийг (иргэний ID, үндэсний ID/регистрийн дугаар, нэр/овог mn+en) гаргаж, `cert.value` (base64 DER)
нь гэрчилгээний дэлгэрэнгүй болгон задлагдана. Итгэлцлийн загвар: TLS + RP Bearer + COMPLETE+OK;
бүрэн ACSP_V2 гарын үсгийн баталгаажуулалтыг ирээдүйн сонголтот бэхжүүлэлт гэж тэмдэглэсэн.

### eID нэвтрэлтийн урсгал (`usecases/auth/auth_eid.go`)

1. `EIDStart` (QR) эсвэл `EIDStartByNationalID` (РД push) → `POST /api/v1/auth/eid/start[-id]`.
2. Клиент `POST /api/v1/auth/eid/poll`-г polling хийдэг (сул limiter; frontend ~2.5s). `COMPLETE` үед: субъектийн түлхүүр = иргэний ID → `users.UpsertFromEID` → JWT хос үүсгэгдэнэ → refresh нь Redis-д санагдана → `{state, user, access_token, refresh_token}` буцаана (BFF нь token-уудыг cookie рүү салгаж авдаг).

### Байгууллагын төлөөлөл ба гарын үсэг зурагчид

XYP + eID-г хамтад нь ашиглан: `RegisterEIDOrganization(userID, regNo)` нь байгууллагыг
XYP-д хайж, эрх бүхий талуудын жагсаалт (ЗГ → үүсгэн байгуулагчид → эзэмшигчид) байгуулж,
eID `AddRepresentation`-г дуудна. eidmongolia (иргэний РД-г мэддэг) нь тухайн иргэн үнэхээр
эрх бүхий эсэхийг шалгадаг; эс бөгөөс `Forbidden`. Гарын үсэг зурагчийн удирдлага
(`/organizations/{regNo}/signers`) нь eID sign-push зөвшөөрлүүд илгээдэг.

### eID PKI dashboard (`eid_pki.go`, RP `PKI_READ` шаардана)

`PersonSummary`, `PersonCertificates` (+ тоолол), `PersonDevices`,
`PersonActivity` (RP-хамрах хүрээтэй auth/sign түүх) — `/v1/users/me/eid/*`
доор гаргагддаг.

> Энэ платформ eID-д нэмүүлэхийг хүсэж буй RP-д зориулсан endpoint-уудыг
> [EID_ENDPOINT_REQUESTS.md](EID_ENDPOINT_REQUESTS.md) файлд баримтжуулсан.

---

## 3. dgov SSO — OIDC (`backend/pkg/oidc`, `usecases/sso`)

**sso.dgov.mn (Ory Hydra)**-д зориулсан хамгийн бага Authorization-Code клиент. Endpoint-ууд
нь issuer-ээс гаргагдана (`/oauth2/auth`, `/oauth2/token`, `/userinfo`,
`/oauth2/sessions/logout`).

- Нууц веб клиент (`client_secret_basic`) + native/mobile-д зориулсан **PKCE public-client** хувилбар (нууцгүй).
- Claim-уудыг `/userinfo`-оос TLS-ээр уншдаг (id_token JWKS-г баталгаажуулдаггүй).
- `Start` нь нэг удаагийн `state`-г Redis-д хадгалдаг (callback дээр `GetDel` = CSRF/replay хамгаалалт). `finish`: хэрэв userinfo нь регистрийн дугаар (иргэний ID) агуулж байвал `UpsertByCivilID` нь **одоо байгаа eID account-той нэгтгэдэг** (нэг хүн = нэг account); эс бөгөөс `UpsertBySSOSub` (pairwise sub). JWT хос үүсгэж, RP-initiated logout-д зориулж id_token-ыг богино Redis ref-ийн ард нуудаг.
- Route-ууд: `POST /v1/sso/{start,callback,native,logout}`.

---

## 4. XYP — улсын бүртгэл (`backend/pkg/xyp`)

**xyp.dgov.mn (ХУР)**-д зориулсан клиент — улсын бүртгэлээс байгууллагыг бодит цагийн
горимоор хайх (HTTP Basic, зөвхөн server-side). Нэг endpoint `POST /v1/org/lookup
{reg_no}` нь байгууллагыг буцаана: нэр, төрөл, хөрөнгө, ЗГ, салбар, үүсгэн байгуулагчид,
эзэмшигчид. Эрх бүхий талуудын жагсаалт байгуулахад eID байгууллагын төлөөллийн урсгал (§2)-д
ашиглагддаг. Сонголтот — creds байхгүй бол org-link идэвхгүй.

---

## 5. Тоон гарын үсэг — PAdES (`usecases/sign`)

PDF-д (PAdES) eidmongolia `/v3`-аар гарын үсэг зурдаг, хувь хүн (PIN2) эсвэл байгууллагын
өмнөөс (`NTRMN-<regNo>`).

- `Init` — сүүлийн хуудсан дээр харагдах гарын үсэг/тамга зургийг давхарлаж (best-effort), PDF-г SHA-256 hash хийж, eID sign session эхлүүлдэг (`certificateLevel: QUALIFIED`). `{session_id, document_hash, verification_code, filename}` буцаана.
- `Poll` — эзэмшил шалгагддаг (IDOR хамгаалалт); `COMPLETE`+OK → гарын үсэг зурагчийн cert-ийг барьж авна; `USER_REFUSED` → татгалзсан.
- `Download` — eID-ийн албан ёсны `stamp` endpoint-г эрхэмлэдэг (PAdES-T + баталгаажуулах хуудас); амжилтгүй бол сервэрийн өөрийн **Document-Signer** cert-ээр PAdES гарын үсэг оруулах руу шаталж буцдаг (`SIGN_SIGNER_CERT_FILE`/`_KEY_FILE`; production шаарддаг, dev нь өөрөө гарын үсэг зурдаг).
- Route-ууд: `POST /v1/sign/init`, `GET /v1/sign/{id}`, `GET /v1/sign/{id}/download`.

---

## 6. Google, Gerege Space ба гуравдагч талын интеграцууд

| Интеграц | Юу |
|-------------|------|
| **Google OAuth** (`pkg/google`) | SDK-free OAuth2/OIDC (scope `openid email profile`); `id_token` claim-уудыг уншдаг (Google-ийн TLS token endpoint-д итгэдэг, JWKS байхгүй). Google account-ыг eID хэрэглэгчид холбоно эсвэл шууд нэвтэрнэ (`POST /api/v1/auth/google`). |
| **Gerege Space** (`pkg/gspace`, `usecases/gspace`) | Аппын **өөрийн SFTP хадгалалт** — нэг SFTP account, хэрэглэгч бүрийн зам тусгаарлагдсан (`basePath/users/<userID>/`), квот (default 2 MB). Route-ууд `/v1/gspace/*`. |
| **Integrations vault** (`usecases/integrations`) | Хэрэглэгч бүрийн **гуравдагч талын OAuth token-ууд** `google-drive`, `dropbox`, `google-meet`-д зориулсан. Token-ууд нь **AES-256-GCM** шифрлэгдсэн (`INTEGRATION_ENC_KEY`), зөвхөн server/BFF-тал дээр тайлагддаг. Route-ууд `/v1/integrations/*`. |

---

## 7. API Gateway (`usecases/gateway`)

Kong-маягийн **API-gateway config хадгалалт** (зөвхөн config + telemetry). Бүх route-ууд
`gateway.manage` эрх шаарддаг. **service**, **route**, **consumer**, **API key**
(32-байтын `gk_live_…` түлхүүрүүд — зөвхөн SHA-256 hash хадгалагддаг, plaintext нэг удаа
буцаагддаг), болон **policy**-уудыг (`rate-limit`, `key-auth`, `cors`, `ip-restrict`,
`transform`) удирддаг. `Overview` + `ListRequestLogs` нь telemetry хангадаг. Endpoint-ууд
`/v1/gateway/*` доор.

---

## 8. Төрийн үйлчилгээний портал (`usecases/gov`)

Иргэнд чиглэсэн "Төрийн үйлчилгээ" портал — олон нийтийн үйлчилгээний каталог, түүнчлэн
хэрэглэгч бүрийн (RLS-тусгаарлагдсан) **өргөдлүүд**, **лавлагаанууд** (оршин суух/төрсөн/гэрлэлт/
татвар/нийгмийн даатгал/ял шийтгэл, 30 хоногийн хүчинтэй хугацаа), **мэдэгдлүүд**, **төлбөрүүд**, болон
**цаг захиалга** (ирээдүйн цаг + ≤1 жилийн баталгаажуулалт). Лавлагаа/өргөдлийн дугаар
`crypto/rand` ашигладаг. Endpoint-ууд `/v1/gov/*` доор (mutation-ууд нь write-rate-limited).

---

## 9. iOS хамтрагч апп (`ios/TemplateApp/`)

Native SwiftUI **RP-consumer** апп (bundle id `mn.gerege.temp`) — **иргэний eID апп биш**;
энэ нь eID нэвтрэлтийг энэ платформын бэкэндээр дамжуулан удирддаг.

- **Зөвхөн BFF**: `https://template.dgov.mn/api/*`-тай харьцдаг, хэзээ ч Go бэкэндтэй шууд харьцдаггүй. Session нь `HTTPCookieStorage`-аар httpOnly cookie-д; mutation-ууд `x-dgov-csrf: 1` тавьдаг.
- **eID нэвтрэлт**: РД push эсвэл "энэ утас" App2App (eID аппыг `geregesmartid://approve?sessionId=…`-ээр нээдэг, QR fallback), `/api/auth/eid/poll`-г polling хийдэг. App2App нь `geregetemp://eid/callback` deep link-ээр буцдаг.
- **SSO нэвтрэлт**: `ASWebAuthenticationSession`-аар native OIDC + PKCE → `POST /api/auth/sso/native`.
- **Universal Links / AASA**: `frontend/src/app/api/aasa/route.ts` нь Apple App Site Association-г (`APP_ID = CQTHTD6YJQ.mn.gerege.temp`) хангаж өгдөг тул eID аппын callback URL нь Safari-руу орохын оронд шууд апп руу route хийгддэг.

---

## Тохиргооны лавлагаа

Бүрэн env-var хүснэгтийг [CONFIGURATION.md](CONFIGURATION_MN.md)-оос үзнэ үү. Интеграцын
түлхүүрүүд: `GEMINI_*`, `EID_*`, `SSO_*`, `XYP_*`, `GOOGLE_CLIENT_*`, `GSPACE_*`,
`INTEGRATION_ENC_KEY`, `SIGN_SIGNER_CERT_FILE`/`_KEY_FILE`. [CONFIGURATION.md](CONFIGURATION_MN.md)
production хамгаалалт шаардсанаас бусад тохиолдолд тус бүр нь boot үед сонголтот — хоосон түлхүүр
нь тухайн функцийг boot-ыг эвдэхийн оронд зүгээр л идэвхгүй болгодог.

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

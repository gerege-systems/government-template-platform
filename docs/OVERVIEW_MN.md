# Платформын тойм

> 🌐 [English](OVERVIEW.md) · **Монгол**

Government Template Platform V3.0 нь eID суурьтай, AI боломжтой төрийн үйлчилгээ бүтээхэд зориулсан **үйлдвэрлэлд бэлэн, аюулгүй байдлаар бэхжүүлсэн бүрэн-стекийн загвар** юм. Энэ нь Clean Architecture дээр суурилсан Go backend-ийг Next.js Backend-for-Frontend-тэй хослуулж, Монгол улсын үндэсний иргэний үнэмлэх, бүртгэл болон SSO системүүдтэй нэгтгэдэг.

Backend нь нээлттэй эхийн [snykk/go-rest-boilerplate](https://github.com/snykk/go-rest-boilerplate) (MIT)-оос гаралтай бөгөөд Gin → chi, sqlx → pgx рүү шилжүүлсэн.

Холбоотой: [ARCHITECTURE.md](ARCHITECTURE_MN.md) · [README.md](README_MN.md)

---

## Tech stack

| Давхарга | Технологи |
|-------|-----------|
| Backend | Go · chi (net/http) · pgx (pgxpool) · **ORM байхгүй** |
| Өгөгдөл | PostgreSQL 16 (+ Row-Level Security) · Redis 7 |
| Frontend | Next.js 15 · React 19 · TypeScript · TanStack Query |
| AI | Google Gemini (SDK-гүй REST client) |
| Identity | eID Mongolia (RP) · dgov SSO (OIDC/Hydra) · Google OAuth |
| Үндэсний систем | XYP бүртгэл · дижитал гарын үсэг (PAdES) · Gerege Core |
| Observability | OpenTelemetry · Prometheus · Zap |
| Delivery | Docker Compose · nginx · distroless image-ууд |

---

## Хайрцаг дотор юу байгаа вэ

- **Clean Architecture backend** — `handler → usecase → repository → domain`, буцаах import байхгүй; бизнесийн цөм нь вэб framework-ийг хэзээ ч import хийдэггүй. Гар DI, гараар бичсэн SQL.
- **eID-тэргүүтэй нэвтрэлт** — үндэсний eID-ээр нэвтрэх (QR/төхөөрөмж-холбоос эсвэл РД push); эргэлттэй JWT access + refresh, Redis суурьтай цуцлалт, нэвтрэлтийн түгжээ, тоолшгүй байдлыг эсэргүүцсэн урсгалууд.
- **Динамик RBAC** — super-admin/admin/manager/user түвшинтэй дүр/зөвшөөрлийн каталог, HTTP давхаргад хэрэгжүүлж, сервер талд дахин шалгадаг.
- **Row-Level Security** — хэрэглэгч бүрийн хүснэгт бүр RLS-ээр тусгаарлагдсан; API нь non-superuser дүрээр холбогддог бөгөөд boot-үеийн хэрэгжих чадварын хамгаалалттай.
- **AI туслах (Gemini)** — функц дуудлагатай чат, яриаг-текст рүү, текстийг-яриа руу хөрвүүлэлт болон шууд орчуулга. Давхаргатай системийн prompt (шаттай хатуу кодлосон хамгаалалт + админаар тохируулж болох scope/зааврууд) нь үүнийг домэйн дотор байлгадаг; `search_knowledge` хэрэгсэл нь хариултыг өгөгдлийн санд суурилуулдаг. Чат нь алдаа заахын оронд эвтэйхэн доройтдог.
- **Үндэсний нэгтгэлүүд** — dgov SSO (OIDC + PKCE), XYP байгууллагын хайлт, PAdES дижитал гарын үсэг, Google OAuth болон Gerege Space SFTP хадгалалт.
- **BFF frontend** — browser нь зөвхөн ижил-эх Next.js route-уудтай харьцдаг; токенууд httpOnly cookie-д хадгалагддаг; давхар CSRF хамгаалалт (тусгай header + эх шалгалт); TanStack Query өгөгдлийн давхарга; mn/en i18n.
- **iOS хамтрагч** — ижил BFF-ээр дамжуулан eID/SSO нэвтрэлтийг ажиллуулдаг нативаар бичсэн SwiftUI RP-хэрэглэгч (AASA-аар universal link).
- **Аюулгүй байдлаар бэхжүүлсэн** — хатуу аюулгүй байдлын header-ууд, CORS зөвшөөрөгдсөн жагсаалт, санах ойд суурилсан хүсэлт хязгаарлалт, HTTP серверийн бүрэн timeout-ууд, параметержсэн query-ууд, hash-гинжлэгдсэн аудит бүртгэл болон хадгалсан гуравдагч талын токеныг AES-256-GCM шифрлэлт.
- **Observability** — OpenTelemetry tracing, Prometheus metric-ууд (DB pool статистик орсон), бүтэцлэгдсэн лог болон `/health` + `/ready` шалгуурууд.

---

## Репозиторийн бүтэц

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

## Хэрэглэгчийн бүсээр ангилсан онцлогийн зураглал

| Бүс | Хэн | Онцлохууд |
|------|-----|-----------|
| **Me** (`/me`) | Иргэд | Хяналтын самбар, профайл, eID иргэний үнэмлэх/сертификат/төхөөрөмжүүд, AI туслах, шууд орчуулга, төрийн үйлчилгээ (өргөдөл, лавлагаа, төлбөр, цаг захиалга), байгууллагууд, нэгтгэлүүд, гарын үсэг зурах. |
| **Admin** (`/admin`) | Админууд | Хэрэглэгчийн удирдлага, RBAC дүрүүд, AI prompt тохиргоо, аудит бүртгэл + баталгаажуулалт, аюулгүй байдлын үйл явдлууд, Core хайлт, API gateway консол. |
| **Manager** (`/manager`) | Менежерүүд | Багийн хяналтын самбар + хэрэглэгчийн харагдац. |
| **Superadmin** | Супер админууд | Админ бүртгэлийг удирдах (аудитлагдсан). |

---

## Дараа хаашаа явах вэ

- Дизайныг ойлгох → [ARCHITECTURE.md](ARCHITECTURE_MN.md)
- Backend дээр бүтээх → [BACKEND.md](BACKEND_MN.md) · [DATABASE.md](DATABASE_MN.md)
- Frontend дээр бүтээх → [FRONTEND.md](FRONTEND_MN.md)
- Байршуулах → [DEPLOYMENT.md](DEPLOYMENT_MN.md) · [CONFIGURATION.md](CONFIGURATION_MN.md)

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

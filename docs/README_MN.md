# Баримт бичиг — Government Template Platform V3.0

> 🌐 [English](README.md) · **Монгол**

> **eID суурьтай · AI боломжтой** төрийн үйлчилгээний платформ.
> Clean Architecture дээр суурилсан, аюулгүй байдлаар бэхжүүлсэн, үйлдвэрлэлд бэлэн бүрэн-стекийн загвар:
> Go (chi · pgx · PostgreSQL · Redis) backend болон Next.js BFF frontend.

Энэ хавтас нь кодоос шинээр хянан үзсэн **бүх платформын баримт бичгийн багц** юм. Төслийн танилцуулга болон хурдан эхлүүлэх зааврыг эх хавтасын [README.md](../README.md)-аас үзнэ үү.

---

## Эндээс эхэл

| Хэрэв та… | Уншина уу |
|-----------------|------|
| Платформыг эхнээс нь дуустал ойлгох | [OVERVIEW.md](OVERVIEW_MN.md) → [ARCHITECTURE.md](ARCHITECTURE_MN.md) |
| Go API дээр ажиллах | [BACKEND.md](BACKEND_MN.md) + [DATABASE.md](DATABASE_MN.md) |
| Вэб UI дээр ажиллах | [FRONTEND.md](FRONTEND_MN.md) |
| API дуудах эсвэл өргөтгөх | [API_REFERENCE.md](API_REFERENCE_MN.md) |
| AI / eID / SSO / гарын үсэг зурах процессыг ойлгох | [AI_AND_INTEGRATIONS.md](AI_AND_INTEGRATIONS_MN.md) |
| Аюулгүй байдлын төлөв байдлыг хянах | [SECURITY.md](SECURITY_MN.md) |
| Байршуулах эсвэл ажиллуулах | [DEPLOYMENT.md](DEPLOYMENT_MN.md) + [CONFIGURATION.md](CONFIGURATION_MN.md) |
| Хувь нэмэр оруулах | [CONTRIBUTING.md](CONTRIBUTING.md) + [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |

---

## Бүрэн багц

| Баримт | Юуг хамардаг |
|-----|----------------|
| [OVERVIEW.md](OVERVIEW.md) · [_MN](OVERVIEW_MN.md) | Онцлогийн тойм, tech stack, репозиторийн бүтэц. |
| [ARCHITECTURE.md](ARCHITECTURE.md) · [_MN](ARCHITECTURE_MN.md) | Бүрэн-стекийн архитектур, хүсэлтийн амьдралын мөчлөг, хил хязгаар. |
| [BACKEND.md](BACKEND.md) · [_MN](BACKEND_MN.md) | Go API: давхаргалалт, DI, HTTP давхарга, middleware-ууд, багцууд. |
| [FRONTEND.md](FRONTEND.md) · [_MN](FRONTEND_MN.md) | Next.js BFF: route-ууд, proxy, cookie/CSRF, TanStack Query, i18n. |
| [DATABASE.md](DATABASE.md) · [_MN](DATABASE_MN.md) | Схем, migration-ууд, RLS, кэш, seed өгөгдөл. |
| [API_REFERENCE.md](API_REFERENCE.md) · [_MN](API_REFERENCE_MN.md) | Домэйнээр ангилсан REST endpoint-ууд, envelope, алдааны загвар. |
| [AI_AND_INTEGRATIONS.md](AI_AND_INTEGRATIONS.md) · [_MN](AI_AND_INTEGRATIONS_MN.md) | Gemini AI, eID, SSO, XYP, гарын үсэг зурах, Google, iOS. |
| [SECURITY.md](SECURITY.md) · [_MN](SECURITY_MN.md) | Нэвтрэлт, RLS, header-ууд, CORS, хүсэлт хязгаарлалт, CSRF, аудит. |
| [DEPLOYMENT.md](DEPLOYMENT.md) · [_MN](DEPLOYMENT_MN.md) | VPS runbook, compose стек, CI, эрүүл мэндийн endpoint-ууд. |
| [CONFIGURATION.md](CONFIGURATION.md) · [_MN](CONFIGURATION_MN.md) | Бүх орчны хувьсагч + үйлдвэрлэлийн хамгаалалтууд. |
| [EID_ENDPOINT_REQUESTS.md](EID_ENDPOINT_REQUESTS.md) | Энэ платформын хүсдэг RP-д зориулсан eID endpoint-ууд. |
| [secure_system_guide_mn.md](secure_system_guide_mn.md) | Аюулгүй web+mobile+API систем бүтээх дэлгэрэнгүй заавар (стандартад суурилсан лавлагаа, MN). |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Хэрхэн хувь нэмэр оруулах. |

### Зөвхөн backend-ийн гүнзгий судалгаа (`backend/docs/`)

`backend/docs/` хавтас нь backend-ийн доод түвшний лавлагаануудыг (EN/MN хосууд) хадгалдаг:
[ARCHITECTURE](../backend/docs/ARCHITECTURE.md), [DEVELOPMENT](../backend/docs/DEVELOPMENT.md)
(шинэ онцлог нэмэх заавар), [API_CONTRACT](../backend/docs/API_CONTRACT.md),
[AI_PIPELINE](../backend/docs/AI_PIPELINE.md), [SECURITY](../backend/docs/SECURITY.md),
болон үүсгэсэн OpenAPI spec.

---

## Эхэлж мэдэх ёстой хоёр зүйл

Өөр газар баримтжуулсан боловч **энэ репозиторид байхгүй** — кодын хяналтын явцад баталгаажуулж, операторуудыг гэнэт гайхшруулахгүйн тулд тэмдэглэсэн:

1. **Репозиторид CI workflow байхгүй.** `.github/` хавтас байхгүй. CI хаалтуудыг `backend/Makefile` (`make pre-push`)-ээр давтан гүйцэтгэх боломжтой — [DEPLOYMENT.md](DEPLOYMENT_MN.md) § CI/CD-г үзнэ үү.
2. **Сонгодог нууц үг/OTP нэвтрэлт route хийгдээгүй.** Эдгээр урсгалыг хэрэгжүүлж, тестэлсэн боловч зөвхөн eID/Google/SSO нэвтрэлт холбогдсон — [SECURITY.md](SECURITY_MN.md) §1-г үзнэ үү.

---

**Government Template Platform V3.0** — Gerege Systems Development Team болон Claude AI хамтран бүтээв, 2026.

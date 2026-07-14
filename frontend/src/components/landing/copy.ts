// Landing (нүүр) хуудасны маркетингийн текст — mn / en хосоор. Апп-ын үндсэн
// dict (lib/i18n.ts)-ийг бөглөхгүйн тулд landing-ийн олон урт мөрийг энд
// төвлөрүүлэв. Бүх түлхүүр хоёр хэлэнд адил байх ёстой (i18n.ts-тэй нэг зарчим).

export interface LandingCopy {
  nav: { platform: string; features: string; stack: string; deploy: string; login: string };
  hero: {
    badge: string;
    titleLead: string;
    titleAccent: string;
    titleTail: string;
    lede: string;
    ctaLogin: string;
    ctaDocs: string;
    stackLabel: string;
    codeFile: string;
    codeComment: string;
    badgeTitle: string;
    badgeSub: string;
  };
  advantages: {
    heading: string;
    sub: string;
    eidTag: string;
    eidTitle: string;
    eidBody: string;
    aiTitle: string;
    aiBody: string;
    secTitle: string;
    secBody: string;
    cleanTitle: string;
    cleanBody: string;
    cleanLink: string;
    gatewayTitle: string;
    gatewayBody: string;
    rbacTitle: string;
    rbacBody: string;
  };
  stack: {
    heading: string;
    sub: string;
    backendTitle: string;
    backendBody: string;
    frontendTitle: string;
    frontendBody: string;
    aiTitle: string;
    aiBody: string;
    deployTitle: string;
    deployBadge: string;
    deployItems: string[];
  };
  everything: { heading: string; sub: string; items: { title: string; body: string }[] };
  cta: { title: string; sub: string; ctaLogin: string; ctaRepo: string; tagline: string };
  footer: { tagline: string; links: string[]; copyright: string };
}

export const DOCS_URL = 'https://gerege-systems.github.io/government-template-platform/';
export const REPO_URL = 'https://github.com/gerege-systems/government-template-platform';

const mn: LandingCopy = {
  nav: { platform: 'Платформ', features: 'Онцлог', stack: 'Технологи', deploy: 'Байршуулалт', login: 'DAN-аар нэвтрэх' },
  hero: {
    badge: 'Хувилбар 3.0 · Тогтвортой',
    titleLead: 'Дижитал засаглалын',
    titleAccent: 'ирээдүйг',
    titleTail: 'бүтээх суурь',
    lede:
      'Clean Architecture дээр суурилсан, аюулгүй байдлаар чангаруулсан, продакшнд бэлэн бүрэн стек загвар. Иргэн төвтэй дижитал үйлчилгээний дараагийн үеийг эхлүүл.',
    ctaLogin: 'DAN-аар нэвтрэх',
    ctaDocs: 'Баримт бичиг үзэх',
    stackLabel: 'Технологийн стек',
    codeFile: 'api/v1/auth.go',
    codeComment: '// Clean Architecture',
    badgeTitle: 'Аудитад бэлэн',
    badgeSub: 'Аюулгүй байдал баталгаажсан · v3.0',
  },
  advantages: {
    heading: 'Гол давуу талууд',
    sub: 'Их ачаалалтай, эмзэг мэдээлэлтэй төрийн үйл ажиллагааны онцгой шаардлагыг эхнээс нь бодож зохион бүтээв.',
    eidTag: 'Баталгаажуулалт',
    eidTitle: 'eID суурьт танилт',
    eidBody:
      'Үндэсний eID систем болон DAN SSO (Google, төрийн gateway)-той гүн уялдаа — QR уншуулан хормын дотор, найдвартай баталгаажсан нэвтрэлт.',
    aiTitle: 'AI чадавх',
    aiBody: 'Gemini AI урьдчилан тохируулсан pipeline — баримт боловсруулах, иргэдэд ухаалаг туслах.',
    secTitle: 'Аюулгүйгээр чангалсан',
    secBody: 'RLS мөрийн түвшний хамгаалалт, CSRF хамгаалалт, аудит лог нь суурь framework-т шингэсэн.',
    cleanTitle: 'Цэвэр архитектур',
    cleanBody: 'Давхаргууд салангид — таны бизнес логик гадны framework, өгөгдлийн сангаас хараат бус хэвээр.',
    cleanLink: 'Архитектурын баримт үзэх',
    gatewayTitle: 'API Gateway',
    gatewayBody: 'Сервис, маршрут, rate-limit, бодлого болон хүсэлтийн логийг нэг самбараас удирдана.',
    rbacTitle: 'RBAC эрхийн загвар',
    rbacBody: 'Дүр (role) ба зөвшөөрөл (permission)-д суурилсан нарийн эрхийн удирдлага — админ, менежер, хэрэглэгч.',
  },
  stack: {
    heading: 'Орчин үеийн, батжсан технологиор',
    sub: 'Хурд, найдвар, өргөтгөх боломжийг эхнээс нь бодсон бүрэлдэхүүн.',
    backendTitle: 'Backend гүйцэтгэл',
    backendBody: 'Go (chi) backend — pgx-ээр PostgreSQL-тэй хурдан харилцаж, Redis-ээр ухаалаг кэшлэнэ. ORM-гүй, гар бичсэн SQL.',
    frontendTitle: 'Next.js Frontend (BFF)',
    frontendBody: 'Cookie-д суурилсан нэвтрэлт, CSRF хамгаалалт, SSR-ийг зохицуулах бат бэх frontend давхарга — SEO болон гүйцэтгэлд оновчтой.',
    aiTitle: 'Gemini AI pipeline',
    aiBody: 'SDK-гүй REST дуудлага, серверт ажилладаг tools, DB-ээр тохируулах scope/instructions, найдвартай fallback.',
    deployTitle: 'Байршуулалтын бэлэн байдал',
    deployBadge: 'DOCKER БЭЛЭН',
    deployItems: [
      'VPS Runbook хавсаргасан',
      'Health check endpoint-ууд',
      'CI/CD Makefile-ууд',
      'Дугаарласан SQL миграцууд',
      'RLS production boot guard',
    ],
  },
  everything: {
    heading: 'Бүгд багтсан',
    sub: 'Эхний өдрөөс ашиглахад бэлэн — дахин зохион бүтээх зүйлгүй.',
    items: [
      { title: 'JWT нэвтрэлт', body: 'Богино TTL access + урт TTL refresh, эргэлддэг токен.' },
      { title: 'Аудит лог', body: 'Эмзэг үйлдлүүдийг мөрдөн бүртгэнэ.' },
      { title: 'Хоёр хэл (mn/en)', body: 'Бүх UI мөр монгол болон англиар.' },
      { title: 'Swagger баримт', body: 'Handler annotation-оос автоматаар үүсгэнэ.' },
      { title: 'Rate limiting', body: 'AI ~20/мин, auth ~5/мин IP тус бүрт.' },
      { title: 'CSRF хамгаалалт', body: 'BFF origin шалгалт, x-dgov-csrf толгой.' },
      { title: 'Testcontainers', body: 'Бодит PostgreSQL дээр интеграц тест.' },
      { title: 'GitHub Pages docs', body: 'Material for MkDocs дээр бүтэн баримт.' },
    ],
  },
  cta: {
    title: 'Платформоо байгуулахад бэлэн үү?',
    sub: 'Бүрэн баримт бичгийг татаж аваад, ирээдүйд бэлэн дижитал үйлчилгээ бүтээгч болоорой.',
    ctaLogin: 'DAN-аар нэвтэрч эхлэх',
    ctaRepo: 'Репозитор үзэх',
    tagline: 'Нээлттэй эх · Аюулгүйгээр зохион бүтээсэн · Өргөтгөх архитектур',
  },
  footer: {
    tagline: 'Gerege Systems болон Claude AI хамтран хөгжүүлэв. 2026 тогтвортой хувилбар.',
    links: ['Үйлчилгээний нөхцөл', 'Нууцлалын бодлого', 'Холбоо барих', 'Аюулгүй байдлын аудит'],
    copyright: '© 2026 Government Template Platform. Бүх эрх хамгаалагдсан.',
  },
};

const en: LandingCopy = {
  nav: { platform: 'Platform', features: 'Features', stack: 'Stack', deploy: 'Deployment', login: 'Sign in with DAN' },
  hero: {
    badge: 'Version 3.0 · Stable',
    titleLead: 'The foundation for the',
    titleAccent: 'future',
    titleTail: 'of digital government',
    lede:
      'A production-ready, security-hardened full-stack template built on Clean Architecture. Empower the next generation of civil-centric digital services.',
    ctaLogin: 'Sign in with DAN',
    ctaDocs: 'View Documentation',
    stackLabel: 'Technology stack',
    codeFile: 'api/v1/auth.go',
    codeComment: '// Clean Architecture',
    badgeTitle: 'Audit Ready',
    badgeSub: 'Security certified · v3.0',
  },
  advantages: {
    heading: 'Core Advantages',
    sub: 'Engineered from the ground up for the unique demands of high-traffic, sensitive government workflows.',
    eidTag: 'Authentication',
    eidTitle: 'eID-based identity',
    eidBody:
      'Deep integration with national eID and DAN SSO (Google, government gateways) — instant, verified sign-in by scanning a QR code.',
    aiTitle: 'AI enabled',
    aiBody: 'Pre-configured Gemini AI pipelines for automated document processing and intelligent citizen support.',
    secTitle: 'Security hardened',
    secBody: 'Row-level security (RLS), CSRF protection and audit logs are built directly into the core framework.',
    cleanTitle: 'Clean Architecture',
    cleanBody: 'Decoupled layers keep your business logic independent of any external framework or database.',
    cleanLink: 'Explore architecture docs',
    gatewayTitle: 'API Gateway',
    gatewayBody: 'Manage services, routes, rate limits, policies and request logs from a single console.',
    rbacTitle: 'RBAC model',
    rbacBody: 'Fine-grained access control based on roles and permissions — admin, manager, user.',
  },
  stack: {
    heading: 'Built on a modern, proven stack',
    sub: 'Components chosen for speed, reliability and scale from day one.',
    backendTitle: 'Backend performance',
    backendBody: 'Go (chi) backend using pgx for fast PostgreSQL access and Redis for smart caching. No ORM, hand-written SQL.',
    frontendTitle: 'Next.js frontend (BFF)',
    frontendBody: 'A robust frontend layer handling cookie-based auth, CSRF and SSR — optimal for SEO and performance.',
    aiTitle: 'Gemini AI pipeline',
    aiBody: 'SDK-free REST calls, server-side tools, DB-configurable scope/instructions and a resilient fallback.',
    deployTitle: 'Deployment readiness',
    deployBadge: 'DOCKER READY',
    deployItems: [
      'VPS runbook included',
      'Health check endpoints',
      'CI/CD Makefiles',
      'Numbered SQL migrations',
      'RLS production boot guard',
    ],
  },
  everything: {
    heading: 'Everything included',
    sub: 'Ready to use from day one — nothing to reinvent.',
    items: [
      { title: 'JWT auth', body: 'Short-TTL access + long-TTL refresh, rotating tokens.' },
      { title: 'Audit logs', body: 'Sensitive actions are traced and recorded.' },
      { title: 'Bilingual (mn/en)', body: 'Every UI string in Mongolian and English.' },
      { title: 'Swagger docs', body: 'Generated automatically from handler annotations.' },
      { title: 'Rate limiting', body: 'AI ~20/min, auth ~5/min per IP.' },
      { title: 'CSRF protection', body: 'BFF origin checks, x-dgov-csrf header.' },
      { title: 'Testcontainers', body: 'Integration tests on real PostgreSQL.' },
      { title: 'GitHub Pages docs', body: 'Full docs on Material for MkDocs.' },
    ],
  },
  cta: {
    title: 'Ready to build your platform?',
    sub: 'Download the full documentation and join the builders of future-proof digital services.',
    ctaLogin: 'Get started with DAN',
    ctaRepo: 'View repository',
    tagline: 'Open source · Secure by design · Scalable architecture',
  },
  footer: {
    tagline: 'Co-developed by Gerege Systems and Claude AI. 2026 stable release.',
    links: ['Terms of Service', 'Privacy Policy', 'Contact Support', 'Security Audit'],
    copyright: '© 2026 Government Template Platform. All rights reserved.',
  },
};

export const landingCopy: Record<'mn' | 'en', LandingCopy> = { mn, en };

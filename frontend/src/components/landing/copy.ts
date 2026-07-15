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
    titleLead: 'Цахим',
    titleAccent: 'засаглалыг',
    titleTail: 'бүтээх суурь',
    lede:
      'Цэгцтэй архитектурт тулгуурласан, өндөр түвшний хамгаалалттай, ашиглалтад бэлэн бүрэн бүтэн загвар. Иргэн төвтэй цахим үйлчилгээний дараагийн үеийг эхлүүл.',
    ctaLogin: 'DAN-аар нэвтрэх',
    ctaDocs: 'Баримт бичиг үзэх',
    stackLabel: 'Технологийн бүрэлдэхүүн',
    codeFile: 'api/v1/auth.go',
    codeComment: '// Clean Architecture',
    badgeTitle: 'Аудитад бэлэн',
    badgeSub: 'Хамгаалалт баталгаажсан · v3.0',
  },
  advantages: {
    heading: 'Гол давуу талууд',
    sub: 'Их ачаалал, эмзэг мэдээлэлтэй төрийн үйл ажиллагааны онцлог шаардлагад нийцүүлэн эхнээс нь нямбай бүтээв.',
    eidTag: 'Баталгаажуулалт',
    eidTitle: 'Цахим үнэмлэгээр танилт',
    eidBody:
      'Үндэсний цахим үнэмлэг болон DAN SSO (Google, төрийн үйлчилгээ)-той гүн уялдаатай — QR уншуулан хормын дотор, найдвартай баталгаажсан нэвтрэлт.',
    aiTitle: 'Хиймэл оюун',
    aiBody: 'Gemini хиймэл оюуны бэлэн урсгал — баримт боловсруулж, иргэдэд ухаалгаар тусална.',
    secTitle: 'Өндөр түвшний хамгаалалт',
    secBody: 'Өгөгдлийн мөр бүрийн хандалтын хяналт, давхар хамгаалалт, үйлдлийн бүртгэл нь суурь системд шингэсэн.',
    cleanTitle: 'Цэгцтэй архитектур',
    cleanBody: 'Давхаргууд бие даасан — таны бизнес логик гадны сан, өгөгдлийн сангаас хараат бус хэвээр.',
    cleanLink: 'Архитектурын баримт үзэх',
    gatewayTitle: 'API Gateway',
    gatewayBody: 'Үйлчилгээ, чиглүүлэлт, хандалтын хязгаарлалт, бодлого, хүсэлтийн бүртгэлийг нэг самбараас удирдана.',
    rbacTitle: 'Эрхийн нарийн загвар (RBAC)',
    rbacBody: 'Дүр болон зөвшөөрөлд суурилсан нарийвчилсан эрхийн удирдлага — админ, менежер, хэрэглэгч.',
  },
  stack: {
    heading: 'Орчин үеийн, найдвартай технологиор',
    sub: 'Хурд, найдвар, өргөтгөх боломжийг эрхэмлэн сонгосон бүрэлдэхүүн.',
    backendTitle: 'Сервер талын гүйцэтгэл',
    backendBody: 'Go сервер — PostgreSQL өгөгдлийн сантай хурдан харилцаж, Redis-ээр ухаалаг санах ой ашиглана. Гар бичсэн цэвэр SQL.',
    frontendTitle: 'Хэрэглэгчийн тал — Next.js',
    frontendBody: 'Cookie-д суурилсан нэвтрэлт, давхар хамгаалалт, серверийн зураглалыг зохицуулах бат бэх давхарга — хайлт болон гүйцэтгэлд оновчтой.',
    aiTitle: 'Gemini хиймэл оюун',
    aiBody: 'Хөнгөн REST холболт, серверт ажилладаг хэрэгслүүд, өгөгдлийн сангаас тохируулах хүрээ ба заавар, доголдвол найдвартай нөөц хариу.',
    deployTitle: 'Байршуулахад бэлэн',
    deployBadge: 'DOCKER БЭЛЭН',
    deployItems: [
      'Байршуулалтын гарын авлагатай',
      'Эрүүл мэндийн шалгах цэгүүд',
      'CI/CD автоматжуулалт',
      'Дугаарласан өгөгдлийн шилжилтүүд',
      'Ашиглалтын үеийн хамгаалалтын хяналт',
    ],
  },
  everything: {
    heading: 'Бүгд багтсан',
    sub: 'Эхний өдрөөс ашиглахад бэлэн — дахин зохион бүтээх зүйлгүй.',
    items: [
      { title: 'JWT нэвтрэлт', body: 'Богино насжилттай эрх, сунгах токен, эргэлддэг найдвартай.' },
      { title: 'Үйлдлийн бүртгэл', body: 'Эмзэг үйлдэл бүрийг мөрдөн бүртгэнэ.' },
      { title: 'Хоёр хэл (mn/en)', body: 'Бүх дэлгэц монгол болон англиар.' },
      { title: 'Swagger баримт', body: 'Кодоос автоматаар үүснэ.' },
      { title: 'Хандалтын хязгаарлалт', body: 'Хиймэл оюун ~20/мин, нэвтрэлт ~5/мин IP тус бүрт.' },
      { title: 'Хүсэлтийн хамгаалалт', body: 'Эх сурвалжийн шалгалт бүхий давхар хамгаалалт.' },
      { title: 'Бодит орчны тест', body: 'Жинхэнэ PostgreSQL дээр интеграцын шалгалт.' },
      { title: 'Онлайн баримт', body: 'GitHub Pages дээр бүрэн гарын авлага.' },
    ],
  },
  cta: {
    title: 'Платформоо байгуулахад бэлэн үү?',
    sub: 'Бүрэн гарын авлагыг үзээд, ирээдүйд бэлэн цахим үйлчилгээ бүтээгч болоорой.',
    ctaLogin: 'DAN-аар нэвтэрч эхлэх',
    ctaRepo: 'Эх кодыг үзэх',
    tagline: 'Нээлттэй эх · Найдвартай хамгаалалт · Өргөтгөх бүтэц',
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
    titleLead: 'The foundation to build',
    titleAccent: 'digital',
    titleTail: 'government',
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

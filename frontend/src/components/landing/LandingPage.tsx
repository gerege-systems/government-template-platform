"use client";

import React from 'react';
import {
  Fingerprint, Sparkles, ShieldCheck, Network, Waypoints, Users,
  Terminal, Layers, Bot, CheckCircle2, ArrowRight, ChevronRight,
  LogIn, GitBranch, Languages, ShieldQuestion, KeyRound, ScrollText,
  Globe, FileCode2, Gauge, ShieldAlert, FlaskConical, BookOpen,
} from 'lucide-react';
import { useLang } from '@/lib/lang';
import AnonThemeToggle from '@/components/AnonThemeToggle';
import { landingCopy, DOCS_URL, REPO_URL } from './copy';

// «Онцлог» хэсгийн жижиг картуудын icon-ууд (copy.ts-ийн items дараалалтай нэг эрэмбэ).
const EVERYTHING_ICONS = [KeyRound, ScrollText, Globe, FileCode2, Gauge, ShieldAlert, FlaskConical, BookOpen];

/**
 * Нийтийн Landing — нэвтрээгүй зочдод харагдах маркетингийн нүүр. Stitch жишиг
 * дизайныг брэнд токен (DAN blue + gold, light/dark) дээр дахин найруулав.
 * Нэвтрэлт нь /api/auth/sso/start (DAN SSO) руу заана.
 */
export default function LandingPage() {
  const { lang, setLang } = useLang();
  const t = landingCopy[lang];

  return (
    <div className="lp">
      {/* ---------- Nav ---------- */}
      <header className="lp-nav">
        <div className="lp-nav__inner">
          <a className="lp-nav__brand" href="#top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lp-nav__mark" src="/brand.webp" alt="" aria-hidden="true" />
            <span className="lp-nav__name">Government Template Platform</span>
          </a>

          <nav className="lp-nav__links" aria-label="Хэсгүүд">
            <a href="#top">{t.nav.platform}</a>
            <a href="#advantages">{t.nav.features}</a>
            <a href="#stack">{t.nav.stack}</a>
            <a href="#deploy">{t.nav.deploy}</a>
          </nav>

          <div className="lp-nav__actions">
            <button
              type="button"
              className="lp-lang"
              onClick={() => setLang(lang === 'mn' ? 'en' : 'mn')}
              aria-label="Хэл солих"
            >
              <Languages size={15} strokeWidth={2} />
              <span>{lang === 'mn' ? 'EN' : 'МН'}</span>
            </button>
            <AnonThemeToggle />
            <a className="lp-btn lp-btn--gold lp-btn--sm" href="/api/auth/sso/start">
              <LogIn size={16} strokeWidth={2} />
              <span>{t.nav.login}</span>
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="lp-hero">
          <div className="lp-hero__pattern" aria-hidden="true" />
          <div className="lp-hero__inner">
            <div className="lp-hero__copy">
              <span className="lp-eyebrow">
                <span className="lp-eyebrow__dot" />
                {t.hero.badge}
              </span>
              <h1 className="lp-hero__title">
                {t.hero.titleLead}{' '}
                <span className="lp-accent">{t.hero.titleAccent}</span>{' '}
                {t.hero.titleTail}
              </h1>
              <p className="lp-hero__lede">{t.hero.lede}</p>

              <div className="lp-hero__cta">
                <a className="lp-btn lp-btn--gold lp-btn--lg" href="/api/auth/sso/start">
                  {t.hero.ctaLogin}
                  <ArrowRight size={18} strokeWidth={2} />
                </a>
                <a className="lp-btn lp-btn--outline lp-btn--lg" href={DOCS_URL} target="_blank" rel="noreferrer">
                  {t.hero.ctaDocs}
                </a>
              </div>

              <div className="lp-hero__stack">
                <span className="lp-hero__stack-label">{t.hero.stackLabel}</span>
                <div className="lp-chips">
                  {['Go · chi', 'Next.js 15', 'PostgreSQL', 'Redis', 'Gemini AI'].map((s) => (
                    <span className="lp-chip" key={s}>{s}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Код карт */}
            <div className="lp-hero__visual">
              <div className="lp-code" role="img" aria-label={t.hero.codeFile}>
                <div className="lp-code__bar">
                  <span className="lp-code__dots">
                    <i /><i /><i />
                  </span>
                  <span className="lp-code__file">{t.hero.codeFile}</span>
                </div>
                <pre className="lp-code__body">
<span className="lp-c-comment">{t.hero.codeComment}</span>{'\n'}
<span className="lp-c-key">func</span> <span className="lp-c-fn">HandleAuth</span>(w http.ResponseWriter) {'{'}{'\n'}
{'  '}user, err := <span className="lp-c-var">usecase</span>.Execute(ctx){'\n'}
{'  '}<span className="lp-c-key">if</span> err != nil {'{'}{'\n'}
{'    '}<span className="lp-c-ret">return</span> apperror.<span className="lp-c-fn">InternalCause</span>(err){'\n'}
{'  }'}{'\n'}
{'  '}<span className="lp-c-ret">return</span> v1.<span className="lp-c-fn">NewSuccessResponse</span>(user){'\n'}
{'}'}
                </pre>
              </div>
              <div className="lp-code__badge">
                <span className="lp-code__badge-icon"><ShieldCheck size={18} strokeWidth={2} /></span>
                <span>
                  <strong>{t.hero.badgeTitle}</strong>
                  <em>{t.hero.badgeSub}</em>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Core Advantages (bento) ---------- */}
        <section className="lp-section" id="advantages">
          <div className="lp-container">
            <header className="lp-head">
              <h2>{t.advantages.heading}</h2>
              <p>{t.advantages.sub}</p>
            </header>

            <div className="lp-bento">
              {/* eID (wide) */}
              <article className="lp-card lp-card--wide">
                <div className="lp-card__top">
                  <span className="lp-card__icon"><Fingerprint size={26} strokeWidth={1.75} /></span>
                  <span className="lp-card__tag">{t.advantages.eidTag}</span>
                </div>
                <div>
                  <h3>{t.advantages.eidTitle}</h3>
                  <p>{t.advantages.eidBody}</p>
                </div>
              </article>

              {/* AI (dark) */}
              <article className="lp-card lp-card--dark">
                <span className="lp-card__icon lp-card__icon--onDark"><Sparkles size={26} strokeWidth={1.75} /></span>
                <div>
                  <h3>{t.advantages.aiTitle}</h3>
                  <p>{t.advantages.aiBody}</p>
                </div>
              </article>

              {/* Security */}
              <article className="lp-card lp-card--muted">
                <span className="lp-card__icon"><ShieldCheck size={26} strokeWidth={1.75} /></span>
                <div>
                  <h3>{t.advantages.secTitle}</h3>
                  <p>{t.advantages.secBody}</p>
                </div>
              </article>

              {/* Clean Architecture (wide) */}
              <article className="lp-card lp-card--wide lp-card--split">
                <div>
                  <h3>{t.advantages.cleanTitle}</h3>
                  <p>{t.advantages.cleanBody}</p>
                  <a className="lp-link" href={`${DOCS_URL}`} target="_blank" rel="noreferrer">
                    {t.advantages.cleanLink}
                    <ChevronRight size={16} strokeWidth={2} />
                  </a>
                </div>
                <span className="lp-card__ghost" aria-hidden="true"><Network size={120} strokeWidth={1} /></span>
              </article>

              {/* API Gateway (wide) */}
              <article className="lp-card lp-card--wide lp-card--split">
                <div>
                  <span className="lp-card__icon"><Waypoints size={26} strokeWidth={1.75} /></span>
                  <h3>{t.advantages.gatewayTitle}</h3>
                  <p>{t.advantages.gatewayBody}</p>
                </div>
                <span className="lp-card__ghost" aria-hidden="true"><Waypoints size={120} strokeWidth={1} /></span>
              </article>

              {/* RBAC */}
              <article className="lp-card">
                <span className="lp-card__icon"><Users size={26} strokeWidth={1.75} /></span>
                <div>
                  <h3>{t.advantages.rbacTitle}</h3>
                  <p>{t.advantages.rbacBody}</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- Tech stack split ---------- */}
        <section className="lp-section lp-section--alt" id="stack">
          <div className="lp-container lp-split">
            <div className="lp-split__copy">
              <h2>{t.stack.heading}</h2>
              <p className="lp-split__sub">{t.stack.sub}</p>
              <ul className="lp-feature-list">
                <li>
                  <span className="lp-feature-list__icon"><Terminal size={20} strokeWidth={1.9} /></span>
                  <div>
                    <h4>{t.stack.backendTitle}</h4>
                    <p>{t.stack.backendBody}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-feature-list__icon"><Layers size={20} strokeWidth={1.9} /></span>
                  <div>
                    <h4>{t.stack.frontendTitle}</h4>
                    <p>{t.stack.frontendBody}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-feature-list__icon"><Bot size={20} strokeWidth={1.9} /></span>
                  <div>
                    <h4>{t.stack.aiTitle}</h4>
                    <p>{t.stack.aiBody}</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Deployment readiness card */}
            <div className="lp-deploy" id="deploy">
              <div className="lp-deploy__bar">
                <span>{t.stack.deployTitle}</span>
                <span className="lp-deploy__badge">{t.stack.deployBadge}</span>
              </div>
              <ul className="lp-deploy__list">
                {t.stack.deployItems.map((item) => (
                  <li key={item}>
                    <span className="lp-deploy__check"><CheckCircle2 size={18} strokeWidth={2} /></span>
                    <span className="lp-deploy__label">{item}</span>
                    <span className="lp-deploy__state">Active</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Everything included ---------- */}
        <section className="lp-section">
          <div className="lp-container">
            <header className="lp-head">
              <h2>{t.everything.heading}</h2>
              <p>{t.everything.sub}</p>
            </header>
            <div className="lp-grid">
              {t.everything.items.map((it, i) => {
                const Icon = EVERYTHING_ICONS[i] ?? ShieldQuestion;
                return (
                  <article className="lp-mini" key={it.title}>
                    <span className="lp-mini__icon"><Icon size={20} strokeWidth={1.9} /></span>
                    <h4>{it.title}</h4>
                    <p>{it.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="lp-cta">
          <div className="lp-cta__pattern" aria-hidden="true" />
          <div className="lp-container lp-cta__inner">
            <h2>{t.cta.title}</h2>
            <p>{t.cta.sub}</p>
            <div className="lp-cta__buttons">
              <a className="lp-btn lp-btn--gold lp-btn--lg" href="/api/auth/sso/start">
                {t.cta.ctaLogin}
                <ArrowRight size={18} strokeWidth={2} />
              </a>
              <a className="lp-btn lp-btn--glass lp-btn--lg" href={REPO_URL} target="_blank" rel="noreferrer">
                <GitBranch size={18} strokeWidth={2} />
                {t.cta.ctaRepo}
              </a>
            </div>
            <p className="lp-cta__tagline">{t.cta.tagline}</p>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__inner">
          <div className="lp-footer__brand">
            <div className="lp-footer__mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand.webp" alt="" aria-hidden="true" />
              <span>DGOV Template</span>
            </div>
            <p>{t.footer.tagline}</p>
          </div>
          <nav className="lp-footer__links" aria-label="Footer">
            {t.footer.links.map((l) => (
              <a href="#top" key={l}>{l}</a>
            ))}
          </nav>
          <p className="lp-footer__copy">{t.footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}

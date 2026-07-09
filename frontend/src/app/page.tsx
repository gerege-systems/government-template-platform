import React from 'react';
import { redirect } from 'next/navigation';
import { KeyRound, Info, LogIn } from 'lucide-react';
import SigninShell from '@/components/SigninShell';
import { hasSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Нэвтэрсэн хэрэглэгчийг /me домэйн руу (admin/manager-тэй адил) шилжүүлнэ;
  // нэвтрээгүй зочдод нийтийн Landing.
  if (await hasSession()) redirect('/me/dashboard');
  return <Landing />;
}

/** Нийтийн landing — нэвтрээгүй зочдод харагдах нүүр. */
function Landing() {
  return (
    <SigninShell>
      <section className="signin-card" aria-labelledby="landing-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="signin-card__crest" src="/brand.webp" alt="" aria-hidden="true" />

        <div>
          <h1 id="landing-title">Government Template Platform V3.0</h1>
          <p className="signin-card__tagline" style={{ marginTop: 6, color: 'var(--dan-blue-text)', fontWeight: 600, letterSpacing: '.02em' }}>
            eID based · AI enabled
          </p>
          <p className="signin-card__lede" style={{ marginTop: 12 }}>
            <strong style={{ color: 'var(--fg)', fontWeight: 600 }}>Government Template Platform V3.0</strong>{' '}
            (chi + pgx) дээр суурилсан жишээ апп.{' '}
            <strong style={{ color: 'var(--fg)', fontWeight: 600 }}>eID</strong> апп-аараа QR кодыг
            уншуулан нэвтэрч, профайл болон аюулгүй байдлын тохиргоогоо нэг дороос удирдана.
          </p>
        </div>

        {/* DAN (dan.dgov.mn) SSO-гоор нэвтрэх — нэвтрэлт dan.dgov.mn дээр eID-ээр
            баталгаажина. BFF route handler руу шууд заана (redirect эхлүүлэх тул
            Link биш <a>). */}
        <a className="btn btn--primary btn--lg btn--block" href="/api/auth/sso/start" aria-label="DAN-аар нэвтрэх">
          <LogIn size={18} strokeWidth={2} />
          <span>DAN-аар нэвтрэх</span>
        </a>

        <p className="signin-card__helper">
          <Info size={14} strokeWidth={2} />
          <span>
            Нэвтрэлт нь <span className="mono" style={{ color: 'var(--fg)' }}>eID</span> аппаар
            баталгаажиж, богино TTL-тэй access болон урт TTL-тэй refresh JWT хослолоор хийгдэнэ.
          </span>
        </p>

        <div className="signin-card__trust" aria-label="Аюулгүй байдлын тэмдэг">
          <span className="badge"><KeyRound size={11} strokeWidth={2} /> JWT</span>
          <span className="badge">eID</span>
          <span className="badge">chi + pgx</span>
          <span className="badge"><span className="mono" style={{ fontSize: 11 }}>TLS 1.3</span></span>
        </div>
      </section>
    </SigninShell>
  );
}

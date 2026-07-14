import React from 'react';
import { redirect } from 'next/navigation';
import LandingPage from '@/components/landing/LandingPage';
import { hasSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Нэвтэрсэн хэрэглэгчийг /me домэйн руу (admin/manager-тэй адил) шилжүүлнэ;
  // нэвтрээгүй зочдод нийтийн маркетингийн Landing.
  if (await hasSession()) redirect('/me/dashboard');
  return <LandingPage />;
}

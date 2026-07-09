import { authedFetch } from '@/lib/api';
import { proxyResult, checkOrigin } from '@/lib/bff';

export const dynamic = 'force-dynamic';

// POST /api/me/eid/organizations/{regNo}/signers/resend?signer=РД — баталгаажаагүй
// (PENDING) гарын үсэг зурагч руу eID sign-push баталгаажуулах хүсэлтийг дахин илгээнэ.
export async function POST(req: Request, { params }: { params: { regNo: string } }) {
  const bad = checkOrigin(req);
  if (bad) return bad;
  const signer = new URL(req.url).searchParams.get('signer') ?? '';
  return proxyResult(
    await authedFetch(
      `/users/me/eid/organizations/${encodeURIComponent(params.regNo)}/signers/resend?signer=${encodeURIComponent(signer)}`,
      { method: 'POST' },
    ),
  );
}

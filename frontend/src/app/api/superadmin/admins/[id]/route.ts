import { authedFetch } from '@/lib/api';
import { proxyResult, checkOrigin, checkUUID } from '@/lib/bff';

export const dynamic = 'force-dynamic';

// DELETE /api/superadmin/admins/{id} — админ эрхийг хасах (энгийн хэрэглэгч болгох).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const bad = checkOrigin(req) ?? checkUUID(params.id);
  if (bad) return bad;
  return proxyResult(await authedFetch(`/superadmin/admins/${params.id}`, { method: 'DELETE' }));
}

import { authedFetch } from '@/lib/api';
import { proxyResult, readJson, checkOrigin, checkUUID } from '@/lib/bff';

export const dynamic = 'force-dynamic';

// PUT /api/gateway/consumers/{id} — consumer шинэчлэх.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const bad = checkOrigin(req) ?? checkUUID(params.id);
  if (bad) return bad;
  const body = await readJson(req);
  return proxyResult(await authedFetch(`/gateway/consumers/${params.id}`, { method: 'PUT', body: JSON.stringify(body) }));
}

// DELETE /api/gateway/consumers/{id} — consumer устгах.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const bad = checkOrigin(req) ?? checkUUID(params.id);
  if (bad) return bad;
  return proxyResult(await authedFetch(`/gateway/consumers/${params.id}`, { method: 'DELETE' }));
}

import { createPrismaFileService } from '@/lib/storage/service';
import { errorResponse, fileResponse, publicDocument, requireActor } from '@/lib/storage/http';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/files/:id — metadata (?meta) or inline content; DELETE removes file (managers only). */
export async function GET(request: Request, { params }: Ctx) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const { id } = await params;
    const service = await createPrismaFileService();
    if (new URL(request.url).searchParams.get('meta') === '1')
      return Response.json({ file: publicDocument(await service.getDocument(actor, id)) });
    const { document, body, signedUrl } = await service.download(actor, id);
    if (signedUrl) return Response.redirect(signedUrl, 302);
    return fileResponse(body, document, 'inline');
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const { id } = await params;
    await (await createPrismaFileService()).delete(actor, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** A manager may classify an existing lease attachment without changing its target or contents. */
export async function PATCH(request: Request, { params }: Ctx) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  if (actor.role !== 'MANAGER' && actor.role !== 'ADMIN')
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { kind } = (await request.json().catch(() => ({}))) as { kind?: unknown };
  if (kind !== 'LEASE' && kind !== 'ADDENDUM' && kind !== 'DISCLOSURE' && kind !== 'OTHER')
    return Response.json({ error: 'Choose a lease document type.' }, { status: 400 });
  const { id } = await params;
  const { count } = await db.document.updateMany({
    where: { id, organizationId: actor.organizationId, leaseId: { not: null }, kind: { not: 'PHOTO' } },
    data: { kind },
  });
  if (!count) return Response.json({ error: 'Lease document not found.' }, { status: 404 });
  return Response.json({ id, kind });
}

import { createPrismaFileService } from '@/lib/storage/service';
import { errorResponse, fileResponse, publicDocument, requireActor } from '@/lib/storage/http';

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

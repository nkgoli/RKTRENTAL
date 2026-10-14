import { createPrismaFileService } from '@/lib/storage/service';
import { errorResponse, fileResponse, requireActor } from '@/lib/storage/http';

export const runtime = 'nodejs';
/** GET /api/files/:id/download — attachment download. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const { document, body, signedUrl } = await (
      await createPrismaFileService()
    ).download(actor, (await params).id);
    if (signedUrl) return Response.redirect(signedUrl, 302);
    return fileResponse(body, document, 'attachment');
  } catch (e) {
    return errorResponse(e);
  }
}

import { createPrismaFileService } from '@/lib/storage/service';
import { errorResponse, parseJsonTarget, publicDocument, requireActor } from '@/lib/storage/http';

export const runtime = 'nodejs';

/**
 * POST /api/files/reorder — persist photo order for a target.
 * JSON: { targetType, targetId, orderedIds: string[] }
 * Also accepts { target: { kind, id }, photoIds|ids } aliases. PATCH is an alias.
 */
async function handle(request: Request) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const target = parseJsonTarget(body);
    if (target instanceof Response) return target;
    const raw = body.orderedIds ?? body.photoIds ?? body.ids ?? body.order;
    const files = await (
      await createPrismaFileService()
    ).reorderPhotos(actor, target, raw as string[]);
    return Response.json({ files: files.map(publicDocument) });
  } catch (e) {
    return errorResponse(e);
  }
}

export const POST = handle;
export const PATCH = handle;
export const PUT = handle;

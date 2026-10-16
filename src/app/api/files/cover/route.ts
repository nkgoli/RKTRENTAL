import { createPrismaFileService } from '@/lib/storage/service';
import { errorResponse, parseJsonTarget, publicDocument, requireActor } from '@/lib/storage/http';

export const runtime = 'nodejs';

/**
 * POST /api/files/cover — set the cover photo for a target (exactly one per target).
 * JSON: { targetType, targetId, documentId }
 * Also accepts photoId|id aliases and a nested target. PATCH/PUT are aliases.
 */
async function handle(request: Request) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const target = parseJsonTarget(body);
    if (target instanceof Response) return target;
    const raw = body.documentId ?? body.photoId ?? body.id;
    const documentId = typeof raw === 'string' ? raw : '';
    const files = await (await createPrismaFileService()).setCover(actor, target, documentId);
    const cover = files.find((f) => f.isCover) ?? null;
    return Response.json({
      file: cover ? publicDocument(cover) : null,
      files: files.map(publicDocument),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export const POST = handle;
export const PATCH = handle;
export const PUT = handle;

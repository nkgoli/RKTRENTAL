import { createPrismaFileService } from '@/lib/storage/service';
import { errorResponse, publicDocument, requireActor } from '@/lib/storage/http';
import type { DocumentKindValue, FileTargetKind } from '@/lib/storage/types';

export const runtime = 'nodejs';

/**
 * POST /api/files/upload-url/complete — verify an S3/MinIO upload before recording it.
 * JSON: { storageKey, fileName, mimeType, sizeBytes, targetType, targetId, kind? }
 */
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const b = (await request.json()) as Record<string, unknown>;
    const kinds = ['lease', 'property', 'unit'];
    if (
      !kinds.includes(String(b.targetType)) ||
      typeof b.targetId !== 'string' ||
      typeof b.storageKey !== 'string'
    )
      return Response.json(
        { error: 'storageKey, targetType (lease|property|unit) and targetId are required' },
        { status: 400 },
      );
    const document = await (
      await createPrismaFileService()
    ).completeSignedUpload(actor, {
      target: { kind: b.targetType as FileTargetKind, id: b.targetId },
      storageKey: b.storageKey,
      fileName: String(b.fileName ?? ''),
      mimeType: String(b.mimeType ?? ''),
      sizeBytes: Number(b.sizeBytes),
      kind: typeof b.kind === 'string' ? (b.kind as DocumentKindValue) : undefined,
    });
    return Response.json({ file: publicDocument(document) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

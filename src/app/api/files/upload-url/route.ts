import { createPrismaFileService } from '@/lib/storage/service';
import { errorResponse, publicDocument, requireActor } from '@/lib/storage/http';
import type { DocumentKindValue, FileTargetKind } from '@/lib/storage/types';

export const runtime = 'nodejs';
/**
 * POST /api/files/upload-url — signed direct upload (S3/MinIO).
 * JSON: { fileName, mimeType, sizeBytes, targetType, targetId, kind? }
 * Returns { file, uploadUrl, storageKey }; client PUTs bytes to uploadUrl.
 * With the local driver this returns 501 and clients should POST /api/files.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const b = (await request.json()) as Record<string, unknown>;
    const kinds = ['lease', 'property', 'unit'];
    if (!kinds.includes(String(b.targetType)) || typeof b.targetId !== 'string')
      return Response.json(
        { error: 'targetType (lease|property|unit) and targetId are required' },
        { status: 400 },
      );
    const result = await (
      await createPrismaFileService()
    ).createSignedUpload(actor, {
      target: { kind: b.targetType as FileTargetKind, id: b.targetId },
      fileName: String(b.fileName ?? ''),
      mimeType: String(b.mimeType ?? ''),
      sizeBytes: Number(b.sizeBytes),
      kind: typeof b.kind === 'string' ? (b.kind as DocumentKindValue) : undefined,
    });
    return Response.json(
      {
        file: publicDocument(result.document),
        uploadUrl: result.uploadUrl,
        storageKey: result.storageKey,
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

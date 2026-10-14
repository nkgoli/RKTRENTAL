import { createPrismaFileService } from '@/lib/storage/service';
import {
  errorResponse,
  parseTarget,
  publicDocument,
  requireActor,
  targetFromForm,
} from '@/lib/storage/http';
import type { DocumentKindValue } from '@/lib/storage/types';
import { MAX_FILE_BYTES } from '@/lib/storage/types';

export const runtime = 'nodejs';

/** GET /api/files?targetType=lease|property|unit&targetId=... — list files for a target. */
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const target = parseTarget(new URL(request.url).searchParams);
    if (target instanceof Response) return target;
    const files = await (await createPrismaFileService()).list(actor, target);
    return Response.json({ files: files.map(publicDocument) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/files — multipart server upload: file, targetType+targetId (or leaseId/propertyId/unitId), kind?, name? */
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (actor instanceof Response) return actor;
    const form = await request.formData();
    const target = targetFromForm(form);
    if (target instanceof Response) return target;
    const file = form.get('file');
    if (!(file instanceof File))
      return Response.json({ error: 'Multipart field "file" is required' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES)
      return Response.json({ error: 'File exceeds the 25 MB limit' }, { status: 400 });
    const kind = form.get('kind');
    const doc = await (
      await createPrismaFileService()
    ).upload(actor, {
      target,
      fileName:
        typeof form.get('name') === 'string' && form.get('name')
          ? String(form.get('name'))
          : file.name,
      mimeType: file.type,
      kind: typeof kind === 'string' && kind ? (kind as DocumentKindValue) : undefined,
      body: new Uint8Array(await file.arrayBuffer()),
    });
    return Response.json({ file: publicDocument(doc) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

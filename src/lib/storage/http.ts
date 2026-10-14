import { getSession } from '@/lib/auth/server-session';
import type { AuthSession } from '@/lib/auth/session';
import type { FileActor, FileTarget, FileTargetKind, StoredDocument } from './types';
import { StorageError } from './types';

export function actorFromSession(s: AuthSession): FileActor {
  return {
    subjectId: s.subjectId,
    organizationId: s.organizationId,
    role: s.role,
    tenantId: s.tenantId,
  };
}
export async function requireActor(): Promise<FileActor | Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return actorFromSession(session);
}
export function parseTarget(params: URLSearchParams): FileTarget | Response {
  const kind = params.get('targetType') ?? params.get('kind');
  const id = params.get('targetId') ?? params.get('id');
  const kinds: FileTargetKind[] = ['lease', 'property', 'unit'];
  if (!kind || !id || !kinds.includes(kind as FileTargetKind))
    return Response.json(
      { error: 'Query requires targetType=lease|property|unit and targetId' },
      { status: 400 },
    );
  return { kind: kind as FileTargetKind, id };
}
export function targetFromForm(form: FormData): FileTarget | Response {
  const p = new URLSearchParams();
  for (const k of ['targetType', 'targetId']) {
    const v = form.get(k);
    if (typeof v === 'string') p.set(k, v);
  }
  // Also accept leaseId/propertyId/unitId form fields.
  if (!p.get('targetType')) {
    for (const [field, kind] of [
      ['leaseId', 'lease'],
      ['propertyId', 'property'],
      ['unitId', 'unit'],
    ] as const) {
      const v = form.get(field);
      if (typeof v === 'string' && v) {
        p.set('targetType', kind);
        p.set('targetId', v);
        break;
      }
    }
  }
  return parseTarget(p);
}
export function errorResponse(e: unknown): Response {
  if (e instanceof StorageError)
    return Response.json({ error: e.message, code: e.code }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
export function publicDocument(d: StoredDocument) {
  return {
    id: d.id,
    organizationId: d.organizationId,
    leaseId: d.leaseId,
    propertyId: d.propertyId,
    unitId: d.unitId,
    kind: d.kind,
    name: d.name,
    sizeBytes: d.sizeBytes,
    mimeType: d.mimeType,
    createdAt: d.createdAt.toISOString(),
    previewUrl: `/api/files/${d.id}/preview`,
    downloadUrl: `/api/files/${d.id}/download`,
  };
}
export function fileResponse(
  body: Uint8Array,
  d: StoredDocument,
  disposition: 'inline' | 'attachment',
): Response {
  const encoded = encodeURIComponent(d.name);
  const inlineSafe = ['application/pdf', 'image/jpeg', 'image/png'].includes(d.mimeType);
  const effectiveDisposition = disposition === 'inline' && inlineSafe ? 'inline' : 'attachment';
  return new Response(Buffer.from(body), {
    headers: {
      'content-type': d.mimeType,
      'content-length': String(body.byteLength),
      'content-disposition': `${effectiveDisposition}; filename*=UTF-8''${encoded}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

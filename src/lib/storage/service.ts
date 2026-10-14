import { randomUUID } from 'node:crypto';
import type { FileAccess } from './access';
import { assertDocumentAccess, assertTargetAccess } from './access';
import type {
  DocumentKindValue,
  FileActor,
  FileTarget,
  StorageAdapter,
  StoredDocument,
} from './types';
import { notFoundError, StorageError } from './types';
import { sanitizeFileName, validateUpload, validateUploadMeta } from './validation';

export interface DocumentRepository {
  create(input: Omit<StoredDocument, 'id' | 'createdAt'>): Promise<StoredDocument>;
  listByTarget(orgId: string, target: FileTarget): Promise<StoredDocument[]>;
  findById(orgId: string, id: string): Promise<StoredDocument | null>;
  delete(id: string): Promise<void>;
}
export interface UploadInput {
  target: FileTarget;
  fileName: string;
  mimeType: string;
  kind?: DocumentKindValue;
  body: Uint8Array;
}
export interface SignedUploadInput extends Omit<UploadInput, 'body'> {
  sizeBytes: number;
}
export interface CompleteSignedUploadInput extends SignedUploadInput {
  storageKey: string;
}
const KINDS: DocumentKindValue[] = ['LEASE', 'NOTICE', 'INSPECTION', 'ID', 'PHOTO', 'OTHER'];
export const TENANT_UPLOAD_KINDS: readonly DocumentKindValue[] = [
  'NOTICE',
  'INSPECTION',
  'PHOTO',
  'OTHER',
];

function assertUploadAllowed(actor: FileActor, kind: DocumentKindValue): void {
  if (actor.role === 'OWNER') throw new StorageError('Owners have read-only access', 'FORBIDDEN', 403);
  if (actor.role === 'TENANT' && !TENANT_UPLOAD_KINDS.includes(kind))
    throw new StorageError('Tenants cannot upload this document kind', 'FORBIDDEN', 403);
}

export class FileService {
  constructor(
    private storage: StorageAdapter,
    private repo: DocumentRepository,
    private access: FileAccess,
  ) {}
  private keyFor(actor: FileActor, target: FileTarget, fileName: string): string {
    return [
      'org',
      actor.organizationId,
      target.kind,
      target.id,
      `${randomUUID()}-${sanitizeFileName(fileName)}`,
    ].join('/');
  }
  private targetFields(t: FileTarget) {
    return {
      leaseId: t.kind === 'lease' ? t.id : null,
      propertyId: t.kind === 'property' ? t.id : null,
      unitId: t.kind === 'unit' ? t.id : null,
    };
  }
  private assertSignedUploadKey(actor: FileActor, target: FileTarget, storageKey: string): void {
    const prefix = `org/${actor.organizationId}/${target.kind}/${target.id}/`;
    const keySuffix = storageKey.startsWith(prefix) ? storageKey.slice(prefix.length) : '';
    // Keys are generated with a random UUID followed by one sanitized filename segment.
    // The target prefix prevents a completion request from deleting another target's object.
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-.+$/i.test(
        keySuffix,
      ) ||
      keySuffix.includes('/')
    )
      throw new StorageError('Upload key does not belong to this target', 'FORBIDDEN', 403);
  }
  async upload(actor: FileActor, input: UploadInput): Promise<StoredDocument> {
    await assertTargetAccess(this.access, actor, input.target);
    const kind = input.kind ?? 'OTHER';
    if (!KINDS.includes(kind)) throw new StorageError(`Unknown kind "${kind}"`, 'VALIDATION', 400);
    assertUploadAllowed(actor, kind);
    const { canonicalMime } = validateUpload({
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.body.byteLength,
      body: input.body,
    });
    const name = sanitizeFileName(input.fileName);
    const storageKey = this.keyFor(actor, input.target, name);
    await this.storage.put(storageKey, input.body, canonicalMime);
    try {
      return await this.repo.create({
        organizationId: actor.organizationId,
        ...this.targetFields(input.target),
        kind,
        name,
        storageKey,
        sizeBytes: input.body.byteLength,
        mimeType: canonicalMime,
      });
    } catch (e) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw e;
    }
  }
  /** Signed direct-upload: validates metadata and returns a PUT URL without recording a Document. */
  async createSignedUpload(
    actor: FileActor,
    input: SignedUploadInput,
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    await assertTargetAccess(this.access, actor, input.target);
    const kind = input.kind ?? 'OTHER';
    if (!KINDS.includes(kind)) throw new StorageError(`Unknown kind "${kind}"`, 'VALIDATION', 400);
    assertUploadAllowed(actor, kind);
    const { canonicalMime } = validateUploadMeta(input);
    const name = sanitizeFileName(input.fileName);
    const storageKey = this.keyFor(actor, input.target, name);
    const uploadUrl = await this.storage.getSignedUrl(storageKey, {
      method: 'PUT',
      contentType: canonicalMime,
      contentLength: input.sizeBytes,
    });
    if (!uploadUrl)
      throw new StorageError(
        'Signed upload is not available with the local storage driver; use server upload',
        'CONFIG',
        501,
      );
    return { uploadUrl, storageKey };
  }
  /** Verifies the uploaded object before recording it; every failed completion removes the object. */
  async completeSignedUpload(
    actor: FileActor,
    input: CompleteSignedUploadInput,
  ): Promise<StoredDocument> {
    await assertTargetAccess(this.access, actor, input.target);
    this.assertSignedUploadKey(actor, input.target, input.storageKey);
    try {
      const kind = input.kind ?? 'OTHER';
      if (!KINDS.includes(kind)) throw new StorageError(`Unknown kind "${kind}"`, 'VALIDATION', 400);
      assertUploadAllowed(actor, kind);
      const { canonicalMime } = validateUploadMeta(input);
      const object = await this.storage.get(input.storageKey);
      if (!object) throw notFoundError('Uploaded file not found');
      if (object.contentType?.trim().toLowerCase() !== canonicalMime)
        throw new StorageError('Stored content type does not match the expected file type');
      validateUpload({
        fileName: input.fileName,
        mimeType: canonicalMime,
        sizeBytes: input.sizeBytes,
        body: object.body,
      });
      const name = sanitizeFileName(input.fileName);
      return await this.repo.create({
        organizationId: actor.organizationId,
        ...this.targetFields(input.target),
        kind,
        name,
        storageKey: input.storageKey,
        sizeBytes: object.body.byteLength,
        mimeType: canonicalMime,
      });
    } catch (e) {
      await this.storage.delete(input.storageKey).catch(() => undefined);
      throw e;
    }
  }
  async list(actor: FileActor, target: FileTarget): Promise<StoredDocument[]> {
    await assertTargetAccess(this.access, actor, target);
    const documents = await this.repo.listByTarget(actor.organizationId, target);
    return actor.role === 'TENANT' ? documents.filter((doc) => doc.kind !== 'ID') : documents;
  }
  async getDocument(actor: FileActor, id: string): Promise<StoredDocument> {
    const doc = await this.repo.findById(actor.organizationId, id);
    if (!doc) throw notFoundError('File not found');
    await assertDocumentAccess(this.access, actor, doc);
    return doc;
  }
  async download(
    actor: FileActor,
    id: string,
  ): Promise<{ document: StoredDocument; body: Uint8Array; signedUrl: string | null }> {
    const document = await this.getDocument(actor, id);
    // Proxy downloads through this origin so the response gets a trusted MIME type,
    // attachment policy and nosniff header instead of relying on bucket response headers.
    const obj = await this.storage.get(document.storageKey);
    if (!obj) throw notFoundError('File content not found');
    return { document, body: obj.body, signedUrl: null };
  }
  async delete(actor: FileActor, id: string): Promise<void> {
    if (actor.role !== 'MANAGER')
      throw new StorageError('Forbidden', 'FORBIDDEN', 403);
    const document = await this.getDocument(actor, id);
    await this.storage.delete(document.storageKey);
    await this.repo.delete(document.id);
  }
}

/** Production wiring: Prisma repository + Prisma access + configured adapter. Lazy imports. */
export async function createPrismaFileService(): Promise<FileService> {
  const [{ db }, { createPrismaFileAccess }, { getStorage }] = await Promise.all([
    import('@/lib/db/client'),
    import('./access'),
    import('./config'),
  ]);
  const repo: DocumentRepository = {
    async create(input) {
      const row = await db.document.create({
        data: { ...input, sizeBytes: BigInt(input.sizeBytes) },
      });
      return { ...row, sizeBytes: Number(row.sizeBytes) };
    },
    async listByTarget(orgId, target) {
      const where =
        target.kind === 'lease'
          ? { organizationId: orgId, leaseId: target.id }
          : target.kind === 'property'
            ? { organizationId: orgId, propertyId: target.id }
            : { organizationId: orgId, unitId: target.id };
      const rows = await db.document.findMany({ where, orderBy: { createdAt: 'desc' } });
      return rows.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) }));
    },
    async findById(orgId, id) {
      const row = await db.document.findFirst({ where: { id, organizationId: orgId } });
      return row ? { ...row, sizeBytes: Number(row.sizeBytes) } : null;
    },
    async delete(id) {
      await db.document.delete({ where: { id } });
    },
  };
  return new FileService(getStorage(), repo, await createPrismaFileAccess());
}

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FileAccess } from './access';
import { assertDocumentAccess, assertTargetAccess } from './access';
import type {
  DocumentKindValue,
  FileActor,
  FileTarget,
  StorageAdapter,
  StoredDocument,
} from './types';
import { notFoundError, StorageError, validationError } from './types';
import { sanitizeFileName, validateUpload, validateUploadMeta } from './validation';
import {
  assertPhotoWithinLimit,
  photoLimitForTarget,
  type PhotoLimitEnv,
  type PhotoUsage,
} from './photo-limits';

export interface DocumentRepository {
  create(input: Omit<StoredDocument, 'id' | 'createdAt'>): Promise<StoredDocument>;
  listByTarget(orgId: string, target: FileTarget): Promise<StoredDocument[]>;
  findById(orgId: string, id: string): Promise<StoredDocument | null>;
  delete(id: string): Promise<void>;
  /** Optional fast photo count; falls back to listByTarget when omitted. */
  countPhotos?(orgId: string, target: FileTarget): Promise<number>;
  /**
   * Optional atomic count-and-create for PHOTO documents. Implementations must
   * count existing PHOTO rows and insert in one transaction (holding a lock on
   * the target) and throw the photo-limit StorageError when full. FileService
   * falls back to its own per-target lock when this is not implemented.
   */
  createPhotoWithinLimit?(
    input: Omit<StoredDocument, 'id' | 'createdAt'>,
    max: number,
  ): Promise<StoredDocument>;
  /** Optional single-row update used by photo ordering/cover fallbacks. */
  update?(
    id: string,
    patch: Partial<Pick<StoredDocument, 'sortOrder' | 'isCover'>>,
  ): Promise<StoredDocument>;
  /** Optional transactional reorder; must persist the given order for the target. */
  reorderPhotos?(
    orgId: string,
    target: FileTarget,
    orderedIds: string[],
  ): Promise<StoredDocument[]>;
  /** Optional transactional cover switch; must leave exactly one cover per target. */
  setCover?(orgId: string, target: FileTarget, documentId: string): Promise<StoredDocument[]>;
}

export function targetMatches(doc: StoredDocument, target: FileTarget): boolean {
  return target.kind === 'lease'
    ? doc.leaseId === target.id
    : target.kind === 'property'
      ? doc.propertyId === target.id
      : doc.unitId === target.id;
}

/** Photos attached to a repair belong to its maintenance request, not the workspace gallery. */
export async function listWorkspacePhotos(
  organizationId: string,
  target: FileTarget,
  client?: PrismaClient,
): Promise<{ id: string; name: string; kind: string; mimeType: string; sizeBytes: number; createdAt: Date; isCover: boolean; caption: string | null }[]> {
  if (target.kind === 'lease') return [];
  const db = client ?? (await import('@/lib/db/client')).db;
  const rows = await db.document.findMany({
    where: {
      organizationId,
      ...(target.kind === 'property' ? { propertyId: target.id } : { unitId: target.id }),
      kind: 'PHOTO',
      maintenancePhoto: { is: null },
    },
    orderBy: [
      { isCover: 'desc' },
      { sortOrder: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    createdAt: row.createdAt,
    isCover: row.isCover,
    caption: row.caption,
  }));
}

/** Cover first, then sortOrder ascending (nulls last), then creation order. */
export function comparePhotoOrder(a: StoredDocument, b: StoredDocument): number {
  if (a.kind !== 'PHOTO' || b.kind !== 'PHOTO') {
    if (a.kind === 'PHOTO') return -1;
    if (b.kind === 'PHOTO') return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  }
  const cover = Number(b.isCover ?? false) - Number(a.isCover ?? false);
  if (cover !== 0) return cover;
  const ao = a.sortOrder ?? null;
  const bo = b.sortOrder ?? null;
  if (ao !== null && bo !== null && ao !== bo) return ao - bo;
  if (ao !== null && bo === null) return -1;
  if (ao === null && bo !== null) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function sortPhotos<T extends StoredDocument>(docs: T[]): T[] {
  return [...docs].sort(comparePhotoOrder);
}

export type { PhotoUsage };
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
const KINDS: DocumentKindValue[] = ['LEASE', 'ADDENDUM', 'DISCLOSURE', 'NOTICE', 'INSPECTION', 'ID', 'PHOTO', 'OTHER'];
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
  private photoLocks = new Map<string, Promise<void>>();

  constructor(
    private storage: StorageAdapter,
    private repo: DocumentRepository,
    private access: FileAccess,
    private env: PhotoLimitEnv = process.env,
  ) {}

  /** Serializes photo count-and-create per target within this process. */
  private async withPhotoLock<T>(orgId: string, target: FileTarget, fn: () => Promise<T>): Promise<T> {
    const key = `${orgId}:${target.kind}:${target.id}`;
    const previous = this.photoLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    this.photoLocks.set(key, chained);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.photoLocks.get(key) === chained) this.photoLocks.delete(key);
    }
  }

  private async countPhotos(orgId: string, target: FileTarget): Promise<number> {
    if (this.repo.countPhotos) return this.repo.countPhotos(orgId, target);
    const documents = await this.repo.listByTarget(orgId, target);
    return documents.filter((doc) => doc.kind === 'PHOTO').length;
  }

  /** Returns `{ used, max }` for PHOTO files on a target; `max` is null when unlimited. */
  async getPhotoUsage(actor: FileActor, target: FileTarget): Promise<PhotoUsage> {
    await assertTargetAccess(this.access, actor, target);
    const max = photoLimitForTarget(target, this.env);
    const used = await this.countPhotos(actor.organizationId, target);
    return { used, max };
  }

  /** Alias for getPhotoUsage. */
  async photoUsage(actor: FileActor, target: FileTarget): Promise<PhotoUsage> {
    return this.getPhotoUsage(actor, target);
  }

  private async assertPhotoCapacity(actor: FileActor, target: FileTarget): Promise<void> {
    const max = photoLimitForTarget(target, this.env);
    if (max === null) return;
    const used = await this.countPhotos(actor.organizationId, target);
    assertPhotoWithinLimit(target, used, max);
  }

  private async nextSortOrder(orgId: string, target: FileTarget): Promise<number> {
    const docs = await this.repo.listByTarget(orgId, target);
    const photos = docs.filter((d) => d.kind === 'PHOTO');
    const max = photos.reduce<number | null>(
      (acc, d) => (d.sortOrder != null && (acc === null || d.sortOrder > acc) ? d.sortOrder : acc),
      null,
    );
    return max !== null ? max + 1 : photos.length;
  }

  private async createDocument(
    actor: FileActor,
    target: FileTarget,
    kind: DocumentKindValue,
    input: Omit<StoredDocument, 'id' | 'createdAt'>,
  ): Promise<StoredDocument> {
    if (kind !== 'PHOTO') return this.repo.create(input);
    const max = photoLimitForTarget(target, this.env);
    if (max !== null && this.repo.createPhotoWithinLimit)
      return this.repo.createPhotoWithinLimit(input, max);
    return this.withPhotoLock(actor.organizationId, target, async () => {
      if (max !== null) {
        const used = await this.countPhotos(actor.organizationId, target);
        assertPhotoWithinLimit(target, used, max);
      }
      const sortOrder = await this.nextSortOrder(actor.organizationId, target);
      return this.repo.create({ ...input, sortOrder });
    });
  }
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
    if (kind === 'PHOTO') await this.assertPhotoCapacity(actor, input.target);
    const name = sanitizeFileName(input.fileName);
    const storageKey = this.keyFor(actor, input.target, name);
    await this.storage.put(storageKey, input.body, canonicalMime);
    try {
      return await this.createDocument(actor, input.target, kind, {
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
    if (kind === 'PHOTO') await this.assertPhotoCapacity(actor, input.target);
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
      return await this.createDocument(actor, input.target, kind, {
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
    const visible =
      actor.role === 'TENANT' ? documents.filter((doc) => doc.kind !== 'ID') : documents;
    return sortPhotos(visible);
  }

  private async photosForTarget(
    actor: FileActor,
    target: FileTarget,
  ): Promise<StoredDocument[]> {
    const docs = await this.repo.listByTarget(actor.organizationId, target);
    return docs.filter((d) => targetMatches(d, target));
  }

  private async assertPhotosBelong(
    actor: FileActor,
    target: FileTarget,
    ids: string[],
  ): Promise<StoredDocument[]> {
    const docs = await this.photosForTarget(actor, target);
    const byId = new Map(docs.map((d) => [d.id, d]));
    for (const id of ids) {
      const doc = byId.get(id);
      if (!doc) {
        const elsewhere = await this.repo.findById(actor.organizationId, id).catch(() => null);
        if (elsewhere) throw validationError('Photo does not belong to this target');
        throw notFoundError('Photo not found');
      }
      if (doc.kind !== 'PHOTO') throw validationError('Only photos can be ordered');
    }
    return docs;
  }

  async reorderPhotos(
    actor: FileActor,
    target: FileTarget,
    orderedIds: string[],
  ): Promise<StoredDocument[]> {
    await assertTargetAccess(this.access, actor, target);
    assertUploadAllowed(actor, 'PHOTO');
    if (!Array.isArray(orderedIds) || orderedIds.length === 0)
      throw validationError('orderedIds must be a non-empty array');
    if (orderedIds.some((id) => typeof id !== 'string' || !id))
      throw validationError('orderedIds must contain photo ids');
    if (new Set(orderedIds).size !== orderedIds.length)
      throw validationError('orderedIds must not contain duplicates');
    const docs = await this.assertPhotosBelong(actor, target, orderedIds);
    if (docs.filter((d) => d.kind === 'PHOTO').length !== orderedIds.length)
      throw validationError('orderedIds must include every photo on this target');
    if (this.repo.reorderPhotos) {
      const updated = await this.repo.reorderPhotos(actor.organizationId, target, orderedIds);
      return sortPhotos(updated.filter((d) => d.kind === 'PHOTO'));
    }
    if (!this.repo.update) throw new StorageError('Photo ordering is unavailable', 'CONFIG', 501);
    const byId = new Map(docs.map((d) => [d.id, d]));
    for (const [index, id] of orderedIds.entries()) {
      const doc = byId.get(id)!;
      doc.sortOrder = index;
      await this.repo.update(id, { sortOrder: index });
    }
    return sortPhotos(docs.filter((d) => d.kind === 'PHOTO'));
  }

  async setCover(
    actor: FileActor,
    target: FileTarget,
    documentId: string,
  ): Promise<StoredDocument[]> {
    await assertTargetAccess(this.access, actor, target);
    assertUploadAllowed(actor, 'PHOTO');
    if (typeof documentId !== 'string' || !documentId)
      throw validationError('documentId is required');
    await this.assertPhotosBelong(actor, target, [documentId]);
    if (this.repo.setCover) {
      const updated = await this.repo.setCover(actor.organizationId, target, documentId);
      return sortPhotos(updated.filter((d) => d.kind === 'PHOTO'));
    }
    if (!this.repo.update) throw new StorageError('Cover selection is unavailable', 'CONFIG', 501);
    const docs = await this.photosForTarget(actor, target);
    for (const doc of docs) {
      if (doc.kind !== 'PHOTO') continue;
      const isCover = doc.id === documentId;
      if ((doc.isCover ?? false) !== isCover) {
        doc.isCover = isCover;
        await this.repo.update(doc.id, { isCover });
      }
    }
    return sortPhotos(docs.filter((d) => d.kind === 'PHOTO'));
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
  const targetWhere = (orgId: string, target: FileTarget) =>
    target.kind === 'lease'
      ? { organizationId: orgId, leaseId: target.id }
      : target.kind === 'property'
        ? { organizationId: orgId, propertyId: target.id }
        : { organizationId: orgId, unitId: target.id };
  const galleryPhotoWhere = (target: FileTarget) =>
    target.kind === 'lease' ? {} : { maintenancePhoto: { is: null as null } };
  const visibleTargetWhere = (orgId: string, target: FileTarget) => ({
    ...targetWhere(orgId, target),
    ...(target.kind === 'lease' ? {} : {
      OR: [{ kind: { not: 'PHOTO' as const } }, { maintenancePhoto: { is: null as null } }],
    }),
  });
  const repo: DocumentRepository = {
    async create(input) {
      const row = await db.document.create({
        data: { ...input, sizeBytes: BigInt(input.sizeBytes) },
      });
      return { ...row, sizeBytes: Number(row.sizeBytes) };
    },
    async countPhotos(orgId, target) {
      return db.document.count({ where: { ...targetWhere(orgId, target), kind: 'PHOTO', ...galleryPhotoWhere(target) } });
    },
    async createPhotoWithinLimit(input, max) {
      const target: FileTarget = input.propertyId
        ? { kind: 'property', id: input.propertyId }
        : input.unitId
          ? { kind: 'unit', id: input.unitId }
          : { kind: 'lease', id: input.leaseId ?? '' };
      const lockKey = `photo-target:${input.organizationId}:${target.kind}:${target.id}`;
      const row = await db.$transaction(async (tx) => {
        // Serialize concurrent photo inserts for this target across processes;
        // the count and insert below then cannot race past the limit.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const where = { ...targetWhere(input.organizationId, target), kind: 'PHOTO' as const, ...galleryPhotoWhere(target) };
        const used = await tx.document.count({ where });
        assertPhotoWithinLimit(target, used, max);
        const top = await tx.document.findFirst({
          where,
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });
        const sortOrder = top?.sortOrder != null ? top.sortOrder + 1 : used;
        return tx.document.create({
          data: { ...input, sortOrder, sizeBytes: BigInt(input.sizeBytes) },
        });
      });
      return { ...row, sizeBytes: Number(row.sizeBytes) };
    },
    async listByTarget(orgId, target) {
      const rows = await db.document.findMany({
        where: visibleTargetWhere(orgId, target),
        orderBy: [
          { isCover: 'desc' },
          { sortOrder: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
      });
      return rows.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) }));
    },
    async update(id, patch) {
      const row = await db.document.update({ where: { id }, data: patch });
      return { ...row, sizeBytes: Number(row.sizeBytes) };
    },
    async reorderPhotos(orgId, target, orderedIds) {
      const where = { ...targetWhere(orgId, target), ...galleryPhotoWhere(target) };
      const rows = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`photo-target:${orgId}:${target.kind}:${target.id}`}))`;
        const existing = await tx.document.findMany({
          where: { ...where, kind: 'PHOTO' },
          select: { id: true, kind: true },
        });
        if (existing.length !== orderedIds.length || existing.some((r) => !orderedIds.includes(r.id)))
          throw validationError('orderedIds must include every photo on this target');
        for (const [index, id] of orderedIds.entries())
          await tx.document.update({ where: { id }, data: { sortOrder: index } });
        return tx.document.findMany({ where });
      });
      return rows.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) }));
    },
    async setCover(orgId, target, documentId) {
      const where = { ...targetWhere(orgId, target), ...galleryPhotoWhere(target) };
      const rows = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`photo-target:${orgId}:${target.kind}:${target.id}`}))`;
        const doc = await tx.document.findFirst({
          where: { ...where, id: documentId },
          select: { id: true, kind: true },
        });
        if (!doc || doc.kind !== 'PHOTO')
          throw validationError('Photo does not belong to this target');
        await tx.document.updateMany({
          where: { ...where, kind: 'PHOTO', isCover: true },
          data: { isCover: false },
        });
        await tx.document.update({ where: { id: documentId }, data: { isCover: true } });
        return tx.document.findMany({ where });
      });
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

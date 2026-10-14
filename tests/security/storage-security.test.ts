import { describe, expect, it, vi } from 'vitest';
import { createFileAccess } from '../../src/lib/storage/access';
import { fileResponse } from '../../src/lib/storage/http';
import { S3StorageAdapter } from '../../src/lib/storage/s3';
import { FileService } from '../../src/lib/storage/service';
import type { FileActor, StoredDocument } from '../../src/lib/storage/types';
import { validateUpload } from '../../src/lib/storage/validation';
import { listTenantLeaseDocuments } from '../../src/lib/tenant-portal/service';
import { JPG, memoryRepo, PDF } from '../storage/helpers';

vi.mock('../../src/lib/db/client', () => ({ db: {} }));

function zipStored(entries: Record<string, string>): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const [name, contents] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(contents, 'utf8');
    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    data.copy(local, 30 + nameBytes.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    nameBytes.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, end]));
}

function heicContainer(): Uint8Array {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(ftyp.length, 0);
  ftyp.write('ftyp', 4, 'ascii');
  ftyp.write('heic', 8, 'ascii');
  ftyp.writeUInt32BE(0, 12);
  ftyp.write('mif1', 16, 'ascii');
  const meta = Buffer.from([0, 0, 0, 12, 0x6d, 0x65, 0x74, 0x61, 0, 0, 0, 0]);
  const mdat = Buffer.from([0, 0, 0, 9, 0x6d, 0x64, 0x61, 0x74, 0x01]);
  return new Uint8Array(Buffer.concat([ftyp, meta, mdat]));
}

const validDocx = zipStored({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<w:document/>' });
const validHeic = heicContainer();
const owner: FileActor = { subjectId: 'owner-1', organizationId: 'org-1', role: 'OWNER' };
const tenant: FileActor = {
  subjectId: 'tenant-user-1',
  organizationId: 'org-1',
  role: 'TENANT',
  tenantId: 'tenant-1',
};

describe('upload content validation', () => {
  it('accepts well-formed DOCX containers and rejects a bare ZIP signature', () => {
    expect(
      validateUpload({
        fileName: 'lease.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: validDocx.byteLength,
        body: validDocx,
      }).extension,
    ).toBe('.docx');
    const bareSignature = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    expect(() =>
      validateUpload({
        fileName: 'fake.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: bareSignature.byteLength,
        body: bareSignature,
      }),
    ).toThrow(/content does not match/);
  });

  it('requires an ISO-BMFF HEIC file type, metadata, and image data boxes', () => {
    expect(
      validateUpload({
        fileName: 'scan.heic',
        mimeType: 'image/heic',
        sizeBytes: validHeic.byteLength,
        body: validHeic,
      }).extension,
    ).toBe('.heic');
    const weakBrandOnly = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);
    expect(() =>
      validateUpload({
        fileName: 'fake.heic',
        mimeType: 'image/heic',
        sizeBytes: weakBrandOnly.byteLength,
        body: weakBrandOnly,
      }),
    ).toThrow(/content does not match/);
  });
});

describe('owner and tenant document access', () => {
  it('passes the signed-in owner id into each property access lookup', async () => {
    const leaseExists = vi.fn(async ({ ownerId }: { ownerId?: string }) => ownerId === owner.subjectId);
    const propertyExists = vi.fn(async ({ ownerId }: { ownerId?: string }) => ownerId === owner.subjectId);
    const unitExists = vi.fn(async ({ ownerId }: { ownerId?: string }) => ownerId === owner.subjectId);
    const access = createFileAccess({ leaseExists, propertyExists, unitExists });
    expect(await access.canAccessTarget(owner, { kind: 'lease', id: 'lease-1' })).toBe(true);
    expect(await access.canAccessTarget(owner, { kind: 'property', id: 'property-1' })).toBe(true);
    expect(await access.canAccessTarget(owner, { kind: 'unit', id: 'unit-1' })).toBe(true);
    expect(leaseExists).toHaveBeenCalledWith({
      leaseId: 'lease-1',
      organizationId: 'org-1',
      ownerId: 'owner-1',
    });
  });

  it('hides all shared-lease ID files from tenants and keeps owner files read-only', async () => {
    const repo = memoryRepo();
    const access = createFileAccess({
      leaseExists: async ({ tenantId, ownerId }) =>
        tenantId === 'tenant-1' || ownerId === 'owner-1',
      propertyExists: async () => true,
      unitExists: async () => true,
    });
    const adapter = {
      driver: 'memory',
      put: vi.fn(async () => undefined),
      get: vi.fn(async () => ({ body: PDF })),
      delete: vi.fn(async () => undefined),
      getSignedUrl: vi.fn(async () => null),
    };
    const files = new FileService(adapter, repo, access);
    const leaseDoc = await repo.create({
      organizationId: 'org-1',
      leaseId: 'lease-1',
      propertyId: null,
      unitId: null,
      kind: 'LEASE',
      name: 'lease.pdf',
      storageKey: 'lease',
      sizeBytes: PDF.byteLength,
      mimeType: 'application/pdf',
    });
    const idDocument = await repo.create({
      organizationId: 'org-1',
      leaseId: 'lease-1',
      propertyId: null,
      unitId: null,
      kind: 'ID',
      name: 'identity.pdf',
      storageKey: 'id',
      sizeBytes: PDF.byteLength,
      mimeType: 'application/pdf',
    });
    expect((await files.list(tenant, { kind: 'lease', id: 'lease-1' })).map((doc) => doc.kind)).toEqual([
      'LEASE',
    ]);
    await expect(files.getDocument(tenant, idDocument.id)).rejects.toMatchObject({ status: 403 });
    await expect(
      files.upload(owner, {
        target: { kind: 'lease', id: 'lease-1' },
        fileName: 'notice.pdf',
        mimeType: 'application/pdf',
        body: PDF,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(files.delete(owner, leaseDoc.id)).rejects.toMatchObject({ status: 403 });
  });

  it('allows tenant repair photos but rejects manager-only lease and ID uploads', async () => {
    const repo = memoryRepo();
    const access = createFileAccess({
      leaseExists: async ({ tenantId }) => tenantId === 'tenant-1',
      propertyExists: async () => false,
      unitExists: async () => false,
    });
    const files = new FileService(
      {
        driver: 'memory',
        put: async () => undefined,
        get: async () => null,
        delete: async () => undefined,
        getSignedUrl: async () => null,
      },
      repo,
      access,
    );
    const photo = await files.upload(tenant, {
      target: { kind: 'lease', id: 'lease-1' },
      fileName: 'repair.jpg',
      mimeType: 'image/jpeg',
      kind: 'PHOTO',
      body: JPG,
    });
    expect(photo.kind).toBe('PHOTO');
    await expect(
      files.upload(tenant, {
        target: { kind: 'lease', id: 'lease-1' },
        fileName: 'replacement.pdf',
        mimeType: 'application/pdf',
        kind: 'LEASE',
        body: PDF,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      files.upload(tenant, {
        target: { kind: 'lease', id: 'lease-1' },
        fileName: 'identity.pdf',
        mimeType: 'application/pdf',
        kind: 'ID',
        body: PDF,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('also filters co-tenant ID documents at the tenant portal boundary', async () => {
    const now = new Date();
    const docs = await listTenantLeaseDocuments(tenant, 'lease-1', {
      list: async () => [
        {
          id: 'lease-file', organizationId: 'org-1', leaseId: 'lease-1', propertyId: null,
          unitId: null, kind: 'LEASE', name: 'lease.pdf', storageKey: 'lease',
          sizeBytes: PDF.byteLength, mimeType: 'application/pdf', createdAt: now,
        },
        {
          id: 'id-file', organizationId: 'org-1', leaseId: 'lease-1', propertyId: null,
          unitId: null, kind: 'ID', name: 'identity.pdf', storageKey: 'identity',
          sizeBytes: PDF.byteLength, mimeType: 'application/pdf', createdAt: now,
        },
      ],
    });
    expect(docs.map((doc) => doc.id)).toEqual(['lease-file']);
  });
});

describe('signed S3 transfer and safe responses', () => {
  it('signs the exact PUT content type and length and keeps GETs as attachments', async () => {
    const s3 = new S3StorageAdapter({
      endpoint: 'https://s3.example.test',
      bucket: 'docs',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'a-secret-value-long-enough',
    });
    const put = new URL(
      await s3.getSignedUrl('org/o/a.pdf', {
        method: 'PUT',
        contentType: 'application/pdf',
        contentLength: 4096,
      }),
    );
    expect(put.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    await expect(s3.getSignedUrl('org/o/a.pdf', { method: 'PUT' })).rejects.toThrow(
      /content type and exact content length/,
    );
    const get = new URL(await s3.getSignedUrl('org/o/a.pdf', { method: 'GET' }));
    expect(get.searchParams.get('response-content-disposition')).toBe('attachment');
    expect(get.searchParams.get('response-content-type')).toBe('application/octet-stream');
  });

  it('forces safe file types to download with nosniff for all other inline requests', () => {
    const document = {
      id: 'doc-1',
      organizationId: 'org-1',
      leaseId: null,
      propertyId: null,
      unitId: null,
      kind: 'OTHER',
      name: 'active.html',
      storageKey: 'key',
      sizeBytes: 4,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      createdAt: new Date(),
    } satisfies StoredDocument;
    const response = fileResponse(new Uint8Array([1, 2, 3, 4]), document, 'inline');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

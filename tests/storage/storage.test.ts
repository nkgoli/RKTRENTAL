import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileAccess, type TargetLookup } from '../../src/lib/storage/access';
import { createStorageAdapter } from '../../src/lib/storage/config';
import { LocalStorageAdapter } from '../../src/lib/storage/local';
import { S3StorageAdapter } from '../../src/lib/storage/s3';
import { FileService } from '../../src/lib/storage/service';
import { MAX_FILE_BYTES, type FileActor } from '../../src/lib/storage/types';
import { validateUpload, validateUploadMeta } from '../../src/lib/storage/validation';
import { DOCX, HEIC, JPG, PDF, PNG, memoryRepo } from './helpers';

const manager: FileActor = { subjectId: 'u1', organizationId: 'org-1', role: 'MANAGER' };
const tenant: FileActor = {
  subjectId: 'u2',
  organizationId: 'org-1',
  role: 'TENANT',
  tenantId: 'tenant-1',
};
const otherOrgManager: FileActor = { subjectId: 'u3', organizationId: 'org-2', role: 'MANAGER' };

const lookup: TargetLookup = {
  async leaseExists({ leaseId, organizationId, tenantId }) {
    if (leaseId !== 'lease-1' || organizationId !== 'org-1') return false;
    return tenantId === undefined || tenantId === 'tenant-1';
  },
  async propertyExists({ propertyId, organizationId }) {
    return propertyId === 'prop-1' && organizationId === 'org-1';
  },
  async unitExists({ unitId, organizationId }) {
    return unitId === 'unit-1' && organizationId === 'org-1';
  },
};
const access = createFileAccess(lookup);
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});
async function service() {
  const dir = await mkdtemp(path.join(process.cwd(), 'tests/storage/.tmp-storage-'));
  dirs.push(dir);
  return new FileService(new LocalStorageAdapter(dir), memoryRepo(), access);
}

describe('type and size limits', () => {
  it('accepts allowed types and rejects others / oversize / mismatches', () => {
    for (const [name, mime, body] of [
      ['lease.pdf', 'application/pdf', PDF],
      ['photo.jpg', 'image/jpeg', JPG],
      ['photo.png', 'image/png', PNG],
      [
        'scan.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        DOCX,
      ],
      ['img.heic', 'image/heic', HEIC],
    ] as const)
      expect(
        validateUpload({ fileName: name, mimeType: mime, sizeBytes: body.byteLength, body })
          .canonicalMime,
      ).toBe(mime);
    expect(() =>
      validateUploadMeta({
        fileName: 'evil.exe',
        mimeType: 'application/octet-stream',
        sizeBytes: 10,
      }),
    ).toThrow(/not allowed/);
    expect(() =>
      validateUploadMeta({ fileName: 'a.zip', mimeType: 'application/zip', sizeBytes: 10 }),
    ).toThrow(/not allowed/);
    expect(() =>
      validateUploadMeta({
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: MAX_FILE_BYTES + 1,
      }),
    ).toThrow(/25 MB/);
    expect(
      validateUploadMeta({
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: MAX_FILE_BYTES,
      }).canonicalMime,
    ).toBe('application/pdf');
    expect(() =>
      validateUploadMeta({ fileName: 'a.pdf', mimeType: 'image/png', sizeBytes: 10 }),
    ).toThrow(/does not match/);
    expect(() =>
      validateUpload({
        fileName: 'fake.pdf',
        mimeType: 'application/pdf',
        sizeBytes: PNG.byteLength,
        body: PNG,
      }),
    ).toThrow(/content does not match/);
    expect(() =>
      validateUploadMeta({ fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 0 }),
    ).toThrow(/empty/);
  });
});

describe('access rules', () => {
  it('managers within org, tenants only own lease, cross-org/admin denied', async () => {
    expect(await access.canAccessTarget(manager, { kind: 'lease', id: 'lease-1' })).toBe(true);
    expect(await access.canAccessTarget(manager, { kind: 'property', id: 'prop-1' })).toBe(true);
    expect(await access.canAccessTarget(manager, { kind: 'unit', id: 'unit-1' })).toBe(true);
    expect(await access.canAccessTarget(otherOrgManager, { kind: 'lease', id: 'lease-1' })).toBe(
      false,
    );
    expect(await access.canAccessTarget(tenant, { kind: 'lease', id: 'lease-1' })).toBe(true);
    expect(await access.canAccessTarget(tenant, { kind: 'property', id: 'prop-1' })).toBe(false);
    expect(await access.canAccessTarget(tenant, { kind: 'unit', id: 'unit-1' })).toBe(false);
    expect(
      await access.canAccessTarget({ ...manager, role: 'ADMIN' }, { kind: 'lease', id: 'lease-1' }),
    ).toBe(false);
    expect(
      await access.canAccessTarget(
        { ...tenant, tenantId: 'tenant-9' },
        { kind: 'lease', id: 'lease-1' },
      ),
    ).toBe(false);
  });
});

describe('file service with local adapter', () => {
  it('uploads, lists, previews/downloads and deletes for lease, property and unit', async () => {
    const svc = await service();
    const leaseDoc = await svc.upload(manager, {
      target: { kind: 'lease', id: 'lease-1' },
      fileName: 'lease.pdf',
      mimeType: 'application/pdf',
      kind: 'LEASE',
      body: PDF,
    });
    const propDoc = await svc.upload(manager, {
      target: { kind: 'property', id: 'prop-1' },
      fileName: 'front.jpg',
      mimeType: 'image/jpeg',
      kind: 'PHOTO',
      body: JPG,
    });
    const unitDoc = await svc.upload(manager, {
      target: { kind: 'unit', id: 'unit-1' },
      fileName: 'unit.png',
      mimeType: 'image/png',
      body: PNG,
    });
    expect(leaseDoc).toMatchObject({
      leaseId: 'lease-1',
      sizeBytes: PDF.byteLength,
      mimeType: 'application/pdf',
    });
    expect((await svc.list(manager, { kind: 'lease', id: 'lease-1' })).map((d) => d.id)).toEqual([
      leaseDoc.id,
    ]);
    expect((await svc.list(manager, { kind: 'property', id: 'prop-1' }))[0].id).toBe(propDoc.id);
    const got = await svc.download(tenant, leaseDoc.id); // tenant may read own-lease file
    expect(Buffer.from(got.body).equals(Buffer.from(PDF))).toBe(true);
    await expect(svc.download(tenant, propDoc.id)).rejects.toMatchObject({ status: 403 });
    await expect(svc.download(otherOrgManager, unitDoc.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      svc.upload(tenant, {
        target: { kind: 'property', id: 'prop-1' },
        fileName: 'x.jpg',
        mimeType: 'image/jpeg',
        body: JPG,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      svc.upload(manager, {
        target: { kind: 'lease', id: 'lease-1' },
        fileName: 'big.pdf',
        mimeType: 'application/pdf',
        body: PDF,
      }),
    ).resolves.toBeTruthy();
    await svc.delete(manager, leaseDoc.id);
    await expect(svc.download(manager, leaseDoc.id)).rejects.toMatchObject({ status: 404 });
  });
  it('rejects signed upload on local driver with 501 guidance', async () => {
    const svc = await service();
    await expect(
      svc.createSignedUpload(manager, {
        target: { kind: 'lease', id: 'lease-1' },
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
      }),
    ).rejects.toMatchObject({ status: 501 });
  });
});

describe('adapters and config', () => {
  it('local adapter round-trips and blocks traversal', async () => {
    const dir = await mkdtemp(path.join(process.cwd(), 'tests/storage/.tmp-local-'));
    dirs.push(dir);
    const a = new LocalStorageAdapter(dir);
    await a.put('org/o/lease/l/a.pdf', PDF, 'application/pdf');
    expect(Buffer.from((await a.get('org/o/lease/l/a.pdf'))!.body).equals(Buffer.from(PDF))).toBe(
      true,
    );
    await expect(a.put('../escape.pdf', PDF, 'application/pdf')).rejects.toBeTruthy();
    expect(await a.getSignedUrl('x', { method: 'GET' })).toBeNull();
    await a.delete('org/o/lease/l/a.pdf');
    expect(await a.get('org/o/lease/l/a.pdf')).toBeNull();
  });
  it('config selects local by default and requires secrets for s3', () => {
    expect(createStorageAdapter({}).driver).toBe('local');
    expect(() => createStorageAdapter({ STORAGE_DRIVER: 's3' })).toThrow(/requires/);
    expect(
      createStorageAdapter({
        S3_BUCKET: 'b',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 's',
        S3_ENDPOINT: 'http://localhost:9000',
      }).driver,
    ).toBe('s3');
  });
  it('s3 adapter SigV4-signs PUT/GET and presigns URLs (fake fetch)', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(PDF, { status: 200, headers: { 'content-type': 'application/pdf' } });
    };
    const s3 = new S3StorageAdapter(
      {
        endpoint: 'http://localhost:9000',
        bucket: 'docs',
        region: 'us-east-1',
        accessKeyId: 'minio',
        secretAccessKey: 'secretsecret',
        forcePathStyle: true,
      },
      fakeFetch as typeof fetch,
    );
    await s3.put('org/o/a.pdf', PDF, 'application/pdf');
    expect(calls[0].url).toBe('http://localhost:9000/docs/org/o/a.pdf');
    expect(String((calls[0].init?.headers as Record<string, string>).Authorization)).toMatch(
      /^AWS4-HMAC-SHA256 Credential=minio\//,
    );
    expect(Buffer.from((await s3.get('org/o/a.pdf'))!.body).equals(Buffer.from(PDF))).toBe(true);
    const url = await s3.getSignedUrl('org/o/a.pdf', { method: 'GET', expiresInSeconds: 60 });
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Expires=60');
  });
});

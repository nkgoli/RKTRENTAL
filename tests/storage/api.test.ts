import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createFileAccess, type TargetLookup } from '../../src/lib/storage/access';
import { LocalStorageAdapter } from '../../src/lib/storage/local';
import { FileService } from '../../src/lib/storage/service';
import { JPG, PDF, memoryRepo } from './helpers';

const lookup: TargetLookup = {
  async leaseExists({ leaseId, organizationId, tenantId }) {
    return (
      leaseId === 'lease-1' && organizationId === 'org-1' && (!tenantId || tenantId === 'tenant-1')
    );
  },
  async propertyExists({ propertyId, organizationId }) {
    return propertyId === 'prop-1' && organizationId === 'org-1';
  },
  async unitExists({ unitId, organizationId }) {
    return unitId === 'unit-1' && organizationId === 'org-1';
  },
};
const session = {
  subjectId: 'u1',
  organizationId: 'org-1',
  email: 'm@example.com',
  name: 'Manager',
  role: 'MANAGER' as const,
  issuedAt: 1,
  expiresAt: 9999999999,
};
vi.mock('@/lib/auth/server-session', () => ({ getSession: async () => session }));
vi.mock('../../src/lib/storage/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/storage/service')>();
  return {
    ...actual,
    createPrismaFileService: async () =>
      (globalThis as unknown as { __fileService: FileService }).__fileService,
  };
});

let POST: typeof import('../../src/app/api/files/route').POST;
let GET: typeof import('../../src/app/api/files/route').GET;
let previewGET: typeof import('../../src/app/api/files/[id]/preview/route').GET;
let downloadGET: typeof import('../../src/app/api/files/[id]/download/route').GET;

beforeAll(async () => {
  const dir = await mkdtemp(path.join(process.cwd(), 'tests/storage/.tmp-api-'));
  (globalThis as unknown as { __fileService: FileService }).__fileService = new FileService(
    new LocalStorageAdapter(dir),
    memoryRepo(),
    createFileAccess(lookup),
  );
  ({ POST, GET } = await import('../../src/app/api/files/route'));
  previewGET = (await import('../../src/app/api/files/[id]/preview/route')).GET;
  downloadGET = (await import('../../src/app/api/files/[id]/download/route')).GET;
});

describe('files API (route handlers, in-memory repo + local storage)', () => {
  it('uploads via POST, lists, previews and downloads — the curl-equivalent flow', async () => {
    const form = new FormData();
    form.set('targetType', 'lease');
    form.set('targetId', 'lease-1');
    form.set('kind', 'LEASE');
    form.set('file', new File([Buffer.from(PDF)], 'lease.pdf', { type: 'application/pdf' }));
    const created = await POST(
      new Request('http://test/api/files', { method: 'POST', body: form }),
    );
    expect(created.status).toBe(201);
    const { file } = (await created.json()) as { file: { id: string; name: string } };
    expect(file.name).toBe('lease.pdf');
    console.log(
      `API example: POST /api/files -> 201 id=${file.id}; GET list/preview/download below`,
    );

    const list = await GET(new Request('http://test/api/files?targetType=lease&targetId=lease-1'));
    expect(list.status).toBe(200);
    expect(((await list.json()) as { files: unknown[] }).files).toHaveLength(1);

    const preview = await previewGET(new Request('http://test/preview'), {
      params: Promise.resolve({ id: file.id }),
    });
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-disposition')).toContain('inline');
    expect(Buffer.from(await preview.arrayBuffer()).equals(Buffer.from(PDF))).toBe(true);

    const download = await downloadGET(new Request('http://test/download'), {
      params: Promise.resolve({ id: file.id }),
    });
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await download.arrayBuffer()).equals(Buffer.from(PDF))).toBe(true);
  });
  it('rejects a disallowed type through the API with 400', async () => {
    const form = new FormData();
    form.set('targetType', 'lease');
    form.set('targetId', 'lease-1');
    form.set(
      'file',
      new File([Buffer.from(JPG)], 'payload.exe', { type: 'application/octet-stream' }),
    );
    const res = await POST(new Request('http://test/api/files', { method: 'POST', body: form }));
    expect(res.status).toBe(400);
  });
});

import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { createFileAccess } from '../../src/lib/storage/access';
import { FileService } from '../../src/lib/storage/service';
import {
  buildActivity,
  canPreview,
  fileBadge,
  leaseNotice,
  listTenantLeaseDocuments,
  loadTenantLease,
  parseOccupants,
  readTenantUnitPhoto,
  TenantPortalAccessError,
  findTenantLeaseForPortal,
  type TenantScope,
} from '../../src/lib/tenant-portal';
import { memoryRepo, PDF, PNG } from '../storage/helpers';

const ORG = 'org-1';
const alex: TenantScope = {
  subjectId: 'u-alex',
  role: 'TENANT',
  organizationId: ORG,
  tenantId: 't-alex',
};
const blake: TenantScope = {
  subjectId: 'u-blake',
  role: 'TENANT',
  organizationId: ORG,
  tenantId: 't-blake',
};
const otherOrg: TenantScope = {
  subjectId: 'u-x',
  role: 'TENANT',
  organizationId: 'org-2',
  tenantId: 't-alex',
};
const manager: TenantScope = { subjectId: 'u-mgr', role: 'MANAGER', organizationId: ORG };

type LeaseRow = {
  id: string;
  organizationId: string;
  unitId: string;
  status: 'ACTIVE';
  startDate: Date;
  endDate: Date;
  monthlyRent: string;
  deposit: string;
  occupants: string | null;
  noticeGivenAt: Date | null;
  moveOutDate: Date | null;
  tenantIds: string[];
};

const leases: LeaseRow[] = [
  {
    id: 'lease-alex',
    organizationId: ORG,
    unitId: 'unit-4b',
    status: 'ACTIVE',
    startDate: new Date('2025-12-01T00:00:00Z'),
    endDate: new Date('2026-11-30T00:00:00Z'),
    monthlyRent: '1850.00',
    deposit: '1850.00',
    occupants: 'Alex Rivera, Casey Rivera',
    noticeGivenAt: new Date('2026-10-01T00:00:00Z'),
    moveOutDate: new Date('2026-11-30T00:00:00Z'),
    tenantIds: ['t-alex'],
  },
  {
    id: 'lease-blake',
    organizationId: ORG,
    unitId: 'unit-2a',
    status: 'ACTIVE',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T00:00:00Z'),
    monthlyRent: '1500.00',
    deposit: '1500.00',
    occupants: null,
    noticeGivenAt: null,
    moveOutDate: null,
    tenantIds: ['t-blake'],
  },
];

const names: Record<string, string> = { 't-alex': 'Alex Rivera', 't-blake': 'Blake Chen' };

type Where = {
  id?: string;
  organizationId?: string;
  status?: string;
  tenants?: { some: { tenantId: string; organizationId: string } };
};

/** Just enough Prisma to evaluate the lease where-clauses the portal builds. */
function fakeClient(documents: Array<Record<string, unknown>> = []) {
  const matches = (lease: LeaseRow, where: Where) =>
    (where.id === undefined || lease.id === where.id) &&
    (where.organizationId === undefined || lease.organizationId === where.organizationId) &&
    (where.status === undefined || lease.status === where.status) &&
    (where.tenants === undefined || lease.tenantIds.includes(where.tenants.some.tenantId));
  const hydrate = (lease: LeaseRow) => ({
    ...lease,
    monthlyRent: lease.monthlyRent,
    unit: {
      number: lease.unitId === 'unit-4b' ? '4B' : '2A',
      isImplicit: false,
      property: { name: 'Maple Court' },
    },
    tenants: lease.tenantIds.map((tenantId) => ({
      tenantId,
      isPrimary: true,
      tenant: { name: names[tenantId] },
    })),
  });
  return {
    lease: {
      findFirst: async ({ where }: { where: Where }) => {
        const found = leases.find((l) => matches(l, where));
        return found ? hydrate(found) : null;
      },
    },
    user: { findFirst: async () => ({ name: 'Jordan Mills' }) },
    autopaySetting: { findUnique: async () => null },
    document: {
      findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
        documents.find((d) => d.id === where.id && d.organizationId === where.organizationId) ??
        null,
      findMany: async ({ where }: { where: { unitId: string } }) =>
        documents.filter((d) => d.unitId === where.unitId && d.kind === 'PHOTO'),
    },
  } as unknown as PrismaClient;
}

/** Real FileService + access rule; the lookup mirrors buildLeaseAccessWhere's tenant clause. */
function fileService() {
  const repo = memoryRepo();
  const access = createFileAccess({
    leaseExists: async ({ leaseId, organizationId, tenantId }) =>
      leases.some(
        (l) =>
          l.id === leaseId &&
          l.organizationId === organizationId &&
          (!tenantId || l.tenantIds.includes(tenantId)),
      ),
    propertyExists: async () => true,
    unitExists: async () => true,
  });
  const storage = new Map<string, Uint8Array>();
  const adapter = {
    driver: 'memory',
    put: async (key: string, body: Uint8Array) => void storage.set(key, body),
    get: async (key: string) => (storage.has(key) ? { body: storage.get(key)! } : null),
    delete: async () => undefined,
    getSignedUrl: async () => null,
  };
  return { service: new FileService(adapter, repo, access), repo, adapter };
}

describe('tenant lease lookup', () => {
  it("returns the tenant's own lease", async () => {
    const lease = await findTenantLeaseForPortal(alex, { client: fakeClient() });
    expect(lease?.id).toBe('lease-alex');
  });

  it("refuses another tenant's lease by id", async () => {
    const client = fakeClient();
    expect(await findTenantLeaseForPortal(alex, { leaseId: 'lease-blake', client })).toBeNull();
    expect(await findTenantLeaseForPortal(blake, { leaseId: 'lease-alex', client })).toBeNull();
  });

  it('refuses a lease from another organization', async () => {
    expect(
      await findTenantLeaseForPortal(otherOrg, { leaseId: 'lease-alex', client: fakeClient() }),
    ).toBeNull();
  });

  it('refuses managers and tenants without a tenant id', async () => {
    const client = fakeClient();
    await expect(findTenantLeaseForPortal(manager, { client })).rejects.toBeInstanceOf(
      TenantPortalAccessError,
    );
    await expect(
      findTenantLeaseForPortal({ ...alex, tenantId: undefined }, { client }),
    ).rejects.toBeInstanceOf(TenantPortalAccessError);
  });
});

describe('tenant lease documents', () => {
  it("lists only the tenant's own lease files and hides unit photos", async () => {
    const { service } = fileService();
    await service.upload(manager, {
      target: { kind: 'lease', id: 'lease-alex' },
      fileName: 'Signed lease.pdf',
      mimeType: 'application/pdf',
      kind: 'LEASE',
      body: PDF,
    });
    const docs = await listTenantLeaseDocuments(alex, 'lease-alex', service);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      previewUrl: `/api/files/${docs[0]!.id}/preview`,
      downloadUrl: `/api/files/${docs[0]!.id}/download`,
    });
  });

  it("refuses to list another tenant's lease documents", async () => {
    const { service } = fileService();
    await expect(listTenantLeaseDocuments(alex, 'lease-blake', service)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it("refuses to preview or download another tenant's document", async () => {
    const { service } = fileService();
    const blakeDoc = await service.upload(
      manager,
      {
        target: { kind: 'lease', id: 'lease-blake' },
        fileName: 'Blake lease.pdf',
        mimeType: 'application/pdf',
        kind: 'LEASE',
        body: PDF,
      },
    );
    await expect(service.download({ ...alex }, blakeDoc.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.getDocument({ ...alex }, blakeDoc.id)).rejects.toMatchObject({
      status: 403,
    });
    // The owner still reads it.
    await expect(service.download({ ...blake }, blakeDoc.id)).resolves.toBeTruthy();
  });

  it('loadTenantLease returns only the signed-in tenant lease with its documents', async () => {
    const { service } = fileService();
    await service.upload(
      manager,
      {
        target: { kind: 'lease', id: 'lease-alex' },
        fileName: 'alex.pdf',
        mimeType: 'application/pdf',
        kind: 'LEASE',
        body: PDF,
      },
    );
    await service.upload(
      manager,
      {
        target: { kind: 'lease', id: 'lease-blake' },
        fileName: 'blake.pdf',
        mimeType: 'application/pdf',
        kind: 'LEASE',
        body: PDF,
      },
    );
    const view = await loadTenantLease(alex, {
      client: fakeClient(),
      files: service,
      now: new Date('2026-10-14T12:00:00Z'),
    });
    expect(view).toMatchObject({
      leaseId: 'lease-alex',
      tenantName: 'Alex Rivera',
      monthlyRentCents: 185000,
      occupants: ['Alex Rivera', 'Casey Rivera'],
    });
    expect(view?.documents.map((d) => d.name)).toEqual(['alex.pdf']);
    expect(view?.notice).toMatchObject({ kind: 'move-out' });
  });
});

describe('tenant unit photos', () => {
  const photos = [
    {
      id: 'photo-4b',
      organizationId: ORG,
      unitId: 'unit-4b',
      kind: 'PHOTO',
      name: 'a.png',
      mimeType: 'image/png',
      storageKey: 'k/4b',
      sizeBytes: BigInt(9),
      leaseId: null,
      propertyId: null,
      createdAt: new Date(),
    },
    {
      id: 'photo-2a',
      organizationId: ORG,
      unitId: 'unit-2a',
      kind: 'PHOTO',
      name: 'b.png',
      mimeType: 'image/png',
      storageKey: 'k/2a',
      sizeBytes: BigInt(9),
      leaseId: null,
      propertyId: null,
      createdAt: new Date(),
    },
  ];
  const storage = {
    get: async (key: string) => (key.startsWith('k/') ? { body: PNG } : null),
  };

  it('serves a photo of the tenant own unit', async () => {
    const res = await readTenantUnitPhoto(alex, 'photo-4b', storage, fakeClient(photos));
    expect(res.document.mimeType).toBe('image/png');
    expect(res.body.byteLength).toBe(PNG.byteLength);
  });

  it("refuses a photo of someone else's unit", async () => {
    await expect(
      readTenantUnitPhoto(alex, 'photo-2a', storage, fakeClient(photos)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses managers on the tenant route', async () => {
    await expect(
      readTenantUnitPhoto(manager, 'photo-4b', storage, fakeClient(photos)),
    ).rejects.toBeInstanceOf(TenantPortalAccessError);
  });
});

describe('portal rules', () => {
  const now = new Date('2026-10-14T12:00:00Z');

  it('parses occupants', () => {
    expect(parseOccupants('Alex Rivera, Casey Rivera')).toEqual(['Alex Rivera', 'Casey Rivera']);
    expect(parseOccupants(null)).toEqual([]);
  });

  it('shows a move-out notice, then a renewal reminder near lease end', () => {
    const base = {
      endDate: new Date('2026-11-30T00:00:00Z'),
      noticeGivenAt: null,
      moveOutDate: null,
    };
    expect(leaseNotice(base, 'Jordan', now)).toMatchObject({ kind: 'renewal' });
    expect(
      leaseNotice(
        { ...base, noticeGivenAt: new Date('2026-10-01'), moveOutDate: new Date('2026-11-30') },
        'Jordan',
        now,
      ),
    ).toMatchObject({ kind: 'move-out', title: 'Move-out Nov 30, 2026' });
    expect(
      leaseNotice({ ...base, endDate: new Date('2027-06-30T00:00:00Z') }, 'Jordan', now),
    ).toBeNull();
  });

  it('classifies files', () => {
    expect(fileBadge('application/pdf')).toBe('pdf');
    expect(fileBadge('image/png')).toBe('img');
    expect(canPreview('application/msword')).toBe(false);
  });

  it('turns receipts into activity', () => {
    const items = buildActivity([
      {
        paymentId: 'p1',
        label: 'October rent',
        amountCents: 185000,
        status: 'SUCCEEDED',
        statusLabel: 'Paid',
        date: new Date('2026-10-01T00:00:00Z'),
      },
    ]);
    expect(items[0]).toMatchObject({ title: 'October rent received', tone: 'success' });
    expect(items[0]!.detail).toContain('$1,850');
  });
});

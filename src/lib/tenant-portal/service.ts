import type { PrismaClient } from '@prisma/client';
import { buildLeaseAccessWhere } from '@/lib/auth/policy';
import type { AuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { unitLabel } from '@/lib/properties/format';
import type { FileService } from '@/lib/storage/service';
import {
  forbiddenError,
  notFoundError,
  type StorageAdapter,
  type StoredDocument,
} from '@/lib/storage/types';
import { loadTenantPayView, type TenantPayView } from '@/lib/tenant-pay';
import {
  buildActivity,
  leaseNotice,
  parseOccupants,
  type ActivityItem,
  type LeaseNotice,
} from './core';

type Client = PrismaClient;

/** The slice of the session the portal needs. Only an authenticated tenant yields a scope. */
export type TenantScope = Pick<AuthSession, 'role' | 'organizationId' | 'tenantId' | 'subjectId'>;

export class TenantPortalAccessError extends Error {
  readonly status = 404;
}

function requireTenantScope(scope: TenantScope): { organizationId: string; tenantId: string } {
  if (scope.role !== 'TENANT' || !scope.tenantId)
    throw new TenantPortalAccessError('Tenant access only');
  return { organizationId: scope.organizationId, tenantId: scope.tenantId };
}

const leaseInclude = {
  unit: { include: { property: true } },
  tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' as const } },
};

/**
 * The tenant's lease. With a `leaseId` the lookup uses the shared access policy, so a lease
 * of another tenant (or another organization) resolves to null exactly like a missing one.
 * Without one, the tenant's own current lease is chosen first and then re-read through the
 * same policy, so there is a single place that decides who can see a lease.
 */
export async function findTenantLeaseForPortal(
  scope: TenantScope,
  options: { leaseId?: string; client?: Client } = {},
) {
  const { organizationId, tenantId } = requireTenantScope(scope);
  const client = options.client ?? db;
  let leaseId = options.leaseId;
  if (!leaseId) {
    const own = await client.lease.findFirst({
      where: { organizationId, status: 'ACTIVE', tenants: { some: { tenantId, organizationId } } },
      orderBy: { startDate: 'asc' },
      select: { id: true },
    });
    if (!own) return null;
    leaseId = own.id;
  }
  if (!leaseId) return null;
  const where = buildLeaseAccessWhere(scope, leaseId);
  if (!where) return null;
  return client.lease.findFirst({ where, include: leaseInclude });
}

async function managerName(client: Client, organizationId: string): Promise<string> {
  const manager = await client.user.findFirst({
    where: { organizationId, role: 'MANAGER' },
    orderBy: { createdAt: 'asc' },
    select: { name: true },
  });
  return manager?.name ?? 'your property manager';
}

export type TenantRepair = {
  id: string;
  title: string;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  vendorName: string | null;
  createdAt: Date;
};

export type TenantHomeView = {
  tenantName: string;
  leaseId: string;
  premises: string;
  managerName: string;
  term: { start: Date; end: Date };
  pay: TenantPayView;
  activity: ActivityItem[];
  notice: LeaseNotice;
  openRepair: TenantRepair | null;
};

export async function loadTenantHome(
  scope: TenantScope,
  now: Date = new Date(),
  client: Client = db,
): Promise<TenantHomeView | null> {
  const { organizationId, tenantId } = requireTenantScope(scope);
  const lease = await findTenantLeaseForPortal(scope, { client });
  if (!lease) return null;
  const [pay, manager, repair] = await Promise.all([
    loadTenantPayView(organizationId, tenantId, now, client),
    managerName(client, organizationId),
    client.maintenanceRequest.findFirst({
      where: {
        organizationId,
        unitId: lease.unitId,
        status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  // loadTenantPayView resolves the tenant's own active lease the same way; they must agree.
  if (!pay || pay.leaseId !== lease.id) return null;
  const tenant = lease.tenants.find((t) => t.tenantId === tenantId)?.tenant;
  return {
    tenantName: tenant?.name ?? pay.tenantName,
    leaseId: lease.id,
    premises: unitLabel(lease.unit.property, lease.unit),
    managerName: manager,
    term: { start: lease.startDate, end: lease.endDate },
    pay,
    activity: buildActivity(pay.receipts),
    notice: leaseNotice(lease, manager, now),
    openRepair: repair
      ? {
          id: repair.id,
          title: repair.title,
          status: repair.status,
          vendorName: repair.vendorName,
          createdAt: repair.createdAt,
        }
      : null,
  };
}

export type PortalDocument = {
  id: string;
  name: string;
  kind: StoredDocument['kind'];
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  previewUrl: string;
  downloadUrl: string;
};

export type UnitPhoto = { id: string; caption: string | null; name: string; url: string };

export type TenantLeaseView = {
  leaseId: string;
  tenantName: string;
  premises: string;
  propertyName: string;
  managerName: string;
  status: 'DRAFT' | 'ACTIVE' | 'ENDED' | 'TERMINATED';
  term: { start: Date; end: Date };
  monthlyRentCents: number;
  depositCents: number;
  rentDueDay: number;
  autopayOn: boolean;
  occupants: string[];
  coTenants: string[];
  notice: LeaseNotice;
  documents: PortalDocument[];
  photos: UnitPhoto[];
};

const cents = (value: { toString(): string }) => Math.round(Number(value.toString()) * 100);

function toPortalDocument(doc: StoredDocument): PortalDocument {
  return {
    id: doc.id,
    name: doc.name,
    kind: doc.kind,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt,
    previewUrl: `/api/files/${doc.id}/preview`,
    downloadUrl: `/api/files/${doc.id}/download`,
  };
}

/**
 * Lists the files attached to the tenant's own lease through the storage layer, which applies
 * the lease access policy again. A lease the tenant is not on is refused with a 403 from
 * storage and never reaches the listing.
 */
export async function listTenantLeaseDocuments(
  scope: TenantScope,
  leaseId: string,
  files: Pick<FileService, 'list'>,
): Promise<PortalDocument[]> {
  requireTenantScope(scope);
  const docs = await files.list(
    {
      subjectId: scope.subjectId,
      organizationId: scope.organizationId,
      role: scope.role,
      tenantId: scope.tenantId,
    },
    {
      kind: 'lease',
      id: leaseId,
    },
  );
  return docs.filter((doc) => doc.kind !== 'PHOTO' && doc.kind !== 'ID').map(toPortalDocument);
}

export async function loadTenantLease(
  scope: TenantScope,
  options: { now?: Date; client?: Client; files?: Pick<FileService, 'list'> } = {},
): Promise<TenantLeaseView | null> {
  const { organizationId, tenantId } = requireTenantScope(scope);
  const client = options.client ?? db;
  const now = options.now ?? new Date();
  const lease = await findTenantLeaseForPortal(scope, { client });
  if (!lease) return null;
  const files =
    options.files ?? (await (await import('@/lib/storage/service')).createPrismaFileService());
  const [manager, autopay, documents, photoRows] = await Promise.all([
    managerName(client, organizationId),
    client.autopaySetting.findUnique({
      where: { leaseId_tenantId: { leaseId: lease.id, tenantId } },
    }),
    listTenantLeaseDocuments(scope, lease.id, files),
    client.document.findMany({
      where: { organizationId, unitId: lease.unitId, kind: 'PHOTO' },
      orderBy: [{ isCover: 'desc' }, { sortOrder: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    }),
  ]);
  const me = lease.tenants.find((t) => t.tenantId === tenantId)?.tenant;
  return {
    leaseId: lease.id,
    tenantName: me?.name ?? 'Tenant',
    premises: unitLabel(lease.unit.property, lease.unit),
    propertyName: lease.unit.property.name,
    managerName: manager,
    status: lease.status,
    term: { start: lease.startDate, end: lease.endDate },
    monthlyRentCents: cents(lease.monthlyRent),
    depositCents: cents(lease.deposit),
    rentDueDay: lease.rentDueDay,
    autopayOn: autopay?.enabled ?? false,
    occupants: parseOccupants(lease.occupants),
    coTenants: lease.tenants.filter((t) => t.tenantId !== tenantId).map((t) => t.tenant.name),
    notice: leaseNotice(lease, manager, now),
    documents,
    photos: photoRows.map((p) => ({
      id: p.id,
      caption: p.caption,
      name: p.name,
      url: `/lease/photos/${p.id}`,
    })),
  };
}

/**
 * Reads one unit photo for the tenant's lease. The photo must belong to the unit of a lease
 * the tenant is on (checked through the lease access policy); anything else is refused.
 */
export async function readTenantUnitPhoto(
  scope: TenantScope,
  photoId: string,
  storage: Pick<StorageAdapter, 'get'>,
  client: Client = db,
): Promise<{ document: StoredDocument; body: Uint8Array }> {
  const { organizationId } = requireTenantScope(scope);
  const row = await client.document.findFirst({
    where: { id: photoId, organizationId, kind: 'PHOTO', unitId: { not: null } },
  });
  if (!row || !row.unitId) throw notFoundError('File not found');
  const lease = await findTenantLeaseForPortal(scope, { client });
  if (!lease || lease.unitId !== row.unitId) throw forbiddenError();
  const object = await storage.get(row.storageKey);
  if (!object) throw notFoundError('File content not found');
  return {
    document: { ...row, sizeBytes: Number(row.sizeBytes) },
    body: object.body,
  };
}

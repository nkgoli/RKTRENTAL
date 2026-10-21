import { MaintenancePriority, MaintenanceStatus, type Prisma } from '@prisma/client';
import {
  MAINTENANCE_PAGE_SIZE,
  RECENT_DONE_DAYS,
  usesRecentWindow,
  type MaintenanceListQuery,
} from './query';
import { db } from '@/lib/db/client';
import { directScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import type { AuthSession } from '@/lib/auth/session';
import { actorFromSession } from '@/lib/storage/http';
import { createPrismaFileService } from '@/lib/storage/service';
import { MAX_FILE_BYTES } from '@/lib/storage/types';
import { publishRepairStatusEvent } from '@/lib/notifications/service';

export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceError';
  }
}

const manager = (session: AuthSession) => {
  if (session.role !== 'MANAGER' && session.role !== 'OWNER')
    throw new MaintenanceError('Manager access required');
};
const required = (value: string, label: string, max: number) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max)
    throw new MaintenanceError(`${label} is required (up to ${max} characters)`);
  return trimmed;
};

async function publishStatusWithoutBlocking(organizationId: string, eventId: string) {
  try {
    await publishRepairStatusEvent(organizationId, eventId);
  } catch (error) {
    // The status event remains in the database for the notification sweep to replay.
    console.error('Repair email delivery deferred', error);
  }
}

const boardSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  createdAt: true,
  completedAt: true,
  propertyId: true,
  vendorId: true,
  vendorName: true,
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, number: true } },
  vendor: { select: { id: true, name: true } },
  // Cover photo only; the image itself is fetched lazily by the browser.
  photos: {
    where: { documentId: { not: null } },
    select: { documentId: true },
    orderBy: { createdAt: 'asc' },
    take: 1,
  },
  events: {
    where: { kind: 'COMMENT' },
    select: { id: true, body: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  },
} satisfies Prisma.MaintenanceRequestSelect;

export type MaintenanceBoardRequest = Prisma.MaintenanceRequestGetPayload<{
  select: typeof boardSelect;
}>;

function listWhere(
  organizationId: string,
  scope: ScopeFilter,
  query: MaintenanceListQuery,
  now: Date,
): Prisma.MaintenanceRequestWhereInput {
  const where: Prisma.MaintenanceRequestWhereInput = {
    organizationId,
    ...directScopeWhere(scope),
  };
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { lt: new Date(Date.parse(`${query.to}T00:00:00.000Z`) + 86_400_000) } : {}),
    };
  }
  if (usesRecentWindow(query)) {
    const cutoff = new Date(now.getTime() - RECENT_DONE_DAYS * 86_400_000);
    where.OR = [
      { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } },
      {
        status: 'DONE',
        OR: [{ completedAt: { gte: cutoff } }, { completedAt: null, createdAt: { gte: cutoff } }],
      },
      { status: 'CANCELLED', createdAt: { gte: cutoff } },
    ];
  }
  return where;
}

/** One page of requests plus board-wide counts; every relation is loaded with one batched query. */
export async function listMaintenancePage(
  organizationId: string,
  scope: ScopeFilter = {},
  query: MaintenanceListQuery = { allHistory: false, page: 1 },
  now = new Date(),
) {
  const where = listWhere(organizationId, scope, query, now);
  const base = { organizationId, ...directScopeWhere(scope) };
  const open = {
    ...base,
    status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] as MaintenanceStatus[] },
  };
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [
    total,
    statusCounts,
    openCount,
    urgentCount,
    firstUrgent,
    openProperties,
    completedThisWeek,
  ] = await Promise.all([
    db.maintenanceRequest.count({ where }),
    db.maintenanceRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
    db.maintenanceRequest.count({ where: open }),
    db.maintenanceRequest.count({ where: { ...open, priority: 'URGENT' } }),
    db.maintenanceRequest.findFirst({
      where: { ...open, priority: 'URGENT' },
      select: { title: true, property: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    db.maintenanceRequest.groupBy({ by: ['propertyId'], where: open }),
    db.maintenanceRequest.count({
      where: { ...base, status: 'DONE', completedAt: { gte: weekAgo } },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / MAINTENANCE_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const requests = await db.maintenanceRequest.findMany({
    where,
    select: boardSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * MAINTENANCE_PAGE_SIZE,
    take: MAINTENANCE_PAGE_SIZE,
  });
  const isEmpty = total === 0 && (await db.maintenanceRequest.count({ where: base })) === 0;
  return {
    requests,
    isEmpty,
    total,
    page,
    pageCount,
    statusCounts: Object.fromEntries(
      statusCounts.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<MaintenanceStatus, number>>,
    summary: {
      open: openCount,
      urgent: urgentCount,
      firstUrgent,
      openProperties: openProperties.length,
      completedThisWeek,
    },
  };
}

/** Lean status/priority rows for counting (dashboard); the board itself pages via listMaintenancePage. */
export async function listMaintenanceBoard(organizationId: string, scope: ScopeFilter = {}) {
  return db.maintenanceRequest.findMany({
    where: { organizationId, ...directScopeWhere(scope) },
    select: { status: true, priority: true },
  });
}

export async function listMaintenanceOptions(organizationId: string) {
  const [properties, vendors] = await Promise.all([
    db.property.findMany({
      where: { organizationId, archivedAt: null },
      select: {
        id: true,
        name: true,
        units: {
          where: { status: { not: 'ARCHIVED' } },
          select: { id: true, number: true },
          orderBy: { number: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    db.vendor.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
  ]);
  return { properties, vendors };
}

export type CreateMaintenanceInput = {
  unitId: string;
  title: string;
  description?: string;
  priority?: MaintenancePriority;
};

/** Tenant entry point for the repairs screen; validates an active lease on the selected unit. */
export async function createRequestAsTenant(session: AuthSession, input: CreateMaintenanceInput) {
  if (session.role !== 'TENANT' || !session.tenantId)
    throw new MaintenanceError('Tenant access required');
  const today = new Date();
  const lease = await db.lease.findFirst({
    where: {
      organizationId: session.organizationId,
      unitId: input.unitId,
      status: 'ACTIVE',
      startDate: { lte: today },
      endDate: { gte: today },
      tenants: { some: { tenantId: session.tenantId, organizationId: session.organizationId } },
    },
    select: { unit: { select: { propertyId: true } } },
  });
  if (!lease) throw new MaintenanceError('Unit is not on your active lease');
  return createRequestRecord(session, input, lease.unit.propertyId, session.tenantId);
}

export async function createRequestAsManager(session: AuthSession, input: CreateMaintenanceInput) {
  manager(session);
  const unit = await db.unit.findFirst({
    where: {
      id: input.unitId,
      status: { not: 'ARCHIVED' },
      organizationId: session.organizationId,
      property: { archivedAt: null },
    },
    select: { propertyId: true },
  });
  if (!unit) throw new MaintenanceError('Unit not found in your portfolio');
  return createRequestRecord(session, input, unit.propertyId, null);
}

async function createRequestRecord(
  session: AuthSession,
  input: CreateMaintenanceInput,
  propertyId: string,
  tenantId: string | null,
) {
  const title = required(input.title, 'Title', 160);
  const description = input.description?.trim() || null;
  if (description && description.length > 3000)
    throw new MaintenanceError('Description is too long');
  const priority = input.priority ?? MaintenancePriority.NORMAL;
  if (!Object.values(MaintenancePriority).includes(priority))
    throw new MaintenanceError('Invalid priority');
  return db.$transaction(async (tx) => {
    const request = await tx.maintenanceRequest.create({
      data: {
        organizationId: session.organizationId,
        propertyId,
        unitId: input.unitId,
        tenantId,
        title,
        description,
        priority,
      },
    });
    await tx.maintenanceEvent.create({
      data: {
        organizationId: session.organizationId,
        maintenanceRequestId: request.id,
        actorId: session.subjectId,
        kind: 'CREATED',
      },
    });
    return request;
  });
}

async function ownedRequest(session: AuthSession, requestId: string) {
  const request = await db.maintenanceRequest.findFirst({
    where: { id: requestId, organizationId: session.organizationId },
  });
  if (!request) throw new MaintenanceError('Request not found');
  if (session.role === 'TENANT' && (!session.tenantId || request.tenantId !== session.tenantId))
    throw new MaintenanceError('Request not found');
  if (!['TENANT', 'MANAGER', 'OWNER'].includes(session.role))
    throw new MaintenanceError('Access denied');
  return request;
}

export async function assignVendor(session: AuthSession, requestId: string, vendorId: string) {
  manager(session);
  const request = await ownedRequest(session, requestId);
  const vendor = await db.vendor.findFirst({
    where: { id: vendorId, organizationId: session.organizationId },
  });
  if (!vendor) throw new MaintenanceError('Vendor not found in your portfolio');
  const { updated, statusEventId } = await db.$transaction(async (tx) => {
    const updated = await tx.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        status: request.status === 'NEW' ? 'ASSIGNED' : request.status,
      },
    });
    await tx.maintenanceEvent.create({
      data: {
        organizationId: session.organizationId,
        maintenanceRequestId: request.id,
        actorId: session.subjectId,
        kind: 'VENDOR_ASSIGNED',
        body: vendor.name,
      },
    });
    let statusEventId: string | null = null;
    if (request.status === 'NEW') {
      const event = await tx.maintenanceEvent.create({
        data: {
          organizationId: session.organizationId,
          maintenanceRequestId: request.id,
          actorId: session.subjectId,
          kind: 'STATUS_CHANGED',
          fromStatus: 'NEW',
          toStatus: 'ASSIGNED',
        },
      });
      statusEventId = event.id;
    }
    return { updated, statusEventId };
  });
  if (statusEventId) await publishStatusWithoutBlocking(session.organizationId, statusEventId);
  return updated;
}

/** Status-change event is persisted and returned for the later notification publisher. */
export async function changeRequestStatus(
  session: AuthSession,
  requestId: string,
  status: MaintenanceStatus,
) {
  manager(session);
  if (!Object.values(MaintenanceStatus).includes(status))
    throw new MaintenanceError('Invalid status');
  const request = await ownedRequest(session, requestId);
  if (request.status === status) return null;
  const event = await db.$transaction(async (tx) => {
    await tx.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        status,
        completedAt: status === 'DONE' ? new Date() : null,
      },
    });
    return tx.maintenanceEvent.create({
      data: {
        organizationId: session.organizationId,
        maintenanceRequestId: request.id,
        actorId: session.subjectId,
        kind: 'STATUS_CHANGED',
        fromStatus: request.status,
        toStatus: status,
      },
    });
  });
  await publishStatusWithoutBlocking(session.organizationId, event.id);
  return event;
}

/** Ordered status events for a notification worker; consumers deduplicate by event ID. */
export async function listStatusChangeEvents(organizationId: string, since: Date) {
  return db.maintenanceEvent.findMany({
    where: { organizationId, kind: 'STATUS_CHANGED', createdAt: { gte: since } },
    include: {
      maintenanceRequest: {
        select: { id: true, title: true, tenantId: true, propertyId: true, unitId: true },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function addRequestComment(session: AuthSession, requestId: string, body: string) {
  const request = await ownedRequest(session, requestId);
  return db.maintenanceEvent.create({
    data: {
      organizationId: session.organizationId,
      maintenanceRequestId: request.id,
      actorId: session.subjectId,
      kind: 'COMMENT',
      body: required(body, 'Comment', 2000),
    },
  });
}

/** FileService performs type, size and target access validation before we link its Document. */
export async function addRequestPhoto(session: AuthSession, requestId: string, file: File) {
  const request = await ownedRequest(session, requestId);
  if (!file.type.startsWith('image/')) throw new MaintenanceError('Choose an image file');
  if (file.size > MAX_FILE_BYTES) throw new MaintenanceError('Photo exceeds the 25 MB limit');
  let target: { kind: 'lease' | 'unit'; id: string } = { kind: 'unit', id: request.unitId };
  if (session.role === 'TENANT') {
    const lease = await db.lease.findFirst({
      where: {
        organizationId: session.organizationId,
        unitId: request.unitId,
        status: 'ACTIVE',
        tenants: { some: { tenantId: session.tenantId, organizationId: session.organizationId } },
      },
      select: { id: true },
    });
    if (!lease) throw new MaintenanceError('No active lease for this request');
    target = { kind: 'lease', id: lease.id };
  }
  const document = await (
    await createPrismaFileService()
  ).upload(actorFromSession(session), {
    target,
    fileName: file.name,
    mimeType: file.type,
    kind: 'PHOTO',
    body: new Uint8Array(await file.arrayBuffer()),
  });
  return db.maintenancePhoto.create({
    data: {
      organizationId: session.organizationId,
      maintenanceRequestId: request.id,
      documentId: document.id,
      storageKey: document.storageKey,
      sizeBytes: BigInt(document.sizeBytes),
      mimeType: document.mimeType,
    },
  });
}

/** Issue editing never changes location, status, assignment, photos or history. */
export async function editRequestDetails(
  session: AuthSession,
  requestId: string,
  input: Pick<CreateMaintenanceInput, 'title' | 'description' | 'priority'>,
  scope: ScopeFilter = {},
) {
  manager(session);
  const title = required(input.title, 'Title', 160);
  const description = input.description?.trim() || null;
  if (description && description.length > 3000)
    throw new MaintenanceError('Description is too long');
  const priority = input.priority ?? MaintenancePriority.NORMAL;
  if (!Object.values(MaintenancePriority).includes(priority))
    throw new MaintenanceError('Invalid priority');
  const result = await db.maintenanceRequest.updateMany({
    where: { id: requestId, organizationId: session.organizationId, ...directScopeWhere(scope) },
    data: { title, description, priority },
  });
  if (!result.count) throw new MaintenanceError('Request not found in this scope');
}

export async function getMaintenanceRequest(
  organizationId: string,
  id: string,
  scope: ScopeFilter = {},
) {
  return db.maintenanceRequest.findFirst({
    where: { id, organizationId, ...directScopeWhere(scope) },
    select: {
      ...boardSelect,
      photos: { where: { documentId: { not: null } }, select: { documentId: true } },
    },
  });
}

/** Dedicated editor data; board queries deliberately keep their smaller projections. */
export async function getMaintenanceEditor(
  organizationId: string,
  id: string,
  scope: ScopeFilter = {},
) {
  return db.maintenanceRequest.findFirst({
    where: { id, organizationId, ...directScopeWhere(scope) },
    select: {
      ...boardSelect,
      updatedAt: true,
      photos: {
        where: { documentId: { not: null } },
        select: { documentId: true, createdAt: true, document: { select: { name: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      events: {
        select: {
          id: true,
          kind: true,
          body: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    },
  });
}

/** One commit for staged fields, with the same assignment/status and notification semantics. */
export async function saveMaintenanceEditor(
  session: AuthSession,
  requestId: string,
  input: Pick<CreateMaintenanceInput, 'title' | 'description' | 'priority'> & {
    vendorId: string | null;
    status: MaintenanceStatus;
    updatedAt: string;
  },
  scope: ScopeFilter,
) {
  manager(session);
  const title = required(input.title, 'Title', 160);
  const description = input.description?.trim() || null;
  if (description && description.length > 3000)
    throw new MaintenanceError('Description is too long');
  const priority = input.priority ?? MaintenancePriority.NORMAL;
  if (!Object.values(MaintenancePriority).includes(priority))
    throw new MaintenanceError('Invalid priority');
  if (!Object.values(MaintenanceStatus).includes(input.status))
    throw new MaintenanceError('Invalid status');
  const revision = new Date(input.updatedAt);
  if (!Number.isFinite(revision.getTime()))
    throw new MaintenanceError('Refresh this request before saving. Your changes are still here.');
  const statusEventId = await db.$transaction(async (tx) => {
    const where = {
      id: requestId,
      organizationId: session.organizationId,
      ...directScopeWhere(scope),
    };
    const request = await tx.maintenanceRequest.findFirst({ where });
    if (!request) throw new MaintenanceError('Request not found in this scope');
    const vendorChanged = input.vendorId !== request.vendorId;
    if (vendorChanged && !input.vendorId)
      throw new MaintenanceError('Choose a vendor from your portfolio');
    const vendor =
      vendorChanged && input.vendorId
        ? await tx.vendor.findFirst({
            where: { id: input.vendorId, organizationId: session.organizationId },
          })
        : null;
    if (vendorChanged && !vendor) throw new MaintenanceError('Vendor not found in your portfolio');
    const status =
      vendorChanged && request.status === 'NEW' && input.status === 'NEW'
        ? 'ASSIGNED'
        : input.status;
    const detailsChanged =
      title !== request.title ||
      description !== request.description ||
      priority !== request.priority;
    if (!detailsChanged && !vendorChanged && status === request.status) return null;
    // Compare-and-set is inside the transaction: concurrent saves cannot create duplicate events.
    const result = await tx.maintenanceRequest.updateMany({
      where: { ...where, updatedAt: revision },
      data: {
        title,
        description,
        priority,
        status,
        ...(vendor ? { vendorId: vendor.id, vendorName: vendor.name } : {}),
        ...(status !== request.status
          ? { completedAt: status === 'DONE' ? new Date() : null }
          : {}),
      },
    });
    if (!result.count)
      throw new MaintenanceError(
        'This request changed since you opened it. Your changes are still here. Open the latest request in another tab to compare before reloading.',
      );
    const event = {
      organizationId: session.organizationId,
      maintenanceRequestId: requestId,
      actorId: session.subjectId,
    };
    if (detailsChanged)
      await tx.maintenanceEvent.create({ data: { ...event, kind: 'DETAILS_UPDATED' } });
    if (vendor)
      await tx.maintenanceEvent.create({
        data: { ...event, kind: 'VENDOR_ASSIGNED', body: vendor.name },
      });
    if (status !== request.status) {
      const saved = await tx.maintenanceEvent.create({
        data: { ...event, kind: 'STATUS_CHANGED', fromStatus: request.status, toStatus: status },
      });
      return saved.id;
    }
    return null;
  });
  if (statusEventId) await publishStatusWithoutBlocking(session.organizationId, statusEventId);
}

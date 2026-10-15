import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
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

export async function listMaintenanceBoard(organizationId: string, scope: ScopeFilter = {}) {
  return db.maintenanceRequest.findMany({
    where: { organizationId, ...directScopeWhere(scope) },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, number: true } },
      vendor: { select: { id: true, name: true } },
      photos: {
        include: { document: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      events: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function listMaintenanceOptions(organizationId: string) {
  const [properties, vendors] = await Promise.all([
    db.property.findMany({
      where: { organizationId, archivedAt: null },
      select: {
        id: true,
        name: true,
        units: { select: { id: true, number: true }, orderBy: { number: 'asc' } },
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

export type MaintenanceBoardRequest = Awaited<ReturnType<typeof listMaintenanceBoard>>[number];

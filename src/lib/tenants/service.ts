import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { defaultLeaseEnd, todayUtc } from './format';
import type { FieldErrors, NewTenantInput, TenantInput } from './validation';

/** A user-correctable failure; `errors` maps onto form fields. */
export class TenantServiceError extends Error {
  constructor(
    message: string,
    readonly errors: FieldErrors = {},
  ) {
    super(message);
    this.name = 'TenantServiceError';
  }
}

function requireOrg(organizationId: string) {
  if (!organizationId.trim()) throw new Error('organizationId is required');
}

async function assertEmailFree(
  client: Pick<PrismaClient, 'tenant'>,
  organizationId: string,
  email: string | null,
  exceptId?: string,
) {
  if (!email) return;
  const existing = await client.tenant.findFirst({
    where: {
      organizationId,
      email: { equals: email, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new TenantServiceError('A tenant with this email already exists.', {
      email: 'A tenant with this email already exists.',
    });
  }
}

/**
 * Creates a tenant. When a unit is chosen, also drafts a 12-month lease at the
 * unit's listed rent so the tenant can be moved in from their detail page.
 */
export async function createTenant(
  organizationId: string,
  input: NewTenantInput,
  client: PrismaClient = db,
): Promise<{ tenantId: string; leaseId: string | null }> {
  requireOrg(organizationId);
  return client.$transaction(async (tx) => {
    await assertEmailFree(tx, organizationId, input.email);

    let lease: { unitId: string; rent: number; start: Date } | null = null;
    if (input.unitId) {
      const unit = await tx.unit.findFirst({
        where: { id: input.unitId, organizationId, status: { not: 'ARCHIVED' } },
        select: { id: true, listedRent: true },
      });
      if (!unit) throw new TenantServiceError('Unit not found.', { unitId: 'Unit not found.' });
      const taken = await tx.lease.findFirst({
        where: { organizationId, unitId: unit.id, status: { in: ['DRAFT', 'ACTIVE'] } },
        select: { id: true },
      });
      if (taken) {
        throw new TenantServiceError('That unit already has a lease.', {
          unitId: 'That unit already has a lease.',
        });
      }
      lease = {
        unitId: unit.id,
        rent: unit.listedRent ? Number(unit.listedRent.toString()) : 0,
        start: input.moveInDate ?? todayUtc(),
      };
    }

    const tenant = await tx.tenant.create({
      data: {
        organizationId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        emergencyContactRelationship: input.emergencyContactRelationship,
      },
      select: { id: true },
    });
    if (!lease) return { tenantId: tenant.id, leaseId: null };

    const created = await tx.lease.create({
      data: {
        organizationId,
        unitId: lease.unitId,
        startDate: lease.start,
        endDate: defaultLeaseEnd(lease.start),
        monthlyRent: lease.rent,
        deposit: lease.rent,
        status: 'DRAFT',
      },
      select: { id: true },
    });
    await tx.leaseTenant.create({
      data: { organizationId, leaseId: created.id, tenantId: tenant.id, isPrimary: true },
    });
    return { tenantId: tenant.id, leaseId: created.id };
  });
}

export async function updateTenant(
  organizationId: string,
  tenantId: string,
  input: TenantInput,
  client: PrismaClient = db,
): Promise<void> {
  requireOrg(organizationId);
  await client.$transaction(async (tx) => {
    await assertEmailFree(tx, organizationId, input.email, tenantId);
    const { count } = await tx.tenant.updateMany({
      where: { id: tenantId, organizationId },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        emergencyContactRelationship: input.emergencyContactRelationship,
      },
    });
    if (count === 0) throw new TenantServiceError('Tenant not found.');
  });
}

/** Appends a note to a tenant's activity log. */
export async function addTenantNote(
  organizationId: string,
  tenantId: string,
  authorName: string,
  body: string,
  client: PrismaClient = db,
): Promise<void> {
  requireOrg(organizationId);
  const tenant = await client.tenant.findFirst({
    where: { id: tenantId, organizationId },
    select: { id: true },
  });
  if (!tenant) throw new TenantServiceError('Tenant not found.');
  await client.tenantNote.create({ data: { organizationId, tenantId, authorName, body } });
}

async function findTenantLease(
  tx: Pick<PrismaClient, 'lease'>,
  organizationId: string,
  tenantId: string,
  leaseId: string,
) {
  return tx.lease.findFirst({
    where: { id: leaseId, organizationId, tenants: { some: { tenantId, organizationId } } },
    select: { id: true, unitId: true, status: true, startDate: true, endDate: true },
  });
}

/** Activates a drafted lease and marks its unit occupied. */
export async function moveInTenant(
  organizationId: string,
  tenantId: string,
  leaseId: string,
  client: PrismaClient = db,
): Promise<void> {
  requireOrg(organizationId);
  await client.$transaction(async (tx) => {
    const lease = await findTenantLease(tx, organizationId, tenantId, leaseId);
    if (!lease) throw new TenantServiceError('Lease not found.');
    if (lease.status !== 'DRAFT') {
      throw new TenantServiceError('Only a draft lease can be moved in.');
    }
    const other = await tx.lease.findFirst({
      where: { organizationId, unitId: lease.unitId, status: 'ACTIVE', id: { not: lease.id } },
      select: { id: true },
    });
    if (other) throw new TenantServiceError('That unit already has an active lease.');

    await tx.lease.update({ where: { id: lease.id }, data: { status: 'ACTIVE' } });
    await tx.unit.updateMany({
      where: { id: lease.unitId, organizationId },
      data: { status: 'OCCUPIED' },
    });
  });
}

/** Ends an active lease today and frees the unit unless another lease holds it. */
export async function moveOutTenant(
  organizationId: string,
  tenantId: string,
  leaseId: string,
  client: PrismaClient = db,
  today: Date = todayUtc(),
): Promise<void> {
  requireOrg(organizationId);
  await client.$transaction(async (tx) => {
    const lease = await findTenantLease(tx, organizationId, tenantId, leaseId);
    if (!lease) throw new TenantServiceError('Lease not found.');
    if (lease.status !== 'ACTIVE') {
      throw new TenantServiceError('Only an active lease can be moved out.');
    }
    const endDate = new Date(
      Math.max(lease.startDate.getTime(), Math.min(lease.endDate.getTime(), today.getTime())),
    );
    await tx.lease.update({ where: { id: lease.id }, data: { status: 'ENDED', endDate } });

    const remaining = await tx.lease.count({
      where: { organizationId, unitId: lease.unitId, status: 'ACTIVE' },
    });
    if (remaining === 0) {
      await tx.unit.updateMany({
        where: { id: lease.unitId, organizationId },
        data: { status: 'VACANT' },
      });
    }
  });
}

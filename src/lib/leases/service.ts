import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { ensureLeaseSetupCharges } from '@/lib/ledger/lease-setup';
import { recordLeaseEvents } from './events';
import { nextLeaseStart, overlaps, renewalEnd, terminationEnd, type LeaseWindow } from './core';

export class LeaseServiceError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'LeaseServiceError';
  }
}

export type Terms = LeaseWindow & {
  monthlyRent: string;
  deposit: string;
  lateFee: string;
  graceDays: number;
  rentDueDay?: number;
  prorateFirstMonth?: boolean;
  moveInFee?: string;
  petDeposit?: string;
};

function overlapError(error: unknown): never {
  if (
    error instanceof Error &&
    /Lease_no_overlapping_active|violates exclusion constraint/.test(error.message)
  ) {
    throw new LeaseServiceError(
      'This unit already has an active lease during those dates.',
      'startDate',
    );
  }
  throw error;
}

/** Updating the unit row locks it until commit, serializing lease mutations for this unit. */
async function lockUnit(tx: Prisma.TransactionClient, organizationId: string, unitId: string) {
  const { count } = await tx.unit.updateMany({
    where: { id: unitId, organizationId, status: { not: 'ARCHIVED' } },
    data: { updatedAt: new Date() },
  });
  if (!count) throw new LeaseServiceError('Unit not found or archived.', 'unitId');
}

async function assertAvailable(
  tx: Prisma.TransactionClient,
  organizationId: string,
  unitId: string,
  proposed: LeaseWindow,
  exceptId?: string,
) {
  const active = await tx.lease.findMany({
    where: {
      organizationId,
      unitId,
      status: 'ACTIVE',
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { startDate: true, endDate: true },
  });
  if (active.some((lease) => overlaps(lease, proposed))) {
    throw new LeaseServiceError(
      'This unit already has an active lease during those dates.',
      'startDate',
    );
  }
}

export async function createLease(
  organizationId: string,
  unitId: string,
  tenantId: string,
  terms: Terms,
  status: 'DRAFT' | 'ACTIVE' = 'DRAFT',
  client: PrismaClient = db,
) {
  return client
    .$transaction(async (tx) => {
      await lockUnit(tx, organizationId, unitId);
      const tenant = await tx.tenant.findFirst({
        where: { id: tenantId, organizationId },
        select: { id: true },
      });
      if (!tenant) throw new LeaseServiceError('Tenant not found.', 'tenantId');
      if (status === 'ACTIVE') await assertAvailable(tx, organizationId, unitId, terms);
      const lease = await tx.lease.create({
        data: {
          organizationId,
          unitId,
          ...terms,
          status,
        },
        select: { id: true },
      });
      await tx.leaseTenant.create({
        data: { organizationId, leaseId: lease.id, tenantId, isPrimary: true },
      });
      if (status === 'ACTIVE')
        await tx.unit.updateMany({
          where: { id: unitId, organizationId },
          data: { status: 'OCCUPIED' },
        });
      if (status === 'ACTIVE') await ensureLeaseSetupCharges(tx, organizationId, lease.id);
      await recordLeaseEvents(tx, organizationId, lease.id, [{ kind: 'CREATED' }]);
      return lease;
    })
    .catch(overlapError);
}

export async function renewLease(
  organizationId: string,
  leaseId: string,
  terms?: Terms,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const source = await tx.lease.findFirst({
      where: { id: leaseId, organizationId, status: 'ACTIVE' },
      include: { tenants: true },
    });
    if (!source) throw new LeaseServiceError('Only an active lease can be renewed.');
    await lockUnit(tx, organizationId, source.unitId);
    const startDate = nextLeaseStart(source.endDate);
    if (terms && terms.startDate < startDate) {
      throw new LeaseServiceError('Renewal must begin after the current lease ends.', 'startDate');
    }
    const created = await tx.lease.create({
      data: {
        organizationId,
        unitId: source.unitId,
        startDate: terms?.startDate ?? startDate,
        endDate: terms?.endDate ?? renewalEnd(startDate),
        monthlyRent: terms?.monthlyRent ?? source.monthlyRent,
        deposit: terms?.deposit ?? source.deposit,
        lateFee: terms?.lateFee ?? source.lateFee,
        graceDays: terms?.graceDays ?? source.graceDays,
        rentDueDay: terms?.rentDueDay ?? source.rentDueDay,
        prorateFirstMonth: terms?.prorateFirstMonth ?? source.prorateFirstMonth,
        moveInFee: terms?.moveInFee ?? '0.00',
        petDeposit: terms?.petDeposit ?? '0.00',
        status: 'DRAFT',
      },
      select: { id: true },
    });
    if (source.tenants.length) {
      await tx.leaseTenant.createMany({
        data: source.tenants.map((t) => ({
          organizationId,
          leaseId: created.id,
          tenantId: t.tenantId,
          isPrimary: t.isPrimary,
        })),
      });
    }
    return created;
  });
}

export async function updateLeaseTerms(
  organizationId: string,
  leaseId: string,
  terms: Terms,
  client: PrismaClient = db,
) {
  return client
    .$transaction(async (tx) => {
      const lease = await tx.lease.findFirst({
        where: { id: leaseId, organizationId },
        select: { id: true, unitId: true, status: true },
      });
      if (!lease) throw new LeaseServiceError('Lease not found.');
      if (lease.status !== 'DRAFT' && lease.status !== 'ACTIVE')
        throw new LeaseServiceError('Only draft or active lease terms can be edited.');
      await lockUnit(tx, organizationId, lease.unitId);
      if (lease.status === 'ACTIVE')
        await assertAvailable(tx, organizationId, lease.unitId, terms, lease.id);
      await tx.lease.updateMany({ where: { id: leaseId, organizationId }, data: terms });
    })
    .catch(overlapError);
}

export async function activateLease(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
) {
  return client
    .$transaction(async (tx) => {
      const lease = await tx.lease.findFirst({
        where: { id: leaseId, organizationId },
        select: { id: true, unitId: true, startDate: true, endDate: true, status: true },
      });
      if (!lease) throw new LeaseServiceError('Lease not found.');
      if (lease.status !== 'DRAFT')
        throw new LeaseServiceError('Only a draft lease can be activated.');
      await lockUnit(tx, organizationId, lease.unitId);
      await assertAvailable(tx, organizationId, lease.unitId, lease);
      await tx.lease.updateMany({
        where: { id: leaseId, organizationId },
        data: { status: 'ACTIVE' },
      });
      await tx.unit.updateMany({
        where: { id: lease.unitId, organizationId },
        data: { status: 'OCCUPIED' },
      });
      await ensureLeaseSetupCharges(tx, organizationId, leaseId);
    })
    .catch(overlapError);
}

export async function terminateLease(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
  today = new Date(),
) {
  return client.$transaction(async (tx) => {
    const lease = await tx.lease.findFirst({
      where: { id: leaseId, organizationId },
      select: {
        id: true,
        unitId: true,
        startDate: true,
        endDate: true,
        status: true,
        eSignStatus: true,
      },
    });
    if (!lease) throw new LeaseServiceError('Lease not found.');
    if (lease.status !== 'ACTIVE')
      throw new LeaseServiceError('Only an active lease can be terminated.');
    await lockUnit(tx, organizationId, lease.unitId);
    await tx.lease.updateMany({
      where: { id: leaseId, organizationId },
      // A termination records move-out without rewriting an already signed agreement's term.
      data: {
        status: 'TERMINATED',
        ...(lease.eSignStatus === 'SIGNED' || lease.eSignStatus === 'PARTIALLY_SIGNED'
          ? { moveOutDate: terminationEnd(lease, today) }
          : { endDate: terminationEnd(lease, today) }),
      },
    });
    const remaining = await tx.lease.count({
      where: { organizationId, unitId: lease.unitId, status: 'ACTIVE' },
    });
    if (!remaining)
      await tx.unit.updateMany({
        where: { id: lease.unitId, organizationId },
        data: { status: 'VACANT' },
      });
  });
}

import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { recordLeaseEvents } from '@/lib/leases/events';
import { LeaseServiceError } from '@/lib/leases/service';
import { ensureLeaseSetupCharges } from '@/lib/ledger/lease-setup';
import { hasOverlap, parseWizardTerms, renewalWindow, validateReview } from './validation';
import { emptyDraft, type WizardDraft } from './types';

export { LeaseServiceError };

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
  proposed: { startDate: Date; endDate: Date },
) {
  const active = await tx.lease.findMany({
    where: { organizationId, unitId, status: 'ACTIVE' },
    select: { startDate: true, endDate: true },
  });
  if (hasOverlap(proposed, active))
    throw new LeaseServiceError(
      'This unit already has an active lease during those dates.',
      'startDate',
    );
}

function assertWizard(draft: WizardDraft, isRenewal: boolean, renewalSourceEnd?: Date | null) {
  const errors = validateReview(draft, { isRenewal, renewalSourceEnd: renewalSourceEnd ?? null });
  // Saving a draft still needs a unit and tenants; e-sign email is enforced only on send.
  delete errors.primaryTenantId;
  // Lessor details are collected by the draft wizard, not by this direct-create path.
  delete errors.lessorName;
  delete errors.lessorAddress;
  const first = Object.entries(errors)[0];
  if (first) throw new LeaseServiceError(first[1], first[0]);
  const terms = parseWizardTerms(draft);
  if (!terms) throw new LeaseServiceError('Please fix the highlighted fields.', 'startDate');
  return terms;
}

export async function createLeaseFromWizard(
  organizationId: string,
  draft: WizardDraft,
  status: 'DRAFT' | 'ACTIVE',
  client: PrismaClient = db,
): Promise<{ id: string }> {
  const terms = assertWizard(draft, false);
  return client.$transaction(async (tx) => {
    await lockUnit(tx, organizationId, draft.unitId);
    const tenants = await tx.tenant.findMany({
      where: { id: { in: draft.tenantIds }, organizationId },
      select: { id: true },
    });
    if (tenants.length !== new Set(draft.tenantIds).size)
      throw new LeaseServiceError('Tenant not found.', 'tenantIds');
    if (status === 'ACTIVE') await assertAvailable(tx, organizationId, draft.unitId, terms);
    const lease = await tx.lease.create({
      data: { organizationId, unitId: draft.unitId, ...terms, status },
      select: { id: true },
    });
    await tx.leaseTenant.createMany({
      data: draft.tenantIds.map((tenantId) => ({
        organizationId,
        leaseId: lease.id,
        tenantId,
        isPrimary: tenantId === draft.primaryTenantId,
      })),
    });
    if (status === 'ACTIVE') {
      await tx.unit.updateMany({
        where: { id: draft.unitId, organizationId },
        data: { status: 'OCCUPIED' },
      });
      await ensureLeaseSetupCharges(tx, organizationId, lease.id);
    }
    await recordLeaseEvents(tx, organizationId, lease.id, [
      { kind: 'CREATED', message: status === 'DRAFT' ? 'Saved as draft' : 'Created from wizard' },
    ]);
    return lease;
  });
}

export async function createRenewalFromWizard(
  organizationId: string,
  sourceLeaseId: string,
  draft: WizardDraft,
  status: 'DRAFT' | 'ACTIVE',
  client: PrismaClient = db,
): Promise<{ id: string }> {
  return client.$transaction(async (tx) => {
    const source = await tx.lease.findFirst({
      where: { id: sourceLeaseId, organizationId, status: 'ACTIVE' },
      include: { tenants: true },
    });
    if (!source) throw new LeaseServiceError('Only an active lease can be renewed.');
    const terms = assertWizard({ ...draft, unitId: source.unitId }, true, source.endDate);
    await lockUnit(tx, organizationId, source.unitId);
    if (status === 'ACTIVE') await assertAvailable(tx, organizationId, source.unitId, terms);
    const lease = await tx.lease.create({
      data: { organizationId, unitId: source.unitId, ...terms, status },
      select: { id: true },
    });
    const tenantIds = draft.tenantIds.length
      ? draft.tenantIds
      : source.tenants.map((t) => t.tenantId);
    await tx.leaseTenant.createMany({
      data: tenantIds.map((tenantId) => ({
        organizationId,
        leaseId: lease.id,
        tenantId,
        isPrimary:
          tenantId === draft.primaryTenantId ||
          (!draft.tenantIds.length &&
            source.tenants.find((t) => t.tenantId === tenantId)?.isPrimary === true),
      })),
    });
    if (status === 'ACTIVE')
      await ensureLeaseSetupCharges(tx, organizationId, lease.id);
    await recordLeaseEvents(tx, organizationId, lease.id, [
      { kind: 'CREATED', message: 'Created as a renewal' },
      { kind: 'RENEWED', message: `Renews lease ${source.id}` },
    ]);
    await recordLeaseEvents(tx, organizationId, source.id, [
      { kind: 'RENEWED', message: `Renewal ${lease.id} created` },
    ]);
    return lease;
  });
}

export function renewalDefaults(source: {
  endDate: Date;
  monthlyRent: { toString(): string };
  deposit: { toString(): string };
  lateFee: { toString(): string };
  graceDays: number;
  rentDueDay?: number;
  tenants: { tenantId: string; isPrimary: boolean }[];
  unitId: string;
}): WizardDraft {
  const window = renewalWindow(source.endDate);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return emptyDraft({
    unitId: source.unitId,
    tenantIds: source.tenants.map((t) => t.tenantId),
    primaryTenantId:
      source.tenants.find((t) => t.isPrimary)?.tenantId ?? source.tenants[0]?.tenantId ?? '',
    leaseType: 'fixed',
    startDate: iso(window.startDate),
    endDate: iso(window.endDate),
    renewalNoticeDays: 60,
    monthlyRent: source.monthlyRent.toString(),
    deposit: source.deposit.toString(),
    lateFee: source.lateFee.toString(),
    lateFeeEnabled: Number(source.lateFee.toString()) > 0,
    graceDays: source.graceDays,
    rentDueDay: source.rentDueDay ?? 1,
    clauses: ['residential-use', 'utilities'],
    customClause: '',
    documentNames: [],
  });
}

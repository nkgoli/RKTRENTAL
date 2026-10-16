import { db } from '@/lib/db/client';
import { unitScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import { ensureRentCharges, loadPropertyLedger } from '@/lib/ledger';
import { buildTimeline, type Timeline } from './timeline';

/** Timeline for a property (one row per unit) or, with a unit in scope, for that unit alone. */
export async function loadWorkspaceTimeline(organizationId: string, scope: ScopeFilter, now = new Date()): Promise<Timeline> {
  const [units, leases] = await Promise.all([
    db.unit.findMany({
      where: { organizationId, status: { not: 'ARCHIVED' }, ...(scope.propertyId ? { propertyId: scope.propertyId } : {}), ...(scope.unitId ? { id: scope.unitId } : {}) },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, isImplicit: true },
    }),
    db.lease.findMany({
      where: { organizationId, ...unitScopeWhere(scope) },
      include: { tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } } },
    }),
  ]);
  return buildTimeline(
    units.map((unit) => ({ id: unit.id, label: unit.isImplicit ? 'Whole property' : `Unit ${unit.number}` })),
    leases.map((lease) => ({
      id: lease.id,
      unitId: lease.unitId,
      status: lease.status,
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: Number(lease.monthlyRent),
      tenantName: lease.tenants[0]?.tenant.name ?? null,
    })),
    now,
  );
}

export type PaymentsMonth = { dueCents: number; paidCents: number; outstandingCents: number; lateCount: number; hasCharges: boolean };

/** This month's charges and what was collected against them, from the same ledger the Payments tab uses. */
export async function loadPaymentsMonth(organizationId: string, scope: ScopeFilter, now = new Date()): Promise<PaymentsMonth> {
  await ensureRentCharges(organizationId, now);
  const ledger = await loadPropertyLedger(organizationId, scope, now);
  const rows = ledger.groups
    .filter((group) => group.active)
    .flatMap((group) => group.rows)
    .filter((row) => row.dueDate.getUTCFullYear() === now.getUTCFullYear() && row.dueDate.getUTCMonth() === now.getUTCMonth());
  const dueCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const paidCents = rows.reduce((sum, row) => sum + Math.min(row.paidCents, row.amountCents), 0);
  return {
    dueCents,
    paidCents,
    outstandingCents: Math.max(dueCents - paidCents, 0),
    lateCount: rows.filter((row) => row.status === 'LATE').length,
    hasCharges: rows.length > 0,
  };
}

import type { ChargeKind, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { unitScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import { centsToDecimal, type Cents, type LedgerPayment } from './core';
import { leaseTerms, toLedgerCharge, toLedgerPayment } from './store';
import {
  buildLeaseStatement,
  describePaymentReference,
  isReservedDescription,
  paymentMethod,
  periodLabel,
  type LeaseStatement,
  type StatementRow,
} from './statement';

type Client = PrismaClient;

export type LedgerTenant = { id: string; name: string; initials: string };

export type LastPayment = { date: Date; amountCents: Cents };

/** One payment on a lease as recorded, with how much of it settled charges listed on the ledger. */
export type PaymentHistoryEntry = {
  id: string;
  date: Date | null;
  amountCents: Cents;
  status: LedgerPayment['status'];
  method: string;
  reference: string;
  /** Portion of a settled payment applied to listed charges; the rest is credit on the lease. */
  appliedCents: Cents;
};

export type LedgerGroup = {
  leaseId: string;
  label: string;
  unitId: string;
  unitLabel: string;
  /** Charges minus settled payments due by now for this lease. */
  balanceCents: Cents;
  lastPayment: LastPayment | null;
  singleUnit: boolean;
  active: boolean;
  tenants: LedgerTenant[];
  rows: StatementRow[];
  /** Every payment on the lease, newest first, including ones that settled no listed charge. */
  payments: PaymentHistoryEntry[];
};

export type PropertyLedger = {
  groups: LedgerGroup[];
  /** Charges minus settled payments across the active leases in scope; negative is credit. */
  balanceCents: Cents;
  /** Most recent settled payment across the active leases in scope. */
  lastPayment: LastPayment | null;
  /** Balance still open on ended or terminated leases; listed per group, not in balanceCents. */
  endedBalanceCents: Cents;
  activeLeaseCount: number;
  tenants: LedgerTenant[];
};

/** Most recent settled payment (by paid date, else recorded date); failed and pending ones never count. */
export function lastSettledPayment(payments: LedgerPayment[]): LastPayment | null {
  let last: LastPayment | null = null;
  for (const p of payments) {
    const date = p.paidAt ?? p.createdAt;
    if (p.status !== 'SUCCEEDED' || p.amountCents <= 0 || !date) continue;
    if (!last || date > last.date) last = { date, amountCents: p.amountCents };
  }
  return last;
}

type LedgerLeaseRow = Parameters<typeof leaseTerms>[0] & {
  charges: Parameters<typeof toLedgerCharge>[0][];
  payments: Parameters<typeof toLedgerPayment>[0][];
};

/**
 * One lease's Rent ledger: the same statement, balance and last payment the property and unit
 * Payments tabs show for that lease, so every scope reads the same numbers.
 */
export function leaseLedger(
  lease: LedgerLeaseRow,
  asOf: Date,
): LeaseStatement & { lastPayment: LastPayment | null; payments: PaymentHistoryEntry[] } {
  const payments = lease.payments.map(toLedgerPayment);
  const statement = buildLeaseStatement({
    lease: leaseTerms(lease),
    charges: lease.charges.map(toLedgerCharge),
    payments,
    asOf,
  });
  return {
    ...statement,
    lastPayment: lastSettledPayment(payments),
    payments: paymentHistory(payments, statement.rows),
  };
}

/** Payments newest first with the amount each applied to the statement rows. */
export function paymentHistory(
  payments: LedgerPayment[],
  rows: Pick<StatementRow, 'applied'>[],
): PaymentHistoryEntry[] {
  const applied = new Map<string, Cents>();
  for (const row of rows)
    for (const a of row.applied)
      applied.set(a.paymentId, (applied.get(a.paymentId) ?? 0) + a.amountCents);
  return payments
    .map((p, index) => ({
      id: p.id ?? `payment-${index}`,
      date: p.paidAt ?? p.createdAt ?? null,
      amountCents: p.amountCents,
      status: p.status,
      method: paymentMethod(p.providerReference),
      reference: describePaymentReference(p.providerReference),
      appliedCents: (p.id && applied.get(p.id)) || 0,
    }))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

/** Charge ledger for a property (optionally one unit): one group per lease term, newest term first. */
export async function loadPropertyLedger(
  organizationId: string,
  scope: ScopeFilter,
  asOf: Date,
  client: Client = db,
): Promise<PropertyLedger> {
  const leases = await client.lease.findMany({
    where: {
      organizationId,
      status: { in: ['ACTIVE', 'ENDED', 'TERMINATED'] },
      ...unitScopeWhere(scope),
    },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } },
      charges: true,
      payments: true,
    },
    orderBy: { startDate: 'desc' },
  });
  const groups: LedgerGroup[] = [];
  let balanceCents = 0;
  let endedBalanceCents = 0;
  let lastPayment: LastPayment | null = null;
  for (const lease of leases) {
    const active = lease.status === 'ACTIVE';
    // Ended leases stay listed whenever they carry any history, charges or payments.
    if (!active && lease.charges.length === 0 && lease.payments.length === 0) continue;
    const statement = leaseLedger(lease, asOf);
    if (active) {
      balanceCents += statement.balanceCents;
      if (statement.lastPayment && (!lastPayment || statement.lastPayment.date > lastPayment.date))
        lastPayment = statement.lastPayment;
    } else endedBalanceCents += statement.balanceCents;
    groups.push({
      leaseId: lease.id,
      label: periodLabel({ start: lease.startDate, end: lease.endDate }, statement.rows),
      unitId: lease.unitId,
      balanceCents: statement.balanceCents,
      lastPayment: statement.lastPayment,
      unitLabel: lease.unit.number,
      singleUnit: lease.unit.isImplicit,
      active,
      tenants: lease.tenants.map(({ tenant }) => ({
        id: tenant.id,
        name: tenant.name,
        initials: initialsOf(tenant.name),
      })),
      rows: statement.rows,
      payments: statement.payments,
    });
  }
  groups.sort((a, b) => Number(b.active) - Number(a.active));
  const seen = new Set<string>();
  const tenants = groups
    .filter((g) => g.active)
    .flatMap((g) => g.tenants)
    .filter((t) => !seen.has(t.id) && seen.add(t.id));
  return {
    groups,
    balanceCents,
    lastPayment,
    endedBalanceCents,
    activeLeaseCount: groups.filter((g) => g.active).length,
    tenants,
  };
}

export type UnitHealth = 'LATE' | 'DUE' | 'CURRENT' | 'ENDED';

export type UnitSummary = {
  unitId: string;
  /** The unit's current active lease, else its most recent ended lease. */
  leaseId: string;
  unitLabel: string;
  /** Tenants on the active lease(s); for an ended-only unit, the most recent ended lease's tenants. */
  tenantNames: string;
  /** Balance due across the unit's active leases only; ended-only units carry 0 here. */
  balanceCents: Cents;
  /** Balance still open on the unit's ended leases; never part of balanceCents or the total. */
  endedBalanceCents: Cents;
  activeLeaseCount: number;
  endedLeaseCount: number;
  status: UnitHealth;
  nextDue: { dueDate: Date; amountCents: Cents } | null;
};

export type UnitSummaryTable = {
  units: UnitSummary[];
  /** Sum of active balances: equals the property's Balance due. */
  totalBalanceCents: Cents;
  endedBalanceCents: Cents;
};

/**
 * One row per unit with any ledger history: active balance, health (Late if any charge is late,
 * Due if something is owed now, Ended when only ended leases remain) and the next unpaid charge.
 * Ended balances stay separate so the total still equals the property's Balance due.
 * Late units sort first, ended-only units last, then by unit label.
 */
export function summarizeUnits(groups: LedgerGroup[]): UnitSummaryTable {
  const byUnit = new Map<string, LedgerGroup[]>();
  for (const g of groups) byUnit.set(g.unitId, [...(byUnit.get(g.unitId) ?? []), g]);
  const units = [...byUnit.values()].map((list): UnitSummary => {
    const active = list.filter((g) => g.active);
    const ended = list.filter((g) => !g.active);
    const open = active
      .flatMap((g) => g.rows)
      .filter((r) => r.balanceCents > 0)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const status: UnitHealth = !active.length
      ? 'ENDED'
      : open.some((r) => r.status === 'LATE')
        ? 'LATE'
        : open.some((r) => r.status === 'DUE' || r.status === 'PARTIAL')
          ? 'DUE'
          : 'CURRENT';
    const next = open.find((r) => r.status !== 'LATE') ?? open[0];
    const named = active.length ? active : ended.slice(0, 1);
    const names = [...new Set(named.flatMap((g) => g.tenants.map((t) => t.name)))];
    return {
      unitId: list[0].unitId,
      leaseId: (active[0] ?? ended[0]).leaseId,
      unitLabel: list[0].unitLabel,
      tenantNames: names.join(', '),
      balanceCents: active.reduce((sum, g) => sum + g.balanceCents, 0),
      endedBalanceCents: ended.reduce((sum, g) => sum + g.balanceCents, 0),
      activeLeaseCount: active.length,
      endedLeaseCount: ended.length,
      status,
      nextDue: next ? { dueDate: next.dueDate, amountCents: next.balanceCents } : null,
    };
  });
  const rank: Record<UnitHealth, number> = { LATE: 0, DUE: 1, CURRENT: 2, ENDED: 3 };
  units.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      a.unitLabel.localeCompare(b.unitLabel, 'en', { numeric: true }),
  );
  return {
    units,
    totalBalanceCents: units.reduce((sum, u) => sum + u.balanceCents, 0),
    endedBalanceCents: units.reduce((sum, u) => sum + u.endedBalanceCents, 0),
  };
}

export const CHARGE_TYPES = [
  'DEPOSIT',
  'OTHER',
  'LATE_FEE',
] as const satisfies readonly ChargeKind[];
export type NewChargeType = (typeof CHARGE_TYPES)[number];

export class ChargeInputError extends Error {}

const MAX_CENTS = 99_999_999_99;

/**
 * Adds a one-off charge to a lease. The lease must belong to the organization and sit in the
 * property (and unit, when given) the manager is working in; anything else reads as "not found".
 */
export async function createCharge(
  input: {
    organizationId: string;
    propertyId: string;
    unitId?: string;
    leaseId: string;
    kind: string;
    description: string;
    dueDate: Date;
    amountCents: Cents;
  },
  client: Client = db,
): Promise<{ chargeId: string }> {
  const description = input.description.trim();
  if (!CHARGE_TYPES.includes(input.kind as NewChargeType))
    throw new ChargeInputError('Choose a charge type.');
  if (!description || description.length > 200)
    throw new ChargeInputError('Describe the charge in up to 200 characters.');
  if (isReservedDescription(description))
    throw new ChargeInputError('Choose a different description.');
  if (Number.isNaN(input.dueDate.getTime())) throw new ChargeInputError('Enter a valid date.');
  if (
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > MAX_CENTS
  )
    throw new ChargeInputError('Enter an amount greater than zero.');
  const lease = await client.lease.findFirst({
    where: {
      id: input.leaseId,
      organizationId: input.organizationId,
      status: 'ACTIVE',
      unit: { propertyId: input.propertyId, ...(input.unitId ? { id: input.unitId } : {}) },
    },
    select: { id: true },
  });
  if (!lease) throw new ChargeInputError('Lease not found');
  const charge = await client.charge.create({
    data: {
      organizationId: input.organizationId,
      leaseId: lease.id,
      kind: input.kind as ChargeKind,
      amount: centsToDecimal(input.amountCents),
      dueDate: input.dueDate,
      description,
    },
  });
  return { chargeId: charge.id };
}

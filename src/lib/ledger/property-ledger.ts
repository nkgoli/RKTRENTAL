import type { ChargeKind, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { unitScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import { centsToDecimal, type Cents } from './core';
import { leaseTerms, toLedgerCharge, toLedgerPayment } from './store';
import {
  buildLeaseStatement,
  isReservedDescription,
  periodLabel,
  type StatementRow,
} from './statement';

type Client = PrismaClient;

export type LedgerTenant = { id: string; name: string; initials: string };

export type LedgerGroup = {
  leaseId: string;
  label: string;
  unitId: string;
  unitLabel: string;
  /** Charges minus settled payments due by now for this lease. */
  balanceCents: Cents;
  singleUnit: boolean;
  active: boolean;
  tenants: LedgerTenant[];
  rows: StatementRow[];
};

export type PropertyLedger = {
  groups: LedgerGroup[];
  /** Charges minus settled payments across the active leases in scope; negative is credit. */
  balanceCents: Cents;
  tenants: LedgerTenant[];
};

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
  for (const lease of leases) {
    const active = lease.status === 'ACTIVE';
    if (!active && lease.charges.length === 0) continue;
    const statement = buildLeaseStatement({
      lease: leaseTerms(lease),
      charges: lease.charges.map(toLedgerCharge),
      payments: lease.payments.map(toLedgerPayment),
      asOf,
    });
    if (active) balanceCents += statement.balanceCents;
    groups.push({
      leaseId: lease.id,
      label: periodLabel({ start: lease.startDate, end: lease.endDate }, statement.rows),
      unitId: lease.unitId,
      balanceCents: statement.balanceCents,
      unitLabel: lease.unit.number,
      singleUnit: lease.unit.isImplicit,
      active,
      tenants: lease.tenants.map(({ tenant }) => ({
        id: tenant.id,
        name: tenant.name,
        initials: initialsOf(tenant.name),
      })),
      rows: statement.rows,
    });
  }
  groups.sort((a, b) => Number(b.active) - Number(a.active));
  const seen = new Set<string>();
  const tenants = groups
    .filter((g) => g.active)
    .flatMap((g) => g.tenants)
    .filter((t) => !seen.has(t.id) && seen.add(t.id));
  return { groups, balanceCents, tenants };
}

export type UnitHealth = 'LATE' | 'DUE' | 'CURRENT';

export type UnitSummary = {
  unitId: string;
  leaseId: string;
  unitLabel: string;
  tenantNames: string;
  balanceCents: Cents;
  status: UnitHealth;
  nextDue: { dueDate: Date; amountCents: Cents } | null;
};

export type UnitSummaryTable = { units: UnitSummary[]; totalBalanceCents: Cents };

/**
 * One row per unit with an active lease: balance, health (Late if any charge is late, Due if
 * something is owed now) and the next unpaid charge. Late units sort first, then by unit label.
 */
export function summarizeUnits(groups: LedgerGroup[]): UnitSummaryTable {
  const units = groups
    .filter((g) => g.active)
    .map((g): UnitSummary => {
      const open = g.rows.filter((r) => r.balanceCents > 0);
      const status: UnitHealth = open.some((r) => r.status === 'LATE')
        ? 'LATE'
        : open.some((r) => r.status === 'DUE' || r.status === 'PARTIAL')
          ? 'DUE'
          : 'CURRENT';
      const next = open.find((r) => r.status !== 'LATE') ?? open[0];
      return {
        unitId: g.unitId,
        leaseId: g.leaseId,
        unitLabel: g.unitLabel,
        tenantNames: g.tenants.map((t) => t.name).join(', '),
        balanceCents: g.balanceCents,
        status,
        nextDue: next ? { dueDate: next.dueDate, amountCents: next.balanceCents } : null,
      };
    });
  const rank: Record<UnitHealth, number> = { LATE: 0, DUE: 1, CURRENT: 2 };
  units.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      a.unitLabel.localeCompare(b.unitLabel, 'en', { numeric: true }),
  );
  return {
    units,
    totalBalanceCents: units.reduce((sum, u) => sum + u.balanceCents, 0),
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

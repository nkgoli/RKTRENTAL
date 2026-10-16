/**
 * Move-in charges a lease creates when it is sent or activated: the prorated first month, the
 * security deposit and the optional move-in fee and pet deposit. Everything here is idempotent:
 * each charge carries a deterministic key in Charge.description, and the prorated first month
 * reuses the monthly rent key (`rent:<lease>:<YYYY-MM>`), so the rent planner and the statement's
 * scheduled rent skip that month instead of adding it a second time.
 */
import type { Prisma } from '@prisma/client';
import {
  addMonths,
  assertCents,
  centsToDecimal,
  monthKey,
  monthStart,
  rentKey,
  startOfUtcDay,
  type Cents,
  type ChargeKindName,
} from './core';

export type SetupChargeKind = 'deposit' | 'move-in-fee' | 'pet-deposit';

export const setupKey = (kind: SetupChargeKind, leaseId: string) => `setup:${kind}:${leaseId}`;

export type SetupFees = {
  monthlyRentCents: Cents;
  depositCents: Cents;
  moveInFeeCents: Cents;
  petDepositCents: Cents;
  /** Charge only the days left in the first month when the lease starts after the 1st. */
  prorateFirstMonth: boolean;
};

export type FirstMonthProration = {
  month: string;
  cents: Cents;
  days: number;
  daysInMonth: number;
  from: Date;
  to: Date;
};

export type SetupCharge = {
  kind: ChargeKindName;
  amountCents: Cents;
  dueDate: Date;
  description: string;
  /** Wizard wording, e.g. "Prorated May rent". */
  label: string;
};

const DAY_MS = 86_400_000;

const monthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

/**
 * Rent for the part of the first month a lease covers, or null when it starts on the 1st (the
 * normal monthly charge applies). The lease end caps the range when it falls in the same month.
 */
export function prorateFirstMonth(
  startDate: Date,
  monthlyRentCents: Cents,
  endDate?: Date,
): FirstMonthProration | null {
  assertCents(monthlyRentCents);
  const start = startOfUtcDay(startDate);
  if (start.getUTCDate() === 1 || monthlyRentCents <= 0) return null;
  const daysInMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), daysInMonth));
  const to = endDate && startOfUtcDay(endDate) < monthEnd ? startOfUtcDay(endDate) : monthEnd;
  if (to < start) return null;
  const days = Math.round((to.getTime() - start.getTime()) / DAY_MS) + 1;
  return {
    month: monthKey(start),
    cents: Math.round((monthlyRentCents * days) / daysInMonth),
    days,
    daysInMonth,
    from: start,
    to,
  };
}

/** The one-time charges created for a lease, in the order they appear on a statement. */
export function planSetupCharges(input: {
  leaseId: string;
  startDate: Date;
  endDate: Date;
  fees: SetupFees;
}): SetupCharge[] {
  const { leaseId, startDate, endDate, fees } = input;
  const dueDate = startOfUtcDay(startDate);
  const out: SetupCharge[] = [];
  const proration = fees.prorateFirstMonth
    ? prorateFirstMonth(startDate, fees.monthlyRentCents, endDate)
    : null;
  if (proration)
    out.push({
      kind: 'RENT',
      amountCents: proration.cents,
      dueDate,
      description: rentKey(leaseId, proration.month),
      label: `Prorated ${monthLabel(proration.from)} rent`,
    });
  const one = (kind: ChargeKindName, key: SetupChargeKind, cents: Cents, label: string) => {
    assertCents(cents);
    if (cents > 0)
      out.push({
        kind,
        amountCents: cents,
        dueDate,
        description: setupKey(key, leaseId),
        label,
      });
  };
  one('DEPOSIT', 'deposit', fees.depositCents, 'Security deposit');
  one('OTHER', 'move-in-fee', fees.moveInFeeCents, 'Move-in fee');
  one('DEPOSIT', 'pet-deposit', fees.petDepositCents, 'Pet deposit');
  return out;
}

export type PreviewRow = {
  date: Date;
  label: string;
  amountCents: Cents;
  group: 'move-in' | 'monthly';
};

export type ChargesPreview = {
  moveIn: PreviewRow[];
  moveInTotalCents: Cents;
  monthly: PreviewRow[];
  proration: FirstMonthProration | null;
};

/**
 * What the Payments ledger will hold after the lease is sent: the move-in charges, then one rent
 * row per month the lease covers. Months before `asOf`'s month are left out because the ledger
 * never backfills rent for them.
 */
export function previewScheduledCharges(input: {
  startDate: Date;
  endDate: Date;
  fees: SetupFees;
  asOf: Date;
}): ChargesPreview {
  const { startDate, endDate, fees, asOf } = input;
  const setup = planSetupCharges({ leaseId: 'preview', startDate, endDate, fees });
  const proration = fees.prorateFirstMonth
    ? prorateFirstMonth(startDate, fees.monthlyRentCents, endDate)
    : null;
  const moveIn = setup.map(
    (c): PreviewRow => ({
      date: c.dueDate,
      label: c.label,
      amountCents: c.amountCents,
      group: 'move-in',
    }),
  );
  const monthly: PreviewRow[] = [];
  if (fees.monthlyRentCents > 0) {
    const first = monthKey(startDate);
    const asOfMonth = monthKey(asOf);
    const last = monthKey(endDate);
    for (let month = first; month <= last; month = addMonths(month, 1)) {
      if (proration && month === proration.month) continue;
      if (month < asOfMonth) continue;
      monthly.push({
        date: monthStart(month),
        label: 'Monthly rent',
        amountCents: fees.monthlyRentCents,
        group: 'monthly',
      });
    }
  }
  return {
    moveIn,
    moveInTotalCents: moveIn.reduce((sum, row) => sum + row.amountCents, 0),
    monthly,
    proration,
  };
}

/**
 * Writes the lease's move-in charges inside the caller's transaction. Charges that already exist
 * (by key) are skipped, so activating or sending twice never doubles them. Returns how many were added.
 */
export async function ensureSetupCharges(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    leaseId: string;
    startDate: Date;
    endDate: Date;
    fees: SetupFees;
  },
): Promise<number> {
  const { organizationId, leaseId } = input;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lease:${leaseId}`}))`;
  const planned = planSetupCharges(input);
  if (!planned.length) return 0;
  const existing = await tx.charge.findMany({
    where: { organizationId, leaseId, description: { in: planned.map((c) => c.description) } },
    select: { description: true },
  });
  const have = new Set(existing.map((c) => c.description));
  const data = planned
    .filter((c) => !have.has(c.description))
    .map((c) => ({
      organizationId,
      leaseId,
      kind: c.kind,
      amount: centsToDecimal(c.amountCents),
      dueDate: c.dueDate,
      description: c.description,
    }));
  if (data.length) await tx.charge.createMany({ data });
  return data.length;
}

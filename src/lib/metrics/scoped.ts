import { computeReturns, type ReturnsMetrics } from '@/lib/returns/core';
import {
  bucketLabel,
  bucketSeries,
  monthBucket,
  yearlyTotals,
  type ResolvedPeriod,
  type SeriesPoint,
  type YearlyPoint,
} from '@/lib/returns/period';

export type ScopedUnitInput = {
  id: string;
  number: string;
  status: string;
  monthlyRentCents: number;
  listedRentCents: number | null;
};

/** A payment, or the sum of a unit's payments for one month (paidAt = any day in it). */
export type ScopedPaymentInput = {
  unitId: string;
  amountCents: number;
  paidAt: Date;
};

/** An expense, or the sum of one category's expenses for one month. */
export type ScopedExpenseInput = {
  category: string;
  label: string;
  amountCents: number;
  occurredOn: Date;
};

export type ScopedReturnsInput = {
  property: {
    purchasePriceCents: number | null;
    downPaymentCents: number | null;
    annualDebtServiceCents: number;
  };
  units: ScopedUnitInput[];
  payments: ScopedPaymentInput[];
  expenses: ScopedExpenseInput[];
  period: ResolvedPeriod;
  unitId?: string;
};

export type ScopedReturns = {
  unitId: string | null;
  unitNumber: string | null;
  metrics: ReturnsMetrics;
  /** One point per month, or per quarter when the range is longer than two years. */
  monthly: SeriesPoint[];
  yearly: YearlyPoint[];
  expenseBreakdown: { category: string; label: string; amountCents: number }[];
  dueCents: number;
  collectedCents: number;
  occupancy: number;
  occupiedUnits: number;
  totalUnits: number;
  period: ResolvedPeriod;
};

/** Axis labels for the chart rows; years are added once the chart spans more than a year. */
export function returnsMonthLabels(rows: { month: string }[]): string[] {
  const withYear = new Set(rows.map(({ month }) => month.slice(0, 4))).size > 1;
  return rows.map(({ month }) => bucketLabel(month, withYear));
}

function unitWeight(unit: ScopedUnitInput): number {
  return Math.max(0, unit.monthlyRentCents || unit.listedRentCents || 0);
}

function allocationShare(unit: ScopedUnitInput, units: ScopedUnitInput[]): number {
  const weights = units.map(unitWeight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total > 0) return unitWeight(unit) / total;
  return units.length ? 1 / units.length : 0;
}

/**
 * Produces a property or unit returns view from the same cent-based return
 * calculations used by the portfolio screen. Property-level expenses and debt
 * have no unit foreign key, so a unit receives its share by scheduled/listed
 * rent (or an equal share when none is available).
 */
export function computeScopedReturns(input: ScopedReturnsInput): ScopedReturns {
  const liveUnits = input.units.filter((unit) => unit.status !== 'ARCHIVED');
  const selected = input.unitId ? input.units.find((unit) => unit.id === input.unitId) : undefined;
  if (input.unitId && !selected) throw new Error('Unit is not part of this property');

  const scopedUnits = selected ? [selected] : liveUnits;
  const includedIds = new Set(scopedUnits.map((unit) => unit.id));
  const expenseShares = new Map(
    liveUnits.map((unit) => [unit.id, allocationShare(unit, liveUnits)] as const),
  );
  const shareOfProperty = selected ? (expenseShares.get(selected.id) ?? 0) : 1;
  const payments = input.payments.filter((payment) => includedIds.has(payment.unitId));
  const expenses = input.expenses;
  const incomeCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const dueCents = scopedUnits.reduce(
    (sum, unit) => sum + unit.monthlyRentCents * input.period.months,
    0,
  );

  const expensesCents = selected
    ? Math.round(expenses.reduce((sum, expense) => sum + expense.amountCents, 0) * shareOfProperty)
    : expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const debtServiceCents = Math.round(
    (input.property.annualDebtServiceCents * input.period.months * shareOfProperty) / 12,
  );
  const purchasePriceCents = input.property.purchasePriceCents
    ? Math.round(input.property.purchasePriceCents * shareOfProperty)
    : null;
  const downPaymentCents = input.property.downPaymentCents
    ? Math.round(input.property.downPaymentCents * shareOfProperty)
    : null;

  const monthlyIncome = new Map<string, number>();
  for (const payment of payments) {
    const month = monthBucket(payment.paidAt);
    monthlyIncome.set(month, (monthlyIncome.get(month) ?? 0) + payment.amountCents);
  }

  const expenseBreakdown = new Map<string, { label: string; amountCents: number }>();
  const monthlyExpenses = new Map<string, number>();
  for (const expense of expenses) {
    const share = selected ? (expenseShares.get(selected.id) ?? 0) : 1;
    const amountCents = Math.round(expense.amountCents * share);
    const row = expenseBreakdown.get(expense.category) ?? { label: expense.label, amountCents: 0 };
    row.amountCents += amountCents;
    expenseBreakdown.set(expense.category, row);
    const month = monthBucket(expense.occurredOn);
    monthlyExpenses.set(month, (monthlyExpenses.get(month) ?? 0) + amountCents);
  }

  const occupiedUnits = scopedUnits.filter((unit) => unit.status === 'OCCUPIED').length;
  const totalUnits = scopedUnits.length;
  return {
    unitId: selected?.id ?? null,
    unitNumber: selected?.number ?? null,
    metrics: computeReturns({
      incomeCents,
      expensesCents,
      debtServiceCents,
      purchasePriceCents,
      downPaymentCents,
      scheduledRentCents: dueCents,
      periodMonths: input.period.months,
    }),
    monthly: bucketSeries(input.period, monthlyIncome, monthlyExpenses),
    yearly: yearlyTotals(monthlyIncome, monthlyExpenses),
    expenseBreakdown: [...expenseBreakdown.entries()]
      .map(([category, values]) => ({ category, ...values }))
      .sort((a, b) => b.amountCents - a.amountCents),
    dueCents,
    collectedCents: incomeCents,
    occupancy: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
    occupiedUnits,
    totalUnits,
    period: input.period,
  };
}

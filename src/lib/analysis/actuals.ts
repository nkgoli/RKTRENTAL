/**
 * Actual-versus-projected comparison for the combined Returns & ROI workspace. Pure and
 * browser-safe: it pairs the recorded actual-returns contract (`@/lib/returns/actual`,
 * integer cents) with an ROI projection's Year-1 figures (dollars, annual) over the same
 * period and whole-property scope. Nothing is filled in: an unavailable actual stays
 * unavailable, a partial actual is never differenced, and the projection is always labelled
 * as a projection.
 */

import type { ActualAmount, ActualReturns, DerivedMetric } from '@/lib/returns/actual';
import {
  PERIOD_KEYS,
  periodKeyFrom,
  resolvePeriod,
  type PeriodKey,
  type ResolvedPeriod,
} from '@/lib/returns/period';

// ------------------------------------------------------------------------------------ period

/** Range chips offered next to the projection. "All" needs a server-side earliest date. */
export const ACTUAL_PERIOD_KEYS = PERIOD_KEYS.filter((key) => key !== 'ALL');
export const DEFAULT_ACTUAL_PERIOD: PeriodKey = '12M';

/** The period as it lives in the URL: `period`, plus inclusive YYYY-MM `from`/`to` for CUSTOM. */
export type PeriodChoice = { key: PeriodKey; from?: string; to?: string };

export function periodChoiceFrom(
  params: {
    get(name: string): string | null;
  } | null,
): PeriodChoice {
  const key = periodKeyFrom(params?.get('period'));
  if (key === 'ALL') return { key: DEFAULT_ACTUAL_PERIOD };
  if (key !== 'CUSTOM') return { key };
  const from = params?.get('from') ?? undefined;
  const to = params?.get('to') ?? undefined;
  return from && to ? { key, from, to } : { key: DEFAULT_ACTUAL_PERIOD };
}

/** URL params for a period; empty for the default so plain property links stay unchanged. */
export function periodChoiceParams(choice: PeriodChoice): Record<string, string> {
  if (choice.key === DEFAULT_ACTUAL_PERIOD) return {};
  if (choice.key !== 'CUSTOM') return { period: choice.key };
  return { period: 'CUSTOM', from: choice.from ?? '', to: choice.to ?? '' };
}

const DAY_MS = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export type ActualWindow = {
  period: ResolvedPeriod;
  /** Inclusive first day (UTC). */
  from: string;
  /** Inclusive last day (UTC): the period's last day, or today when the period runs on. */
  to: string;
  /** True when the window stops at today rather than the end of the current month. */
  throughToday: boolean;
  label: string;
};

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

/**
 * The inclusive day range to request. Rolling windows end with the current month; days after
 * today cannot be observed yet, so the range stops today instead of reporting them as gaps.
 */
export function actualWindow(choice: PeriodChoice, now: Date): ActualWindow {
  const period = resolvePeriod(choice.key, now, { from: choice.from, to: choice.to });
  const from = isoDay(period.start);
  const lastDay = isoDay(new Date(period.end.getTime() - DAY_MS));
  const today = isoDay(now);
  const throughToday = lastDay > today;
  const to = throughToday ? today : lastDay;
  return {
    period,
    from,
    to,
    throughToday,
    label: `${dayLabel(from)} – ${dayLabel(to)}`,
  };
}

// -------------------------------------------------------------------------------- comparison

/** Year-1 projection figures from the ROI engine, in dollars per year. */
export type ProjectionYear = {
  effectiveGrossIncome: number;
  totalOperatingExpenses: number;
  noi: number;
  annualDebtService: number;
  annualCashFlow: number;
};

export type ActualCell = {
  status: 'recorded' | 'zero' | 'partial' | 'unavailable';
  cents: number | null;
  /** Why the value is unavailable or partial; empty when complete. */
  notes: string[];
};

export type ProjectedCell = { status: 'projected' | 'unavailable'; cents: number | null };

export type ComparisonRow = {
  key: 'income' | 'expenses' | 'noi' | 'debtService' | 'cashFlow';
  label: string;
  actual: ActualCell;
  projected: ProjectedCell;
  /** Actual − projected, only when both are complete; otherwise null with the reason. */
  difference: { cents: number | null; reason: string | null };
  /** Positive differences are good for income-like rows and bad for cost rows. */
  costLike: boolean;
};

export type Comparison = {
  rows: ComparisonRow[];
  /** Fraction of a year the projection was scaled by. */
  scale: number;
  scaleLabel: string;
  projectionAvailable: boolean;
};

const readable: Record<string, string> = {
  confirmedRent: 'no confirmed rent is recorded',
  expenses: 'no expenses are recorded',
  actualDebtService: 'loan payments are not recorded',
  purchasePrice: 'purchase price is missing',
  cashInvested: 'cash invested is unknown',
};
const explain = (items: string[]) => items.map((m) => readable[m] ?? m);

function fromAmount(amount: ActualAmount): ActualCell {
  if (amount.status === 'unavailable')
    return { status: 'unavailable', cents: null, notes: amount.reason ? [amount.reason] : [] };
  if (amount.coverage.status !== 'complete')
    return { status: 'partial', cents: amount.cents, notes: amount.coverage.gaps };
  return { status: amount.status, cents: amount.cents, notes: [] };
}

function fromMetric(metric: DerivedMetric): ActualCell {
  if (metric.status === 'unavailable')
    return { status: 'unavailable', cents: null, notes: explain(metric.missing) };
  if (metric.status === 'partial')
    return { status: 'partial', cents: metric.value, notes: explain(metric.missing) };
  return { status: metric.value === 0 ? 'zero' : 'recorded', cents: metric.value, notes: [] };
}

/** The contract's own proration rule: whole months ÷ 12, otherwise days ÷ 365. */
export function periodScale(period: ActualReturns['period']): number {
  return period.wholeMonths != null ? period.wholeMonths / 12 : period.days / 365;
}

export function compareActualToProjection(
  actual: ActualReturns,
  projection: ProjectionYear | null,
): Comparison {
  const scale = periodScale(actual.period);
  const scaleLabel =
    actual.period.wholeMonths != null
      ? `${actual.period.wholeMonths} of 12 months`
      : `${actual.period.days} of 365 days`;
  const projected = (dollars: number | undefined): ProjectedCell =>
    projection && dollars != null && Number.isFinite(dollars)
      ? { status: 'projected', cents: Math.round(dollars * 100 * scale) }
      : { status: 'unavailable', cents: null };
  const row = (
    key: ComparisonRow['key'],
    label: string,
    cell: ActualCell,
    plan: ProjectedCell,
    costLike = false,
  ): ComparisonRow => {
    const complete = cell.status === 'recorded' || cell.status === 'zero';
    const difference =
      complete && plan.cents != null && cell.cents != null
        ? { cents: cell.cents - plan.cents, reason: null }
        : {
            cents: null,
            reason:
              cell.status === 'unavailable'
                ? 'Actual not recorded'
                : cell.status === 'partial'
                  ? 'Actual is partial'
                  : 'No projection yet',
          };
    return { key, label, actual: cell, projected: plan, difference, costLike };
  };
  return {
    scale,
    scaleLabel,
    projectionAvailable: !!projection,
    rows: [
      row(
        'income',
        'Operating income',
        fromMetric(actual.actual.operatingIncome),
        projected(projection?.effectiveGrossIncome),
      ),
      row(
        'expenses',
        'Operating expenses',
        fromAmount(actual.expenses.total),
        projected(projection?.totalOperatingExpenses),
        true,
      ),
      row('noi', 'Net operating income', fromMetric(actual.actual.noi), projected(projection?.noi)),
      row(
        'debtService',
        'Debt service',
        fromAmount(actual.debtService.actual),
        projected(projection?.annualDebtService),
        true,
      ),
      row(
        'cashFlow',
        'Cash flow',
        fromMetric(actual.actual.cashFlow),
        projected(projection?.annualCashFlow),
      ),
    ],
  };
}

// ------------------------------------------------------------------------------ needed inputs

export type NeededInput = {
  id: string;
  text: string;
  /** Where the manager can supply it; absent for the in-page assumptions. */
  href?: string;
  action?: 'assumptions';
  linkLabel: string;
};

/** Actionable steps that would complete the comparison. Nothing here is assumed or filled. */
export function neededInputs(
  propertyId: string,
  actual: ActualReturns | null,
  missingAssumptions: number,
): NeededInput[] {
  const out: NeededInput[] = [];
  const base = `/properties/${encodeURIComponent(propertyId)}`;
  if (missingAssumptions > 0)
    out.push({
      id: 'assumptions',
      text: `Complete ${missingAssumptions} ROI assumption${missingAssumptions === 1 ? '' : 's'} to show the projection beside your actuals.`,
      action: 'assumptions',
      linkLabel: 'Review assumptions',
    });
  if (!actual) return out;
  const rent = actual.income.confirmedRent;
  const unclassified = actual.income.receipts.filter(
    (r) => r.classification === 'mixed' || r.classification === 'unapplied',
  ).length;
  if (rent.status === 'unavailable')
    out.push(
      rent.coverage.status === 'none' && !rent.coverage.recordedFrom
        ? {
            id: 'rent',
            text: 'No lease, rent charge or payment is recorded for this property, so actual rent is unavailable.',
            href: `${base}/leases`,
            linkLabel: 'Add a lease',
          }
        : {
            id: 'rent',
            text: 'No rent is recorded for this period.',
            href: `${base}/payments`,
            linkLabel: 'Record rent payments',
          },
    );
  else if (unclassified > 0)
    out.push({
      id: 'unclassified',
      text: `${unclassified} receipt(s) could not be classified as rent. Generate the matching rent charges so they count as income.`,
      href: `${base}/payments`,
      linkLabel: 'Review payments',
    });
  else if (rent.coverage.status === 'partial' && rent.coverage.recordedFrom)
    out.push({
      id: 'rent-window',
      text: `Rent records start ${rent.coverage.recordedFrom}; earlier days in this period are not covered.`,
      href: `${base}/leases`,
      linkLabel: 'Review leases',
    });
  const expenses = actual.expenses.total;
  if (expenses.status === 'unavailable')
    out.push({
      id: 'expenses',
      text:
        expenses.coverage.status === 'none'
          ? 'No expenses have ever been recorded for this property; actual expenses and NOI are unavailable, not $0.'
          : 'No expenses are recorded in this period; actual expenses and NOI are unavailable, not $0.',
      href: `/returns?${new URLSearchParams({ property: propertyId, add: '1' })}#add-expense`,
      linkLabel: 'Add expense',
    });
  else if (expenses.coverage.status === 'partial' && expenses.coverage.recordedFrom)
    out.push({
      id: 'expense-window',
      text: `Expense records start ${expenses.coverage.recordedFrom}; earlier days in this period are not covered.`,
      href: `/returns?${new URLSearchParams({ property: propertyId, add: '1' })}#add-expense`,
      linkLabel: 'Add expense',
    });
  if (actual.debtService.actual.status === 'unavailable')
    out.push(
      actual.scheduled.debtService.status === 'unavailable'
        ? {
            id: 'financing',
            text: 'Financing is unknown. Enter the loan amount (0 for a cash purchase) and annual debt service on the property.',
            href: `${base}/edit`,
            linkLabel: 'Edit property',
          }
        : {
            id: 'loan-payments',
            text: 'Loan payments are not recorded, so actual cash flow is unavailable. The estimate below uses scheduled debt service.',
            href: `${base}/edit`,
            linkLabel: 'Review financing',
          },
    );
  if (actual.actual.periodCapRate.missing.includes('purchasePrice'))
    out.push({
      id: 'price',
      text: 'Purchase price is missing, so the actual cap rate is unavailable.',
      href: `${base}/edit`,
      linkLabel: 'Edit property',
    });
  return out;
}

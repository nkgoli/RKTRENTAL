/**
 * Recorded ("actual") returns for one property over an explicit period. Pure: works on
 * integer cents and UTC dates, never touches the database and never reads the clock.
 *
 * Unlike {@link computeReturns} in ./core, nothing here assumes a value. There is no default
 * debt service, no 3% appreciation, no projected or listed rent and no zero standing in for
 * an empty expense history. Every amount is an {@link ActualAmount} whose `status` keeps
 * recorded, explicitly zero and unavailable observations distinct, with coverage and
 * provenance. Scheduled, estimated and annualized figures live only under `scheduled` and
 * `estimates`, each labelled with its basis, and never feed the `actual` metrics.
 *
 * Accounting basis: cash receipts. Income is SUCCEEDED Payment rows dated (paidAt) inside
 * the period. Payment rows carry no classification, so each receipt is classified by
 * replaying the ledger's own settlement rule (ledger/core computeBalance: oldest charge
 * first, rent before deposit before late fee on the same due date) one payment at a time
 * in paidAt order. Only a receipt applied entirely to RENT charges is confirmed rent.
 * Receipts spanning kinds are `mixed`; receipts with no charge to settle are `unapplied`.
 * Neither is ever labelled rent. Deposits are liabilities and are not income.
 */

import type { ChargeKindName } from '@/lib/ledger/core';
import type { Cents } from './core';

export const ACTUAL_RETURNS_VERSION = 1;
export const ACTUAL_CURRENCY = 'USD';

/** Assumptions that the actual result never contains; shown so the UI can say so. */
export const EXCLUDED_ASSUMPTIONS = [
  'appreciation',
  'projectedRent',
  'listedOrMarketRent',
  'vacancyAllowance',
  'assumedDebtService',
  'inferredZeroExpenses',
] as const;

// ------------------------------------------------------------------------------------- period

/** Half-open UTC day range [start, endExclusive). */
export type ActualPeriod = {
  /** Inclusive first day, YYYY-MM-DD (UTC). */
  from: string;
  /** Inclusive last day, YYYY-MM-DD (UTC). */
  to: string;
  start: Date;
  endExclusive: Date;
  days: number;
  /** Whole calendar months when the range starts on a 1st and ends on a month end; else null. */
  wholeMonths: number | null;
};

const DAY_MS = 86_400_000;
const MAX_PERIOD_DAYS = 366 * 50;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const monthIndex = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return isoDay(date) === value ? date : null;
}

export type PeriodError = { path: 'from' | 'to'; message: string };

/** Validates inclusive YYYY-MM-DD bounds into a period. Never clamps or reorders silently. */
export function actualPeriod(
  from: unknown,
  to: unknown,
): { ok: true; period: ActualPeriod } | { ok: false; issues: PeriodError[] } {
  const start = parseDay(from);
  const last = parseDay(to);
  const issues: PeriodError[] = [];
  if (!start) issues.push({ path: 'from', message: 'Enter a valid start date (YYYY-MM-DD).' });
  if (!last) issues.push({ path: 'to', message: 'Enter a valid end date (YYYY-MM-DD).' });
  if (start && last && last < start)
    issues.push({ path: 'to', message: 'The end date must be on or after the start date.' });
  if (issues.length || !start || !last) return { ok: false, issues };
  const endExclusive = new Date(last.getTime() + DAY_MS);
  const days = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);
  if (days > MAX_PERIOD_DAYS)
    return { ok: false, issues: [{ path: 'to', message: 'The period cannot exceed 50 years.' }] };
  const aligned = start.getUTCDate() === 1 && endExclusive.getUTCDate() === 1;
  return {
    ok: true,
    period: {
      from: isoDay(start),
      to: isoDay(last),
      start,
      endExclusive,
      days,
      wholeMonths: aligned ? monthIndex(endExclusive) - monthIndex(start) : null,
    },
  };
}

/** The same window as a returns-screen period ({ start, end } half-open month range). */
export function actualPeriodFromRange(range: { start: Date; end: Date }): ActualPeriod {
  const result = actualPeriod(isoDay(range.start), isoDay(new Date(range.end.getTime() - DAY_MS)));
  if (!result.ok) throw new Error(result.issues.map((i) => i.message).join(' '));
  return result.period;
}

const inPeriod = (date: Date, period: Pick<ActualPeriod, 'start' | 'endExclusive'>) =>
  date.getTime() >= period.start.getTime() && date.getTime() < period.endExclusive.getTime();

// ------------------------------------------------------------------------------------- inputs

export type ActualCharge = {
  id: string;
  leaseId: string;
  kind: ChargeKindName;
  amountCents: Cents;
  dueDate: Date;
  description?: string | null;
};

/** SUCCEEDED payments only. paidAt null means settled but undated (never in a period). */
export type ActualPayment = {
  id: string;
  leaseId: string;
  amountCents: Cents;
  paidAt: Date | null;
  createdAt: Date;
};

export type ActualExpense = {
  category: string;
  /** Sum of the rows of this category in the period. */
  amountCents: Cents;
  count: number;
  firstOn: Date;
  lastOn: Date;
};

export type ActualReturnsInput = {
  property: {
    id: string;
    name: string;
    purchasePriceCents: Cents | null;
    downPaymentCents: Cents | null;
    loanAmountCents: Cents | null;
    annualDebtServiceCents: Cents;
  };
  period: ActualPeriod;
  /** Clock reading supplied by the caller: days after it are not yet observable. */
  asOf: Date;
  /** Leases on the property's units that ever reached ACTIVE (status not DRAFT). */
  leases: { id: string; startDate: Date; endDate: Date }[];
  /** Every charge of those leases (allocation needs history before and after the period). */
  charges: ActualCharge[];
  /** Every SUCCEEDED payment of those leases dated before the period end, plus undated ones. */
  payments: ActualPayment[];
  /** PENDING/FAILED/REFUNDED rows dated (paidAt ?? createdAt) inside the period. */
  excludedPayments: { status: 'PENDING' | 'FAILED' | 'REFUNDED'; amountCents: Cents }[];
  /** Expense rows in the period, aggregated per category. */
  expenses: ActualExpense[];
  /** Earliest Expense.occurredOn ever recorded for the property, or null. */
  earliestExpenseOn: Date | null;
};

// ------------------------------------------------------------------------------------- output

export type CoverageStatus = 'complete' | 'partial' | 'none';

export type Coverage = {
  status: CoverageStatus;
  /** Days of the period inside the source's recorded window (and on or before asOf). */
  observedDays: number;
  periodDays: number;
  /** Inclusive YYYY-MM-DD window the source has records for, clipped to asOf; null if none. */
  recordedFrom: string | null;
  recordedTo: string | null;
  gaps: string[];
};

export type SourceRef = {
  source: 'payment' | 'charge' | 'expense' | 'property' | 'lease';
  /** Record IDs (capped at {@link MAX_SOURCE_IDS}); `idsTruncated` says when more exist. */
  ids: string[];
  idsTruncated: boolean;
  count: number;
  note: string;
};

/**
 * One observation. `recorded`: records exist and sum to `cents` (which may be negative or
 * zero only when rows say so). `zero`: the source covers the period and explicitly shows
 * nothing (for example rent charged but nothing collected); `cents` is 0. `unavailable`: no
 * supporting record; `cents` is null and must never be shown or used as 0.
 */
export type ActualAmount = {
  status: 'recorded' | 'zero' | 'unavailable';
  cents: Cents | null;
  basis: 'recorded';
  coverage: Coverage;
  sources: SourceRef[];
  reason?: string;
};

export type ReceiptClass = 'rent' | 'otherIncome' | 'deposit' | 'mixed' | 'unapplied';

export type ClassifiedReceipt = {
  paymentId: string;
  leaseId: string;
  paidAt: string;
  amountCents: Cents;
  classification: ReceiptClass;
  /** How the ledger rule applied this receipt, in cents per charge kind. */
  appliedCents: Record<ChargeKindName | 'UNAPPLIED', Cents>;
};

export type DerivedMetric = {
  status: 'derived' | 'partial' | 'unavailable';
  /** Cents for amounts, a fraction for ratios (0.053 = 5.3%); null when unavailable. */
  value: number | null;
  unit: 'cents' | 'ratio';
  /** Inputs that are absent (value null) or incomplete (status partial). */
  missing: string[];
};

export type Estimate = DerivedMetric & {
  basis: 'scheduled' | 'annualized';
  note: string;
};

export type ActualReturns = {
  version: typeof ACTUAL_RETURNS_VERSION;
  currency: typeof ACTUAL_CURRENCY;
  unit: 'cents';
  accountingBasis: 'cash';
  propertyId: string;
  propertyName: string;
  period: { from: string; to: string; days: number; wholeMonths: number | null };
  asOf: string;
  excludedAssumptions: readonly string[];
  income: {
    /** Receipts applied entirely to RENT charges. */
    confirmedRent: ActualAmount;
    /** Receipts applied entirely to LATE_FEE / OTHER charges. */
    otherIncome: ActualAmount;
    /** Receipts spanning charge kinds. Not rent; `allocatedRentCents` is informational. */
    mixedReceipts: ActualAmount & { allocatedRentCents: Cents };
    /** Receipts with no charge to settle (credit/prepayment before charges exist). */
    unappliedReceipts: ActualAmount;
    /** Security deposits received: a liability, never income. */
    securityDeposits: ActualAmount;
    /** Every SUCCEEDED receipt in the period, whatever its classification. */
    totalReceipts: ActualAmount;
    receipts: ClassifiedReceipt[];
    excluded: {
      pendingCents: Cents;
      failedCount: number;
      refundedCents: Cents;
      undatedCount: number;
    };
  };
  expenses: {
    total: ActualAmount;
    byCategory: { category: string; cents: Cents; count: number }[];
  };
  debtService: {
    /** Actual loan payments are not recorded; only an explicit no-loan fact yields zero. */
    actual: ActualAmount;
  };
  /** Period actuals derived only from the observations above. */
  actual: {
    operatingIncome: DerivedMetric;
    noi: DerivedMetric;
    cashFlow: DerivedMetric;
    expenseRatio: DerivedMetric;
    /** Period NOI ÷ purchase price (not annualized). */
    periodCapRate: DerivedMetric;
    /** Period cash flow ÷ cash invested (not annualized). */
    periodCashOnCash: DerivedMetric;
  };
  /** Billed or scheduled amounts: what was due, not what happened. */
  scheduled: {
    billedRent: ActualAmount;
    debtService: Estimate;
  };
  /** Figures that combine actuals with a schedule or scale them to a year. */
  estimates: {
    cashFlowAfterScheduledDebt: Estimate;
    annualizedNoi: Estimate;
    annualizedCapRate: Estimate;
  };
  limitations: string[];
};

export const MAX_SOURCE_IDS = 500;

// ------------------------------------------------------------------------------- allocation

const KIND_ORDER: Record<ChargeKindName, number> = { RENT: 0, DEPOSIT: 1, LATE_FEE: 2, OTHER: 3 };

const emptyApplied = (): ClassifiedReceipt['appliedCents'] => ({
  RENT: 0,
  DEPOSIT: 0,
  LATE_FEE: 0,
  OTHER: 0,
  UNAPPLIED: 0,
});

/**
 * Applies each lease's settled payments, oldest first, to its charges oldest first — the
 * ledger's computeBalance order — and records where each payment's cents went. The total
 * applied to each charge equals computeBalance's allocation for the same rows.
 */
export function allocateReceipts(
  charges: ActualCharge[],
  payments: ActualPayment[],
): Map<string, ClassifiedReceipt['appliedCents']> {
  const out = new Map<string, ClassifiedReceipt['appliedCents']>();
  const leaseIds = new Set(payments.map((p) => p.leaseId));
  for (const leaseId of leaseIds) {
    const queue = charges
      .filter((c) => c.leaseId === leaseId)
      .sort(
        (a, b) =>
          a.dueDate.getTime() - b.dueDate.getTime() ||
          KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
          (a.description ?? '').localeCompare(b.description ?? '') ||
          a.id.localeCompare(b.id),
      )
      .map((c) => ({ kind: c.kind, left: c.amountCents }));
    const ordered = payments
      .filter((p) => p.leaseId === leaseId)
      .sort(
        (a, b) =>
          (a.paidAt ?? a.createdAt).getTime() - (b.paidAt ?? b.createdAt).getTime() ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
    let index = 0;
    for (const payment of ordered) {
      const applied = emptyApplied();
      let remaining = payment.amountCents;
      while (remaining > 0 && index < queue.length) {
        const charge = queue[index];
        const take = Math.min(remaining, charge.left);
        applied[charge.kind] += take;
        charge.left -= take;
        remaining -= take;
        if (charge.left <= 0) index++;
      }
      applied.UNAPPLIED += remaining;
      out.set(payment.id, applied);
    }
  }
  return out;
}

export function classifyReceipt(applied: ClassifiedReceipt['appliedCents']): ReceiptClass {
  const parts = (Object.keys(applied) as (keyof typeof applied)[]).filter((k) => applied[k] > 0);
  if (parts.length === 0) return 'unapplied';
  if (parts.length > 1) return 'mixed';
  switch (parts[0]) {
    case 'RENT':
      return 'rent';
    case 'DEPOSIT':
      return 'deposit';
    case 'UNAPPLIED':
      return 'unapplied';
    default:
      return 'otherIncome';
  }
}

// ---------------------------------------------------------------------------------- coverage

function coverage(
  period: ActualPeriod,
  asOf: Date,
  recordedFrom: Date | null,
  gapsWhenNone: string,
): Coverage {
  const asOfEnd = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + 1),
  );
  const base = { periodDays: period.days };
  if (!recordedFrom || recordedFrom.getTime() >= asOfEnd.getTime())
    return {
      ...base,
      status: 'none',
      observedDays: 0,
      recordedFrom: null,
      recordedTo: null,
      gaps: [gapsWhenNone],
    };
  const from = new Date(Math.max(period.start.getTime(), recordedFrom.getTime()));
  const to = new Date(Math.min(period.endExclusive.getTime(), asOfEnd.getTime()));
  const observedDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  const gaps: string[] = [];
  if (recordedFrom.getTime() > period.start.getTime())
    gaps.push(
      `No records before ${isoDay(recordedFrom)}; ${isoDay(period.start)} – ${isoDay(
        new Date(Math.min(recordedFrom.getTime(), period.endExclusive.getTime()) - DAY_MS),
      )} is not observed.`,
    );
  if (asOfEnd.getTime() < period.endExclusive.getTime())
    gaps.push(`The period continues after the as-of date ${isoDay(asOf)}.`);
  return {
    ...base,
    status: observedDays === 0 ? 'none' : observedDays === period.days ? 'complete' : 'partial',
    observedDays,
    recordedFrom: isoDay(recordedFrom),
    recordedTo: isoDay(new Date(asOfEnd.getTime() - DAY_MS)),
    gaps: observedDays === 0 && !gaps.length ? [gapsWhenNone] : gaps,
  };
}

function sourceRef(source: SourceRef['source'], ids: string[], note: string): SourceRef {
  return {
    source,
    ids: ids.slice(0, MAX_SOURCE_IDS),
    idsTruncated: ids.length > MAX_SOURCE_IDS,
    count: ids.length,
    note,
  };
}

/** Recorded when rows exist, zero when the source covers the period with none, else unavailable. */
function observed(
  cents: Cents,
  rows: number,
  cov: Coverage,
  sources: SourceRef[],
  zeroAllowed: boolean,
  unavailableReason: string,
): ActualAmount {
  if (rows > 0)
    return {
      status: cents === 0 ? 'zero' : 'recorded',
      cents,
      basis: 'recorded',
      coverage: cov,
      sources,
    };
  if (zeroAllowed && cov.status !== 'none')
    return { status: 'zero', cents: 0, basis: 'recorded', coverage: cov, sources };
  return {
    status: 'unavailable',
    cents: null,
    basis: 'recorded',
    coverage: cov,
    sources,
    reason: unavailableReason,
  };
}

// ---------------------------------------------------------------------------------- metrics

const metric = (
  value: number | null,
  unit: DerivedMetric['unit'],
  missing: string[],
  partial: string[] = [],
): DerivedMetric =>
  value === null || missing.length
    ? { status: 'unavailable', value: null, unit, missing: [...missing, ...partial] }
    : { status: partial.length ? 'partial' : 'derived', value, unit, missing: partial };

const usable = (a: ActualAmount) => a.status !== 'unavailable';

function incompleteness(label: string, a: ActualAmount): string[] {
  return a.status !== 'unavailable' && a.coverage.status !== 'complete'
    ? [`${label} coverage is ${a.coverage.status}`]
    : [];
}

/** Builds the actual-returns contract from scoped, already-loaded rows. */
export function computeActualReturns(input: ActualReturnsInput): ActualReturns {
  const { period, asOf, property } = input;
  const allocations = allocateReceipts(input.charges, input.payments);

  const receipts: ClassifiedReceipt[] = input.payments
    .filter((p): p is ActualPayment & { paidAt: Date } => !!p.paidAt && inPeriod(p.paidAt, period))
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.id.localeCompare(b.id))
    .map((p) => {
      const appliedCents = allocations.get(p.id) ?? { ...emptyApplied(), UNAPPLIED: p.amountCents };
      return {
        paymentId: p.id,
        leaseId: p.leaseId,
        paidAt: p.paidAt.toISOString(),
        amountCents: p.amountCents,
        classification: classifyReceipt(appliedCents),
        appliedCents,
      };
    });

  // The ledger window starts at the first lease term, charge or settled payment.
  const ledgerDates = [
    ...input.leases.map((l) => l.startDate),
    ...input.charges.map((c) => c.dueDate),
    ...input.payments.map((p) => p.paidAt ?? p.createdAt),
  ];
  const ledgerFrom = ledgerDates.length
    ? new Date(Math.min(...ledgerDates.map((d) => d.getTime())))
    : null;
  const ledgerCoverage = coverage(
    period,
    asOf,
    ledgerFrom,
    'No lease, charge or payment is recorded for this property.',
  );

  const byClass = (cls: ReceiptClass) => receipts.filter((r) => r.classification === cls);
  const amountOf = (cls: ReceiptClass, note: string, zeroAllowed = true) => {
    const rows = byClass(cls);
    return observed(
      rows.reduce((s, r) => s + r.amountCents, 0),
      rows.length,
      ledgerCoverage,
      [
        sourceRef(
          'payment',
          rows.map((r) => r.paymentId),
          note,
        ),
      ],
      zeroAllowed,
      'No lease ledger covers this period.',
    );
  };

  const confirmedRentBase = amountOf(
    'rent',
    'SUCCEEDED payments applied entirely to RENT charges by the ledger rule.',
  );
  const mixedRows = byClass('mixed');
  const mixedReceipts = {
    ...amountOf(
      'mixed',
      'SUCCEEDED payments the ledger rule spread across charge kinds or credit.',
    ),
    allocatedRentCents: mixedRows.reduce((s, r) => s + r.appliedCents.RENT, 0),
  };
  const unappliedReceipts = amountOf(
    'unapplied',
    'SUCCEEDED payments with no outstanding charge to settle.',
  );
  const otherIncome = amountOf(
    'otherIncome',
    'SUCCEEDED payments applied entirely to LATE_FEE / OTHER charges.',
  );
  const securityDeposits = amountOf(
    'deposit',
    'SUCCEEDED payments applied entirely to DEPOSIT charges (liability).',
  );
  const totalReceipts = observed(
    receipts.reduce((s, r) => s + r.amountCents, 0),
    receipts.length,
    ledgerCoverage,
    [
      sourceRef(
        'payment',
        receipts.map((r) => r.paymentId),
        'All SUCCEEDED payments dated in the period.',
      ),
    ],
    true,
    'No lease ledger covers this period.',
  );

  // Rent is only complete when every receipt in the period could be classified.
  const unclassified = mixedRows.length + byClass('unapplied').length;
  const confirmedRent: ActualAmount =
    confirmedRentBase.status !== 'unavailable' && unclassified > 0
      ? {
          ...confirmedRentBase,
          coverage: {
            ...confirmedRentBase.coverage,
            status: 'partial',
            gaps: [
              ...confirmedRentBase.coverage.gaps,
              `${unclassified} receipt(s) could not be classified as rent (mixed or unapplied).`,
            ],
          },
        }
      : confirmedRentBase;

  const excluded = {
    pendingCents: input.excludedPayments
      .filter((p) => p.status === 'PENDING')
      .reduce((s, p) => s + p.amountCents, 0),
    failedCount: input.excludedPayments.filter((p) => p.status === 'FAILED').length,
    refundedCents: input.excludedPayments
      .filter((p) => p.status === 'REFUNDED')
      .reduce((s, p) => s + p.amountCents, 0),
    undatedCount: input.payments.filter((p) => !p.paidAt).length,
  };

  // Expenses: absence of rows is never a zero; rows summing to zero would be.
  const expenseCoverage = coverage(
    period,
    asOf,
    input.earliestExpenseOn,
    'No expense has ever been recorded for this property.',
  );
  const expenseRows = input.expenses.reduce((s, e) => s + e.count, 0);
  const expenseTotal = observed(
    input.expenses.reduce((s, e) => s + e.amountCents, 0),
    expenseRows,
    expenseCoverage,
    [
      {
        source: 'expense',
        ids: [],
        idsTruncated: false,
        count: expenseRows,
        note: 'Expense rows with occurredOn in the period, summed per category in SQL.',
      },
    ],
    false,
    expenseRows === 0 && expenseCoverage.status !== 'none'
      ? 'No expense is recorded in this period; absence of records is not a zero.'
      : 'No expense history covers this period.',
  );

  // Debt: payments to lenders are not recorded. An explicit zero loan amount is the only
  // recorded statement that there is no debt service.
  const noLoan = property.loanAmountCents === 0;
  const propertyRef = sourceRef(
    'property',
    [property.id],
    'Property.loanAmount / annualDebtService.',
  );
  const debtActual: ActualAmount = noLoan
    ? {
        status: 'zero',
        cents: 0,
        basis: 'recorded',
        coverage: {
          status: 'complete',
          observedDays: period.days,
          periodDays: period.days,
          recordedFrom: null,
          recordedTo: null,
          gaps: [],
        },
        sources: [
          { ...propertyRef, note: 'Property.loanAmount is explicitly 0: no financing recorded.' },
        ],
      }
    : {
        status: 'unavailable',
        cents: null,
        basis: 'recorded',
        coverage: {
          status: 'none',
          observedDays: 0,
          periodDays: period.days,
          recordedFrom: null,
          recordedTo: null,
          gaps: ['Loan payments are not recorded in RocketRental.'],
        },
        sources: [propertyRef],
        reason:
          property.loanAmountCents == null
            ? 'Financing is unknown and loan payments are not recorded.'
            : 'Loan payments are not recorded; see scheduled debt service.',
      };

  const prorate = (annual: Cents) =>
    Math.round(
      period.wholeMonths != null
        ? (annual * period.wholeMonths) / 12
        : (annual * period.days) / 365,
    );
  const scheduledDebt: Estimate =
    property.annualDebtServiceCents > 0
      ? {
          status: 'derived',
          value: prorate(property.annualDebtServiceCents),
          unit: 'cents',
          missing: [],
          basis: 'scheduled',
          note: 'Property.annualDebtService prorated to the period (months ÷ 12, or days ÷ 365).',
        }
      : noLoan
        ? {
            status: 'derived',
            value: 0,
            unit: 'cents',
            missing: [],
            basis: 'scheduled',
            note: 'No financing recorded (loan amount 0).',
          }
        : {
            status: 'unavailable',
            value: null,
            unit: 'cents',
            missing: ['annualDebtService'],
            basis: 'scheduled',
            note: 'annualDebtService is 0 by default and no zero loan amount confirms it; not treated as no debt.',
          };

  const billedRows = input.charges.filter((c) => c.kind === 'RENT' && inPeriod(c.dueDate, period));
  const billedRent = observed(
    billedRows.reduce((s, c) => s + c.amountCents, 0),
    billedRows.length,
    ledgerCoverage,
    [
      sourceRef(
        'charge',
        billedRows.map((c) => c.id),
        'RENT charges due in the period (what was billed, not collected).',
      ),
    ],
    true,
    'No lease ledger covers this period.',
  );

  // ------------------------------------------------------------------- derived actuals
  const incomeMissing = [...(usable(confirmedRent) ? [] : ['confirmedRent'])];
  const incomePartial = [
    ...incompleteness('Rent', confirmedRent),
    ...(mixedReceipts.cents ? ['mixed receipts are excluded from income until classified'] : []),
    ...(unappliedReceipts.cents
      ? ['unapplied receipts are excluded from income until classified']
      : []),
  ];
  const operatingIncomeCents = usable(confirmedRent)
    ? (confirmedRent.cents ?? 0) + (otherIncome.cents ?? 0)
    : null;
  const operatingIncome = metric(operatingIncomeCents, 'cents', incomeMissing, incomePartial);

  const expenseMissing = usable(expenseTotal) ? [] : ['expenses'];
  const expensePartial = incompleteness('Expense', expenseTotal);
  const noiCents =
    operatingIncomeCents !== null && usable(expenseTotal)
      ? operatingIncomeCents - (expenseTotal.cents ?? 0)
      : null;
  const noi = metric(
    noiCents,
    'cents',
    [...incomeMissing, ...expenseMissing],
    [...incomePartial, ...expensePartial],
  );

  const debtMissing = usable(debtActual) ? [] : ['actualDebtService'];
  const cashFlowCents =
    noiCents !== null && usable(debtActual) ? noiCents - (debtActual.cents ?? 0) : null;
  const cashFlow = metric(
    cashFlowCents,
    'cents',
    [...(noi.status === 'unavailable' ? noi.missing : []), ...debtMissing],
    noi.status === 'partial' ? noi.missing : [],
  );

  const price =
    property.purchasePriceCents && property.purchasePriceCents > 0
      ? property.purchasePriceCents
      : null;
  const invested =
    property.downPaymentCents && property.downPaymentCents > 0
      ? property.downPaymentCents
      : noLoan
        ? price
        : null;

  const ratioOf = (
    base: DerivedMetric,
    denominator: number | null,
    denominatorName: string,
  ): DerivedMetric => {
    const missing = [
      ...(base.status === 'unavailable' ? base.missing : []),
      ...(denominator ? [] : [denominatorName]),
    ];
    return metric(
      base.value !== null && denominator ? base.value / denominator : null,
      'ratio',
      missing,
      base.status === 'partial' ? base.missing : [],
    );
  };

  const expenseRatio =
    operatingIncomeCents && operatingIncomeCents > 0 && usable(expenseTotal)
      ? metric(
          (expenseTotal.cents ?? 0) / operatingIncomeCents,
          'ratio',
          [],
          [...incomePartial, ...expensePartial],
        )
      : metric(null, 'ratio', [
          ...expenseMissing,
          ...(operatingIncomeCents === null ? incomeMissing : ['positive operating income']),
        ]);

  // ------------------------------------------------------------------------- estimates
  const cashFlowAfterScheduledDebt: Estimate = {
    ...metric(
      noiCents !== null && scheduledDebt.value !== null ? noiCents - scheduledDebt.value : null,
      'cents',
      [
        ...(noi.status === 'unavailable' ? noi.missing : []),
        ...(scheduledDebt.value === null ? ['scheduledDebtService'] : []),
      ],
      noi.status === 'partial' ? noi.missing : [],
    ),
    basis: 'scheduled',
    note: 'Recorded NOI minus scheduled (not paid) debt service.',
  };
  const factor = period.wholeMonths != null ? 12 / period.wholeMonths : 365 / period.days;
  const annualizedNoi: Estimate = {
    ...metric(
      noiCents !== null ? Math.round(noiCents * factor) : null,
      'cents',
      noi.status === 'unavailable' ? noi.missing : [],
      noi.status === 'partial' ? noi.missing : [],
    ),
    basis: 'annualized',
    note: `Period NOI × ${period.wholeMonths != null ? `12 ÷ ${period.wholeMonths} months` : `365 ÷ ${period.days} days`}; seasonality is not adjusted.`,
  };
  const annualizedCapRate: Estimate = {
    ...ratioOf(annualizedNoi, price, 'purchasePrice'),
    basis: 'annualized',
    note: 'Annualized NOI ÷ recorded purchase price.',
  };

  const limitations = [
    'Cash basis: income is dated by Payment.paidAt and expenses by Expense.occurredOn (UTC days).',
    'Payments carry no category; rent is inferred only by the ledger settlement rule and only for receipts applied wholly to RENT charges.',
    'Expenses are manually entered; categories and completeness are not verified against bank records.',
    'Loan payments, capital expenditure and owner contributions are not recorded; appreciation is never included.',
  ];
  if (excluded.undatedCount)
    limitations.push(
      `${excluded.undatedCount} settled payment(s) have no paid date and are in no period.`,
    );

  return {
    version: ACTUAL_RETURNS_VERSION,
    currency: ACTUAL_CURRENCY,
    unit: 'cents',
    accountingBasis: 'cash',
    propertyId: property.id,
    propertyName: property.name,
    period: {
      from: period.from,
      to: period.to,
      days: period.days,
      wholeMonths: period.wholeMonths,
    },
    asOf: asOf.toISOString(),
    excludedAssumptions: EXCLUDED_ASSUMPTIONS,
    income: {
      confirmedRent,
      otherIncome,
      mixedReceipts,
      unappliedReceipts,
      securityDeposits,
      totalReceipts,
      receipts,
      excluded,
    },
    expenses: {
      total: expenseTotal,
      byCategory: input.expenses
        .map((e) => ({ category: e.category, cents: e.amountCents, count: e.count }))
        .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category)),
    },
    debtService: { actual: debtActual },
    actual: {
      operatingIncome,
      noi,
      cashFlow,
      expenseRatio,
      periodCapRate: ratioOf(noi, price, 'purchasePrice'),
      periodCashOnCash: ratioOf(cashFlow, invested, 'cashInvested'),
    },
    scheduled: { billedRent, debtService: scheduledDebt },
    estimates: { cashFlowAfterScheduledDebt, annualizedNoi, annualizedCapRate },
    limitations,
  };
}

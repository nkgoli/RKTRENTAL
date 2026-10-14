/**
 * Pure rental-return calculations. Everything here works on integer cents and
 * plain numbers, never touches the database and never reads the clock, so every
 * result is reproducible from its inputs. Ratios are returned as fractions
 * (0.053 means 5.3%) or `null` when the denominator is missing or not positive,
 * so callers can render an em dash instead of dividing by zero.
 *
 * Formulas (all amounts are for the same chosen period):
 * - NOI (net operating income) = income − operating expenses. Debt service,
 *   income tax and capital expenditure are excluded, by the usual definition.
 * - Cash flow = NOI − debt service for the period.
 * - Cap rate = NOI ÷ property value (purchase price). It prices the unlevered
 *   return of the property itself, independent of how it was financed.
 * - Cash-on-cash = cash flow ÷ cash invested (the down payment; when there is
 *   no financing the full purchase price is the cash invested).
 * - ROI = (cash flow + appreciation) ÷ cash invested. Appreciation defaults to
 *   3% of the property value per year, prorated by the period length, matching
 *   the assumption labelled on the returns screen. Pass `appreciationCents`
 *   explicitly to use a different figure (including 0).
 * - Yield (gross yield) = scheduled rent ÷ property value, where scheduled rent
 *   is the rent that would be collected at full occupancy for the period. It
 *   sits above the cap rate because it is measured before expenses and vacancy.
 * - Expense ratio = operating expenses ÷ income.
 */

export type Cents = number;

export type ReturnsInput = {
  /** Collected income for the period (succeeded rent payments), in cents. */
  incomeCents: Cents;
  /** Operating expenses for the period, in cents. */
  expensesCents: Cents;
  /** Debt service (mortgage payments) for the period, in cents. Defaults to 0. */
  debtServiceCents?: Cents;
  /** Property value used as the cap-rate / yield denominator (purchase price). */
  purchasePriceCents?: Cents | null;
  /** Cash actually put in (down payment). Falls back to the purchase price. */
  downPaymentCents?: Cents | null;
  /** Scheduled (full-occupancy) rent for the period, in cents. */
  scheduledRentCents?: Cents | null;
  /** Appreciation for the period, in cents. Defaults to 3%/yr of the value. */
  appreciationCents?: Cents | null;
  /** Period length in months, used to prorate the default appreciation. */
  periodMonths?: number;
};

export type ReturnsMetrics = {
  incomeCents: Cents;
  expensesCents: Cents;
  debtServiceCents: Cents;
  noiCents: Cents;
  cashFlowCents: Cents;
  expenseRatio: number | null;
  capRate: number | null;
  cashOnCash: number | null;
  roi: number | null;
  yieldRate: number | null;
  cashInvestedCents: Cents | null;
  appreciationCents: Cents;
};

function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a whole number of cents`);
}

function ratio(numerator: Cents, denominator: Cents | null | undefined): number | null {
  if (denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

/** Cash the owner put in: the down payment, or the full price when unfinanced. */
export function cashInvestedCents(input: ReturnsInput): Cents | null {
  if (input.downPaymentCents != null && input.downPaymentCents > 0) return input.downPaymentCents;
  if (input.purchasePriceCents != null && input.purchasePriceCents > 0)
    return input.purchasePriceCents;
  return null;
}

/** Net operating income: collected income minus operating expenses. */
export function computeNoi(incomeCents: Cents, expensesCents: Cents): Cents {
  assertCents(incomeCents, 'incomeCents');
  assertCents(expensesCents, 'expensesCents');
  return incomeCents - expensesCents;
}

/** Cash flow after debt service. May be negative; that is a real result. */
export function computeCashFlow(noiCents: Cents, debtServiceCents: Cents): Cents {
  assertCents(noiCents, 'noiCents');
  assertCents(debtServiceCents, 'debtServiceCents');
  return noiCents - debtServiceCents;
}

/** Cap rate = NOI / property value. Null when no positive value is known. */
export function computeCapRate(noiCents: Cents, purchasePriceCents?: Cents | null): number | null {
  return ratio(noiCents, purchasePriceCents);
}

/** Cash-on-cash = cash flow / cash invested. Null when nothing was invested. */
export function computeCashOnCash(
  cashFlowCents: Cents,
  investedCents?: Cents | null,
): number | null {
  return ratio(cashFlowCents, investedCents);
}

/**
 * ROI = (cash flow + appreciation) / cash invested. Appreciation is supplied by
 * the caller (see the 3%/yr default in {@link computeReturns}).
 */
export function computeRoi(
  cashFlowCents: Cents,
  appreciationCents: Cents,
  investedCents?: Cents | null,
): number | null {
  return ratio(cashFlowCents + appreciationCents, investedCents);
}

/** Gross yield = scheduled rent / property value. Null without a value. */
export function computeYield(
  scheduledRentCents?: Cents | null,
  purchasePriceCents?: Cents | null,
): number | null {
  if (scheduledRentCents == null) return null;
  return ratio(scheduledRentCents, purchasePriceCents);
}

/** Default appreciation: 3% of the property value per year, prorated. */
export function assumedAppreciationCents(
  purchasePriceCents?: Cents | null,
  periodMonths = 12,
): Cents {
  if (purchasePriceCents == null || purchasePriceCents <= 0) return 0;
  return Math.round(purchasePriceCents * 0.03 * (periodMonths / 12));
}

/** Every metric for one property (or a summed portfolio) over one period. */
export function computeReturns(input: ReturnsInput): ReturnsMetrics {
  const debtServiceCents = input.debtServiceCents ?? 0;
  const periodMonths = input.periodMonths ?? 12;
  const noiCents = computeNoi(input.incomeCents, input.expensesCents);
  const cashFlowCents = computeCashFlow(noiCents, debtServiceCents);
  const invested = cashInvestedCents(input);
  const appreciationCents =
    input.appreciationCents ??
    assumedAppreciationCents(input.purchasePriceCents, periodMonths);
  return {
    incomeCents: input.incomeCents,
    expensesCents: input.expensesCents,
    debtServiceCents,
    noiCents,
    cashFlowCents,
    expenseRatio: input.incomeCents > 0 ? input.expensesCents / input.incomeCents : null,
    capRate: computeCapRate(noiCents, input.purchasePriceCents),
    cashOnCash: computeCashOnCash(cashFlowCents, invested),
    roi: computeRoi(cashFlowCents, appreciationCents, invested),
    yieldRate: computeYield(input.scheduledRentCents, input.purchasePriceCents),
    cashInvestedCents: invested,
    appreciationCents,
  };
}

/** Formats a ratio fraction as a one-decimal percent, or an em dash for null. */
export function formatPercent(ratioValue: number | null | undefined): string {
  if (ratioValue == null || !Number.isFinite(ratioValue)) return '—';
  return `${(ratioValue * 100).toFixed(1)}%`;
}

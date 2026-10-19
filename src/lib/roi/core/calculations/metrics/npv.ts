import { round } from '../../../utils/index.js';

/**
 * NPV (Net Present Value) calculation
 *
 * NPV is the sum of all future cashflows discounted back to present value
 * minus the initial investment. A positive NPV indicates a profitable investment.
 */

/**
 * Calculate NPV of a series of cashflows
 *
 * @param cashflows - Array of cashflows where index 0 is initial investment (typically negative)
 * @param discountRate - Annual discount rate as decimal (e.g., 0.08 for 8%)
 * @returns Net Present Value
 *
 * @example
 * // Initial investment of $100k, then $30k/year for 5 years at 8% discount rate
 * const cashflows = [-100000, 30000, 30000, 30000, 30000, 30000];
 * const npv = calculateNPV(cashflows, 0.08); // Returns ~$19,854
 */
export function calculateNPV(cashflows: number[], discountRate: number): number {
  if (!cashflows || cashflows.length === 0) {
    return 0;
  }

  const npv = cashflows.reduce((pv, cf, t) => {
    return pv + cf / Math.pow(1 + discountRate, t);
  }, 0);

  return round(npv, 2);
}

/**
 * Calculate NPV for real estate investment including sale proceeds
 *
 * @param initialInvestment - Total cash invested (down payment + closing costs + rehab)
 * @param annualCashflows - Array of annual cash flows after debt service
 * @param saleProceeds - Net proceeds from sale after paying off loan
 * @param discountRate - Annual discount rate as decimal
 * @returns NPV of the investment
 */
export function calculateInvestmentNPV(
  initialInvestment: number,
  annualCashflows: number[],
  saleProceeds: number,
  discountRate: number,
): number {
  // Build cashflow array
  const cashflows = [-initialInvestment, ...annualCashflows];

  // Add sale proceeds to the last year
  if (cashflows.length > 1) {
    cashflows[cashflows.length - 1] += saleProceeds;
  }

  return calculateNPV(cashflows, discountRate);
}

/**
 * Calculate the present value of a single future amount
 *
 * @param futureValue - Future amount
 * @param discountRate - Annual discount rate as decimal
 * @param periods - Number of periods until the future value
 * @returns Present value
 */
export function calculatePresentValue(
  futureValue: number,
  discountRate: number,
  periods: number,
): number {
  return round(futureValue / Math.pow(1 + discountRate, periods), 2);
}

/**
 * Calculate the future value of a present amount
 *
 * @param presentValue - Present amount
 * @param rate - Annual growth rate as decimal
 * @param periods - Number of periods to compound
 * @returns Future value
 */
export function calculateFutureValue(presentValue: number, rate: number, periods: number): number {
  return round(presentValue * Math.pow(1 + rate, periods), 2);
}

/**
 * Calculate the present value of an annuity (equal periodic payments)
 *
 * @param payment - Periodic payment amount
 * @param discountRate - Annual discount rate as decimal
 * @param periods - Number of periods
 * @returns Present value of the annuity
 */
export function calculateAnnuityPV(payment: number, discountRate: number, periods: number): number {
  if (discountRate === 0) {
    return round(payment * periods, 2);
  }

  const pv = payment * ((1 - Math.pow(1 + discountRate, -periods)) / discountRate);
  return round(pv, 2);
}

/**
 * Calculate profitability index (PI)
 * PI = PV of future cashflows / Initial Investment
 * PI > 1 indicates a good investment
 *
 * @param cashflows - Array of cashflows (index 0 is initial investment)
 * @param discountRate - Annual discount rate as decimal
 * @returns Profitability Index
 */
export function calculateProfitabilityIndex(cashflows: number[], discountRate: number): number {
  if (!cashflows || cashflows.length < 2) {
    return 0;
  }

  const initialInvestment = Math.abs(cashflows[0]);
  if (initialInvestment === 0) {
    return 0;
  }

  // Calculate PV of future cashflows (excluding initial investment)
  const futureCashflows = cashflows.slice(1);
  const pvFuture = futureCashflows.reduce((pv, cf, t) => {
    return pv + cf / Math.pow(1 + discountRate, t + 1);
  }, 0);

  return round(pvFuture / initialInvestment, 4);
}

/**
 * Calculate the discount rate that would make NPV equal to a target value
 * Useful for sensitivity analysis
 *
 * @param cashflows - Array of cashflows
 * @param targetNPV - Target NPV value (usually 0 for break-even)
 * @returns Required discount rate or null if not found
 */
export function calculateRequiredDiscountRate(
  cashflows: number[],
  targetNPV: number = 0,
): number | null {
  // This is essentially finding IRR when target is 0
  // For other targets, we need to adjust the initial cashflow

  const adjustedCashflows = [...cashflows];
  adjustedCashflows[0] -= targetNPV;

  // Use bisection method to find the rate
  let low = -0.5;
  let high = 2;
  const tolerance = 1e-6;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npv = calculateNPV(adjustedCashflows, mid);

    if (Math.abs(npv) < tolerance) {
      return round(mid, 6);
    }

    if (npv > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return null;
}

import { round } from '../../../utils/index';

/**
 * IRR (Internal Rate of Return) calculation using Newton-Raphson method
 *
 * IRR is the discount rate that makes the Net Present Value (NPV) of all cashflows equal to zero.
 * It represents the annualized effective compounded return rate.
 */

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;
const DEFAULT_GUESS = 0.1; // 10% initial guess

/**
 * Calculate NPV for a given discount rate
 * @param cashflows - Array of cashflows (index 0 is initial investment, typically negative)
 * @param rate - Annual discount rate as decimal (e.g., 0.1 for 10%)
 * @returns Net Present Value
 */
export function calculateNPVForRate(cashflows: number[], rate: number): number {
  return cashflows.reduce((npv, cf, t) => {
    return npv + cf / Math.pow(1 + rate, t);
  }, 0);
}

/**
 * Calculate derivative of NPV with respect to rate (for Newton-Raphson)
 * @param cashflows - Array of cashflows
 * @param rate - Annual discount rate as decimal
 * @returns Derivative of NPV
 */
function calculateNPVDerivative(cashflows: number[], rate: number): number {
  return cashflows.reduce((derivative, cf, t) => {
    if (t === 0) return derivative;
    return derivative - (t * cf) / Math.pow(1 + rate, t + 1);
  }, 0);
}

/**
 * Check if cashflows have at least one sign change (required for IRR to exist)
 * @param cashflows - Array of cashflows
 * @returns true if there's at least one sign change
 */
function hasSignChange(cashflows: number[]): boolean {
  let positiveFound = false;
  let negativeFound = false;

  for (const cf of cashflows) {
    if (cf > 0) positiveFound = true;
    if (cf < 0) negativeFound = true;
    if (positiveFound && negativeFound) return true;
  }

  return false;
}

/**
 * Calculate IRR using Newton-Raphson iteration method
 *
 * @param cashflows - Array of cashflows where index 0 is initial investment (typically negative)
 *                    and subsequent values are periodic returns
 * @param guess - Initial guess for IRR (default 10%)
 * @returns IRR as decimal (e.g., 0.15 for 15%) or null if IRR cannot be calculated
 *
 * @example
 * // Initial investment of $100k, then $30k/year for 5 years
 * const cashflows = [-100000, 30000, 30000, 30000, 30000, 30000];
 * const irr = calculateIRR(cashflows); // Returns ~0.1525 (15.25%)
 */
export function calculateIRR(cashflows: number[], guess: number = DEFAULT_GUESS): number | null {
  // Validate inputs
  if (!cashflows || cashflows.length < 2) {
    return null;
  }

  // Check for sign change (required for IRR to exist)
  if (!hasSignChange(cashflows)) {
    return null;
  }

  let rate = guess;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const npv = calculateNPVForRate(cashflows, rate);
    const derivative = calculateNPVDerivative(cashflows, rate);

    // Avoid division by zero
    if (Math.abs(derivative) < 1e-10) {
      // Try a different approach - bisection fallback
      return calculateIRRBisection(cashflows);
    }

    const newRate = rate - npv / derivative;

    // Check for convergence
    if (Math.abs(newRate - rate) < TOLERANCE) {
      // Validate result is reasonable (-100% to 1000%)
      if (newRate > -1 && newRate < 10) {
        return round(newRate, 6);
      }
      return null;
    }

    rate = newRate;

    // Prevent rate from going too extreme
    if (rate < -0.99) rate = -0.99;
    if (rate > 10) rate = 10;
  }

  // If Newton-Raphson didn't converge, try bisection
  return calculateIRRBisection(cashflows);
}

/**
 * Calculate IRR using bisection method (fallback for difficult cases)
 * More robust but slower than Newton-Raphson
 */
function calculateIRRBisection(cashflows: number[]): number | null {
  let low = -0.99;
  let high = 10;

  // Check if solution exists in range
  const npvLow = calculateNPVForRate(cashflows, low);
  const npvHigh = calculateNPVForRate(cashflows, high);

  if (npvLow * npvHigh > 0) {
    // No sign change in range, IRR may not exist or is outside range
    return null;
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const npvMid = calculateNPVForRate(cashflows, mid);

    if (Math.abs(npvMid) < TOLERANCE || (high - low) / 2 < TOLERANCE) {
      return round(mid, 6);
    }

    if (npvMid * calculateNPVForRate(cashflows, low) < 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return null;
}

/**
 * Calculate leveraged IRR (includes financing)
 * Uses actual cashflows after debt service and sale proceeds after loan payoff
 *
 * @param initialInvestment - Total cash invested (down payment + closing costs + rehab)
 * @param annualCashflows - Array of annual cash flows after debt service
 * @param saleProceeds - Net proceeds from sale after paying off loan
 * @returns Leveraged IRR as decimal or null
 */
export function calculateLeveragedIRR(
  initialInvestment: number,
  annualCashflows: number[],
  saleProceeds: number,
): number | null {
  // Build cashflow array: -initial, cf1, cf2, ..., cfN + saleProceeds
  const cashflows = [-initialInvestment, ...annualCashflows];

  // Add sale proceeds to the last year's cashflow
  if (cashflows.length > 1) {
    cashflows[cashflows.length - 1] += saleProceeds;
  }

  return calculateIRR(cashflows);
}

/**
 * Calculate unleveraged IRR (all-cash purchase, no financing)
 * Uses NOI as cashflow and full property value at sale
 *
 * @param purchasePrice - Total purchase price (no loan)
 * @param annualNOI - Array of annual Net Operating Income
 * @param salePrice - Gross sale price (before selling costs)
 * @param sellingCosts - Selling costs (agent fees, closing costs)
 * @returns Unleveraged IRR as decimal or null
 */
export function calculateUnleveragedIRR(
  purchasePrice: number,
  annualNOI: number[],
  salePrice: number,
  sellingCosts: number,
): number | null {
  // Build cashflow array: -purchase, noi1, noi2, ..., noiN + (salePrice - sellingCosts)
  const cashflows = [-purchasePrice, ...annualNOI];

  // Add net sale proceeds to the last year's NOI
  if (cashflows.length > 1) {
    cashflows[cashflows.length - 1] += salePrice - sellingCosts;
  }

  return calculateIRR(cashflows);
}

/**
 * Calculate Modified IRR (MIRR)
 * Assumes reinvestment at a specified rate rather than the IRR itself
 * More realistic for comparing investments with different risk profiles
 *
 * @param cashflows - Array of cashflows
 * @param financeRate - Rate paid on negative cashflows (cost of capital)
 * @param reinvestRate - Rate earned on positive cashflows
 * @returns MIRR as decimal or null
 */
export function calculateMIRR(
  cashflows: number[],
  financeRate: number,
  reinvestRate: number,
): number | null {
  if (!cashflows || cashflows.length < 2) {
    return null;
  }

  const n = cashflows.length - 1;

  // Calculate present value of negative cashflows (discounted at finance rate)
  let pvNegative = 0;
  // Calculate future value of positive cashflows (compounded at reinvest rate)
  let fvPositive = 0;

  for (let t = 0; t <= n; t++) {
    const cf = cashflows[t];
    if (cf < 0) {
      pvNegative += cf / Math.pow(1 + financeRate, t);
    } else {
      fvPositive += cf * Math.pow(1 + reinvestRate, n - t);
    }
  }

  // MIRR formula: (FV of positives / |PV of negatives|)^(1/n) - 1
  if (pvNegative >= 0 || fvPositive <= 0) {
    return null;
  }

  const mirr = Math.pow(fvPositive / Math.abs(pvNegative), 1 / n) - 1;

  return round(mirr, 6);
}

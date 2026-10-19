import { round } from '../../../utils/index';

/**
 * Advanced return metrics for real estate investment analysis
 */

/**
 * Calculate Equity Multiple
 * Total cash returned divided by total cash invested
 * A multiple > 1 means you made money, > 2 means you doubled your investment
 *
 * @param totalCashInvested - Initial investment (down payment + closing + rehab)
 * @param totalCashReturned - Sum of all cashflows + sale proceeds
 * @returns Equity Multiple (e.g., 2.5 means 2.5x return)
 */
export function calculateEquityMultiple(
  totalCashInvested: number,
  totalCashReturned: number,
): number {
  if (totalCashInvested <= 0) return 0;
  return round(totalCashReturned / totalCashInvested, 2);
}

/**
 * Calculate Equity Multiple from cashflows
 *
 * @param initialInvestment - Total cash invested
 * @param annualCashflows - Array of annual cash flows
 * @param saleProceeds - Net proceeds from sale
 * @returns Equity Multiple
 */
export function calculateEquityMultipleFromCashflows(
  initialInvestment: number,
  annualCashflows: number[],
  saleProceeds: number,
): number {
  const totalCashflows = annualCashflows.reduce((sum, cf) => sum + cf, 0);
  const totalReturned = totalCashflows + saleProceeds;
  return calculateEquityMultiple(initialInvestment, totalReturned);
}

/**
 * Calculate Total Return (absolute profit/loss)
 *
 * @param initialInvestment - Total cash invested
 * @param annualCashflows - Array of annual cash flows
 * @param saleProceeds - Net proceeds from sale
 * @returns Total profit or loss in dollars
 */
export function calculateTotalReturn(
  initialInvestment: number,
  annualCashflows: number[],
  saleProceeds: number,
): number {
  const totalCashflows = annualCashflows.reduce((sum, cf) => sum + cf, 0);
  return round(totalCashflows + saleProceeds - initialInvestment, 2);
}

/**
 * Calculate Total Return Percentage
 *
 * @param initialInvestment - Total cash invested
 * @param totalReturn - Total profit/loss
 * @returns Return as percentage (decimal, e.g., 0.25 for 25%)
 */
export function calculateTotalReturnPercent(
  initialInvestment: number,
  totalReturn: number,
): number {
  if (initialInvestment <= 0) return 0;
  return round(totalReturn / initialInvestment, 4);
}

/**
 * Calculate Average Annual Return
 * Simple average, not accounting for compounding
 *
 * @param totalReturnPercent - Total return as decimal
 * @param holdingPeriodYears - Number of years held
 * @returns Average annual return as decimal
 */
export function calculateAverageAnnualReturn(
  totalReturnPercent: number,
  holdingPeriodYears: number,
): number {
  if (holdingPeriodYears <= 0) return 0;
  return round(totalReturnPercent / holdingPeriodYears, 4);
}

/**
 * Calculate Break-even Occupancy Rate
 * The minimum occupancy rate needed to cover all expenses and debt service
 *
 * @param grossPotentialRent - Annual rent at 100% occupancy
 * @param operatingExpenses - Annual operating expenses
 * @param debtService - Annual debt service (mortgage payments)
 * @returns Break-even occupancy as decimal (e.g., 0.75 for 75%)
 */
export function calculateBreakEvenOccupancy(
  grossPotentialRent: number,
  operatingExpenses: number,
  debtService: number,
): number {
  if (grossPotentialRent <= 0) return 1; // 100% occupancy required if no rent

  const totalRequiredIncome = operatingExpenses + debtService;
  const breakEven = totalRequiredIncome / grossPotentialRent;

  // Cap at 100% - if break-even > 100%, property is underwater
  return round(Math.min(breakEven, 1), 4);
}

/**
 * Calculate Break-even Rent
 * The minimum rent needed to cover all expenses and debt service
 *
 * @param operatingExpenses - Annual operating expenses
 * @param debtService - Annual debt service
 * @param vacancyRate - Expected vacancy rate as decimal
 * @returns Required annual rent (or monthly if divided by 12)
 */
export function calculateBreakEvenRent(
  operatingExpenses: number,
  debtService: number,
  vacancyRate: number,
): number {
  const effectiveRentRate = 1 - vacancyRate;
  if (effectiveRentRate <= 0) return Infinity;

  const requiredGrossRent = (operatingExpenses + debtService) / effectiveRentRate;
  return round(requiredGrossRent, 2);
}

/**
 * Calculate Payback Period
 * Number of years to recover initial investment from cashflows alone
 * Does not account for sale proceeds or time value of money
 *
 * @param initialInvestment - Total cash invested
 * @param annualCashflows - Array of annual cash flows
 * @returns Years to payback (can be fractional, null if never pays back)
 */
export function calculatePaybackPeriod(
  initialInvestment: number,
  annualCashflows: number[],
): number | null {
  if (initialInvestment <= 0) return 0;

  let cumulativeCashflow = 0;

  for (let year = 0; year < annualCashflows.length; year++) {
    const previousCumulative = cumulativeCashflow;
    cumulativeCashflow += annualCashflows[year];

    if (cumulativeCashflow >= initialInvestment) {
      // Calculate fractional year
      const remaining = initialInvestment - previousCumulative;
      const yearlyContribution = annualCashflows[year];

      if (yearlyContribution > 0) {
        const fractionalYear = remaining / yearlyContribution;
        return round(year + fractionalYear, 2);
      }

      return year + 1;
    }
  }

  // Never pays back within the holding period
  return null;
}

/**
 * Calculate Discounted Payback Period
 * Number of years to recover initial investment using discounted cashflows
 *
 * @param initialInvestment - Total cash invested
 * @param annualCashflows - Array of annual cash flows
 * @param discountRate - Annual discount rate as decimal
 * @returns Years to payback (can be fractional, null if never pays back)
 */
export function calculateDiscountedPaybackPeriod(
  initialInvestment: number,
  annualCashflows: number[],
  discountRate: number,
): number | null {
  if (initialInvestment <= 0) return 0;

  let cumulativeDiscountedCashflow = 0;

  for (let year = 0; year < annualCashflows.length; year++) {
    const previousCumulative = cumulativeDiscountedCashflow;
    const discountedCashflow = annualCashflows[year] / Math.pow(1 + discountRate, year + 1);
    cumulativeDiscountedCashflow += discountedCashflow;

    if (cumulativeDiscountedCashflow >= initialInvestment) {
      // Calculate fractional year
      const remaining = initialInvestment - previousCumulative;

      if (discountedCashflow > 0) {
        const fractionalYear = remaining / discountedCashflow;
        return round(year + fractionalYear, 2);
      }

      return year + 1;
    }
  }

  return null;
}

/**
 * Calculate Return on Equity (ROE)
 * Annual cashflow divided by current equity
 *
 * @param annualCashflow - Annual cash flow after debt service
 * @param currentEquity - Current equity in the property
 * @returns ROE as decimal
 */
export function calculateReturnOnEquity(annualCashflow: number, currentEquity: number): number {
  if (currentEquity <= 0) return 0;
  return round(annualCashflow / currentEquity, 4);
}

/**
 * Calculate the 1% Rule
 * Monthly rent should be >= 1% of purchase price for a good deal
 *
 * @param monthlyRent - Monthly rent amount
 * @param purchasePrice - Purchase price of property
 * @returns Rent to price ratio as percentage (e.g., 0.01 = 1%)
 */
export function calculateRentToPrice(monthlyRent: number, purchasePrice: number): number {
  if (purchasePrice <= 0) return 0;
  return round(monthlyRent / purchasePrice, 4);
}

/**
 * Check if property meets the 1% rule
 *
 * @param monthlyRent - Monthly rent amount
 * @param purchasePrice - Purchase price of property
 * @returns true if rent >= 1% of purchase price
 */
export function meetsOnePercentRule(monthlyRent: number, purchasePrice: number): boolean {
  return calculateRentToPrice(monthlyRent, purchasePrice) >= 0.01;
}

/**
 * Calculate the 50% Rule estimate for expenses
 * Estimates that 50% of gross rent goes to expenses (excluding mortgage)
 *
 * @param grossMonthlyRent - Gross monthly rent
 * @returns Estimated monthly expenses
 */
export function estimateExpensesFiftyPercent(grossMonthlyRent: number): number {
  return round(grossMonthlyRent * 0.5, 2);
}

/**
 * Calculate the 70% Rule for flipping
 * Maximum purchase price = (ARV × 70%) - Repair Costs
 *
 * @param afterRepairValue - Expected value after repairs
 * @param repairCosts - Estimated repair costs
 * @returns Maximum purchase price for 30% margin
 */
export function calculateMaxPurchasePrice(afterRepairValue: number, repairCosts: number): number {
  return round(afterRepairValue * 0.7 - repairCosts, 2);
}

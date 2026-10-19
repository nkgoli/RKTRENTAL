import { round, fromPercent } from '../../../utils/index.js';
import type { DealInput } from '../../domain/schemas/deal-input.schema.js';

/**
 * Calculate total cash required at closing
 */
export function calculateTotalCashRequired(input: DealInput): number {
  const downPayment = input.purchase.purchasePrice - calculateLoanAmount(input);
  const closingCosts = input.purchase.closingCosts;
  const rehabCosts = input.purchase.rehabCosts;
  const furnishingCosts = input.purchase.furnishingCosts;

  // Points on the loan
  const loanAmount = calculateLoanAmount(input);
  const pointsCost = loanAmount * fromPercent(input.financing.pointsPaid);
  const lenderFees = input.financing.lenderFees;

  return round(
    downPayment + closingCosts + rehabCosts + furnishingCosts + pointsCost + lenderFees,
    2,
  );
}

/**
 * Calculate loan amount
 */
export function calculateLoanAmount(input: DealInput): number {
  if (input.financing.loanAmount !== undefined) {
    return input.financing.loanAmount;
  }
  const downPayment =
    input.purchase.purchasePrice * fromPercent(input.financing.downPaymentPercent);
  return round(input.purchase.purchasePrice - downPayment, 2);
}

/**
 * Calculate Cap Rate
 * Cap Rate = NOI / Purchase Price
 */
export function calculateCapRate(noi: number, purchasePrice: number): number {
  if (purchasePrice === 0) return 0;
  return round(noi / purchasePrice, 4);
}

/**
 * Calculate Cash-on-Cash Return
 * CoC = Annual Cash Flow / Total Cash Invested
 */
export function calculateCashOnCash(annualCashFlow: number, totalCashInvested: number): number {
  if (totalCashInvested === 0) return 0;
  return round(annualCashFlow / totalCashInvested, 4);
}

/**
 * Calculate Gross Rent Multiplier (GRM)
 * GRM = Purchase Price / Annual Gross Rent
 */
export function calculateGRM(purchasePrice: number, annualGrossRent: number): number {
  if (annualGrossRent === 0) return 0;
  return round(purchasePrice / annualGrossRent, 2);
}

/**
 * Calculate Debt Service Coverage Ratio (DSCR)
 * DSCR = NOI / Annual Debt Service
 */
export function calculateDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService === 0) return Infinity;
  return round(noi / annualDebtService, 2);
}

import { round } from '../../utils/index.js';
import { DealInputSchema, type DealInput } from '../domain/schemas/deal-input.schema.js';
import type { AnalysisResult, SummaryMetrics } from '../domain/schemas/analysis-result.schema.js';
import {
  calculateIncomeBreakdown,
  calculateExpenseBreakdown,
  calculateNOI,
  calculateOER,
} from '../calculations/metrics/noi.js';
import {
  calculateTotalCashRequired,
  calculateLoanAmount,
  calculateCapRate,
  calculateCashOnCash,
  calculateGRM,
  calculateDSCR,
} from '../calculations/metrics/returns.js';
import { calculateLeveragedIRR, calculateUnleveragedIRR } from '../calculations/metrics/irr.js';
import {
  calculateInvestmentNPV,
  calculateProfitabilityIndex,
} from '../calculations/metrics/npv.js';
import {
  calculateEquityMultipleFromCashflows,
  calculateTotalReturn,
  calculateTotalReturnPercent,
  calculateAverageAnnualReturn,
  calculateBreakEvenOccupancy,
  calculatePaybackPeriod,
  calculateRentToPrice,
} from '../calculations/metrics/advanced-returns.js';
import { generateAmortizationSchedule } from '../calculations/projections/amortization.js';
import {
  generateMonthlyCashflows,
  generateAnnualCashflows,
} from '../calculations/projections/cashflows.js';
import {
  generateEquityTimeline,
  calculateSaleProceeds,
} from '../calculations/projections/equity.js';
import { evaluateWarnings } from './warnings.js';

const DEFAULT_DISCOUNT_RATE = 0.08; // 8% default discount rate for NPV

export interface AnalysisOptions {
  /** Discount rate for NPV calculation (as decimal, e.g., 0.08 for 8%) */
  discountRate?: number;
  /** Include tax analysis */
  includeTaxAnalysis?: boolean;
  /** Include explainability steps */
  includeExplainability?: boolean;
  /** Start date for projections */
  startDate?: Date;
}

/**
 * Main analysis function - orchestrates all calculations
 */
export function analyze(input: DealInput, options: AnalysisOptions = {}): AnalysisResult {
  const startTime = 0;
  const { startDate = new Date('2000-01-01T00:00:00Z') } = options;

  // 1. Validate input
  const validatedInput = DealInputSchema.parse(input);

  // 2. Calculate base values
  const loanAmount = calculateLoanAmount(validatedInput);
  const totalCashRequired = calculateTotalCashRequired(validatedInput);

  // 3. Generate amortization schedule
  const amortization = generateAmortizationSchedule(validatedInput, loanAmount, startDate);

  // 4. Calculate income and expense breakdowns (Year 1)
  const incomeBreakdown = calculateIncomeBreakdown(validatedInput);
  const expenseBreakdown = calculateExpenseBreakdown(
    validatedInput,
    incomeBreakdown.effectiveGrossIncome,
  );

  // 5. Calculate Year 1 metrics
  const noi = calculateNOI(incomeBreakdown.effectiveGrossIncome, expenseBreakdown.total);
  const oer = calculateOER(expenseBreakdown.total, incomeBreakdown.effectiveGrossIncome);
  const capRate = calculateCapRate(noi, validatedInput.purchase.purchasePrice);
  const grm = calculateGRM(
    validatedInput.purchase.purchasePrice,
    incomeBreakdown.grossRent + incomeBreakdown.otherIncome,
  );

  const annualDebtService = round(
    amortization.schedule.slice(0, 12).reduce((sum, entry) => sum + entry.payment, 0),
    2,
  );
  const dscr = calculateDSCR(noi, annualDebtService);

  const annualCashFlow = round(noi - annualDebtService - expenseBreakdown.capex, 2);
  const monthlyCashFlow = round(annualCashFlow / 12, 2);
  const cashOnCash = calculateCashOnCash(annualCashFlow, totalCashRequired);

  // 6. Generate projections
  const monthlyCashflows = generateMonthlyCashflows(
    validatedInput,
    incomeBreakdown,
    expenseBreakdown,
    amortization.schedule,
    startDate,
  );

  const annualCashflows = generateAnnualCashflows(
    validatedInput,
    monthlyCashflows,
    amortization.schedule,
    loanAmount,
  );

  const equityTimeline = generateEquityTimeline(
    validatedInput,
    loanAmount,
    totalCashRequired,
    amortization.schedule,
  );

  // 7. Calculate advanced metrics
  const discountRate = options.discountRate ?? DEFAULT_DISCOUNT_RATE;
  const holdingPeriod = validatedInput.appreciationExit.holdingPeriodYears;

  // Get final year data for sale calculations
  const finalEquity = equityTimeline[equityTimeline.length - 1];

  // Calculate sale proceeds
  const saleProceeds = calculateSaleProceeds(
    validatedInput,
    finalEquity?.propertyValue || validatedInput.purchase.purchasePrice,
    finalEquity?.loanBalance || 0,
  );

  // Extract annual cashflows array for calculations
  const annualCashflowValues = annualCashflows.map((y) => y.cashFlow);
  const annualNOIValues = annualCashflows.map((y) => y.noi);

  // Calculate IRR (leveraged and unleveraged)
  const irrLeveraged = calculateLeveragedIRR(
    totalCashRequired,
    annualCashflowValues,
    saleProceeds.netProceeds,
  );

  const irrUnleveraged = calculateUnleveragedIRR(
    validatedInput.purchase.purchasePrice +
      validatedInput.purchase.closingCosts +
      validatedInput.purchase.rehabCosts +
      validatedInput.purchase.furnishingCosts,
    annualNOIValues,
    saleProceeds.grossSalePrice,
    saleProceeds.sellingCosts,
  );

  // Calculate NPV
  const npvCashflows = [-totalCashRequired, ...annualCashflowValues];
  npvCashflows[npvCashflows.length - 1] += saleProceeds.netProceeds;
  const npv = calculateInvestmentNPV(
    totalCashRequired,
    annualCashflowValues,
    saleProceeds.netProceeds,
    discountRate,
  );

  // Calculate profitability index
  const profitabilityIndex = calculateProfitabilityIndex(npvCashflows, discountRate);

  // Calculate equity multiple and total return
  const equityMultiple = calculateEquityMultipleFromCashflows(
    totalCashRequired,
    annualCashflowValues,
    saleProceeds.netProceeds,
  );

  const totalReturnDollars = calculateTotalReturn(
    totalCashRequired,
    annualCashflowValues,
    saleProceeds.netProceeds,
  );

  const totalReturnPercent = calculateTotalReturnPercent(totalCashRequired, totalReturnDollars);
  const averageAnnualReturn = calculateAverageAnnualReturn(totalReturnPercent, holdingPeriod);

  // Calculate break-even occupancy
  const grossPotentialRent = incomeBreakdown.grossRent + incomeBreakdown.otherIncome;
  const breakEvenOccupancy = calculateBreakEvenOccupancy(
    grossPotentialRent,
    expenseBreakdown.total,
    annualDebtService,
  );

  // Calculate payback period
  const paybackPeriodYears = calculatePaybackPeriod(totalCashRequired, annualCashflowValues);

  // Calculate rent to price ratio (1% rule)
  const rentToPrice = calculateRentToPrice(
    validatedInput.income.monthlyRent,
    validatedInput.purchase.purchasePrice,
  );

  // 8. Build summary metrics
  const summaryMetrics: SummaryMetrics = {
    // Income metrics
    grossPotentialIncome: grossPotentialRent,
    effectiveGrossIncome: incomeBreakdown.effectiveGrossIncome,
    totalOperatingExpenses: expenseBreakdown.total,
    noi,
    oer,

    // Purchase metrics
    purchasePrice: validatedInput.purchase.purchasePrice,
    totalCashRequired,
    loanAmount,
    monthlyDebtService: amortization.monthlyPayment,
    annualDebtService,

    // Return metrics
    capRate,
    cashOnCash,
    grm,
    dscr,

    // Cash flow
    monthlyCashFlow,
    annualCashFlow,

    // Advanced return metrics
    irrLeveraged,
    irrUnleveraged,
    npv,
    npvDiscountRate: discountRate,
    equityMultiple,
    totalReturn: totalReturnDollars,
    totalReturnPercent,
    averageAnnualReturn,
    breakEvenOccupancy,
    paybackPeriodYears,
    rentToPrice,
    profitabilityIndex,

    // Tax-aware metrics (when enabled)
  };

  // 9. Evaluate warnings
  const warnings = evaluateWarnings(validatedInput, summaryMetrics);

  // 10. Build result
  const computeTimeMs = startTime;

  return {
    summaryMetrics,
    monthlyCashflows,
    annualCashflows,
    amortizationSchedule: amortization.schedule,
    equityTimeline,
    expenseBreakdown,
    incomeBreakdown,
    warnings,
    explainability: [], // To be implemented
    computedAt: new Date(startDate),
    computeTimeMs: round(computeTimeMs, 2),
  };
}

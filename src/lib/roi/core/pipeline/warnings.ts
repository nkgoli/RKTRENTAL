import type { DealInput } from '../domain/schemas/deal-input.schema';
import type { Warning, SummaryMetrics } from '../domain/schemas/analysis-result.schema';
import { calculateLoanAmount } from '../calculations/metrics/returns';

/**
 * Evaluate input and metrics to generate warnings
 */
export function evaluateWarnings(input: DealInput, metrics: SummaryMetrics): Warning[] {
  const warnings: Warning[] = [];
  const loanAmount = calculateLoanAmount(input);

  // DSCR warning
  if (metrics.dscr < 1.0 && metrics.dscr !== Infinity) {
    warnings.push({
      code: 'LOW_DSCR',
      severity: 'error',
      message: `DSCR of ${metrics.dscr.toFixed(2)} is below 1.0, meaning NOI doesn't cover debt service. This property has negative cash flow.`,
      field: 'financing',
      suggestion: 'Consider a larger down payment or lower purchase price to improve cash flow.',
    });
  } else if (metrics.dscr < 1.25 && metrics.dscr !== Infinity) {
    warnings.push({
      code: 'MARGINAL_DSCR',
      severity: 'warning',
      message: `DSCR of ${metrics.dscr.toFixed(2)} is below the typical lender minimum of 1.25.`,
      field: 'financing',
      suggestion:
        'Many lenders require DSCR of 1.25+. Consider improving income or reducing loan amount.',
    });
  }

  // Negative cash flow warning
  if (metrics.annualCashFlow < 0) {
    warnings.push({
      code: 'NEGATIVE_CASH_FLOW',
      severity: 'warning',
      message: `Annual cash flow is negative ($${Math.abs(metrics.annualCashFlow).toLocaleString()}). You will need to contribute additional funds each year.`,
      field: 'income',
    });
  }

  // High vacancy rate
  if (input.income.vacancyRate > 10) {
    warnings.push({
      code: 'HIGH_VACANCY',
      severity: 'info',
      message: `Vacancy rate of ${input.income.vacancyRate}% is higher than typical (5-8%). Verify this is appropriate for your market.`,
      field: 'income.vacancyRate',
    });
  }

  // Very low vacancy rate
  if (input.income.vacancyRate < 3 && input.income.monthlyRent > 0) {
    warnings.push({
      code: 'LOW_VACANCY',
      severity: 'info',
      message: `Vacancy rate of ${input.income.vacancyRate}% may be optimistic. Consider using 5% or higher for conservative projections.`,
      field: 'income.vacancyRate',
    });
  }

  // High expense ratio
  if (metrics.oer > 0.6) {
    warnings.push({
      code: 'HIGH_OER',
      severity: 'warning',
      message: `Operating expense ratio of ${(metrics.oer * 100).toFixed(1)}% is high. Typical range is 35-50%.`,
      field: 'expenses',
      suggestion: 'Review expenses or verify income assumptions.',
    });
  }

  // Very low cap rate
  if (metrics.capRate > 0 && metrics.capRate < 0.04) {
    warnings.push({
      code: 'LOW_CAP_RATE',
      severity: 'info',
      message: `Cap rate of ${(metrics.capRate * 100).toFixed(2)}% is low. This indicates a premium price relative to income.`,
      field: 'purchase.purchasePrice',
    });
  }

  // High interest rate
  if (
    loanAmount > 0 &&
    input.financing.interestRate !== undefined &&
    input.financing.interestRate > 10
  ) {
    warnings.push({
      code: 'HIGH_INTEREST_RATE',
      severity: 'warning',
      message: `Interest rate of ${input.financing.interestRate}% is high. Consider shopping for better financing options.`,
      field: 'financing.interestRate',
    });
  }

  // Low down payment (high LTV)
  const downPaymentPercent = (1 - loanAmount / input.purchase.purchasePrice) * 100;
  if (loanAmount > 0 && downPaymentPercent < 20 && input.financing.loanType === 'conventional') {
    warnings.push({
      code: 'LOW_DOWN_PAYMENT',
      severity: 'info',
      message: `Down payment of ${Number(downPaymentPercent.toFixed(2))}% may require PMI for conventional loans.`,
      field:
        input.financing.loanAmount === undefined
          ? 'financing.downPaymentPercent'
          : 'financing.loanAmount',
    });
  }

  // Unrealistic appreciation
  if (input.appreciationExit.annualAppreciation > 7) {
    warnings.push({
      code: 'HIGH_APPRECIATION',
      severity: 'warning',
      message: `Annual appreciation of ${input.appreciationExit.annualAppreciation}% is above historical averages (3-4%). Consider using more conservative estimates.`,
      field: 'appreciationExit.annualAppreciation',
    });
  }

  // Long holding period
  if (input.appreciationExit.holdingPeriodYears > 15) {
    warnings.push({
      code: 'LONG_HOLD',
      severity: 'info',
      message: `${input.appreciationExit.holdingPeriodYears}-year holding period is long. Projections become less reliable over extended periods.`,
      field: 'appreciationExit.holdingPeriodYears',
    });
  }

  // Missing rent
  if (input.income.monthlyRent === 0) {
    warnings.push({
      code: 'NO_RENT',
      severity: 'error',
      message: 'Monthly rent is $0. Please enter the expected rental income.',
      field: 'income.monthlyRent',
    });
  }

  // No expenses
  const totalExpenses = metrics.totalOperatingExpenses;
  if (totalExpenses === 0 && input.income.monthlyRent > 0) {
    warnings.push({
      code: 'NO_EXPENSES',
      severity: 'warning',
      message:
        'Operating expenses are $0. All properties have some expenses (taxes, insurance, maintenance).',
      field: 'expenses',
      suggestion: 'Add property tax, insurance, and maintenance estimates.',
    });
  }

  // Unrealistic after-tax returns (sanity check for tax calculation bugs)
  if (metrics.afterTaxCashOnCash !== undefined) {
    const taxBenefit = metrics.afterTaxCashOnCash - metrics.cashOnCash;
    // Tax benefit from depreciation typically adds 1-5% to CoC, rarely more than 10%
    if (Math.abs(taxBenefit) > 0.15) {
      warnings.push({
        code: 'UNREALISTIC_TAX_BENEFIT',
        severity: 'error',
        message: `Tax benefit of ${(taxBenefit * 100).toFixed(1)}% seems unrealistic. Please verify tax settings.`,
        field: 'taxes',
        suggestion:
          'Check depreciation period (should be 27.5 years for residential, 39 for commercial).',
      });
    }
  }

  return warnings;
}

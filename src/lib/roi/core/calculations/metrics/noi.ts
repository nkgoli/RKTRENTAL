import { round, fromPercent } from '../../../utils/index';
import type { DealInput } from '../../domain/schemas/deal-input.schema';
import type {
  IncomeBreakdown,
  ExpenseBreakdown,
} from '../../domain/schemas/analysis-result.schema';

/**
 * Calculate income breakdown for Year 1
 */
export function calculateIncomeBreakdown(input: DealInput): IncomeBreakdown {
  const annualGrossRent = input.income.monthlyRent * 12;
  const annualOtherIncome = input.income.otherMonthlyIncome * 12;
  const grossPotentialIncome = annualGrossRent + annualOtherIncome;

  const vacancyRate = fromPercent(input.income.vacancyRate);
  const vacancyLoss = round(grossPotentialIncome * vacancyRate, 2);
  const effectiveGrossIncome = round(grossPotentialIncome - vacancyLoss, 2);

  return {
    grossRent: annualGrossRent,
    otherIncome: annualOtherIncome,
    vacancyLoss,
    effectiveGrossIncome,
  };
}

/**
 * Calculate expense breakdown for Year 1
 */
export function calculateExpenseBreakdown(
  input: DealInput,
  effectiveGrossIncome: number,
): ExpenseBreakdown {
  const grossRent = input.income.monthlyRent * 12;

  // Property tax and insurance are direct inputs
  const propertyTax = input.expenses.propertyTax;
  const insurance = input.expenses.insurance;
  const hoa = input.expenses.hoaMonthly * 12;

  // Maintenance - use dollar amount if provided, otherwise calculate from percentage
  const maintenance =
    input.expenses.maintenance !== undefined
      ? input.expenses.maintenance
      : round(grossRent * fromPercent(input.expenses.maintenancePercent), 2);

  // CapEx - use dollar amount if provided, otherwise calculate from percentage
  const capex =
    input.expenses.capex !== undefined
      ? input.expenses.capex
      : round(grossRent * fromPercent(input.expenses.capexPercent), 2);

  // Property management - use dollar amount if provided, otherwise calculate from percentage of EGI
  const propertyManagement =
    input.expenses.propertyManagement !== undefined
      ? input.expenses.propertyManagement
      : round(effectiveGrossIncome * fromPercent(input.expenses.propertyManagementPercent), 2);

  const utilities = input.expenses.utilitiesMonthly * 12;
  const leasing = input.expenses.leasingCosts;
  const other = input.expenses.otherExpenses;

  const total = round(
    propertyTax + insurance + hoa + maintenance + propertyManagement + utilities + leasing + other,
    2,
  );

  return {
    propertyTax,
    insurance,
    hoa,
    maintenance,
    capex,
    propertyManagement,
    utilities,
    leasing,
    other,
    total,
  };
}

/**
 * Calculate Net Operating Income (NOI)
 * NOI = Effective Gross Income - Operating Expenses
 */
export function calculateNOI(effectiveGrossIncome: number, totalOperatingExpenses: number): number {
  return round(effectiveGrossIncome - totalOperatingExpenses, 2);
}

/**
 * Calculate Operating Expense Ratio (OER)
 * OER = Operating Expenses / Effective Gross Income
 */
export function calculateOER(totalOperatingExpenses: number, effectiveGrossIncome: number): number {
  if (effectiveGrossIncome === 0) return 0;
  return round(totalOperatingExpenses / effectiveGrossIncome, 4);
}

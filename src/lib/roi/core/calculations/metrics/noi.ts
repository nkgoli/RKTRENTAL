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
  function cost(fixed: number | undefined, percent: number | undefined, basis: number) {
    if (fixed !== undefined) return fixed;
    if (percent === undefined) throw new Error('Enter a fixed annual cost or percentage.');
    return round(basis * fromPercent(percent), 2);
  }

  // Maintenance - use dollar amount if provided, otherwise calculate from percentage
  const maintenance = cost(
    input.expenses.maintenance,
    input.expenses.maintenancePercent,
    grossRent,
  );

  // CapEx - use dollar amount if provided, otherwise calculate from percentage
  const capex = cost(input.expenses.capex, input.expenses.capexPercent, grossRent);

  // Property management - use dollar amount if provided, otherwise calculate from percentage of EGI
  const propertyManagement = cost(
    input.expenses.propertyManagement,
    input.expenses.propertyManagementPercent,
    effectiveGrossIncome,
  );

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

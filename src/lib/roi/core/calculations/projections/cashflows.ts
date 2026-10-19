import { round, fromPercent, compoundGrowth } from '../../../utils/index.js';
import type { DealInput } from '../../domain/schemas/deal-input.schema.js';
import type {
  MonthlyCashflow,
  AnnualCashflow,
  IncomeBreakdown,
  ExpenseBreakdown,
} from '../../domain/schemas/analysis-result.schema.js';
import type { AmortizationEntry } from '../../domain/schemas/analysis-result.schema.js';

/**
 * Generate monthly cashflow projections
 */
export function generateMonthlyCashflows(
  input: DealInput,
  _incomeBreakdown: IncomeBreakdown,
  expenseBreakdown: ExpenseBreakdown,
  amortizationSchedule: AmortizationEntry[],
  startDate?: Date,
): MonthlyCashflow[] {
  const totalMonths = input.appreciationExit.holdingPeriodYears * 12;
  const cashflows: MonthlyCashflow[] = [];
  let cumulativeCashFlow = 0;

  const baseDate = startDate || new Date('2000-01-01T00:00:00Z');
  const rentGrowthRate = fromPercent(input.income.annualRentGrowth);
  const expenseGrowthRate = fromPercent(input.expenses.annualExpenseGrowth);
  const vacancyRate = fromPercent(input.income.vacancyRate);

  // Base monthly values (Year 1)
  const baseMonthlyRent = input.income.monthlyRent;
  const baseMonthlyOtherIncome = input.income.otherMonthlyIncome;
  const baseMonthlyExpenses = expenseBreakdown.total / 12;

  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.ceil(month / 12);
    const yearsElapsed = year - 1;

    // Apply annual growth (growth applies starting from year 2)
    const growthMultiplierIncome =
      yearsElapsed > 0 ? compoundGrowth(1, rentGrowthRate, yearsElapsed) : 1;
    const growthMultiplierExpense =
      yearsElapsed > 0 ? compoundGrowth(1, expenseGrowthRate, yearsElapsed) : 1;

    const monthlyRent = round(baseMonthlyRent * growthMultiplierIncome, 2);
    const monthlyOtherIncome = round(baseMonthlyOtherIncome * growthMultiplierIncome, 2);
    const grossIncome = monthlyRent + monthlyOtherIncome;
    const vacancyLoss = round(grossIncome * vacancyRate, 2);
    const effectiveGrossIncome = round(grossIncome - vacancyLoss, 2);

    const operatingExpenses = round(baseMonthlyExpenses * growthMultiplierExpense, 2);
    const noi = round(effectiveGrossIncome - operatingExpenses, 2);

    // Debt service from amortization schedule
    const debtService =
      month <= amortizationSchedule.length ? amortizationSchedule[month - 1].payment : 0;

    const capexReserve = round((expenseBreakdown.capex / 12) * growthMultiplierExpense, 2);
    const cashFlow = round(noi - debtService - capexReserve, 2);
    cumulativeCashFlow = round(cumulativeCashFlow + cashFlow, 2);

    const date = new Date(baseDate);
    date.setUTCDate(1);
    date.setUTCMonth(baseDate.getUTCMonth() + month - 1);
    date.setUTCDate(
      Math.min(
        baseDate.getUTCDate(),
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(),
      ),
    );

    cashflows.push({
      month,
      year,
      date,
      grossRent: monthlyRent,
      otherIncome: monthlyOtherIncome,
      vacancyLoss,
      effectiveGrossIncome,
      operatingExpenses,
      noi,
      debtService,
      cashFlow,
      cumulativeCashFlow,
    });
  }

  return cashflows;
}

/**
 * Generate annual cashflow summaries
 * Uses ARV (After Repair Value) as the base for property value appreciation
 */
export function generateAnnualCashflows(
  input: DealInput,
  monthlyCashflows: MonthlyCashflow[],
  amortizationSchedule: AmortizationEntry[],
  _loanAmount: number,
): AnnualCashflow[] {
  void _loanAmount;
  const years = input.appreciationExit.holdingPeriodYears;
  const annualCashflows: AnnualCashflow[] = [];
  const appreciationRate = fromPercent(input.appreciationExit.annualAppreciation);

  // Use ARV as the base property value for appreciation calculations
  const afterRepairValue = input.purchase.afterRepairValue ?? input.purchase.purchasePrice;

  for (let year = 1; year <= years; year++) {
    const startMonth = (year - 1) * 12;
    const endMonth = year * 12;
    const yearlyMonths = monthlyCashflows.slice(startMonth, endMonth);

    // Sum up monthly values
    const grossRent = round(
      yearlyMonths.reduce((sum, m) => sum + m.grossRent, 0),
      2,
    );
    const otherIncome = round(
      yearlyMonths.reduce((sum, m) => sum + m.otherIncome, 0),
      2,
    );
    const vacancyLoss = round(
      yearlyMonths.reduce((sum, m) => sum + m.vacancyLoss, 0),
      2,
    );
    const effectiveGrossIncome = round(
      yearlyMonths.reduce((sum, m) => sum + m.effectiveGrossIncome, 0),
      2,
    );
    const operatingExpenses = round(
      yearlyMonths.reduce((sum, m) => sum + m.operatingExpenses, 0),
      2,
    );
    const noi = round(
      yearlyMonths.reduce((sum, m) => sum + m.noi, 0),
      2,
    );
    const debtService = round(
      yearlyMonths.reduce((sum, m) => sum + m.debtService, 0),
      2,
    );
    const cashFlow = round(
      yearlyMonths.reduce((sum, m) => sum + m.cashFlow, 0),
      2,
    );

    // Cumulative cash flow is from the last month of the year
    const cumulativeCashFlow = yearlyMonths[yearlyMonths.length - 1]?.cumulativeCashFlow || 0;

    // Property value with appreciation (from ARV)
    const propertyValue = round(compoundGrowth(afterRepairValue, appreciationRate, year), 2);

    // Loan balance at end of year
    const loanBalanceMonth = year * 12;
    const loanBalance =
      loanBalanceMonth <= amortizationSchedule.length
        ? amortizationSchedule[loanBalanceMonth - 1].balance
        : 0;

    // Equity = Property Value - Loan Balance
    const equity = round(propertyValue - loanBalance, 2);

    // Principal and interest paid this year
    let principalPaid = 0;
    let interestPaid = 0;
    for (
      let month = startMonth + 1;
      month <= endMonth && month <= amortizationSchedule.length;
      month++
    ) {
      principalPaid += amortizationSchedule[month - 1].principal;
      interestPaid += amortizationSchedule[month - 1].interest;
    }

    annualCashflows.push({
      year,
      grossRent,
      otherIncome,
      vacancyLoss,
      effectiveGrossIncome,
      operatingExpenses,
      noi,
      debtService,
      cashFlow,
      cumulativeCashFlow,
      propertyValue,
      loanBalance,
      equity,
      principalPaid: round(principalPaid, 2),
      interestPaid: round(interestPaid, 2),
    });
  }

  return annualCashflows;
}

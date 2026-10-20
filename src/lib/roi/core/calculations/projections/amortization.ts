import { round, fromPercent, calculateMonthlyPayment } from '../../../utils/index';
import type { DealInput } from '../../domain/schemas/deal-input.schema';
import type { AmortizationEntry } from '../../domain/schemas/analysis-result.schema';

export interface AmortizationSummary {
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  totalPrincipal: number;
  schedule: AmortizationEntry[];
}

/**
 * Generate a full amortization schedule
 */
export function generateAmortizationSchedule(
  input: DealInput,
  loanAmount: number,
  startDate?: Date,
): AmortizationSummary {
  if (loanAmount === 0) {
    return {
      monthlyPayment: 0,
      totalPayments: 0,
      totalInterest: 0,
      totalPrincipal: 0,
      schedule: [],
    };
  }
  const { interestRate, loanTermYears } = input.financing;
  if (interestRate === undefined || loanTermYears === undefined) {
    throw new Error('Enter an interest rate and loan term for this financed purchase.');
  }
  const monthlyRate = fromPercent(interestRate) / 12;
  const termMonths = loanTermYears * 12;
  const amortizationMonths = input.financing.amortizationYears
    ? input.financing.amortizationYears * 12
    : termMonths;

  // Calculate monthly payment based on amortization period
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    fromPercent(interestRate),
    amortizationMonths,
  );

  const schedule: AmortizationEntry[] = [];
  let balance = loanAmount;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;
  const baseDate = startDate || new Date('2000-01-01T00:00:00Z');

  for (let i = 1; i <= termMonths && balance > 0; i++) {
    const interestPayment = round(balance * monthlyRate, 2);
    let principalPayment = round(monthlyPayment - interestPayment, 2);

    // Handle final payment rounding
    if (principalPayment > balance || i === termMonths || i === amortizationMonths) {
      principalPayment = balance;
    }

    const newBalance = round(balance - principalPayment, 2);
    cumulativePrincipal = round(cumulativePrincipal + principalPayment, 2);
    cumulativeInterest = round(cumulativeInterest + interestPayment, 2);

    const paymentDate = new Date(baseDate);
    paymentDate.setUTCDate(1);
    paymentDate.setUTCMonth(baseDate.getUTCMonth() + i);
    paymentDate.setUTCDate(
      Math.min(
        baseDate.getUTCDate(),
        new Date(
          Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );

    schedule.push({
      paymentNumber: i,
      month: i,
      year: Math.ceil(i / 12),
      date: paymentDate,
      payment: round(principalPayment + interestPayment, 2),
      principal: principalPayment,
      interest: interestPayment,
      balance: newBalance,
      cumulativePrincipal,
      cumulativeInterest,
    });

    balance = newBalance;
  }

  return {
    monthlyPayment: round(monthlyPayment, 2),
    totalPayments: round(
      schedule.reduce((sum, entry) => sum + entry.payment, 0),
      2,
    ),
    totalInterest: cumulativeInterest,
    totalPrincipal: cumulativePrincipal,
    schedule,
  };
}

/**
 * Get loan balance at a specific month
 */
export function getLoanBalanceAtMonth(schedule: AmortizationEntry[], month: number): number {
  if (month <= 0) return (schedule[0]?.balance ?? 0) + (schedule[0]?.principal ?? 0);
  if (month > schedule.length) return 0;
  return schedule[month - 1].balance;
}

/**
 * Get total principal paid up to a specific month
 */
export function getPrincipalPaidByMonth(schedule: AmortizationEntry[], month: number): number {
  if (month <= 0) return 0;
  if (month > schedule.length) month = schedule.length;
  return schedule[month - 1]?.cumulativePrincipal ?? 0;
}

/**
 * Get total interest paid up to a specific month
 */
export function getInterestPaidByMonth(schedule: AmortizationEntry[], month: number): number {
  if (month <= 0) return 0;
  if (month > schedule.length) month = schedule.length;
  return schedule[month - 1]?.cumulativeInterest ?? 0;
}

/**
 * Get principal and interest for a specific year
 */
export function getAnnualDebtBreakdown(
  schedule: AmortizationEntry[],
  year: number,
): { principal: number; interest: number; total: number } {
  const startMonth = (year - 1) * 12 + 1;
  const endMonth = year * 12;

  let principal = 0;
  let interest = 0;

  for (let month = startMonth; month <= endMonth && month <= schedule.length; month++) {
    const entry = schedule[month - 1];
    principal += entry.principal;
    interest += entry.interest;
  }

  return {
    principal: round(principal, 2),
    interest: round(interest, 2),
    total: round(principal + interest, 2),
  };
}

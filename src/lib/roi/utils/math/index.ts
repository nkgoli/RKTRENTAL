// Math utilities for financial calculations

/**
 * Round a number to a specified number of decimal places
 */
export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Round a number to the nearest cent (2 decimal places)
 */
export function roundCents(value: number): number {
  return round(value, 2);
}

/**
 * Convert a decimal to a percentage (0.05 -> 5)
 */
export function toPercent(decimal: number): number {
  return round(decimal * 100, 4);
}

/**
 * Convert a percentage to a decimal (5 -> 0.05)
 */
export function fromPercent(percent: number): number {
  return percent / 100;
}

/**
 * Calculate compound growth: principal * (1 + rate)^periods
 */
export function compoundGrowth(principal: number, rate: number, periods: number): number {
  return principal * Math.pow(1 + rate, periods);
}

/**
 * Calculate the present value of a future amount
 * PV = FV / (1 + rate)^periods
 */
export function presentValue(futureValue: number, rate: number, periods: number): number {
  return futureValue / Math.pow(1 + rate, periods);
}

/**
 * Calculate the future value of a present amount
 * FV = PV * (1 + rate)^periods
 */
export function futureValue(presentValue: number, rate: number, periods: number): number {
  return presentValue * Math.pow(1 + rate, periods);
}

/**
 * Calculate monthly payment for a loan (fixed-rate amortization)
 * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
 * where P = principal, r = monthly rate, n = number of payments
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRate === 0) return principal / termMonths;

  const monthlyRate = annualRate / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

/**
 * Calculate the sum of an array of numbers
 */
export function sum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

/**
 * Calculate the average of an array of numbers
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Check if a number is within a range (inclusive)
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Date utilities for financial calculations

/**
 * Get the number of months between two dates
 */
export function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return years * 12 + months;
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add years to a date
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Get the start of a month
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the end of a month
 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Get the start of a year
 */
export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * Get the end of a year
 */
export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a date for display (e.g., "Jan 2025")
 */
export function formatMonthYear(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

/**
 * Format a date for display (e.g., "January 15, 2025")
 */
export function formatDateLong(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generate an array of months for a given period
 */
export function generateMonthlyPeriods(
  startDate: Date,
  months: number,
): Array<{ month: number; year: number; date: Date }> {
  const periods: Array<{ month: number; year: number; date: Date }> = [];

  for (let i = 0; i < months; i++) {
    const date = addMonths(startDate, i);
    periods.push({
      month: i + 1,
      year: Math.floor(i / 12) + 1,
      date,
    });
  }

  return periods;
}

/**
 * Generate an array of years for a given period
 */
export function generateAnnualPeriods(
  startDate: Date,
  years: number,
): Array<{ year: number; startDate: Date; endDate: Date }> {
  const periods: Array<{ year: number; startDate: Date; endDate: Date }> = [];

  for (let i = 0; i < years; i++) {
    const start = addYears(startDate, i);
    const end = addYears(startDate, i + 1);
    end.setDate(end.getDate() - 1);

    periods.push({
      year: i + 1,
      startDate: start,
      endDate: end,
    });
  }

  return periods;
}

/**
 * Convert years to months
 */
export function yearsToMonths(years: number): number {
  return Math.round(years * 12);
}

/**
 * Convert months to years
 */
export function monthsToYears(months: number): number {
  return months / 12;
}

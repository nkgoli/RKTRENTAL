// Currency formatting utilities

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

export interface FormatCurrencyOptions {
  currency?: CurrencyCode;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  compact?: boolean;
}

const currencyLocales: Record<CurrencyCode, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, options: FormatCurrencyOptions = {}): string {
  const {
    currency = 'USD',
    locale = currencyLocales[currency],
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    compact = false,
  } = options;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    notation: compact ? 'compact' : 'standard',
  });

  return formatter.format(value);
}

/**
 * Format a number as currency with cents (2 decimal places)
 */
export function formatCurrencyWithCents(value: number, currency: CurrencyCode = 'USD'): string {
  return formatCurrency(value, {
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a large currency value in compact form (e.g., $1.2M)
 */
export function formatCurrencyCompact(value: number, currency: CurrencyCode = 'USD'): string {
  return formatCurrency(value, {
    currency,
    compact: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Parse a currency string back to a number
 * Handles various formats: $1,234.56, $1.2K, etc.
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[^0-9.,\-KMB]/gi, '').trim();

  // Handle compact notation (K, M, B)
  const multipliers: Record<string, number> = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
  };

  let multiplier = 1;
  const lastChar = cleaned.slice(-1).toUpperCase();
  if (multipliers[lastChar]) {
    multiplier = multipliers[lastChar];
    cleaned = cleaned.slice(0, -1);
  }

  // Remove commas and parse
  const parsed = parseFloat(cleaned.replace(/,/g, ''));

  if (isNaN(parsed)) return 0;
  return parsed * multiplier;
}

/**
 * Format a number as a percentage
 */
export function formatPercent(
  value: number,
  options: { decimals?: number; locale?: string } = {},
): string {
  const { decimals = 2, locale = 'en-US' } = options;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(value);
}

/**
 * Format a decimal as a percentage string (0.05 -> "5.00%")
 */
export function formatPercentFromDecimal(decimal: number, decimals: number = 2): string {
  return formatPercent(decimal, { decimals });
}

/**
 * Format a plain number (e.g., for displaying in metrics)
 */
export function formatNumber(
  value: number,
  options: { decimals?: number; locale?: string } = {},
): string {
  const { decimals = 0, locale = 'en-US' } = options;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

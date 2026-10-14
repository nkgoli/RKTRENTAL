import { formatPercent, type ReturnsMetrics } from './core';

export type ReturnsCsvRow = {
  propertyName: string;
  metrics: ReturnsMetrics;
};

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function cell(value: string, untrustedText = false): string {
  const safeValue =
    untrustedText && /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safeValue) ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
}

/**
 * Builds the owner-ready CSV export: one row per property plus a Portfolio
 * total row. Money is plain dollars with two places and ratios are percents,
 * so the file opens cleanly in a spreadsheet.
 */
export function buildReturnsCsv(
  rows: ReturnsCsvRow[],
  portfolio: ReturnsCsvRow | null,
  periodLabel: string,
): string {
  const header = [
    'Property',
    'Period',
    'Income',
    'Expenses',
    'NOI',
    'Debt service',
    'Cash flow',
    'Cap rate',
    'Cash-on-cash',
    'ROI',
    'Yield',
    'Expense ratio',
  ];
  const line = (row: ReturnsCsvRow) =>
    [
      cell(row.propertyName, true),
      cell(periodLabel, true),
      dollars(row.metrics.incomeCents),
      dollars(row.metrics.expensesCents),
      dollars(row.metrics.noiCents),
      dollars(row.metrics.debtServiceCents),
      dollars(row.metrics.cashFlowCents),
      formatPercent(row.metrics.capRate),
      formatPercent(row.metrics.cashOnCash),
      formatPercent(row.metrics.roi),
      formatPercent(row.metrics.yieldRate),
      formatPercent(row.metrics.expenseRatio),
    ].join(',');
  const lines = [header.map((value) => cell(value)).join(','), ...rows.map(line)];
  if (portfolio) lines.push(line(portfolio));
  return `${lines.join('\n')}\n`;
}

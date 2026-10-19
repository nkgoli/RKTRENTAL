import type { PropertyWorkspaceReturns } from '@/lib/metrics/queries';

/** Portfolio reports include historical income from archived units as well as active units. */
export function propertyReportActivity(report: PropertyWorkspaceReturns) {
  const monthly = report.property.monthly.map((point) => ({
    ...point,
    incomeCents: report.units.reduce(
      (sum, unit) =>
        sum + (unit.monthly.find((row) => row.month === point.month)?.incomeCents ?? 0),
      0,
    ),
  }));
  const yearly = report.property.yearly.map((point) => {
    const incomeCents = report.units.reduce(
      (sum, unit) => sum + (unit.yearly.find((row) => row.year === point.year)?.incomeCents ?? 0),
      0,
    );
    return { ...point, incomeCents, noiCents: incomeCents - point.expensesCents };
  });
  return { monthly, yearly, expenseBreakdown: report.property.expenseBreakdown };
}

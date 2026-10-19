import { writeFileSync } from 'node:fs';
import { mapleOutputs } from './maple-court';

// Run from the repository root to regenerate the numeric design evidence.
const outputs = mapleOutputs();
function compact(result: typeof outputs.base) {
  return {
    summary: result.summaryMetrics,
    annual: result.annualCashflows,
    sale: result.saleProceeds,
    expenses: result.expenseBreakdown,
    equity: result.equityTimeline.filter((p) => p.month % 12 === 0),
    amortization: result.amortizationSchedule.slice(0, 12),
    amortizationYears: Array.from({ length: 30 }, (_, i) => {
      const months = result.amortizationSchedule.slice(i * 12, i * 12 + 12);
      return {
        year: i + 1,
        payment: months.reduce((sum, p) => sum + p.payment, 0),
        principal: months.reduce((sum, p) => sum + p.principal, 0),
        interest: months.reduce((sum, p) => sum + p.interest, 0),
        balance: months.at(-1)?.balance,
      };
    }),
  };
}
writeFileSync(
  'tests/roi/maple-court-outputs.json',
  JSON.stringify(
    {
      base: compact(outputs.base),
      scenarios: Object.fromEntries(
        Object.entries(outputs.scenarios).map(([id, result]) => [id, compact(result)]),
      ),
      comparison: outputs.comparison,
      benchmarks: outputs.benchmarks,
      exit5: compact(outputs.exit5),
      sensitivity: outputs.sensitivity,
    },
    null,
    2,
  ),
);

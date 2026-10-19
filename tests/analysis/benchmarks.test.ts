import { describe, it, expect } from 'vitest';
import { payload } from './fixture';
import { benchmarkComparison } from '@/lib/analysis/benchmarks';
import { calculatePayload, PayloadSchema } from '@/lib/analysis/contract';
import { getAllBenchmarks } from '@/lib/roi';
describe('public benchmark mapping', () => {
  it('reconciles final wealth, growth, ranking and same capital without adding yield', () => {
    const p = payload();
    p.benchmarks = getAllBenchmarks().slice(0, 2);
    const c = benchmarkComparison(p).comparison!;
    const base = calculatePayload({ ...p, benchmarks: [] }).base;
    expect(c.assets[0].finalValue).toBeCloseTo(
      base.saleProceeds.netProceeds + base.annualCashflows.at(-1)!.cumulativeCashFlow,
      6,
    );
    expect(c.assets[0].projections.at(-1)!.value).toBe(c.assets[0].finalValue);
    expect(c.assets[1].finalValue).toBeCloseTo(
      c.initialInvestment * 1.105 ** c.holdingPeriodYears,
      6,
    );
    expect(c.ranking).toEqual(
      [...c.assets].sort((a, b) => b.finalValue - a.finalValue).map((a) => a.id),
    );
  });
  it('retains no-selection, limits, zero capital and precision errors honestly', () => {
    const p = payload();
    p.benchmarks = [];
    expect(benchmarkComparison(p).comparison).toBeNull();
    p.benchmarks = getAllBenchmarks().slice(0, 3);
    expect(PayloadSchema.safeParse(p).success).toBe(false);
    p.benchmarks = [getAllBenchmarks()[0]];
    p.input.financing!.loanAmount = 100000;
    p.input.financing!.downPaymentPercent = 0;
    expect(benchmarkComparison(p).comparison).toBeNull();
    p.input.purchase!.purchasePrice = 1e10;
    p.input.appreciationExit!.holdingPeriodYears = 50;
    p.benchmarks[0] = { ...p.benchmarks[0], historicalCAGR: 100 };
    expect(benchmarkComparison(p).error).toMatch(/precision/);
  });
  it('preserves negative final wealth and null annualized growth', () => {
    const p = payload();
    p.benchmarks = [getAllBenchmarks()[0]];
    p.input.expenses!.otherExpenses = 200000;
    const c = benchmarkComparison(p).comparison!;
    expect(c.assets[0].finalValue).toBeLessThan(0);
    expect(c.assets[0].annualizedReturn).toBeNull();
  });
});

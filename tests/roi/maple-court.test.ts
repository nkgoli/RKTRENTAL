import { describe, expect, it } from 'vitest';
import { mapleOutputs } from './fixtures/maple-court';

describe('companion design fixture via the supported public API', () => {
  const { base, scenarios, comparison, sensitivity } = mapleOutputs();

  it('reconciles operating NOI, debt and separate reserves against independent arithmetic', () => {
    const income = 23000 * 12 * 0.95;
    const operating = 30000 + 9600 + 23000 * 12 * 0.05 + income * 0.08;
    const reserves = 23000 * 12 * 0.05;
    expect(operating).toBe(74376);
    expect(base.summaryMetrics.noi).toBe(income - operating);
    expect(base.expenseBreakdown.capex).toBe(reserves);
    expect(base.summaryMetrics.annualDebtService).toBe(150179.4);
    expect(base.summaryMetrics.annualCashFlow).toBe(23844.6);
    expect(base.summaryMetrics.dscr).toBeCloseTo(187824 / 150179.4, 10);
    expect(base.summaryMetrics.capRate).toBe(0.0664);
    for (const y of base.annualCashflows) {
      expect(y.noi).toBeCloseTo(y.effectiveGrossIncome - y.operatingExpenses, 2);
      expect(y.noi - y.debtService - y.cashFlow).toBeCloseTo(reserves * 1.02 ** (y.year - 1), 0);
    }
    expect(scenarios.optimistic.summaryMetrics.noi).toBe(192902.4);
    expect(scenarios.conservative.summaryMetrics.noi).toBe(180206.4);
    expect(sensitivity[1][1]).toBe(base.summaryMetrics.cashOnCash);
  });

  it('ranks final wealth after exit costs and separates CAGR from timed IRR', () => {
    const grossSale = Math.round(2830000 * 1.03 ** 10 * 100) / 100;
    const costs = Math.round(grossSale * 0.06 * 100) / 100;
    const cash = 403720.32;
    expect(base.annualCashflows.at(-1)!.cumulativeCashFlow).toBe(cash);
    expect(base.saleProceeds.netProceeds).toBe(1896519.5);
    const terminal = grossSale - costs - 1678566.85 + cash;
    expect(comparison.assets[0].finalValue).toBeCloseTo(terminal, 8);
    expect(comparison.assets[0].annualizedReturn).toBeCloseTo(
      ((terminal / 906600) ** 0.1 - 1) * 100,
      10,
    );
    expect(comparison.assets[1].finalValue).toBe(Math.round(906600 * 1.105 ** 10));
    expect(comparison.ranking).toEqual(['sp500', 'property', 'bonds']);
    expect(comparison.assets[1].finalValue - terminal).toBeCloseTo(160346.18, 8);
    expect(base.summaryMetrics.irrLeveraged).toBeCloseTo(0.107267234, 8);
    expect(base.summaryMetrics.irrUnleveraged).toBeCloseTo(0.081523977, 8);
  });

  it('uses the explicitly chosen 8% sample discount and reconciles NPV from cash flows', () => {
    const independent = base.cashflows.reduce((sum, cash, year) => sum + cash / 1.08 ** year, 0);
    expect(base.assumptions.discountRate).toBe(0.08);
    expect(base.summaryMetrics.npv).toBeCloseTo(independent, 8);
    expect(base.summaryMetrics.npv).toBeCloseTo(226885.854621, 5);
  });
});

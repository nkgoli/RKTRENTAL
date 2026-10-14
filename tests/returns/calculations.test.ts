import { describe, expect, it } from 'vitest';
import {
  assumedAppreciationCents,
  buildReturnsCsv,
  cashInvestedCents,
  computeCapRate,
  computeCashFlow,
  computeCashOnCash,
  computeNoi,
  computeReturns,
  computeRoi,
  computeYield,
  formatPercent,
  periodKeyFrom,
  resolvePeriod,
} from '../../src/lib/returns';
import {
  parseExpenseAmount,
  parseExpenseDate,
  validateExpenseInput,
} from '../../src/lib/expenses';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('NOI and cash flow', () => {
  it('subtracts operating expenses from income', () => {
    expect(computeNoi(81400000, 31230000)).toBe(50170000);
    expect(computeNoi(0, 0)).toBe(0);
  });

  it('goes negative when expenses exceed income', () => {
    expect(computeNoi(100000, 250000)).toBe(-150000);
  });

  it('subtracts debt service for cash flow, including negative results', () => {
    expect(computeCashFlow(50170000, 15600000)).toBe(34570000);
    expect(computeCashFlow(100000, 250000)).toBe(-150000);
    expect(computeCashFlow(100000, 0)).toBe(100000);
  });

  it('rejects fractional cents', () => {
    expect(() => computeNoi(1.5, 0)).toThrow('whole number of cents');
  });
});

describe('cap rate', () => {
  it('divides NOI by the property value', () => {
    expect(computeCapRate(50170000, 946000000)).toBeCloseTo(0.05303, 4);
  });

  it('is null for a zero or missing price instead of dividing by zero', () => {
    expect(computeCapRate(100000, 0)).toBeNull();
    expect(computeCapRate(100000, null)).toBeNull();
    expect(computeCapRate(100000, undefined)).toBeNull();
    expect(computeCapRate(100000, -5)).toBeNull();
  });

  it('keeps the sign of a negative NOI', () => {
    expect(computeCapRate(-100000, 2000000)).toBeCloseTo(-0.05);
  });
});

describe('cash invested and cash-on-cash', () => {
  it('uses the down payment when financed', () => {
    expect(
      cashInvestedCents({ incomeCents: 0, expensesCents: 0, purchasePriceCents: 1000000, downPaymentCents: 200000 }),
    ).toBe(200000);
  });

  it('falls back to the full price with no financing', () => {
    expect(
      cashInvestedCents({ incomeCents: 0, expensesCents: 0, purchasePriceCents: 1000000, downPaymentCents: null }),
    ).toBe(1000000);
    expect(cashInvestedCents({ incomeCents: 0, expensesCents: 0 })).toBeNull();
  });

  it('divides cash flow by cash invested and handles negatives', () => {
    expect(computeCashOnCash(34570000, 336000000)).toBeCloseTo(0.10289, 4);
    expect(computeCashOnCash(-50000, 200000)).toBeCloseTo(-0.25);
    expect(computeCashOnCash(50000, 0)).toBeNull();
    expect(computeCashOnCash(50000, null)).toBeNull();
  });
});

describe('ROI and yield', () => {
  it('adds appreciation to cash flow over cash invested', () => {
    expect(computeRoi(100000, 30000, 200000)).toBeCloseTo(0.65);
    expect(computeRoi(100000, 0, null)).toBeNull();
  });

  it('assumes 3% annual appreciation prorated by period', () => {
    expect(assumedAppreciationCents(100000000, 12)).toBe(3000000);
    expect(assumedAppreciationCents(100000000, 6)).toBe(1500000);
    expect(assumedAppreciationCents(0, 12)).toBe(0);
    expect(assumedAppreciationCents(null, 12)).toBe(0);
  });

  it('divides scheduled rent by value for gross yield', () => {
    expect(computeYield(9000000, 100000000)).toBeCloseTo(0.09);
    expect(computeYield(null, 100000000)).toBeNull();
    expect(computeYield(9000000, 0)).toBeNull();
  });
});

describe('computeReturns', () => {
  it('returns every metric for a financed property', () => {
    const metrics = computeReturns({
      incomeCents: 81400000,
      expensesCents: 31230000,
      debtServiceCents: 15600000,
      purchasePriceCents: 946000000,
      downPaymentCents: 336000000,
      scheduledRentCents: 86280000,
      periodMonths: 12,
    });
    expect(metrics.noiCents).toBe(50170000);
    expect(metrics.cashFlowCents).toBe(34570000);
    expect(metrics.capRate).toBeCloseTo(0.05303, 4);
    expect(metrics.cashOnCash).toBeCloseTo(0.10289, 4);
    expect(metrics.roi).toBeCloseTo((34570000 + 28380000) / 336000000, 6);
    expect(metrics.yieldRate).toBeCloseTo(86280000 / 946000000, 6);
    expect(metrics.expenseRatio).toBeCloseTo(31230000 / 81400000, 6);
  });

  it('handles a property with no price and no financing', () => {
    const metrics = computeReturns({ incomeCents: 100000, expensesCents: 40000 });
    expect(metrics.noiCents).toBe(60000);
    expect(metrics.cashFlowCents).toBe(60000);
    expect(metrics.capRate).toBeNull();
    expect(metrics.cashOnCash).toBeNull();
    expect(metrics.roi).toBeNull();
    expect(metrics.yieldRate).toBeNull();
    expect(metrics.cashInvestedCents).toBeNull();
  });

  it('handles negative cash flow without hiding it', () => {
    const metrics = computeReturns({
      incomeCents: 100000,
      expensesCents: 90000,
      debtServiceCents: 50000,
      purchasePriceCents: 1000000,
      downPaymentCents: 200000,
      appreciationCents: 0,
    });
    expect(metrics.cashFlowCents).toBe(-40000);
    expect(metrics.cashOnCash).toBeCloseTo(-0.2);
    expect(metrics.roi).toBeCloseTo(-0.2);
  });

  it('formats ratios as percents and null as an em dash', () => {
    expect(formatPercent(0.053)).toBe('5.3%');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(-0.2)).toBe('-20.0%');
  });
});

describe('periods', () => {
  it('defaults unknown keys to 12M', () => {
    expect(periodKeyFrom('YTD')).toBe('YTD');
    expect(periodKeyFrom('bogus')).toBe('12M');
    expect(periodKeyFrom(undefined)).toBe('12M');
  });

  it('resolves trailing twelve months ending after the current month', () => {
    const period = resolvePeriod('12M', d('2026-10-14'));
    expect(period.start.toISOString()).toBe('2025-11-01T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(period.months).toBe(12);
    expect(period.label).toBe('Nov 2025 – Oct 2026');
  });

  it('resolves MTD, QTD and YTD windows', () => {
    expect(resolvePeriod('MTD', d('2026-10-14')).months).toBe(1);
    expect(resolvePeriod('QTD', d('2026-10-14')).start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    const ytd = resolvePeriod('YTD', d('2026-10-14'));
    expect(ytd.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(ytd.months).toBe(10);
  });
});

describe('CSV export', () => {
  it('writes a header, property rows and a portfolio row', () => {
    const metrics = computeReturns({
      incomeCents: 100000,
      expensesCents: 40000,
      purchasePriceCents: 1000000,
      downPaymentCents: 200000,
      scheduledRentCents: 120000,
      appreciationCents: 0,
    });
    const csv = buildReturnsCsv(
      [{ propertyName: 'Maple Court', metrics }],
      { propertyName: 'Portfolio', metrics },
      '12M · Nov 2025 – Oct 2026',
    );
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Cap rate');
    expect(lines[1]).toContain('Maple Court');
    expect(lines[1]).toContain('1000.00');
    expect(lines[2]).toContain('Portfolio');
  });

  it('quotes names containing commas', () => {
    const metrics = computeReturns({ incomeCents: 0, expensesCents: 0 });
    const csv = buildReturnsCsv([{ propertyName: 'Elm, Street', metrics }], null, '12M');
    expect(csv).toContain('"Elm, Street"');
  });
});

describe('expense input', () => {
  it('parses dollar amounts and rejects zero or junk', () => {
    expect(parseExpenseAmount('1,850.50')).toBe(185050);
    expect(parseExpenseAmount('0')).toBeNull();
    expect(parseExpenseAmount('abc')).toBeNull();
    expect(parseExpenseAmount('-5')).toBeNull();
  });

  it('parses real calendar dates only', () => {
    expect(parseExpenseDate('2026-10-15')?.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(parseExpenseDate('2026-02-30')).toBeNull();
    expect(parseExpenseDate('10/15/2026')).toBeNull();
  });

  it('validates a complete expense and reports field errors', () => {
    const ok = validateExpenseInput({
      propertyId: 'p1',
      category: 'TAXES',
      amount: '250.00',
      occurredOn: '2026-10-15',
    });
    expect(ok.ok).toBe(true);
    const bad = validateExpenseInput({ propertyId: '', category: 'NOPE', amount: '0', occurredOn: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.propertyId).toBeTruthy();
      expect(bad.errors.category).toBeTruthy();
      expect(bad.errors.amount).toBeTruthy();
      expect(bad.errors.occurredOn).toBeTruthy();
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  calculatePayload,
  missingData,
  PayloadSchema,
  rehydrateInput,
} from '../../src/lib/analysis/contract';
import { payload } from './fixture';

describe('analysis serialization contract', () => {
  it('round trips ISO dates, fractions, explicit zeros and named scenarios', () => {
    const p = PayloadSchema.parse(JSON.parse(JSON.stringify(payload())));
    expect(missingData(p)).toEqual([]);
    expect(rehydrateInput(p.input).purchase?.acquisitionDate).toBeInstanceOf(Date);
    const result = calculatePayload(p);
    expect(result.base.assumptions.startDate.toISOString()).toBe(p.options.startDate);
    expect(result.base.assumptions.discountRate).toBe(0.08);
    expect(result.base.summaryMetrics.noi).toBe(10800);
    expect(result.scenarios[0].result.summaryMetrics.noi).toBe(12000);
    expect(result.scenarios[0].result.assumptions.startDate.toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
    expect(result.scenarios[0].result.assumptions.discountRate).toBe(0.05);
    expect(result.scenarios[0].result.assumptions.tax?.landValuePercent).toBe(20);
    expect(result.comparison?.assets[1].id).toBe('custom');
    expect(p.input.income?.monthlyRent).toBe(1000);
  });
  it('keeps missing financial facts missing and reports field paths', () => {
    const p = payload();
    p.input = { propertyId: p.propertyId };
    p.options = {};
    const parsed = PayloadSchema.parse(p);
    expect(parsed.input.purchase).toBeUndefined();
    expect(missingData(parsed).map((x) => x.path)).toContain('input.financing');
    expect(missingData(parsed).map((x) => x.path)).toContain('options.startDate');
  });
  it('keeps monthly, annual and percentage-point assumptions distinct', () => {
    const p = payload();
    p.input.income!.vacancyRate = 5;
    p.input.expenses!.hoaMonthly = 100;
    p.input.expenses!.utilitiesMonthly = 2400 / 12; // Explicit manager annual budget conversion.
    p.input.expenses!.insurance = 50 * 12; // Explicit manager monthly budget conversion.
    p.scenarios = [];
    p.benchmarks = [];
    const result = calculatePayload(PayloadSchema.parse(p));
    // 12,000 gross - 600 vacancy - 1,200 tax - 600 insurance - 1,200 HOA - 2,400 utilities.
    expect(result.base.summaryMetrics.noi).toBe(6000);
    expect(result.base.assumptions.discountRate).toBe(0.08);
  });
  it.each([NaN, Infinity, '1000', null, 1e11])('rejects invalid financial number %s', (v) => {
    const p = payload();
    Object.assign(p.input.income!, { monthlyRent: v });
    expect(PayloadSchema.safeParse(p).success).toBe(false);
  });
  it.each(['not-a-date', '2026-02-30T00:00:00Z', '2101-01-01T00:00:00Z', '2026-01-01'])(
    'rejects invalid date %s',
    (v) => {
      const p = payload();
      p.options.startDate = v;
      expect(PayloadSchema.safeParse(p).success).toBe(false);
    },
  );
  it('rejects forged property scope, unknown keys and unsupported versions', () => {
    const p = payload();
    p.input.propertyId = 'other';
    expect(PayloadSchema.safeParse(p).success).toBe(false);
    expect(PayloadSchema.safeParse({ ...payload(), version: 2 }).success).toBe(false);
    expect(PayloadSchema.safeParse({ ...payload(), organizationId: 'other' }).success).toBe(false);
  });
  it('validates duplicate scenarios, nested overrides and calculated loan constraints', () => {
    const p = payload();
    p.scenarios.push(p.scenarios[0]);
    expect(PayloadSchema.safeParse(p).success).toBe(false);
    p.scenarios = [
      { id: 'x', name: 'Invalid debt', overrides: { financing: { loanAmount: 200000 } } },
    ];
    expect(() => calculatePayload(PayloadSchema.parse(p))).toThrow('Loan exceeds purchase price');
  });
});

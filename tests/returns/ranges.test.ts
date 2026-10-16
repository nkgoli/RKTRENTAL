import { describe, expect, it } from 'vitest';
import {
  bucketLabel,
  bucketSeries,
  periodBuckets,
  periodKeyFrom,
  periodParams,
  resolvePeriod,
  yearlyTotals,
} from '../../src/lib/returns/period';
import { collectionRangeFrom, COLLECTION_RANGES } from '../../src/lib/dashboard/queries';

const now = new Date('2026-10-14T12:00:00.000Z');

describe('multi-year ranges', () => {
  it('resolves 2Y, 3Y and 5Y as whole trailing months ending this month', () => {
    for (const [key, months] of [['2Y', 24], ['3Y', 36], ['5Y', 60]] as const) {
      const period = resolvePeriod(key, now);
      expect(period.months).toBe(months);
      expect(period.end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    }
    expect(resolvePeriod('2Y', now).start.toISOString()).toBe('2024-11-01T00:00:00.000Z');
    expect(resolvePeriod('5Y', now).start.toISOString()).toBe('2021-11-01T00:00:00.000Z');
  });

  it('buckets by month up to two years and by quarter beyond', () => {
    expect(resolvePeriod('12M', now).granularity).toBe('month');
    expect(resolvePeriod('2Y', now).granularity).toBe('month');
    expect(resolvePeriod('3Y', now).granularity).toBe('quarter');
    expect(periodBuckets(resolvePeriod('2Y', now))).toHaveLength(24);
    const quarters = periodBuckets(resolvePeriod('3Y', now));
    expect(quarters[0]).toBe('2023-Q4');
    expect(quarters.at(-1)).toBe('2026-Q4');
    expect(quarters).toHaveLength(13);
  });

  it('starts "All" at the earliest activity month and falls back to 12 months', () => {
    const all = resolvePeriod('ALL', now, { earliest: new Date('2021-03-01T00:00:00Z') });
    expect(all.start.toISOString()).toBe('2021-03-01T00:00:00.000Z');
    expect(all.months).toBe(68);
    expect(resolvePeriod('ALL', now).months).toBe(12);
  });

  it('resolves a custom range, clamps it to this month and ignores bad input', () => {
    const custom = resolvePeriod('CUSTOM', now, { from: '2023-02', to: '2024-05' });
    expect(custom.key).toBe('CUSTOM');
    expect(custom.start.toISOString()).toBe('2023-02-01T00:00:00.000Z');
    expect(custom.end.toISOString()).toBe('2024-06-01T00:00:00.000Z');
    expect(custom.months).toBe(16);
    expect(resolvePeriod('CUSTOM', now, { from: '2024-05', to: '2023-02' }).months).toBe(16);
    expect(resolvePeriod('CUSTOM', now, { from: '2026-01', to: '2031-01' }).end.toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
    expect(resolvePeriod('CUSTOM', now, { from: 'nope', to: '2024-05' }).key).toBe('12M');
    expect(periodKeyFrom('CUSTOM')).toBe('CUSTOM');
    expect(periodParams(custom)).toEqual({ period: 'CUSTOM', from: '2023-02', to: '2024-05' });
    expect(periodParams(resolvePeriod('3Y', now))).toEqual({ period: '3Y' });
  });

  it('folds month totals into quarter buckets without losing cents', () => {
    const period = resolvePeriod('3Y', now);
    const income = new Map<string, number>();
    const expenses = new Map<string, number>();
    let incomeTotal = 0;
    let expenseTotal = 0;
    for (let i = 0; i < period.months; i++) {
      const d = new Date(Date.UTC(2023, 10 + i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      income.set(key, 100_007 + i);
      expenses.set(key, 31_003 + 3 * i);
      incomeTotal += 100_007 + i;
      expenseTotal += 31_003 + 3 * i;
    }
    const series = bucketSeries(period, income, expenses);
    expect(series.reduce((t, p) => t + p.incomeCents, 0)).toBe(incomeTotal);
    expect(series.reduce((t, p) => t + p.expensesCents, 0)).toBe(expenseTotal);
    // 2024-Q1 is months index 2, 3, 4 (Jan, Feb, Mar 2024).
    expect(series.find((p) => p.month === '2024-Q1')?.incomeCents).toBe(
      100_009 + 100_010 + 100_011,
    );
    const years = yearlyTotals(income, expenses);
    expect(years.map((y) => y.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(years.reduce((t, y) => t + y.noiCents, 0)).toBe(incomeTotal - expenseTotal);
    expect(years[0]).toMatchObject({ year: 2023, incomeCents: 100_007 + 100_008 });
  });

  it('labels buckets and parses dashboard ranges', () => {
    expect(bucketLabel('2025-03', false)).toBe('Mar');
    expect(bucketLabel('2025-03', true)).toBe('Mar ’25');
    expect(bucketLabel('2025-Q2', true)).toBe('Q2 ’25');
    expect(collectionRangeFrom('5Y')).toBe('5Y');
    expect(collectionRangeFrom('bogus')).toBe('6M');
    expect(collectionRangeFrom(undefined)).toBe('6M');
    expect(COLLECTION_RANGES['2Y']).toBe(24);
  });
});

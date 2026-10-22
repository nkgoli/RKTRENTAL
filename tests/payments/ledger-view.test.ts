import { describe, expect, it } from 'vitest';
import {
  foldSettledRows,
  monthRangeLabel,
  paidDateLabel,
  recentLedgerRows,
  STATUS_PILL,
  type LedgerRowView,
} from '@/components/payments/ledger-view';

const row = (key: string, status: LedgerRowView['status'], over: Partial<LedgerRowView> = {}) =>
  ({
    key,
    type: 'Rent',
    description: `${key} rent`,
    dateLabel: key,
    amountCents: 100_000,
    paidCents: status === 'PAID' ? 100_000 : 0,
    balanceCents: status === 'PAID' ? 0 : 100_000,
    status,
    derived: status === 'SCHEDULED',
    applied:
      status === 'PAID'
        ? [{ id: 'p', amountCents: 100_000, dateLabel: 'Paid day', method: 'm' }]
        : [],
    month: key,
    ...over,
  }) satisfies LedgerRowView;

describe('ledger view helpers', () => {
  it('labels late as past the grace period', () => {
    expect(STATUS_PILL.LATE.label).toBe('Late · past grace');
  });

  it('names month ranges within and across years', () => {
    expect(monthRangeLabel('2026-01', '2026-08')).toBe('January – August 2026');
    expect(monthRangeLabel('2025-12', '2026-02')).toBe('December 2025 – February 2026');
    expect(monthRangeLabel('2026-03', '2026-03')).toBe('March 2026');
  });

  it('folds the oldest paid run but keeps the newest paid charge visible', () => {
    const rows = [
      row('2026-11', 'SCHEDULED'),
      row('2026-10', 'LATE'),
      row('2026-09', 'PAID'),
      row('2026-08', 'PAID'),
      row('2026-07', 'PAID'),
      row('2026-06', 'PAID', { type: 'Security deposit' }),
    ];
    const { visible, settled } = foldSettledRows(rows);
    expect(visible.map((r) => r.key)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(settled?.rows.map((r) => r.key)).toEqual(['2026-08', '2026-07', '2026-06']);
    expect(settled?.label).toBe('June – August 2026 · 3 charges · all paid');
  });

  it('never folds a single paid row or a paid row newer than an open one', () => {
    expect(
      foldSettledRows([row('2026-10', 'LATE'), row('2026-09', 'PAID'), row('2026-08', 'PAID')])
        .settled,
    ).toBeNull();
    const mixed = [row('2026-10', 'PAID'), row('2026-09', 'PAID'), row('2026-08', 'LATE')];
    expect(foldSettledRows(mixed).visible).toHaveLength(3);
  });

  it('excerpts every open charge, then the next scheduled and the last paid', () => {
    const rows = [
      row('2026-12', 'SCHEDULED'),
      row('2026-11', 'SCHEDULED'),
      row('2026-10', 'LATE'),
      row('2026-09', 'PARTIAL'),
      row('2026-08', 'PAID'),
      row('2026-07', 'PAID'),
    ];
    expect(recentLedgerRows(rows).map((r) => r.key)).toEqual([
      '2026-11',
      '2026-10',
      '2026-09',
      '2026-08',
    ]);
    const open = ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06'].map((k) => row(k, 'LATE'));
    expect(recentLedgerRows(open)).toHaveLength(5);
  });

  it('reports the paid date only for settled rows', () => {
    expect(paidDateLabel(row('a', 'PAID'))).toBe('Paid day');
    expect(paidDateLabel(row('b', 'LATE'))).toBeUndefined();
  });
});

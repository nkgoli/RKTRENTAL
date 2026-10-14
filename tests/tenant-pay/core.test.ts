import { describe, expect, it } from 'vitest';
import type { LedgerCharge, LedgerPayment } from '../../src/lib/ledger/core';
import {
  buildAmountDue,
  buildReceipts,
  cardFeeCents,
  chargeLabel,
  validatePayAmount,
  validateProviderToken,
} from '../../src/lib/tenant-pay/core';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const charge = (partial: Partial<LedgerCharge>): LedgerCharge => ({
  leaseId: 'lease-1',
  kind: 'RENT',
  amountCents: 185_000,
  dueDate: d('2026-11-01'),
  description: 'rent:lease-1:2026-11',
  ...partial,
});
const payment = (partial: Partial<LedgerPayment>): LedgerPayment => ({
  leaseId: 'lease-1',
  amountCents: 185_000,
  status: 'SUCCEEDED',
  paidAt: d('2026-10-03'),
  ...partial,
});

describe('card fee', () => {
  it('is 2.9% rounded to cents only when fees are passed on', () => {
    expect(cardFeeCents(185_000, true)).toBe(5_365);
    expect(cardFeeCents(185_000, false)).toBe(0);
    expect(cardFeeCents(0, true)).toBe(0);
    expect(cardFeeCents(10_001, true)).toBe(290);
  });
});

describe('provider token safety', () => {
  it('accepts provider tokens and derives display last4', () => {
    expect(validateProviderToken('tok_mock_card_4242', 'card')).toEqual({
      token: 'tok_mock_card_4242',
      last4: '4242',
    });
    expect(validateProviderToken('tok_mock_bank_6789', 'ach').last4).toBe('6789');
    expect(validateProviderToken('pm_1234567890abcd4242', 'card').last4).toBe('4242');
  });

  it('rejects raw card and account numbers so they can never be stored', () => {
    expect(() => validateProviderToken('4242424242424242', 'card')).toThrow(/provider fields/);
    expect(() => validateProviderToken('4242 4242 4242 4242', 'card')).toThrow(/provider fields/);
    expect(() => validateProviderToken('0210006789', 'ach')).toThrow(/provider fields/);
    expect(() => validateProviderToken('card-number', 'card')).toThrow(/token required/);
    expect(() => validateProviderToken('', 'ach')).toThrow(/token required/);
  });
});

describe('amount due from the ledger', () => {
  it('breaks the $1,850 November rent down from charges and settled payments', () => {
    const due = buildAmountDue([charge({})], [payment({ amountCents: 0, status: 'PENDING' })]);
    expect(due.totalDueCents).toBe(185_000);
    expect(due.lines).toHaveLength(1);
    expect(due.lines[0]).toMatchObject({ label: 'November rent', outstandingCents: 185_000 });
    expect(due.billingMonth).toBe('2026-11');
  });

  it('applies settled payments oldest first and keeps pending separate', () => {
    const charges = [
      charge({}),
      charge({
        kind: 'LATE_FEE',
        amountCents: 7_500,
        dueDate: d('2026-11-06'),
        description: 'late-fee:lease-1:2026-11',
      }),
    ];
    const due = buildAmountDue(charges, [
      payment({ amountCents: 100_000 }),
      payment({ amountCents: 50_000, status: 'PENDING' }),
    ]);
    expect(due.paidCents).toBe(100_000);
    expect(due.pendingCents).toBe(50_000);
    expect(due.totalDueCents).toBe(92_500);
    expect(due.lines.map((l) => l.label)).toEqual(['November rent', 'Late fee']);
    expect(chargeLabel(charges[1])).toBe('Late fee');
  });

  it('is zero when rent is settled', () => {
    const due = buildAmountDue([charge({})], [payment({})]);
    expect(due.totalDueCents).toBe(0);
    expect(due.lines).toEqual([]);
  });
});

describe('pay amount', () => {
  it('requires a positive amount no larger than the amount due', () => {
    expect(validatePayAmount(185_000, 185_000)).toBe(185_000);
    expect(() => validatePayAmount(0, 185_000)).toThrow(/greater than zero/);
    expect(() => validatePayAmount(185_001, 185_000)).toThrow(/more than the amount due/);
    expect(() => validatePayAmount(100, 0)).toThrow(/Nothing is due/);
  });
});

describe('receipts', () => {
  it('lists newest settled payments first with Paid labels', () => {
    const receipts = buildReceipts([
      payment({ id: 'p-sep', paidAt: d('2026-09-03') }),
      payment({ id: 'p-oct', paidAt: d('2026-10-03') }),
      payment({ id: 'p-pending', status: 'PENDING', paidAt: null, createdAt: d('2026-11-01') }),
    ]);
    expect(receipts.map((r) => r.paymentId)).toEqual(['p-pending', 'p-oct', 'p-sep']);
    expect(receipts[1]).toMatchObject({ label: 'October rent', statusLabel: 'Paid' });
    expect(receipts[0].statusLabel).toBe('Pending');
  });
});

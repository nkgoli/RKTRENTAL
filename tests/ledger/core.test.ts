import { describe, expect, it } from 'vitest';
import {
  assessLateFee,
  centsToDecimal,
  computeBalance,
  formatUsd,
  isPastGrace,
  planLateFees,
  planOwnerPayout,
  planRefund,
  planRentCharges,
  rentStatus,
  toCents,
  type LeaseTerms,
  type LedgerCharge,
  type LedgerPayment,
  type NewCharge,
} from '../../src/lib/ledger/core';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const lease: LeaseTerms = {
  id: 'L1',
  startDate: d('2026-01-01'),
  endDate: d('2026-12-31'),
  monthlyRentCents: 185000,
  lateFeeCents: 7500,
  graceDays: 5,
  status: 'ACTIVE',
};
const asCharge = (c: NewCharge): LedgerCharge => ({ ...c, amountCents: c.amountCents });
const pay = (
  amountCents: number,
  status: LedgerPayment['status'] = 'SUCCEEDED',
  paidAt = '2026-10-03',
): LedgerPayment => ({ leaseId: 'L1', amountCents, status, paidAt: d(paidAt) });

describe('money', () => {
  it('converts decimals to integer cents without float drift', () => {
    expect(toCents('1850.00')).toBe(185000);
    expect(toCents('0.10')).toBe(10);
    expect(toCents('19.99')).toBe(1999);
    expect(toCents(1850.5)).toBe(185050);
    expect(toCents({ toString: () => '75' })).toBe(7500);
    expect(toCents('1.005')).toBe(101);
    expect(() => toCents('abc')).toThrow('Invalid money');
  });

  it('formats cents for storage and display', () => {
    expect(centsToDecimal(185000)).toBe('1850.00');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(() => centsToDecimal(1.5)).toThrow('whole number of cents');
    expect(formatUsd(185000)).toBe('$1,850');
    expect(formatUsd(185050)).toBe('$1,850.50');
  });
});

describe('monthly rent charges', () => {
  const asOf = d('2026-10-14');

  it('creates the current month once for a lease with no history', () => {
    const planned = planRentCharges(lease, [], [], asOf);
    expect(planned).toEqual([
      {
        leaseId: 'L1',
        kind: 'RENT',
        amountCents: 185000,
        dueDate: d('2026-10-01'),
        description: 'rent:L1:2026-10',
      },
    ]);
  });

  it('is idempotent: planning again after creation yields nothing', () => {
    const first = planRentCharges(lease, [], [], asOf);
    expect(planRentCharges(lease, first.map(asCharge), [], asOf)).toEqual([]);
  });

  it('backfills from the first recorded payment and only fills gaps', () => {
    const payments = [pay(185000, 'SUCCEEDED', '2026-08-03')];
    const months = planRentCharges(lease, [], payments, asOf).map((c) => c.description);
    expect(months).toEqual(['rent:L1:2026-08', 'rent:L1:2026-09', 'rent:L1:2026-10']);
    const existing = [asCharge(planRentCharges(lease, [], payments, asOf)[1])];
    expect(planRentCharges(lease, existing, payments, asOf).map((c) => c.description)).toEqual([
      'rent:L1:2026-08',
      'rent:L1:2026-10',
    ]);
  });

  it('never charges before the lease starts or after it ends', () => {
    const early = { ...lease, startDate: d('2026-10-10') };
    expect(planRentCharges(early, [], [pay(1, 'SUCCEEDED', '2026-05-01')], asOf)).toHaveLength(1);
    const ended = { ...lease, endDate: d('2026-09-30') };
    expect(planRentCharges(ended, [], [], asOf)).toEqual([]);
    expect(planRentCharges({ ...lease, status: 'ENDED' }, [], [], asOf)).toEqual([]);
    expect(planRentCharges({ ...lease, status: 'DRAFT' }, [], [], asOf)).toEqual([]);
  });

  it('rejects non-integer rent', () => {
    expect(() => planRentCharges({ ...lease, monthlyRentCents: 10.5 }, [], [], asOf)).toThrow();
  });
});

describe('balances and payments', () => {
  const rent = (month: string): LedgerCharge => ({
    leaseId: 'L1',
    kind: 'RENT',
    amountCents: 185000,
    dueDate: d(`${month}-01`),
    description: `rent:L1:${month}`,
  });

  it('shows the full rent as owed with no payments', () => {
    const balance = computeBalance([rent('2026-10')], []);
    expect(balance).toMatchObject({ chargedCents: 185000, paidCents: 0, outstandingCents: 185000 });
  });

  it('applies a partial payment and leaves the remainder outstanding', () => {
    const balance = computeBalance([rent('2026-10')], [pay(100000)]);
    expect(balance.outstandingCents).toBe(85000);
    expect(balance.allocations[0]).toMatchObject({ paidCents: 100000, outstandingCents: 85000 });
  });

  it('settles the oldest charge first and carries credit forward', () => {
    const charges = [rent('2026-10'), rent('2026-09')];
    const balance = computeBalance(charges, [pay(200000)]);
    expect(balance.allocations.map((a) => [a.charge.description, a.outstandingCents])).toEqual([
      ['rent:L1:2026-09', 0],
      ['rent:L1:2026-10', 170000],
    ]);
    const over = computeBalance([rent('2026-10')], [pay(200000)]);
    expect(over).toMatchObject({ outstandingCents: 0, creditCents: 15000 });
  });

  it('ignores pending, failed and refunded payments when settling', () => {
    const payments = [pay(185000, 'PENDING'), pay(185000, 'FAILED'), pay(185000, 'REFUNDED')];
    const balance = computeBalance([rent('2026-10')], payments);
    expect(balance.outstandingCents).toBe(185000);
    expect(balance.pendingCents).toBe(185000);
  });

  it('only counts charges due by the as-of date', () => {
    const balance = computeBalance([rent('2026-10'), rent('2026-11')], [], d('2026-10-14'));
    expect(balance.chargedCents).toBe(185000);
  });

  it('settles rent before the late fee on the same day', () => {
    const fee: LedgerCharge = {
      leaseId: 'L1',
      kind: 'LATE_FEE',
      amountCents: 7500,
      dueDate: d('2026-10-01'),
      description: 'late-fee:L1:2026-10',
    };
    const balance = computeBalance([fee, rent('2026-10')], [pay(185000)]);
    expect(balance.allocations.map((a) => [a.charge.kind, a.outstandingCents])).toEqual([
      ['RENT', 0],
      ['LATE_FEE', 7500],
    ]);
  });
});

describe('grace period and late fees', () => {
  const charges = [asCharge(planRentCharges(lease, [], [], d('2026-10-14'))[0])];

  it('treats the grace day itself as on time', () => {
    expect(isPastGrace(d('2026-10-01'), 5, d('2026-10-06'))).toBe(false);
    expect(isPastGrace(d('2026-10-01'), 5, d('2026-10-07'))).toBe(true);
    expect(isPastGrace(d('2026-10-01'), 0, d('2026-10-01'))).toBe(false);
  });

  it('refuses a fee during the grace period', () => {
    expect(assessLateFee(lease, '2026-10', charges, [], d('2026-10-06'))).toEqual({
      eligible: false,
      reason: 'in-grace',
    });
  });

  it('assesses the lease late fee after the grace period', () => {
    const decision = assessLateFee(lease, '2026-10', charges, [], d('2026-10-14'));
    expect(decision).toEqual({
      eligible: true,
      fee: {
        leaseId: 'L1',
        kind: 'LATE_FEE',
        amountCents: 7500,
        dueDate: d('2026-10-14'),
        description: 'late-fee:L1:2026-10',
      },
    });
  });

  it('uses the grace days from the lease terms', () => {
    const strict = { ...lease, graceDays: 0 };
    expect(assessLateFee(strict, '2026-10', charges, [], d('2026-10-02')).eligible).toBe(true);
    const generous = { ...lease, graceDays: 15 };
    expect(assessLateFee(generous, '2026-10', charges, [], d('2026-10-14')).eligible).toBe(false);
  });

  it('charges at most one fee per rent month', () => {
    const first = assessLateFee(lease, '2026-10', charges, [], d('2026-10-14'));
    if (!first.eligible) throw new Error('expected eligible');
    const withFee = [...charges, asCharge(first.fee)];
    expect(assessLateFee(lease, '2026-10', withFee, [], d('2026-10-20'))).toEqual({
      eligible: false,
      reason: 'already-applied',
    });
    expect(planLateFees(lease, withFee, [], d('2026-10-20'))).toEqual([]);
  });

  it('skips fees once rent is paid, or when the lease has no fee', () => {
    expect(assessLateFee(lease, '2026-10', charges, [pay(185000)], d('2026-10-14'))).toEqual({
      eligible: false,
      reason: 'paid',
    });
    expect(
      assessLateFee({ ...lease, lateFeeCents: 0 }, '2026-10', charges, [], d('2026-10-14')),
    ).toEqual({ eligible: false, reason: 'no-fee' });
    expect(assessLateFee(lease, '2026-09', charges, [], d('2026-10-14'))).toEqual({
      eligible: false,
      reason: 'no-rent-charge',
    });
  });

  it('still assesses a fee when a partial payment leaves rent unpaid', () => {
    expect(assessLateFee(lease, '2026-10', charges, [pay(100000)], d('2026-10-14')).eligible).toBe(
      true,
    );
  });

  it('batch-plans one fee for each overdue month', () => {
    const all = planRentCharges(lease, [], [pay(1, 'SUCCEEDED', '2026-08-02')], d('2026-10-14'));
    const planned = planLateFees(lease, all.map(asCharge), [], d('2026-10-14'));
    expect(planned.map((f) => f.description)).toEqual([
      'late-fee:L1:2026-08',
      'late-fee:L1:2026-09',
      'late-fee:L1:2026-10',
    ]);
  });

  it('adds the fee to the amount owed', () => {
    const decision = assessLateFee(lease, '2026-10', charges, [], d('2026-10-14'));
    if (!decision.eligible) throw new Error('expected eligible');
    const balance = computeBalance([...charges, asCharge(decision.fee)], [pay(185000)]);
    expect(balance.outstandingCents).toBe(7500);
  });
});

describe('rent roll status', () => {
  const charges = [asCharge(planRentCharges(lease, [], [], d('2026-10-14'))[0])];
  const base = { lease, month: '2026-10', charges, autopay: false };

  it('is Paid when settled payments cover rent', () => {
    expect(rentStatus({ ...base, payments: [pay(185000)], asOf: d('2026-10-14') }).status).toBe(
      'PAID',
    );
  });

  it('is Pending when an in-flight payment covers the balance', () => {
    expect(
      rentStatus({ ...base, payments: [pay(185000, 'PENDING')], asOf: d('2026-10-14') }).status,
    ).toBe('PENDING');
  });

  it('is Late when unpaid after the grace period, with the amount owed', () => {
    expect(rentStatus({ ...base, payments: [pay(60000)], asOf: d('2026-10-14') })).toMatchObject({
      status: 'LATE',
      outstandingCents: 125000,
    });
  });

  it('is Pending inside the grace period and Autopay when enrolled', () => {
    expect(rentStatus({ ...base, payments: [], asOf: d('2026-10-04') }).status).toBe('PENDING');
    expect(rentStatus({ ...base, autopay: true, payments: [], asOf: d('2026-10-04') }).status).toBe(
      'AUTOPAY',
    );
    expect(
      rentStatus({ ...base, month: '2026-11', payments: [], autopay: true, asOf: d('2026-10-14') })
        .status,
    ).toBe('AUTOPAY');
  });

  it('a failed payment leaves rent Late', () => {
    expect(
      rentStatus({ ...base, payments: [pay(185000, 'FAILED')], asOf: d('2026-10-14') }).status,
    ).toBe('LATE');
  });
});

describe('refunds', () => {
  const payment = { id: 'P1', amountCents: 185000, status: 'SUCCEEDED' as const };

  it('fully refunds by default', () => {
    expect(planRefund(payment, undefined, 'k1')).toEqual({
      kind: 'full',
      paymentId: 'P1',
      refundCents: 185000,
    });
  });

  it('splits a partial refund so received money stays auditable', () => {
    const plan = planRefund(payment, 50000, 'k1');
    expect(plan).toEqual({
      kind: 'partial',
      paymentId: 'P1',
      refundCents: 50000,
      remainingCents: 135000,
      refundReference: 'refund:P1:k1',
    });
    if (plan.kind === 'partial') expect(plan.remainingCents + plan.refundCents).toBe(185000);
  });

  it('is a no-op once refunded and rejects unsettled or oversized refunds', () => {
    expect(planRefund({ ...payment, status: 'REFUNDED' }, undefined, 'k')).toEqual({
      kind: 'noop',
      reason: 'already-refunded',
    });
    expect(() => planRefund({ ...payment, status: 'PENDING' }, undefined, 'k')).toThrow('settled');
    expect(() => planRefund(payment, 185001, 'k')).toThrow('between');
    expect(() => planRefund(payment, 0, 'k')).toThrow('between');
    expect(() => planRefund(payment, 10.5, 'k')).toThrow('whole number');
  });

  it('puts the money back on the balance', () => {
    const charge: LedgerCharge = {
      leaseId: 'L1',
      kind: 'RENT',
      amountCents: 185000,
      dueDate: d('2026-10-01'),
    };
    const after = computeBalance([charge], [pay(135000), pay(50000, 'REFUNDED')]);
    expect(after.outstandingCents).toBe(50000);
  });
});

describe('owner payouts', () => {
  const input = {
    propertyId: 'PR1',
    month: '2026-10',
    payments: [
      pay(185000, 'SUCCEEDED', '2026-10-03'),
      pay(224000, 'SUCCEEDED', '2026-10-05'),
      pay(99999, 'PENDING', '2026-10-05'),
      pay(50000, 'REFUNDED', '2026-10-06'),
      pay(175000, 'SUCCEEDED', '2026-09-28'),
    ],
    priorPayoutCents: [],
  };

  it('pays out settled collections for the month net of refunds', () => {
    expect(planOwnerPayout(input)).toMatchObject({
      collectedCents: 409000,
      paidOutCents: 0,
      readyCents: 409000,
      idempotencyKey: 'payout:PR1:2026-10:to-409000',
    });
  });

  it('subtracts what was already sent and never goes negative', () => {
    expect(planOwnerPayout({ ...input, priorPayoutCents: [300000] }).readyCents).toBe(109000);
    expect(planOwnerPayout({ ...input, priorPayoutCents: [409000] }).readyCents).toBe(0);
    expect(planOwnerPayout({ ...input, priorPayoutCents: [500000] }).readyCents).toBe(0);
  });

  it('keeps the same key for unchanged money and a new key when more arrives', () => {
    const a = planOwnerPayout(input);
    expect(planOwnerPayout(input).idempotencyKey).toBe(a.idempotencyKey);
    const more = planOwnerPayout({
      ...input,
      payments: [...input.payments, pay(10000, 'SUCCEEDED', '2026-10-09')],
    });
    expect(more.idempotencyKey).not.toBe(a.idempotencyKey);
  });
});

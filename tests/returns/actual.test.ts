import { describe, expect, it } from 'vitest';
import {
  actualPeriod,
  actualPeriodFromRange,
  allocateReceipts,
  computeActualReturns,
  resolvePeriod,
  type ActualPeriod,
  type ActualReturnsInput,
} from '../../src/lib/returns';
import { computeBalance } from '../../src/lib/ledger/core';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const t = (value: string) => new Date(value);

function period(from: string, to: string): ActualPeriod {
  const result = actualPeriod(from, to);
  if (!result.ok) throw new Error('bad period');
  return result.period;
}

const rent = (id: string, month: string, cents = 150_000) => ({
  id,
  leaseId: 'L1',
  kind: 'RENT' as const,
  amountCents: cents,
  dueDate: d(`${month}-01`),
  description: `rent:L1:${month}`,
});
const pay = (id: string, paidAt: string, cents: number, leaseId = 'L1') => ({
  id,
  leaseId,
  amountCents: cents,
  paidAt: t(paidAt),
  createdAt: t(paidAt),
});

function input(overrides: Partial<ActualReturnsInput> = {}): ActualReturnsInput {
  return {
    property: {
      id: 'P1',
      name: 'Elm',
      purchasePriceCents: 30_000_000,
      downPaymentCents: 6_000_000,
      loanAmountCents: 24_000_000,
      annualDebtServiceCents: 1_800_000,
    },
    period: period('2026-01-01', '2026-03-31'),
    asOf: t('2026-10-20T12:00:00Z'),
    leases: [{ id: 'L1', startDate: d('2025-06-01'), endDate: d('2027-05-31') }],
    charges: [rent('c1', '2026-01'), rent('c2', '2026-02'), rent('c3', '2026-03')],
    payments: [
      pay('p1', '2026-01-02T15:00:00Z', 150_000),
      pay('p2', '2026-02-03T15:00:00Z', 150_000),
      pay('p3', '2026-03-02T15:00:00Z', 150_000),
    ],
    excludedPayments: [],
    expenses: [
      {
        category: 'TAXES',
        amountCents: 120_000,
        count: 1,
        firstOn: d('2026-01-15'),
        lastOn: d('2026-01-15'),
      },
      {
        category: 'REPAIRS',
        amountCents: 30_050,
        count: 2,
        firstOn: d('2026-02-01'),
        lastOn: d('2026-03-31'),
      },
    ],
    expenseDays: [d('2026-01-15'), d('2026-02-01'), d('2026-03-31')],
    earliestExpenseOn: d('2025-06-10'),
    ...overrides,
  };
}

describe('actual period', () => {
  it('is an inclusive day range stored half-open in UTC', () => {
    const p = period('2026-01-01', '2026-03-31');
    expect(p.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(p.endExclusive.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(p.days).toBe(90);
    expect(p.wholeMonths).toBe(3);
    expect(period('2026-01-05', '2026-02-04').wholeMonths).toBeNull();
  });

  it('rejects malformed, impossible and reversed dates without clamping', () => {
    expect(actualPeriod('2026-02-30', '2026-03-01')).toMatchObject({
      ok: false,
      issues: [{ path: 'from' }],
    });
    expect(actualPeriod('2026-03-01', '2026-02-01')).toMatchObject({
      ok: false,
      issues: [{ path: 'to' }],
    });
    expect(actualPeriod(undefined, 20260101)).toMatchObject({ ok: false });
    expect(actualPeriod('1900-01-01', '2026-01-01')).toMatchObject({ ok: false });
  });

  it('reuses a returns-screen period window', () => {
    const screen = resolvePeriod('YTD', t('2026-03-15T00:00:00Z'));
    expect(actualPeriodFromRange(screen)).toMatchObject({
      from: '2026-01-01',
      to: '2026-03-31',
      wholeMonths: 3,
    });
  });

  it('counts a receipt at 23:59:59Z on the last day and excludes 00:00Z the next day', () => {
    const result = computeActualReturns(
      input({
        charges: [
          rent('c1', '2026-01'),
          rent('c2', '2026-02'),
          rent('c3', '2026-03'),
          rent('c4', '2026-04'),
        ],
        payments: [
          pay('before', '2025-12-31T23:59:59Z', 150_000),
          pay('first', '2026-01-01T00:00:00Z', 150_000),
          pay('last', '2026-03-31T23:59:59Z', 150_000),
          pay('after', '2026-04-01T00:00:00Z', 150_000),
        ],
      }),
    );
    expect(result.income.receipts.map((r) => r.paymentId)).toEqual(['first', 'last']);
  });
});

describe('recorded rent and expenses', () => {
  it('reports complete recorded actuals in integer cents with provenance', () => {
    const r = computeActualReturns(input());
    expect(r).toMatchObject({ currency: 'USD', unit: 'cents', accountingBasis: 'cash' });
    expect(r.income.confirmedRent).toMatchObject({
      status: 'recorded',
      cents: 450_000,
      coverage: { status: 'complete', observedDays: 90 },
    });
    expect(r.income.confirmedRent.sources[0]).toMatchObject({
      source: 'payment',
      ids: ['p1', 'p2', 'p3'],
      count: 3,
    });
    expect(r.expenses.total).toMatchObject({ status: 'recorded', cents: 150_050 });
    expect(r.expenses.byCategory[0]).toEqual({ category: 'TAXES', cents: 120_000, count: 1 });
    expect(r.actual.noi).toEqual({ status: 'derived', value: 299_950, unit: 'cents', missing: [] });
    expect(r.actual.periodCapRate.value).toBeCloseTo(299_950 / 30_000_000);
    expect(r.scheduled.billedRent).toMatchObject({ status: 'recorded', cents: 450_000 });
  });

  it('never adds appreciation, projected rent or assumed debt to actual results', () => {
    const r = computeActualReturns(input());
    expect(r.excludedAssumptions).toContain('appreciation');
    expect(JSON.stringify(r.actual)).not.toMatch(/apprec/i);
    // Debt is financed but loan payments are not recorded: cash flow is unavailable.
    expect(r.debtService.actual).toMatchObject({ status: 'unavailable', cents: null });
    expect(r.actual.cashFlow).toMatchObject({
      status: 'unavailable',
      value: null,
      missing: ['actualDebtService'],
    });
    expect(r.actual.periodCashOnCash).toMatchObject({ status: 'unavailable', value: null });
    // The schedule is reported separately with its basis.
    expect(r.scheduled.debtService).toMatchObject({ basis: 'scheduled', value: 450_000 });
    expect(r.estimates.cashFlowAfterScheduledDebt).toMatchObject({
      basis: 'scheduled',
      value: 299_950 - 450_000,
    });
    expect(r.estimates.annualizedNoi).toMatchObject({ basis: 'annualized', value: 299_950 * 4 });
  });

  it('does not treat the default zero annual debt service as no debt', () => {
    const p = { ...input().property, annualDebtServiceCents: 0, loanAmountCents: null };
    const r = computeActualReturns(input({ property: p }));
    expect(r.scheduled.debtService).toMatchObject({
      status: 'unavailable',
      value: null,
      missing: ['annualDebtService'],
    });
    expect(r.debtService.actual.status).toBe('unavailable');
  });

  it('uses an explicit zero loan as recorded zero debt service', () => {
    const p = {
      ...input().property,
      annualDebtServiceCents: 0,
      loanAmountCents: 0,
      downPaymentCents: null,
    };
    const r = computeActualReturns(input({ property: p }));
    expect(r.debtService.actual).toMatchObject({ status: 'zero', cents: 0 });
    expect(r.actual.cashFlow).toMatchObject({ status: 'derived', value: 299_950 });
    // Unfinanced: cash invested is the purchase price.
    expect(r.actual.periodCashOnCash.value).toBeCloseTo(299_950 / 30_000_000);
  });
});

describe('classification of receipts', () => {
  it('applies payments like the ledger and keeps mixed and unapplied receipts out of rent', () => {
    const charges = [
      rent('c1', '2026-01'),
      {
        id: 'dep',
        leaseId: 'L1',
        kind: 'DEPOSIT' as const,
        amountCents: 100_000,
        dueDate: d('2026-01-01'),
      },
      {
        id: 'fee',
        leaseId: 'L1',
        kind: 'LATE_FEE' as const,
        amountCents: 5_000,
        dueDate: d('2026-02-10'),
      },
      rent('c2', '2026-02'),
    ];
    const payments = [
      pay('rentOnly', '2026-01-01T10:00:00Z', 150_000),
      pay('depositPlusRent', '2026-01-02T10:00:00Z', 160_000), // 100k deposit + 60k Feb rent
      pay('restOfRent', '2026-02-12T10:00:00Z', 90_000),
      pay('lateFee', '2026-02-13T10:00:00Z', 5_000),
      pay('credit', '2026-02-20T10:00:00Z', 40_000),
    ];
    const r = computeActualReturns(
      input({ charges, payments, period: period('2026-01-01', '2026-02-28') }),
    );
    const cls = Object.fromEntries(r.income.receipts.map((x) => [x.paymentId, x.classification]));
    expect(cls).toEqual({
      rentOnly: 'rent',
      depositPlusRent: 'mixed',
      restOfRent: 'rent',
      lateFee: 'otherIncome',
      credit: 'unapplied',
    });
    expect(r.income.confirmedRent).toMatchObject({
      status: 'recorded',
      cents: 240_000,
      coverage: { status: 'partial' },
    });
    expect(r.income.mixedReceipts).toMatchObject({ cents: 160_000, allocatedRentCents: 60_000 });
    expect(r.income.unappliedReceipts.cents).toBe(40_000);
    expect(r.income.otherIncome.cents).toBe(5_000);
    expect(r.income.totalReceipts.cents).toBe(445_000);
    expect(r.actual.operatingIncome).toMatchObject({ status: 'partial', value: 245_000 });
    expect(r.actual.noi.status).toBe('partial');
    expect(r.actual.noi.missing.join(' ')).toMatch(/mixed receipts/);

    // Per-charge totals match the ledger's own computeBalance allocation.
    const applied = allocateReceipts(charges, payments);
    const rentApplied = [...applied.values()].reduce((s, a) => s + a.RENT, 0);
    const ledger = computeBalance(
      charges.map((c) => ({ ...c, amountCents: c.amountCents })),
      payments.map((p) => ({ ...p, status: 'SUCCEEDED' as const })),
    );
    expect(rentApplied).toBe(
      ledger.allocations
        .filter((a) => a.charge.kind === 'RENT')
        .reduce((s, a) => s + a.paidCents, 0),
    );
    expect([...applied.values()].reduce((s, a) => s + a.UNAPPLIED, 0)).toBe(ledger.creditCents);
  });

  it('allocates against earlier history before classifying a receipt in the period', () => {
    // A December receipt prepaid January, so the January receipt settles February rent.
    const r = computeActualReturns(
      input({
        payments: [
          pay('dec', '2025-12-20T00:00:00Z', 150_000),
          pay('jan', '2026-01-05T00:00:00Z', 150_000),
        ],
        period: period('2026-01-01', '2026-01-31'),
      }),
    );
    expect(r.income.receipts).toMatchObject([{ paymentId: 'jan', classification: 'rent' }]);
    expect(r.income.totalReceipts.cents).toBe(150_000);
  });

  it('summarizes excluded statuses and undated settled payments', () => {
    const r = computeActualReturns(
      input({
        payments: [
          ...input().payments,
          { id: 'nodate', leaseId: 'L1', amountCents: 1, paidAt: null, createdAt: t('2026-01-01') },
        ],
        excludedPayments: [
          { status: 'PENDING', amountCents: 150_000 },
          { status: 'FAILED', amountCents: 99_999 },
          { status: 'REFUNDED', amountCents: 2_500 },
        ],
      }),
    );
    expect(r.income.excluded).toEqual({
      pendingCents: 150_000,
      failedCount: 1,
      refundedCents: 2_500,
      undatedCount: 1,
    });
    expect(r.income.totalReceipts.cents).toBe(450_000);
  });
});

describe('unknown, partial and zero observations', () => {
  it('reports an empty history as unavailable, never zero', () => {
    const r = computeActualReturns(
      input({ leases: [], charges: [], payments: [], expenses: [], earliestExpenseOn: null }),
    );
    expect(r.income.confirmedRent).toMatchObject({
      status: 'unavailable',
      cents: null,
      coverage: { status: 'none' },
    });
    expect(r.expenses.total).toMatchObject({ status: 'unavailable', cents: null });
    expect(r.actual.noi).toMatchObject({
      status: 'unavailable',
      value: null,
      missing: ['confirmedRent', 'expenses'],
    });
    expect(r.actual.expenseRatio.value).toBeNull();
    expect(r.estimates.annualizedNoi.value).toBeNull();
  });

  it('distinguishes rent charged but not collected (zero) from no ledger (unavailable)', () => {
    const r = computeActualReturns(input({ payments: [] }));
    expect(r.income.confirmedRent).toMatchObject({
      status: 'zero',
      cents: 0,
      coverage: { status: 'complete' },
    });
    expect(r.scheduled.billedRent.cents).toBe(450_000);
    expect(r.actual.noi).toMatchObject({ status: 'derived', value: -150_050 });
    expect(r.actual.expenseRatio).toMatchObject({
      status: 'unavailable',
      missing: ['positive operating income'],
    });
  });

  it('keeps a period without expense rows unavailable, but a recorded zero sum is zero', () => {
    const none = computeActualReturns(input({ expenses: [], expenseDays: [] }));
    expect(none.expenses.total).toMatchObject({ status: 'unavailable', cents: null });
    expect(none.expenses.total.reason).toMatch(/not a zero/);
    expect(none.actual.noi).toMatchObject({ status: 'unavailable', missing: ['expenses'] });
    const zero = computeActualReturns(
      input({
        expenses: [
          {
            category: 'OTHER',
            amountCents: 0,
            count: 1,
            firstOn: d('2026-01-02'),
            lastOn: d('2026-01-02'),
          },
        ],
      }),
    );
    expect(zero.expenses.total).toMatchObject({ status: 'zero', cents: 0 });
    expect(zero.actual.noi).toMatchObject({ status: 'derived', value: 450_000 });
  });

  it('marks history starting inside the period, and periods past the as-of date, as partial', () => {
    const late = computeActualReturns(
      input({
        leases: [{ id: 'L1', startDate: d('2026-02-01'), endDate: d('2027-01-31') }],
        charges: [rent('c2', '2026-02'), rent('c3', '2026-03')],
        payments: [pay('p2', '2026-02-03T15:00:00Z', 150_000)],
        earliestExpenseOn: d('2026-03-01'),
        expenseDays: [d('2026-03-01')],
        expenses: [
          {
            category: 'TAXES',
            amountCents: 10_000,
            count: 1,
            firstOn: d('2026-03-01'),
            lastOn: d('2026-03-01'),
          },
        ],
      }),
    );
    expect(late.income.confirmedRent.coverage).toMatchObject({
      status: 'partial',
      observedDays: 59,
      recordedFrom: '2026-02-01',
    });
    expect(late.expenses.total.coverage).toMatchObject({ status: 'partial', observedDays: 31 });
    expect(late.actual.noi.status).toBe('partial');
    expect(late.estimates.annualizedNoi.status).toBe('partial');

    const future = computeActualReturns(input({ asOf: t('2026-02-14T08:00:00Z') }));
    expect(future.income.confirmedRent.coverage).toMatchObject({
      status: 'partial',
      observedDays: 45,
      recordedTo: '2026-02-14',
    });
    expect(future.income.confirmedRent.coverage.gaps.join(' ')).toMatch(/as-of date/);
  });

  it('reports no coverage when the period precedes every record', () => {
    const r = computeActualReturns(
      input({ period: period('2024-01-01', '2024-12-31'), expenses: [] }),
    );
    expect(r.income.confirmedRent).toMatchObject({
      status: 'unavailable',
      coverage: { status: 'none' },
    });
    expect(r.expenses.total).toMatchObject({ status: 'unavailable', coverage: { status: 'none' } });
  });

  it('never lets an old lease or charge establish coverage or zero collections later', () => {
    const r = computeActualReturns(
      input({
        leases: [{ id: 'L1', startDate: d('2020-01-01'), endDate: d('2020-12-31') }],
        charges: [{ ...rent('old', '2020-03'), dueDate: d('2020-03-01') }],
        payments: [],
      }),
    );
    expect(r.income.confirmedRent).toMatchObject({
      status: 'unavailable',
      cents: null,
      coverage: { status: 'none', observedDays: 0, hasHistory: true },
    });
    expect(r.income.totalReceipts.status).toBe('unavailable');
    expect(r.scheduled.billedRent.status).toBe('unavailable');
    expect(r.actual.operatingIncome).toMatchObject({ status: 'unavailable', value: null });
    expect(r.actual.noi.value).toBeNull();
  });

  it('keeps lease months without rent charges unverified instead of zero', () => {
    const noReceipts = computeActualReturns(
      input({ charges: [rent('c1', '2026-01')], payments: [] }),
    );
    expect(noReceipts.income.confirmedRent).toMatchObject({
      status: 'unavailable',
      cents: null,
      coverage: { status: 'partial', observedDays: 31, recordedTo: '2026-01-31' },
    });
    expect(noReceipts.income.confirmedRent.reason).toMatch(/not \$0/);
    expect(noReceipts.income.confirmedRent.coverage.gaps.join(' ')).toMatch(
      /2026-02-01 – 2026-03-31/,
    );
    // Recorded receipts stay visible as an observed total, flagged partial.
    const observed = computeActualReturns(input({ charges: [rent('c1', '2026-01')] }));
    expect(observed.income.confirmedRent).toMatchObject({
      status: 'recorded',
      coverage: { status: 'partial' },
    });
    expect(observed.actual.operatingIncome.status).toBe('partial');
    expect(observed.estimates.annualizedNoi.status).toBe('partial');
  });

  it('counts only months with recorded expenses as expense coverage', () => {
    const r = computeActualReturns(
      input({
        earliestExpenseOn: d('2024-05-01'),
        expenseDays: [d('2026-01-15')],
        expenses: [
          {
            category: 'TAXES',
            amountCents: 120_000,
            count: 1,
            firstOn: d('2026-01-15'),
            lastOn: d('2026-01-15'),
          },
        ],
      }),
    );
    expect(r.expenses.total).toMatchObject({
      status: 'recorded',
      cents: 120_000,
      coverage: { status: 'partial', observedDays: 31 },
    });
    expect(r.expenses.total.coverage.gaps.join(' ')).toMatch(/No expense recorded in 2026-02-01/);
    expect(r.actual.noi).toMatchObject({ status: 'partial', value: 330_000 });
    expect(r.actual.periodCapRate.status).toBe('partial');
    expect(r.actual.expenseRatio.status).toBe('partial');
  });

  it('propagates undated receipts on leases in the period to coverage and metrics', () => {
    const undated = {
      id: 'nodate',
      leaseId: 'L1',
      amountCents: 150_000,
      paidAt: null,
      createdAt: t('2026-04-10'),
    };
    const r = computeActualReturns(input({ payments: [...input().payments, undated] }));
    expect(r.income.confirmedRent).toMatchObject({
      status: 'recorded',
      cents: 450_000,
      coverage: { status: 'partial', observedDays: 90 },
    });
    expect(r.income.confirmedRent.coverage.gaps.join(' ')).toMatch(/no paid date/);
    expect(r.actual.noi.status).toBe('partial');
    // With no dated receipt, the undated one prevents an inferred $0.
    const onlyUndated = computeActualReturns(input({ payments: [undated] }));
    expect(onlyUndated.income.confirmedRent).toMatchObject({ status: 'unavailable', cents: null });
    // An undated receipt on a lease outside the period does not touch it.
    const elsewhere = computeActualReturns(
      input({
        leases: [
          ...input().leases,
          { id: 'L2', startDate: d('2021-01-01'), endDate: d('2021-12-31') },
        ],
        payments: [...input().payments, { ...undated, leaseId: 'L2' }],
      }),
    );
    expect(elsewhere.income.confirmedRent.coverage.status).toBe('complete');
  });

  it('derives ratios only with supported denominators', () => {
    const p = { ...input().property, purchasePriceCents: null };
    const r = computeActualReturns(input({ property: p }));
    expect(r.actual.periodCapRate).toMatchObject({
      status: 'unavailable',
      missing: ['purchasePrice'],
    });
    expect(r.estimates.annualizedCapRate.value).toBeNull();
  });
});

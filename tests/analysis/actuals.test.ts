import { describe, expect, it } from 'vitest';
import {
  actualWindow,
  compareActualToProjection,
  comparisonCsv,
  comparisonFileName,
  neededInputs,
  periodChoiceFrom,
  periodChoiceParams,
  type ProjectionYear,
} from '@/lib/analysis/actuals';
import { actualPeriod, computeActualReturns, type ActualReturnsInput } from '@/lib/returns/actual';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const t = (value: string) => new Date(value);
const rent = (id: string, month: string) => ({
  id,
  leaseId: 'L1',
  kind: 'RENT' as const,
  amountCents: 150_000,
  dueDate: d(`${month}-01`),
  description: `rent:L1:${month}`,
});
const pay = (id: string, paidAt: string, cents: number) => ({
  id,
  leaseId: 'L1',
  amountCents: cents,
  paidAt: t(paidAt),
  createdAt: t(paidAt),
});
function quarter() {
  const p = actualPeriod('2026-01-01', '2026-03-31');
  if (!p.ok) throw new Error('bad period');
  return p.period;
}
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
    period: quarter(),
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
        amountCents: 150_050,
        count: 2,
        firstOn: d('2026-01-15'),
        lastOn: d('2026-03-15'),
      },
    ],
    expenseDays: [d('2026-01-15'), d('2026-02-15'), d('2026-03-15')],
    earliestExpenseOn: d('2025-06-10'),
    ...overrides,
  };
}
const projection: ProjectionYear = {
  effectiveGrossIncome: 20_000,
  totalOperatingExpenses: 6_000,
  noi: 14_000,
  annualDebtService: 9_000,
  annualCashFlow: 5_000,
};
const row = (c: ReturnType<typeof compareActualToProjection>, key: string) =>
  c.rows.find((r) => r.key === key)!;

describe('actual versus projected comparison', () => {
  it('scales the Year-1 projection to the same period and differences only complete actuals', () => {
    const c = compareActualToProjection(computeActualReturns(input()), projection);
    expect(c.scale).toBe(0.25);
    expect(c.scaleLabel).toBe('3 of 12 months');
    expect(row(c, 'income')).toMatchObject({
      actual: { status: 'recorded', cents: 450_000 },
      projected: { status: 'projected', cents: 500_000 },
      difference: { cents: -50_000, reason: null },
    });
    expect(row(c, 'expenses').difference.cents).toBe(50);
    expect(row(c, 'expenses').costLike).toBe(true);
    expect(row(c, 'noi')).toMatchObject({
      actual: { cents: 299_950 },
      projected: { cents: 350_000 },
      difference: { cents: -50_050 },
    });
    // Loan payments are not recorded: actual debt service and cash flow stay unavailable,
    // while the projection keeps its own modeled values.
    expect(row(c, 'debtService')).toMatchObject({
      actual: { status: 'unavailable', cents: null },
      projected: { cents: 225_000 },
      difference: { cents: null, reason: 'Actual not recorded' },
    });
    expect(row(c, 'cashFlow').actual).toMatchObject({ status: 'unavailable', cents: null });
    expect(row(c, 'cashFlow').actual.notes).toContain('loan payments are not recorded');
  });

  it('keeps partial actuals visible but never differences them', () => {
    const actual = computeActualReturns(
      input({ payments: [...input().payments, pay('p4', '2026-03-20T15:00:00Z', 40_000)] }),
    );
    const c = compareActualToProjection(actual, projection);
    expect(row(c, 'income').actual.status).toBe('partial');
    expect(row(c, 'income').actual.cents).toBe(450_000);
    expect(row(c, 'income').difference).toEqual({ cents: null, reason: 'Actual is partial' });
    expect(neededInputs('P1', actual, 0).map((n) => n.id)).toContain('unclassified');
  });

  it('shows no data as unavailable, never zero, with actionable inputs', () => {
    const actual = computeActualReturns(
      input({ leases: [], charges: [], payments: [], expenses: [], earliestExpenseOn: null }),
    );
    const c = compareActualToProjection(actual, null);
    expect(c.projectionAvailable).toBe(false);
    for (const r of c.rows) {
      expect(r.projected).toEqual({ status: 'unavailable', cents: null });
      expect(r.difference.cents).toBeNull();
    }
    for (const key of ['income', 'expenses', 'noi', 'cashFlow'])
      expect(row(c, key).actual).toMatchObject({ status: 'unavailable', cents: null });
    const needed = neededInputs('P 1', actual, 3);
    expect(needed.map((n) => n.id)).toEqual(['assumptions', 'rent', 'expenses', 'loan-payments']);
    expect(needed[0]).toMatchObject({
      action: 'assumptions',
      text: expect.stringContaining('3 ROI assumptions'),
    });
    expect(needed[1].href).toBe('/properties/P%201/leases');
    expect(needed[2].href).toBe('/returns?property=P+1&add=1#add-expense');
  });

  it('treats an explicit zero loan as recorded zero debt service', () => {
    const actual = computeActualReturns(
      input({
        property: { ...input().property, loanAmountCents: 0, annualDebtServiceCents: 0 },
      }),
    );
    const c = compareActualToProjection(actual, projection);
    expect(row(c, 'debtService').actual).toMatchObject({ status: 'zero', cents: 0 });
    expect(row(c, 'cashFlow').actual).toMatchObject({ status: 'recorded', cents: 299_950 });
    expect(neededInputs('P1', actual, 0)).toEqual([]);
  });

  it('asks for financing when it is unknown', () => {
    const actual = computeActualReturns(
      input({
        property: { ...input().property, loanAmountCents: null, annualDebtServiceCents: 0 },
      }),
    );
    expect(neededInputs('P1', actual, 0).find((n) => n.id === 'financing')?.href).toBe(
      '/properties/P1/edit',
    );
  });
});

describe('comparison export', () => {
  it('reconciles to the comparison cell for cell, keeping partial and unavailable values', () => {
    const actual = computeActualReturns(
      input({ charges: [rent('c1', '2026-01'), rent('c2', '2026-02')] }),
    );
    const c = compareActualToProjection(actual, projection);
    const csv = comparisonCsv(actual, c, {
      propertyId: 'P1',
      propertyName: '=Elm',
      windowLabel: 'Jan 1, 2026 – Mar 31, 2026',
      projectionBasis: 'Saved analysis, revision 2',
    });
    const lines = csv.trim().split('\n');
    // Text that could run as a formula is neutralised; numbers stay numeric, even negative.
    expect(lines[0]).toBe("Property,'=Elm");
    expect(csv).toContain('Period from,2026-01-01\nPeriod to (inclusive),2026-03-31');
    for (const r of c.rows) {
      const cells = lines.find((l) => l.startsWith(`${r.label},`))!.split(',');
      expect(cells[1]).toBe(r.actual.status);
      expect(cells[2]).toBe(r.actual.cents == null ? '' : (r.actual.cents / 100).toFixed(2));
      expect(cells[4]).toBe(r.projected.cents == null ? '' : (r.projected.cents / 100).toFixed(2));
      expect(cells[5]).toBe(
        r.difference.cents == null ? '' : (r.difference.cents / 100).toFixed(2),
      );
    }
    expect(row(c, 'income').actual.status).toBe('partial');
    expect(csv).toMatch(/^Operating income,partial,3000\.00,projected,5000\.00,,/m);
    expect(csv).toMatch(/^Debt service,unavailable,,projected,2250\.00,,/m);
    expect(csv).toMatch(/^Rent records,partial,59,90,/m);
    expect(csv).toMatch(
      /^Cash flow after scheduled debt \(estimate\),partial,-3000\.50,scheduled,/m,
    );
    expect(comparisonFileName(actual)).toBe('actual-vs-projected-elm-2026-01-01-to-2026-03-31.csv');
  });
});

describe('needed inputs for unverified history', () => {
  it('explains old-only ledgers and month gaps instead of asking for nothing', () => {
    const old = computeActualReturns(
      input({
        leases: [{ id: 'L1', startDate: d('2020-01-01'), endDate: d('2020-12-31') }],
        charges: [rent('c0', '2020-02')],
        payments: [],
      }),
    );
    const rentNeed = neededInputs('P1', old, 0).find((n) => n.id === 'rent')!;
    expect(rentNeed.text).toMatch(/not \$0/);
    expect(rentNeed.linkLabel).toBe('Review leases');
    const gapped = computeActualReturns(input({ expenseDays: [d('2026-01-15')] }));
    expect(neededInputs('P1', gapped, 0).find((n) => n.id === 'expense-window')?.text).toMatch(
      /31 of 90 days.*unverified, not \$0/,
    );
  });
});

describe('shared period', () => {
  const now = t('2026-10-20T12:00:00Z');
  it('stops rolling windows at today and keeps past custom months whole', () => {
    expect(actualWindow({ key: '12M' }, now)).toMatchObject({
      from: '2025-11-01',
      to: '2026-10-20',
      throughToday: true,
    });
    expect(actualWindow({ key: 'CUSTOM', from: '2026-01', to: '2026-03' }, now)).toMatchObject({
      from: '2026-01-01',
      to: '2026-03-31',
      throughToday: false,
      label: 'Jan 1, 2026 – Mar 31, 2026',
    });
  });

  it('round-trips through the URL and keeps plain property links unchanged', () => {
    const q = (s: string) => new URLSearchParams(s);
    expect(periodChoiceFrom(null)).toEqual({ key: '12M' });
    expect(periodChoiceFrom(q('period=ALL'))).toEqual({ key: '12M' });
    expect(periodChoiceFrom(q('period=CUSTOM&from=2026-01'))).toEqual({ key: '12M' });
    expect(periodChoiceFrom(q('period=YTD'))).toEqual({ key: 'YTD' });
    expect(periodChoiceParams({ key: '12M' })).toEqual({});
    const custom = periodChoiceFrom(q('period=CUSTOM&from=2026-01&to=2026-03'));
    expect(periodChoiceParams(custom)).toEqual({
      period: 'CUSTOM',
      from: '2026-01',
      to: '2026-03',
    });
  });
});

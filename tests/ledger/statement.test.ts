import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  applyPayments,
  buildLeaseStatement,
  ChargeInputError,
  createCharge,
  describeCharge,
  formatMoney,
  isReservedDescription,
  periodLabel,
  summarizeUnits,
  type LedgerGroup,
  loadPropertyLedger,
  scheduledRent,
  statementStatus,
  type LeaseTerms,
  type LedgerCharge,
  type LedgerPayment,
} from '../../src/lib/ledger';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const asOf = d('2026-10-15');

const lease: LeaseTerms = {
  id: 'L1',
  startDate: d('2026-05-01'),
  endDate: d('2027-04-30'),
  monthlyRentCents: 342_500,
  lateFeeCents: 5_000,
  graceDays: 5,
  status: 'ACTIVE',
};
const rent = (month: string, id = `c-${month}`): LedgerCharge => ({
  id,
  leaseId: 'L1',
  kind: 'RENT',
  amountCents: 342_500,
  dueDate: d(`${month}-01`),
  description: `rent:L1:${month}`,
});
const pay = (id: string, cents: number, at: string, ref = `manual:${id}`): LedgerPayment => ({
  id,
  leaseId: 'L1',
  amountCents: cents,
  status: 'SUCCEEDED',
  paidAt: d(at),
  providerReference: ref,
});

describe('scheduled rent', () => {
  const stored = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((m) =>
    rent(m),
  );

  it('derives the rest of the lease term without duplicating stored months', () => {
    const upcoming = scheduledRent(lease, stored, asOf);
    expect(upcoming.map((c) => c.description)).toEqual(
      ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'].map((m) => `rent:L1:${m}`),
    );
    expect(upcoming.every((c) => !c.id && c.amountCents === 342_500)).toBe(true);
  });

  it('never invents past months and skips non-active leases', () => {
    expect(scheduledRent(lease, [], asOf).map((c) => c.description)[0]).toBe('rent:L1:2026-11');
    expect(scheduledRent({ ...lease, status: 'ENDED' }, stored, asOf)).toEqual([]);
  });
});

describe('payment application and balance', () => {
  it('applies settled payments oldest first and records which payment paid what', () => {
    const charges = [rent('2026-09'), rent('2026-10')];
    const map = applyPayments(charges, [
      pay('p2', 100_000, '2026-10-03'),
      pay('p1', 400_000, '2026-09-02'),
      { ...pay('px', 999_999, '2026-09-05'), status: 'FAILED' },
    ]);
    expect(map.get(charges[0])?.map((a) => [a.paymentId, a.amountCents])).toEqual([
      ['p1', 342_500],
    ]);
    expect(map.get(charges[1])?.map((a) => [a.paymentId, a.amountCents])).toEqual([
      ['p1', 57_500],
      ['p2', 100_000],
    ]);
  });

  it('balance is charges due minus payments; scheduled rent does not count', () => {
    const charges = ['2026-09', '2026-10'].map((m) => rent(m));
    const none = buildLeaseStatement({ lease, charges, payments: [], asOf });
    expect(none.balanceCents).toBe(685_000);
    expect(none.rows.filter((r) => r.status === 'SCHEDULED').length).toBe(6);
    const partial = buildLeaseStatement({
      lease,
      charges,
      payments: [pay('p1', 400_000, '2026-09-02')],
      asOf,
    });
    expect(partial.balanceCents).toBe(285_000);
    const over = buildLeaseStatement({
      lease,
      charges,
      payments: [pay('p1', 700_000, '2026-09-02')],
      asOf,
    });
    expect(over.balanceCents).toBe(-15_000);
  });

  it('uses the sample statuses: Paid, Partially paid, Late, Scheduled', () => {
    const statement = buildLeaseStatement({
      lease: { ...lease, graceDays: 20 },
      charges: ['2026-08', '2026-09', '2026-10'].map((m) => rent(m)),
      payments: [pay('p1', 342_500 + 100_000, '2026-08-02')],
      asOf,
    });
    const byMonth = Object.fromEntries(
      statement.rows.map((r) => [r.dueDate.toISOString().slice(0, 7), r]),
    );
    expect(byMonth['2026-08'].status).toBe('PAID');
    expect(byMonth['2026-09'].status).toBe('LATE');
    expect(byMonth['2026-09'].balanceCents).toBe(242_500);
    expect(byMonth['2026-10'].status).toBe('DUE');
    expect(byMonth['2026-11'].status).toBe('SCHEDULED');
    expect(
      statementStatus({
        amountCents: 1000,
        paidCents: 400,
        dueDate: d('2026-10-10'),
        graceDays: 30,
        asOf,
      }),
    ).toBe('PARTIAL');
  });

  it('formats money with two places and describes generated charges', () => {
    expect(formatMoney(339_500)).toBe('$3,395.00');
    expect(formatMoney(-1_250)).toBe('-$12.50');
    expect(describeCharge({ kind: 'RENT', description: 'rent:L1:2026-10' })).toBe(
      'October rent',
    );
    expect(describeCharge({ kind: 'OTHER', description: 'Pet fee' })).toBe('Pet fee');
  });
});

type FakeLease = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: string;
  lateFee: string;
  graceDays: number;
  unit: { number: string; isImplicit: boolean; property: { name: string } };
  tenants: { tenant: { id: string; name: string } }[];
  charges: {
    id: string;
    leaseId: string;
    kind: 'RENT';
    amount: string;
    dueDate: Date;
    description: string | null;
  }[];
  payments: [];
};
const fakeLease = (over: Partial<FakeLease>): FakeLease => ({
  id: 'L1',
  status: 'ACTIVE',
  startDate: lease.startDate,
  endDate: lease.endDate,
  monthlyRent: '3425.00',
  lateFee: '50.00',
  graceDays: 5,
  unit: { number: '4B', isImplicit: false, property: { name: 'Maple Court' } },
  tenants: [{ tenant: { id: 't1', name: 'Alex Rivera' } }],
  charges: [],
  payments: [],
  ...over,
});

describe('property ledger grouping', () => {
  it('groups by lease term, active first, with charge counts and active tenants', async () => {
    const client = {
      lease: {
        findMany: vi.fn().mockResolvedValue([
          fakeLease({
            id: 'OLD',
            status: 'ENDED',
            startDate: d('2025-05-01'),
            endDate: d('2026-04-30'),
            tenants: [{ tenant: { id: 't0', name: 'Old Tenant' } }],
            charges: [
              {
                id: 'o1',
                leaseId: 'OLD',
                kind: 'RENT',
                amount: '3000.00',
                dueDate: d('2025-05-01'),
                description: 'rent:OLD:2025-05',
              },
            ],
          }),
          fakeLease({
            charges: [
              {
                id: 'c1',
                leaseId: 'L1',
                kind: 'RENT',
                amount: '3425.00',
                dueDate: d('2026-10-01'),
                description: 'rent:L1:2026-10',
              },
            ],
          }),
        ]),
      },
    } as unknown as PrismaClient;
    const ledger = await loadPropertyLedger('org1', { propertyId: 'P1' }, asOf, client);
    expect(ledger.groups.map((g) => [g.leaseId, g.active, g.label])).toEqual([
      ['L1', true, 'Oct 2026 – Apr 2027'],
      ['OLD', false, 'May 2025'],
    ]);
    expect(ledger.groups[0].rows).toHaveLength(7); // 1 stored + 6 scheduled
    expect(ledger.groups[1].rows).toHaveLength(1);
    expect(ledger.tenants.map((t) => t.name)).toEqual(['Alex Rivera']);
    expect(ledger.balanceCents).toBe(342_500);
    const where = (client.lease.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.organizationId).toBe('org1');
    expect(where.unit).toEqual({ propertyId: 'P1' });
  });
});

describe('createCharge', () => {
  const base = {
    organizationId: 'org1',
    propertyId: 'P1',
    leaseId: 'L1',
    kind: 'OTHER',
    description: 'Pet fee',
    dueDate: d('2026-10-20'),
    amountCents: 15_000,
  };
  const clientWith = (found: unknown) => {
    const create = vi.fn().mockResolvedValue({ id: 'new1' });
    const findFirst = vi.fn().mockResolvedValue(found);
    return {
      client: { lease: { findFirst }, charge: { create } } as unknown as PrismaClient,
      create,
      findFirst,
    };
  };

  it('scopes the lease lookup to organization, property and unit before writing', async () => {
    const { client, create, findFirst } = clientWith({ id: 'L1' });
    await expect(createCharge({ ...base, unitId: 'U1' }, client)).resolves.toEqual({
      chargeId: 'new1',
    });
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'L1',
      organizationId: 'org1',
      unit: { propertyId: 'P1', id: 'U1' },
    });
    expect(create.mock.calls[0][0].data).toMatchObject({
      organizationId: 'org1',
      leaseId: 'L1',
      kind: 'OTHER',
      amount: '150.00',
      description: 'Pet fee',
    });
  });

  it('writes nothing when the lease is outside the organization, property or unit', async () => {
    const { client, create } = clientWith(null);
    await expect(createCharge(base, client)).rejects.toThrow('Lease not found');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects bad input without touching the database', async () => {
    const { client, create, findFirst } = clientWith({ id: 'L1' });
    for (const bad of [
      { amountCents: 0 },
      { amountCents: -5 },
      { amountCents: 1.5 },
      { description: '   ' },
      { description: 'rent:L1:2026-11' },
      { description: 'Late-Fee:L1:2026-11' },
      { kind: 'RENT' },
      { dueDate: new Date('nope') },
    ])
      await expect(createCharge({ ...base, ...bad }, client)).rejects.toBeInstanceOf(
        ChargeInputError,
      );
    expect(findFirst).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(isReservedDescription('Pet rent: extra')).toBe(false);
  });
});

describe('short charge descriptions', () => {
  it('names the charge without the property or unit', () => {
    expect(describeCharge({ kind: 'RENT', description: 'rent:L1:2026-08' })).toBe('August rent');
    expect(describeCharge({ kind: 'RENT', description: 'prorated:L1:2026-05-10' })).toBe('Prorated May rent');
    expect(describeCharge({ kind: 'LATE_FEE', description: 'late-fee:L1:2026-08' })).toBe('August late fee');
    expect(describeCharge({ kind: 'DEPOSIT', description: 'setup:deposit:L1' })).toBe('Security deposit');
    expect(describeCharge({ kind: 'OTHER', description: 'setup:move-in-fee:L1' })).toBe('Move-in fee');
    expect(describeCharge({ kind: 'OTHER', description: null })).toBe('Fee');
  });

  it('keeps the stored de-duplication key untouched', () => {
    const [row] = buildLeaseStatement({
      lease,
      charges: [{ id: 'c1', leaseId: 'L1', kind: 'RENT', amountCents: 100, dueDate: d('2026-10-01'), description: 'rent:L1:2026-10' }],
      payments: [],
      asOf,
    }).rows;
    expect(row.description).toBe('October rent');
    expect(scheduledRent(lease, [{ leaseId: 'L1', kind: 'RENT', amountCents: 100, dueDate: d('2026-11-01'), description: 'rent:L1:2026-11' }], asOf).map((c) => c.description)).not.toContain('rent:L1:2026-11');
  });
});

describe('periodLabel', () => {
  const term = { start: d('2026-01-01'), end: d('2026-12-31') };
  const rows = (...dates: string[]) => dates.map((x) => ({ dueDate: d(x) }));
  it('uses the lease term only when the listed charges span it', () => {
    expect(periodLabel(term, rows('2026-01-01', '2026-06-01', '2026-12-01'))).toBe('Jan 2026 – Dec 2026');
  });
  it('uses the range of listed charges otherwise', () => {
    expect(periodLabel(term, rows('2026-08-01', '2026-12-01'))).toBe('Aug 2026 – Dec 2026');
    expect(periodLabel(term, rows('2026-08-01'))).toBe('Aug 2026');
  });
  it('falls back to the term with no charges', () => {
    expect(periodLabel(term, [])).toBe('Jan 2026 – Dec 2026');
  });
});

describe('summarizeUnits', () => {
  const row = (status: 'PAID' | 'LATE' | 'DUE' | 'SCHEDULED', due: string, balance: number) =>
    ({ status, dueDate: d(due), balanceCents: balance }) as LedgerGroup['rows'][number];
  const group = (over: Partial<LedgerGroup>): LedgerGroup => ({
    leaseId: 'L', label: '', unitId: 'U', unitLabel: '1', balanceCents: 0, singleUnit: false,
    active: true, tenants: [{ id: 't', name: 'T', initials: 'T' }], rows: [], ...over,
  });
  it('sorts late units first, picks the next unpaid charge and totals balances', () => {
    const { units, totalBalanceCents } = summarizeUnits([
      group({ leaseId: 'A', unitId: 'UA', unitLabel: '1', balanceCents: 0, rows: [row('PAID', '2026-10-01', 0), row('SCHEDULED', '2026-11-01', 100)] }),
      group({ leaseId: 'B', unitId: 'UB', unitLabel: '2', balanceCents: 100, rows: [row('LATE', '2026-10-01', 100), row('SCHEDULED', '2026-11-01', 100)] }),
      group({ leaseId: 'C', unitId: 'UC', unitLabel: '10', balanceCents: 50, rows: [row('DUE', '2026-10-15', 50)] }),
      group({ leaseId: 'OLD', unitId: 'UD', unitLabel: '3', active: false, balanceCents: 999 }),
    ]);
    expect(units.map((u) => [u.unitLabel, u.status])).toEqual([['2', 'LATE'], ['10', 'DUE'], ['1', 'CURRENT']]);
    expect(units[0].nextDue).toEqual({ dueDate: d('2026-11-01'), amountCents: 100 });
    expect(units[1].nextDue?.amountCents).toBe(50);
    expect(totalBalanceCents).toBe(150);
  });
});

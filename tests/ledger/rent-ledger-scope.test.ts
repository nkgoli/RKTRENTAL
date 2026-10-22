import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  lastSettledPayment,
  leaseLedger,
  loadPropertyLedger,
  summarizeUnits,
} from '../../src/lib/ledger';
import { toLastPayment, toLedgerRows } from '../../src/components/payments/ledger-view';

/**
 * One data set read through every Rent ledger scope: the lease page, the unit Payments tab and the
 * property Payments tab must agree on balance, last payment, statuses and rows.
 */
const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const asOf = d('2026-10-15');

type Unit = { id: string; propertyId: string; number: string; isImplicit: boolean };
const units: Record<string, Unit> = {
  U1: { id: 'U1', propertyId: 'P', number: 'Townhome 1', isImplicit: false },
  U2: { id: 'U2', propertyId: 'P', number: 'Townhome 2', isImplicit: false },
  U3: { id: 'U3', propertyId: 'P', number: 'Townhome 3', isImplicit: false },
};

let seq = 0;
const charge = (
  leaseId: string,
  kind: string,
  amount: string,
  due: string,
  description: string,
) => ({
  id: `c${++seq}`,
  leaseId,
  kind,
  amount,
  dueDate: d(due),
  description,
});
const payment = (leaseId: string, amount: string, paid: string, status = 'SUCCEEDED') => ({
  id: `p${++seq}`,
  leaseId,
  amount,
  status,
  paidAt: d(paid),
  createdAt: d(paid),
  providerReference: `manual:${leaseId}:${paid}`,
});
const months = (from: number, to: number, year = 2026) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${year}-${String(from + i).padStart(2, '0')}`);

const lease = (
  id: string,
  unitId: string,
  status: string,
  start: string,
  end: string,
  rent: string,
  tenant: string,
  charges: ReturnType<typeof charge>[],
  payments: ReturnType<typeof payment>[],
) => ({
  id,
  organizationId: 'org',
  unitId,
  unit: { ...units[unitId], property: { id: 'P', name: 'Cedar Row' } },
  status,
  startDate: d(start),
  endDate: d(end),
  monthlyRent: rent,
  lateFee: '50.00',
  graceDays: 5,
  rentDueDay: 1,
  tenants: [{ tenant: { id: `t-${id}`, name: tenant } }],
  charges,
  payments,
});

// A: active, partial September payment, assessed late fee, a failed October attempt, scheduled rent.
const A = lease(
  'A',
  'U1',
  'ACTIVE',
  '2026-05-01',
  '2027-04-30',
  '1000.00',
  'Avery Active',
  [
    ...months(5, 10).map((m) => charge('A', 'RENT', '1000.00', `${m}-01`, `rent:A:${m}`)),
    charge('A', 'LATE_FEE', '50.00', '2026-09-07', 'late-fee:A:2026-09'),
  ],
  [
    ...months(5, 8).map((m) => payment('A', '1000.00', `${m}-02`)),
    payment('A', '600.00', '2026-09-03'),
    payment('A', '1000.00', '2026-10-02', 'FAILED'),
  ],
);
// OLD: ended lease in the same unit that still owes March rent.
const OLD = lease(
  'OLD',
  'U1',
  'ENDED',
  '2025-05-01',
  '2026-04-30',
  '900.00',
  'Olive Old',
  months(3, 4).map((m) => charge('OLD', 'RENT', '900.00', `${m}-01`, `rent:OLD:${m}`)),
  [payment('OLD', '900.00', '2026-03-02')],
);
// B: active, fully paid, the most recent payment on the property.
const B = lease(
  'B',
  'U2',
  'ACTIVE',
  '2026-01-01',
  '2026-12-31',
  '800.00',
  'Blake Paid',
  months(1, 10).map((m) => charge('B', 'RENT', '800.00', `${m}-01`, `rent:B:${m}`)),
  months(1, 10).map((m) => payment('B', '800.00', m === '2026-10' ? '2026-10-05' : `${m}-01`)),
);
// PREV: ended lease with only a payment on record (credit); history must still be listed.
const PREV = lease(
  'PREV',
  'U2',
  'TERMINATED',
  '2025-01-01',
  '2025-12-31',
  '800.00',
  'Pat Prev',
  [],
  [payment('PREV', '100.00', '2025-06-01')],
);
// EMPTY: ended lease with no charges or payments; DRAFT is never on a ledger.
const EMPTY = lease('EMPTY', 'U3', 'ENDED', '2024-01-01', '2024-12-31', '700.00', 'Em Pty', [], []);
const DRAFT = lease(
  'DRAFT',
  'U3',
  'DRAFT',
  '2026-11-01',
  '2027-10-31',
  '700.00',
  'Dee Raft',
  [],
  [],
);
const all = [A, OLD, B, PREV, EMPTY, DRAFT];

type Where = {
  organizationId: string;
  status: { in: string[] };
  unit?: { id?: string; propertyId?: string };
};
const client = {
  lease: {
    findMany: async ({ where }: { where: Where }) =>
      all
        .filter(
          (l) =>
            l.organizationId === where.organizationId &&
            where.status.in.includes(l.status) &&
            (!where.unit?.id || l.unit.id === where.unit.id) &&
            (!where.unit?.propertyId || l.unit.propertyId === where.unit.propertyId),
        )
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
  },
} as unknown as PrismaClient;

const load = (scope: { propertyId: string; unitId?: string }) =>
  loadPropertyLedger('org', scope, asOf, client);
// What the lease page reads for a lease, through the same helpers it uses.
const leaseView = (l: typeof A) => leaseLedger(l as never, asOf);
const comparable = (rows: ReturnType<typeof leaseView>['rows']) =>
  rows.map((r) => [r.key, r.status, r.amountCents, r.paidCents, r.balanceCents]);

describe('Rent ledger scopes read the same data the same way', () => {
  it('lease scope equals that lease inside the unit and property scopes', async () => {
    const lease = leaseView(A);
    for (const scope of [{ propertyId: 'P', unitId: 'U1' }, { propertyId: 'P' }]) {
      const group = (await load(scope)).groups.find((g) => g.leaseId === 'A')!;
      expect(group.balanceCents).toBe(lease.balanceCents);
      expect(group.lastPayment).toEqual(lease.lastPayment);
      expect(comparable(group.rows)).toEqual(comparable(lease.rows));
    }
    // Displayed values match too, not only the raw numbers.
    expect(toLastPayment(lease.lastPayment)).toEqual({
      dateLabel: 'Sep 3, 2026',
      amountCents: 60_000,
    });
  });

  it('keeps partial payments, assessed fees and scheduled rent with consistent statuses', () => {
    const { rows, balanceCents } = leaseView(A);
    const byKey = Object.fromEntries(rows.map((r) => [r.description, r]));
    expect(balanceCents).toBe(6 * 100_000 + 5_000 - 460_000); // charges due minus settled payments
    expect(byKey['September rent']).toMatchObject({
      status: 'LATE',
      paidCents: 60_000,
      balanceCents: 40_000,
    });
    expect(byKey['September late fee']).toMatchObject({
      typeLabel: 'Late fee',
      status: 'LATE',
      balanceCents: 5_000,
    });
    expect(byKey['October rent'].status).toBe('LATE');
    const scheduled = rows.filter((r) => r.status === 'SCHEDULED');
    expect(scheduled.map((r) => r.description)).toEqual([
      'November rent',
      'December rent',
      'January rent',
      'February rent',
      'March rent',
      'April rent',
    ]);
    expect(scheduled.every((r) => r.derived)).toBe(true);
    // The failed October attempt never counts as the last payment.
    expect(leaseView(A).lastPayment?.date).toEqual(d('2026-09-03'));
  });

  it('unit scope lists ended history without folding it into Balance due', async () => {
    const unit = await load({ propertyId: 'P', unitId: 'U1' });
    expect(unit.groups.map((g) => [g.leaseId, g.active])).toEqual([
      ['A', true],
      ['OLD', false],
    ]);
    expect(unit.balanceCents).toBe(leaseView(A).balanceCents);
    expect(unit.lastPayment).toEqual(leaseView(A).lastPayment);
    expect(unit.endedBalanceCents).toBe(90_000);
    expect(unit.groups[1].balanceCents).toBe(leaseView(OLD).balanceCents);
    expect(unit.activeLeaseCount).toBe(1);
  });

  it('property scope aggregates every unit and keeps every record', async () => {
    const property = await load({ propertyId: 'P' });
    expect(property.groups.map((g) => g.leaseId).sort()).toEqual(['A', 'B', 'OLD', 'PREV']);
    expect(property.balanceCents).toBe(leaseView(A).balanceCents + leaseView(B).balanceCents);
    expect(property.lastPayment).toEqual({ date: d('2026-10-05'), amountCents: 80_000 });
    expect(property.endedBalanceCents).toBe(90_000 - 10_000);
    const leases = [A, OLD, B, PREV];
    expect(property.groups.reduce((n, g) => n + g.rows.length, 0)).toBe(
      leases.reduce((n, l) => n + leaseView(l).rows.length, 0),
    );
    // The per-unit summary table adds up to the same Balance due.
    const summary = summarizeUnits(property.groups);
    expect(summary.totalBalanceCents).toBe(property.balanceCents);
    expect(summary.units.map((u) => [u.unitLabel, u.status])).toEqual([
      ['Townhome 1', 'LATE'],
      ['Townhome 2', 'CURRENT'],
    ]);
    // Unit scopes partition the property: active balances sum to the property balance.
    const perUnit = await Promise.all(
      ['U1', 'U2', 'U3'].map((u) => load({ propertyId: 'P', unitId: u })),
    );
    expect(perUnit.reduce((n, u) => n + u.balanceCents, 0)).toBe(property.balanceCents);
    expect(perUnit.reduce((n, u) => n + u.groups.length, 0)).toBe(property.groups.length);
  });

  it('an empty scope reads as zero with no last payment', async () => {
    const empty = await load({ propertyId: 'P', unitId: 'U3' });
    expect(empty).toMatchObject({
      groups: [],
      balanceCents: 0,
      lastPayment: null,
      endedBalanceCents: 0,
      activeLeaseCount: 0,
    });
    expect(leaseView(DRAFT)).toMatchObject({ rows: [], balanceCents: 0, lastPayment: null });
  });

  it('shows rows newest first with nothing dropped', () => {
    const { rows } = leaseView(A);
    const view = toLedgerRows(rows);
    expect(view).toHaveLength(rows.length);
    expect(view[0].description).toBe('April rent');
    expect(view.at(-1)?.description).toBe('May rent');
    expect(view.find((r) => r.description === 'September rent')?.applied).toEqual([
      {
        id: expect.any(String),
        amountCents: 60_000,
        dateLabel: 'Sep 3, 2026',
        method: 'Cash or check (recorded manually)',
      },
    ]);
  });

  it('last payment ignores failed, pending and zero payments', () => {
    expect(
      lastSettledPayment([
        { leaseId: 'L', amountCents: 500, status: 'FAILED', paidAt: d('2026-10-09') },
        { leaseId: 'L', amountCents: 500, status: 'PENDING', createdAt: d('2026-10-08') },
        { leaseId: 'L', amountCents: 0, status: 'SUCCEEDED', paidAt: d('2026-10-07') },
        { leaseId: 'L', amountCents: 300, status: 'SUCCEEDED', createdAt: d('2026-10-01') },
        { leaseId: 'L', amountCents: 200, status: 'SUCCEEDED', paidAt: d('2026-09-01') },
      ]),
    ).toEqual({ date: d('2026-10-01'), amountCents: 300 });
    expect(lastSettledPayment([])).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  buildLeaseStatement,
  chargeTypeLabel,
  describeCharge,
  isReservedDescription,
  paymentsProviderLabel,
  planRentCharges,
  planSetupCharges,
  ensureLeaseSetupCharges,
  previewScheduledCharges,
  prorateFirstMonth,
  scheduledRent,
  setupKey,
  type LeaseTerms,
  type LedgerCharge,
  type SetupFees,
} from '../../src/lib/ledger';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('first-month proration', () => {
  it('aligns proration to a 5th due day, including the cross-month billing period', () => {
    const p = prorateFirstMonth(d('2027-05-15'), 185_000, d('2028-05-14'), 5)!;
    expect(p).toMatchObject({ days: 21, daysInMonth: 31, cents: 125_323 });
    expect(iso(p.to)).toBe('2027-06-04');
    expect(prorateFirstMonth(d('2027-05-05'), 185_000, undefined, 5)).toBeNull();
  });

  it('handles a start before the selected due day and the 28th across February', () => {
    expect(prorateFirstMonth(d('2027-05-01'), 180_000, undefined, 5)).toMatchObject({ days: 4, daysInMonth: 30, cents: 24_000 });
    const feb = prorateFirstMonth(d('2028-02-27'), 290_000, undefined, 28)!;
    expect(iso(feb.to)).toBe('2028-02-27');
    expect(feb.days).toBe(1);
  });
  it('charges the days left in the month, counting the move-in day', () => {
    const p = prorateFirstMonth(d('2027-05-15'), 185_000)!;
    expect(p).toMatchObject({ month: '2027-05', days: 17, daysInMonth: 31 });
    expect(p.cents).toBe(101_452); // 1850.00 × 17 / 31 = 1014.516… → $1,014.52 (matches the design)
    expect(iso(p.from)).toBe('2027-05-15');
    expect(iso(p.to)).toBe('2027-05-31');
  });

  it('is not needed when the lease starts on the 1st', () => {
    expect(prorateFirstMonth(d('2027-05-01'), 185_000)).toBeNull();
  });

  it('uses the right month length, including February in a leap year', () => {
    expect(prorateFirstMonth(d('2027-02-15'), 280_000)).toMatchObject({ days: 14, daysInMonth: 28, cents: 140_000 });
    expect(prorateFirstMonth(d('2028-02-15'), 290_000)).toMatchObject({ days: 15, daysInMonth: 29 });
    expect(prorateFirstMonth(d('2027-05-31'), 310_000)).toMatchObject({ days: 1, cents: 10_000 });
  });

  it('stops at the lease end when it ends inside the first month', () => {
    expect(prorateFirstMonth(d('2027-05-10'), 310_000, d('2027-05-19'))).toMatchObject({ days: 10, cents: 100_000 });
  });

  it('returns nothing for zero rent', () => {
    expect(prorateFirstMonth(d('2027-05-15'), 0)).toBeNull();
  });
});

const fees: SetupFees = {
  monthlyRentCents: 185_000,
  depositCents: 185_000,
  moveInFeeCents: 15_000,
  petDepositCents: 25_000,
  prorateFirstMonth: true,
};

describe('setup charges', () => {
  const plan = planSetupCharges({ leaseId: 'L9', startDate: d('2027-05-15'), endDate: d('2028-05-14'), fees });

  it('creates the prorated month, deposit, move-in fee and pet deposit due at move-in', () => {
    expect(plan.map((c) => [c.kind, c.amountCents, c.description])).toEqual([
      ['RENT', 101_452, 'prorated:L9:2027-05-15'],
      ['DEPOSIT', 185_000, setupKey('deposit', 'L9')],
      ['OTHER', 15_000, setupKey('move-in-fee', 'L9')],
      ['DEPOSIT', 25_000, setupKey('pet-deposit', 'L9')],
    ]);
    expect(plan.every((c) => iso(c.dueDate) === '2027-05-15')).toBe(true);
  });

  it('skips fees that are off or zero', () => {
    const none = planSetupCharges({
      leaseId: 'L9',
      startDate: d('2027-05-01'),
      endDate: d('2028-04-30'),
      fees: { ...fees, moveInFeeCents: 0, petDepositCents: 0 },
    });
    expect(none.map((c) => c.description)).toEqual([setupKey('deposit', 'L9')]);
  });

  it('leaves the first month to the monthly rent when proration is off', () => {
    const plain = planSetupCharges({
      leaseId: 'L9',
      startDate: d('2027-05-15'),
      endDate: d('2028-05-14'),
      fees: { ...fees, prorateFirstMonth: false },
    });
    expect(plain.some((c) => c.kind === 'RENT')).toBe(false);
  });
});

describe('ledger rows after sending', () => {
  it('previews and schedules rent on the 5th without repeating move-in charges', () => {
    const fifthFees = { ...fees, rentDueDay: 5 };
    const startDate = d('2027-05-15');
    const endDate = d('2027-08-14');
    const preview = previewScheduledCharges({ startDate, endDate, fees: fifthFees, asOf: d('2027-05-01') });
    expect(preview.proration?.cents).toBe(125_323);
    expect(preview.monthly.map((row) => iso(row.date))).toEqual(['2027-06-05', '2027-07-05', '2027-08-05']);
    const fifthLease: LeaseTerms = { id: 'five', startDate, endDate, monthlyRentCents: 185_000, lateFeeCents: 0, graceDays: 5, rentDueDay: 5, status: 'ACTIVE' };
    const setup = planSetupCharges({ leaseId: fifthLease.id, startDate, endDate, fees: fifthFees }).map((charge) => ({ leaseId: fifthLease.id, ...charge }));
    const june = planRentCharges(fifthLease, setup, [], d('2027-06-10'));
    const stored = [...june, ...planRentCharges(fifthLease, [...setup, ...june], [], d('2027-07-10'))];
    const statement = buildLeaseStatement({ lease: fifthLease, charges: [...setup, ...stored], payments: [], place: 'Maple Court', asOf: d('2027-07-10') });
    expect(statement.rows.filter((row) => row.kind === 'RENT').map((row) => iso(row.dueDate))).toEqual(['2027-05-15', '2027-06-05', '2027-07-05', '2027-08-05']);
    expect(new Set(statement.rows.map((row) => row.description)).size).toBe(statement.rows.length);
  });
  const lease: LeaseTerms = {
    id: 'L9',
    startDate: d('2027-05-15'),
    endDate: d('2027-09-14'),
    monthlyRentCents: 185_000,
    lateFeeCents: 5_000,
    graceDays: 5,
    status: 'ACTIVE',
  };
  const stored = (asOf: Date) => {
    const setup = planSetupCharges({ leaseId: lease.id, startDate: lease.startDate, endDate: lease.endDate, fees }).map(
      (c, i): LedgerCharge => ({
        id: `s${i}`,
        leaseId: lease.id,
        kind: c.kind,
        amountCents: c.amountCents,
        dueDate: c.dueDate,
        description: c.description,
      }),
    );
    const monthly = planRentCharges(lease, setup, [], asOf).map(
      (c, i): LedgerCharge => ({ ...c, id: `m${i}` }),
    );
    return [...setup, ...monthly];
  };

  it('never repeats a charge, whether rent is stored or derived', () => {
    for (const asOf of [d('2027-05-10'), d('2027-05-20'), d('2027-06-01'), d('2027-08-31')]) {
      const charges = stored(asOf);
      const statement = buildLeaseStatement({ lease, charges, payments: [], place: 'Maple Court 1A', asOf });
      const keys = statement.rows.map((r) => `${r.kind}:${r.description}:${iso(r.dueDate)}`);
      expect(new Set(keys).size).toBe(keys.length);
      const rentRows = statement.rows.filter((r) => r.kind === 'RENT');
      const months = rentRows.map((r) => r.dueDate.toISOString().slice(0, 7));
      expect(new Set(months).size).toBe(months.length);
      // The prorated May charge is the only rent row for May.
      expect(rentRows.find((r) => r.dueDate.toISOString().startsWith('2027-05'))?.amountCents).toBe(101_452);
    }
  });

  it('adds no stored duplicates when the planner runs again', () => {
    const asOf = d('2027-07-02');
    const charges = stored(asOf);
    expect(planRentCharges(lease, charges, [], asOf)).toEqual([]);
    expect(scheduledRent(lease, charges, asOf).every((c) => !charges.some((s) => s.description === c.description))).toBe(true);
  });

  it('previews the same rent rows the ledger will derive', () => {
    const asOf = d('2027-05-10');
    const preview = previewScheduledCharges({ startDate: lease.startDate, endDate: lease.endDate, fees, asOf });
    expect(preview.moveInTotalCents).toBe(101_452 + 185_000 + 15_000 + 25_000);
    const statement = buildLeaseStatement({ lease, charges: stored(asOf), payments: [], place: 'x', asOf });
    const ledgerMonthly = statement.rows
      .filter((r) => r.kind === 'RENT' && r.description.includes('rent for'))
      .filter((r) => r.amountCents === 185_000)
      .map((r) => iso(r.dueDate));
    expect(preview.monthly.map((r) => iso(r.date))).toEqual(ledgerMonthly);
    expect(preview.monthly.map((r) => iso(r.date))).toEqual(['2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01']);
  });
});

describe('activation setup idempotency', () => {
  it('creates each move-in charge once across repeated activation calls', async () => {
    const charges: { description: string }[] = [];
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      lease: { findFirst: vi.fn().mockResolvedValue({ id: 'once', startDate: d('2027-05-15'), endDate: d('2028-05-14'), monthlyRent: '1850.00', deposit: '1850.00', moveInFee: '150.00', petDeposit: '250.00', prorateFirstMonth: true, rentDueDay: 5 }) },
      charge: {
        findMany: vi.fn().mockImplementation(async () => charges),
        createMany: vi.fn().mockImplementation(async ({ data }: { data: { description: string }[] }) => { charges.push(...data); }),
      },
    };
    const client = tx as unknown as Parameters<typeof ensureLeaseSetupCharges>[0];
    expect(await ensureLeaseSetupCharges(client, 'org', 'once')).toBe(4);
    expect(await ensureLeaseSetupCharges(client, 'org', 'once')).toBe(0);
    expect(charges.map((charge) => charge.description)).toEqual(['prorated:once:2027-05-15', 'setup:deposit:once', 'setup:move-in-fee:once', 'setup:pet-deposit:once']);
    expect(tx.charge.createMany).toHaveBeenCalledTimes(1);
  });
});

describe('statement wording for move-in charges', () => {
  it('names them and reserves the keys', () => {
    const charge = { kind: 'DEPOSIT' as const, description: setupKey('pet-deposit', 'L9') };
    expect(describeCharge(charge, 'Maple Court 1A')).toBe('Pet deposit for Maple Court 1A');
    expect(chargeTypeLabel(charge)).toBe('Pet deposit');
    expect(chargeTypeLabel({ kind: 'DEPOSIT', description: setupKey('deposit', 'L9') })).toBe('Security deposit');
    expect(chargeTypeLabel({ kind: 'OTHER', description: setupKey('move-in-fee', 'L9') })).toBe('Move-in fee');
    expect(isReservedDescription(setupKey('deposit', 'L9'))).toBe(true);
  });
});

describe('payments provider pill', () => {
  it('calls the mock provider sandbox payments', () => {
    expect(paymentsProviderLabel({ provider: 'mock' }, 'Mock payments')).toBe('Sandbox payments');
    expect(paymentsProviderLabel({ provider: 'stripe' }, 'Stripe')).toBe('Stripe connected');
    expect(paymentsProviderLabel(null, null)).toBe('No payments provider connected');
  });
});

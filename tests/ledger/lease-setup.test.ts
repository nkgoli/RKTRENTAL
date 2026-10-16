import { describe, expect, it } from 'vitest';
import {
  buildLeaseStatement,
  chargeTypeLabel,
  describeCharge,
  isReservedDescription,
  paymentsProviderLabel,
  planRentCharges,
  planSetupCharges,
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
      ['RENT', 101_452, 'rent:L9:2027-05'],
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

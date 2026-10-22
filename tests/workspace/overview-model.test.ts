import { describe, expect, it } from 'vitest';
import {
  expiringDetail,
  firstExpiring,
  leaseTerm,
  occupancyDetail,
  paymentsView,
  splitUnitsForPhone,
  timeLeft,
  unitStatusView,
  type OverviewUnit,
} from '@/components/workspace/overview-model';

const today = new Date('2026-10-22T00:00:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const unit = (over: Partial<OverviewUnit> & { id: string }): OverviewUnit => ({
  number: over.id,
  isImplicit: false,
  status: 'OCCUPIED',
  rent: 1500,
  listedRent: 1500,
  leaseStart: day('2026-01-01'),
  leaseEnd: day('2026-12-31'),
  tenant: { id: `t-${over.id}`, name: `Tenant ${over.id}` },
  ...over,
});

describe('overview model', () => {
  it('formats lease terms and time left from the supplied date', () => {
    expect(leaseTerm(day('2026-01-01'), day('2026-12-31'))).toBe('Jan 1 – Dec 31, 2026');
    expect(leaseTerm(day('2026-01-01'), day('2027-03-31'))).toBe('Jan 1, 2026 – Mar 31, 2027');
    expect(timeLeft(day('2026-11-30'), today)).toBe('39 days');
    expect(timeLeft(day('2026-12-31'), today)).toBe('2 months');
    expect(timeLeft(day('2026-10-22'), today)).toBe('Ends today');
    expect(timeLeft(day('2026-10-01'), today)).toBe('Ended Oct 1, 2026');
  });

  it('marks renewals due inside 60 days and vacant units for attention', () => {
    expect(unitStatusView(unit({ id: '4B', leaseEnd: day('2026-11-30') }), today)).toEqual({
      label: 'Renewal due',
      tone: 'warning',
    });
    expect(unitStatusView(unit({ id: '1A' }), today).label).toBe('Occupied');
    expect(unitStatusView(unit({ id: '3A', status: 'VACANT', tenant: null }), today).label).toBe(
      'Vacant',
    );
  });

  it('summarises occupancy and the first expiring lease from live units', () => {
    const units = [
      unit({ id: '1A' }),
      unit({ id: '3A', status: 'VACANT', tenant: null, leaseStart: null, leaseEnd: null }),
      unit({ id: '4B', leaseEnd: day('2026-11-30') }),
      unit({ id: '9Z', status: 'ARCHIVED' }),
    ];
    expect(occupancyDetail(units, 2)).toBe('2 of 3 units · Unit 3A vacant');
    expect(expiringDetail(firstExpiring(units, today))).toBe('First: Unit 4B · Nov 30');
    expect(expiringDetail(null)).toBe('None in the next 90 days');
  });

  it('orders phone rows with vacancies and soonest-ending leases first', () => {
    const { priority, rest } = splitUnitsForPhone(
      [
        unit({ id: '1A' }),
        unit({ id: '4B', leaseEnd: day('2026-11-30') }),
        unit({ id: '2C', leaseEnd: day('2026-11-10') }),
        unit({ id: '3A', status: 'VACANT', tenant: null, leaseEnd: null }),
      ],
      today,
    );
    expect(priority.map((u) => u.id)).toEqual(['3A', '2C', '4B']);
    expect(rest.map((u) => u.id)).toEqual(['1A']);
  });

  it('words the payments band for paid, outstanding and no-charge months', () => {
    const paid = paymentsView(
      {
        dueCents: 2_140_000,
        paidCents: 2_140_000,
        outstandingCents: 0,
        lateCount: 0,
        hasCharges: true,
      },
      today,
    );
    expect(paid.eyebrow).toBe('October 2026 · Payments this month');
    expect(paid.value).toBe('$21,400');
    expect(paid.detail).toBe('collected of $21,400 due · all paid');
    expect(paid.meter).toBe('100% collected · no overdue balance');

    const owed = paymentsView(
      {
        dueCents: 200_000,
        paidCents: 150_000,
        outstandingCents: 50_000,
        lateCount: 1,
        hasCharges: true,
        overdue: { amountCents: 50_000, leaseCount: 1 },
      },
      today,
    );
    expect(owed.detail).toBe('collected of $2,000 due · $500 outstanding · 1 late');
    expect(owed.meter).toBe('75% collected · $500 overdue to date');
  });
});

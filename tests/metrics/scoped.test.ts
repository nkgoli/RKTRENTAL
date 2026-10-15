import { describe, expect, it } from 'vitest';
import { computeScopedReturns } from '@/lib/metrics/scoped';
import { resolvePeriod } from '@/lib/returns/period';

const period = resolvePeriod('12M', new Date('2026-10-15T00:00:00.000Z'));
const base = {
  property: {
    purchasePriceCents: 30_000_000,
    downPaymentCents: 6_000_000,
    annualDebtServiceCents: 900_000,
  },
  units: [
    { id: 'unit-a', number: 'A', status: 'OCCUPIED', monthlyRentCents: 200_000, listedRentCents: 220_000 },
    { id: 'unit-b', number: 'B', status: 'VACANT', monthlyRentCents: 100_000, listedRentCents: 110_000 },
  ],
  payments: [
    { unitId: 'unit-a', amountCents: 1_200_000, paidAt: new Date('2026-05-10T00:00:00.000Z') },
    { unitId: 'unit-b', amountCents: 600_000, paidAt: new Date('2026-06-10T00:00:00.000Z') },
  ],
  expenses: [
    { category: 'TAX', label: 'Property taxes', amountCents: 300_000, occurredOn: new Date('2026-06-01T00:00:00.000Z') },
    { category: 'REPAIRS', label: 'Repairs', amountCents: 60_000, occurredOn: new Date('2026-07-01T00:00:00.000Z') },
  ],
  period,
};

describe('computeScopedReturns', () => {
  it('filters unit income and monthly rows and allocates property costs by rent share', () => {
    const unit = computeScopedReturns({ ...base, unitId: 'unit-a' });

    expect(unit.unitId).toBe('unit-a');
    expect(unit.collectedCents).toBe(1_200_000);
    expect(unit.dueCents).toBe(2_400_000);
    expect(unit.metrics.expensesCents).toBe(240_000);
    expect(unit.metrics.debtServiceCents).toBe(600_000);
    expect(unit.metrics.cashInvestedCents).toBe(4_000_000);
    expect(unit.monthly.find((row) => row.month === '2026-06')?.incomeCents).toBe(0);
    expect(unit.monthly.find((row) => row.month === '2026-06')?.expensesCents).toBe(200_000);
    expect(unit.occupancy).toBe(100);
  });

  it('keeps the property totals intact and rolls up scoped income and expenses', () => {
    const property = computeScopedReturns(base);
    const unitA = computeScopedReturns({ ...base, unitId: 'unit-a' });
    const unitB = computeScopedReturns({ ...base, unitId: 'unit-b' });

    expect(property.collectedCents).toBe(1_800_000);
    expect(property.metrics.expensesCents).toBe(360_000);
    expect(unitA.metrics.expensesCents + unitB.metrics.expensesCents).toBe(360_000);
    expect(property.occupancy).toBe(50);
  });

  it('rejects a unit outside the property and handles no-unit occupancy', () => {
    expect(() => computeScopedReturns({ ...base, unitId: 'other' })).toThrow(
      'Unit is not part of this property',
    );
    const empty = computeScopedReturns({ ...base, units: [], payments: [], expenses: [] });
    expect(empty.occupancy).toBe(0);
    expect(empty.totalUnits).toBe(0);
    expect(empty.monthly).toHaveLength(12);
  });
});

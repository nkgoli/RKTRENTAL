import { describe, expect, it } from 'vitest';
import { assessLateFee, computeBalance, rentDueDate, rentKey, type LedgerCharge, type LedgerPayment } from '../../src/lib/ledger/core';
import { assertDemoTarget } from './guard';
import { assertNoLeaseOverlap, planPortfolio, properties } from './plan';

const today = new Date('2026-10-16T00:00:00.000Z');

describe('demo seed', () => {
  it('produces deterministic multi-year data with the original properties', () => {
    const first = planPortfolio(42, today);
    expect(planPortfolio(42, today)).toEqual(first);
    expect(planPortfolio(43, today)).not.toEqual(first);
    expect(properties.map((property) => property.name)).toEqual(expect.arrayContaining([
      '18 Elm Street', 'Maple Court', 'Cedar Row Townhomes', 'Harbor View Lofts',
    ]));
    expect(first.units.length).toBeGreaterThanOrEqual(60);
    expect(first.units.length).toBeLessThanOrEqual(80);
    expect(first.leases.length).toBeGreaterThan(first.units.length * 4);
    const renewals = first.leases.filter((lease) => lease.renewal);
    expect(renewals.length).toBeGreaterThan(20);
    for (const lease of renewals) {
      const prior = first.leases.find((candidate) => candidate.unitId === lease.unitId && candidate.cycle === lease.cycle - 1)!;
      expect(lease.tenantId).toBe(prior.tenantId);
      expect(lease.rentCents / prior.rentCents).toBeGreaterThanOrEqual(1.0199);
      expect(lease.rentCents / prior.rentCents).toBeLessThanOrEqual(1.0601);
    }
  });

  it('never overlaps leases in any unit, including drafts', () => {
    const plan = planPortfolio(42, today);
    expect(() => assertNoLeaseOverlap(plan.leases)).not.toThrow();
    expect(() => assertNoLeaseOverlap([plan.leases[0]!, { ...plan.leases[0]!, id: 'overlap' }])).toThrow(/Overlapping/);
  });

  it('uses ledger rules for fees and reconciled balances', () => {
    const leaseId = 'lease-1';
    const due = rentDueDate('2026-09', 3);
    const charge: LedgerCharge = { leaseId, kind: 'RENT', amountCents: 180000, dueDate: due,
      description: rentKey(leaseId, '2026-09') };
    const decision = assessLateFee({ id: leaseId, startDate: due,
      endDate: new Date('2027-08-31T00:00:00.000Z'), monthlyRentCents: 180000,
      lateFeeCents: 7500, graceDays: 5, rentDueDay: 3, status: 'ACTIVE' },
    '2026-09', [charge], [], new Date('2026-09-10T00:00:00.000Z'));
    expect(decision.eligible).toBe(true);
    if (!decision.eligible) return;
    const payment: LedgerPayment = { leaseId, amountCents: 90000, status: 'SUCCEEDED', paidAt: today };
    const balance = computeBalance([charge, decision.fee], [payment]);
    expect(balance.chargedCents).toBe(balance.paidCents + balance.outstandingCents);
    expect(balance.outstandingCents).toBe(97500);
  });

  it('refuses production and non-demo targets unless explicitly forced', () => {
    const local = 'postgresql://user:pass@localhost:5432/rocketrental';
    const remote = 'postgresql://user:pass@database.example.com:5432/live';
    expect(() => assertDemoTarget('production', local, true)).toThrow(/production/);
    expect(() => assertDemoTarget('development', remote, false)).toThrow(/Refusing/);
    expect(() => assertDemoTarget('development', remote, true)).not.toThrow();
    expect(() => assertDemoTarget('development', local, false)).not.toThrow();
  });
});

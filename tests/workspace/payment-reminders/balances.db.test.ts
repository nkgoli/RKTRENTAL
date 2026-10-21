import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db/client';
import { loadPaymentsMonth, loadReminderLeases } from '@/lib/workspace/timeline-data';
import { rentKey } from '@/lib/ledger/core';

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')('reminder overview ledger scoping', () => {
  const org = `reminder-overview-${randomUUID()}`;
  const now = new Date('2026-10-21T12:00:00Z');
  beforeAll(async () => {
    await db.organization.create({ data: { id: org, name: 'Synthetic overview checks' } });
    await db.property.create({
      data: {
        id: org,
        organizationId: org,
        name: 'Synthetic Court',
        type: 'MULTI_UNIT',
        street: '1 Test St',
        city: 'Test',
        state: 'TX',
        postalCode: '00000',
      },
    });
    for (const suffix of ['old', 'paid', 'grace']) {
      const id = `${org}-${suffix}`;
      await db.unit.create({ data: { id, organizationId: org, propertyId: org, number: suffix } });
      await db.lease.create({
        data: {
          id,
          organizationId: org,
          unitId: id,
          monthlyRent: '1000',
          deposit: '0',
          graceDays: suffix === 'grace' ? 31 : 3,
          startDate: new Date(suffix === 'old' ? '2026-09-01' : '2026-10-01'),
          endDate: new Date(suffix === 'old' ? '2026-09-30' : '2026-12-31'),
          status: suffix === 'old' ? 'ENDED' : 'ACTIVE',
          charges: {
            create: [
              {
                kind: 'RENT',
                amount: '1000',
                dueDate: new Date(suffix === 'old' ? '2026-09-01' : '2026-10-01'),
                description: rentKey(id, suffix === 'old' ? '2026-09' : '2026-10'),
              },
              ...(suffix === 'old'
                ? [
                    { kind: 'LATE_FEE' as const, amount: '50', dueDate: new Date('2026-09-05') },
                    { kind: 'OTHER' as const, amount: '500', dueDate: new Date('2026-11-01') },
                  ]
                : []),
            ],
          },
          payments:
            suffix !== 'grace'
              ? {
                  create: [
                    {
                      status: 'SUCCEEDED',
                      amount: suffix === 'paid' ? '1000' : '200',
                      paidAt: new Date('2026-10-05'),
                    },
                  ],
                }
              : undefined,
        },
      });
    }
  });
  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
  });

  it('includes ended-lease arrears and assessed fees without changing this-month totals', async () => {
    const total = await loadPaymentsMonth(org, { propertyId: org }, now);
    expect(total).toMatchObject({
      dueCents: 200000,
      paidCents: 100000,
      outstandingCents: 100000,
      overdue: { amountCents: 85000, leaseCount: 1 },
    });
    const paid = await loadPaymentsMonth(org, { propertyId: org, unitId: `${org}-paid` }, now);
    expect(paid).toMatchObject({
      dueCents: 100000,
      paidCents: 100000,
      outstandingCents: 0,
      overdue: { amountCents: 0, leaseCount: 0 },
    });
    const old = await loadPaymentsMonth(org, { propertyId: org, unitId: `${org}-old` }, now);
    expect(old).toMatchObject({
      hasCharges: false,
      overdue: { amountCents: 85000, leaseCount: 1 },
    });
  });
  it('honors unit, property and organization fences using dispatch eligibility', async () => {
    expect(await loadReminderLeases('foreign-organization', { propertyId: org }, now)).toEqual([]);
    expect(
      await loadReminderLeases(org, { propertyId: 'foreign-property', unitId: `${org}-old` }, now),
    ).toEqual([]);
    const grace = await loadReminderLeases(org, { propertyId: org, unitId: `${org}-grace` }, now);
    expect(grace).toHaveLength(1);
    expect(grace[0].EMAIL.amountCents).toBe(0);
    const rows = await loadReminderLeases(org, { propertyId: org, unitId: `${org}-old` }, now);
    expect(rows).toHaveLength(1);
    expect(rows[0].EMAIL.charges.map((c) => c.kind)).toEqual(['RENT', 'LATE_FEE']);
  });
});

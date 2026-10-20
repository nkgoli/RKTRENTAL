import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { actualReturnsService } from '../../src/lib/returns/actual-service';

// Organization/property scoping and SQL boundaries against a real database.
// Run only through tests/returns/run-actual-isolated.mjs (RUN_ACTUAL_RETURNS_DB=1).
describe.skipIf(process.env.RUN_ACTUAL_RETURNS_DB !== '1')(
  'actual returns service (database)',
  () => {
    const prisma = new PrismaClient();
    const org = `actual-org-${randomUUID()}`;
    const otherOrg = `actual-other-${randomUUID()}`;
    const propertyId = `actual-prop-${randomUUID()}`;
    const otherPropertyId = `actual-foreign-${randomUUID()}`;
    const archivedId = `actual-archived-${randomUUID()}`;
    const asOf = new Date('2026-10-20T12:00:00Z');
    const manager = actualReturnsService(
      { organizationId: org, role: 'MANAGER' },
      prisma,
      () => asOf,
    );
    const d = (v: string) => new Date(`${v}T00:00:00.000Z`);

    async function seedProperty(
      organizationId: string,
      id: string,
      archivedAt: Date | null = null,
    ) {
      await prisma.property.create({
        data: {
          id,
          organizationId,
          name: id,
          type: 'SINGLE_UNIT',
          street: '1 Main',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          purchasePrice: '300000.00',
          loanAmount: '0.00',
          archivedAt,
        },
      });
      const unit = await prisma.unit.create({
        data: { organizationId, propertyId: id, number: '1' },
      });
      return prisma.lease.create({
        data: {
          organizationId,
          unitId: unit.id,
          monthlyRent: '1500.25',
          deposit: '1500.00',
          status: 'ACTIVE',
          startDate: d('2025-12-01'),
          endDate: d('2026-11-30'),
        },
      });
    }

    beforeAll(async () => {
      await prisma.organization.createMany({
        data: [
          { id: org, name: 'Actual' },
          { id: otherOrg, name: 'Other' },
        ],
      });
      const lease = await seedProperty(org, propertyId);
      const foreign = await seedProperty(otherOrg, otherPropertyId);
      await seedProperty(org, archivedId, new Date('2026-01-01'));
      for (const [l, organizationId] of [
        [lease, org],
        [foreign, otherOrg],
      ] as const) {
        await prisma.charge.createMany({
          data: ['2026-01', '2026-02'].map((m) => ({
            organizationId,
            leaseId: l.id,
            kind: 'RENT' as const,
            amount: '1500.25',
            dueDate: d(`${m}-01`),
            description: `rent:${l.id}:${m}`,
          })),
        });
      }
      await prisma.payment.createMany({
        data: [
          {
            organizationId: org,
            leaseId: lease.id,
            amount: '1500.25',
            status: 'SUCCEEDED',
            paidAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            organizationId: org,
            leaseId: lease.id,
            amount: '1500.25',
            status: 'SUCCEEDED',
            paidAt: new Date('2026-01-31T23:59:59Z'),
          },
          {
            organizationId: org,
            leaseId: lease.id,
            amount: '700.00',
            status: 'SUCCEEDED',
            paidAt: new Date('2026-02-01T00:00:00Z'),
          },
          {
            organizationId: org,
            leaseId: lease.id,
            amount: '999.99',
            status: 'FAILED',
            paidAt: new Date('2026-01-10T00:00:00Z'),
          },
          // The other organization's receipt in the same window must never appear.
          {
            organizationId: otherOrg,
            leaseId: foreign.id,
            amount: '8888.88',
            status: 'SUCCEEDED',
            paidAt: new Date('2026-01-15T00:00:00Z'),
          },
        ],
      });
      await prisma.expense.createMany({
        data: [
          {
            organizationId: org,
            propertyId,
            category: 'TAXES',
            amount: '410.13',
            occurredOn: d('2026-01-01'),
          },
          {
            organizationId: org,
            propertyId,
            category: 'REPAIRS',
            amount: '87.07',
            occurredOn: d('2026-01-31'),
          },
          {
            organizationId: org,
            propertyId,
            category: 'REPAIRS',
            amount: '50.00',
            occurredOn: d('2026-02-01'),
          },
          {
            organizationId: otherOrg,
            propertyId: otherPropertyId,
            category: 'TAXES',
            amount: '7777.77',
            occurredOn: d('2026-01-15'),
          },
        ],
      });
    });

    afterAll(async () => {
      await prisma.organization.deleteMany({ where: { id: { in: [org, otherOrg] } } });
      await prisma.$disconnect();
    });

    it('reads recorded January rent and expenses in exact cents within the session organization', async () => {
      const result = await manager.load({ propertyId, from: '2026-01-01', to: '2026-01-31' });
      if (!result.ok) throw new Error(result.code);
      const r = result.data;
      expect(r.income.confirmedRent).toMatchObject({ status: 'recorded', cents: 300_050 });
      expect(r.income.receipts).toHaveLength(2);
      expect(r.income.excluded.failedCount).toBe(1);
      expect(r.expenses.total).toMatchObject({ status: 'recorded', cents: 49_720 });
      expect(r.debtService.actual).toMatchObject({ status: 'zero', cents: 0 });
      expect(r.actual.cashFlow).toMatchObject({ status: 'derived', value: 300_050 - 49_720 });
    });

    it('classifies the February receipt after allocating January history', async () => {
      const result = await manager.load({ propertyId, from: '2026-02-01', to: '2026-02-28' });
      if (!result.ok) throw new Error(result.code);
      // Both rent charges were settled in January, so February's receipt has nothing to
      // settle: it is unapplied, never labelled rent, and rent is a partial zero.
      expect(result.data.income.unappliedReceipts).toMatchObject({
        status: 'recorded',
        cents: 70_000,
      });
      expect(result.data.income.confirmedRent).toMatchObject({
        status: 'zero',
        cents: 0,
        coverage: { status: 'partial' },
      });
      expect(result.data.scheduled.billedRent).toMatchObject({
        status: 'recorded',
        cents: 150_025,
      });
      expect(result.data.expenses.total.cents).toBe(5_000);
    });

    it('returns the same NOT_FOUND for foreign, archived and absent properties', async () => {
      for (const id of [otherPropertyId, archivedId, 'missing'])
        expect(
          await manager.load({ propertyId: id, from: '2026-01-01', to: '2026-01-31' }),
        ).toEqual({
          ok: false,
          code: 'NOT_FOUND',
        });
      const foreignManager = actualReturnsService(
        { organizationId: otherOrg, role: 'MANAGER' },
        prisma,
        () => asOf,
      );
      expect(
        await foreignManager.load({ propertyId, from: '2026-01-01', to: '2026-01-31' }),
      ).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
    });

    it('reports a period before any record as unavailable', async () => {
      const result = await manager.load({ propertyId, from: '2025-01-01', to: '2025-06-30' });
      if (!result.ok) throw new Error(result.code);
      expect(result.data.income.confirmedRent.status).toBe('unavailable');
      expect(result.data.expenses.total.status).toBe('unavailable');
      expect(result.data.actual.noi.value).toBeNull();
    });
  },
);

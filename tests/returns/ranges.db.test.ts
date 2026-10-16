import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { loadReturnsOverview } from '../../src/lib/returns/queries';
import { resolvePeriod, type ResolvedPeriod } from '../../src/lib/returns/period';
import { loadPropertyWorkspaceReturns } from '../../src/lib/metrics/queries';
import { loadCollectionSeries } from '../../src/lib/dashboard/queries';

// Reconciles the SQL-aggregated returns against the raw ledger rows.
// Run after db:migrate with RUN_DB_INTEGRATION=1 and DATABASE_URL set.
describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'returns ranges reconcile with the ledger',
  () => {
    const prisma = new PrismaClient();
    const org = `ranges-org-${randomUUID()}`;
    const propertyId = `ranges-prop-${randomUUID()}`;
    const now = new Date();
    const monthsAgo = (n: number, day: number) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, day));
    const cents = (value: { toString(): string }) => Math.round(Number(value.toString()) * 100);

    beforeAll(async () => {
      await prisma.organization.create({ data: { id: org, name: 'Ranges' } });
      await prisma.property.create({
        data: {
          id: propertyId,
          organizationId: org,
          name: 'Ranges Court',
          type: 'MULTI_UNIT',
          street: '1 R St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
        },
      });
      const leaseIds: string[] = [];
      for (const number of ['1', '2']) {
        const unit = await prisma.unit.create({ data: { organizationId: org, propertyId, number } });
        const lease = await prisma.lease.create({
          data: {
            organizationId: org,
            unitId: unit.id,
            monthlyRent: 1500,
            deposit: 1500,
            status: 'ACTIVE',
            startDate: monthsAgo(80, 1),
            endDate: monthsAgo(-12, 28),
          },
        });
        leaseIds.push(lease.id);
      }
      const payments: Prisma.PaymentCreateManyInput[] = [];
      const expenses: Prisma.ExpenseCreateManyInput[] = [];
      for (let n = 0; n < 75; n++) {
        leaseIds.forEach((leaseId, i) => {
          payments.push({
            organizationId: org,
            leaseId,
            amount: (1500.37 + n * 0.11 + i).toFixed(2),
            status: 'SUCCEEDED' as const,
            paidAt: monthsAgo(n, 3 + i),
          });
          // Not income: failed payments must be ignored.
          payments.push({
            organizationId: org,
            leaseId,
            amount: '999.99',
            status: 'FAILED' as const,
            paidAt: monthsAgo(n, 4),
          });
        });
        expenses.push(
          { organizationId: org, propertyId, category: 'TAXES' as const, amount: (410.13 + n).toFixed(2), occurredOn: monthsAgo(n, 1) },
          { organizationId: org, propertyId, category: 'REPAIRS' as const, amount: (87.07 + n / 3).toFixed(2), occurredOn: monthsAgo(n, 28) },
        );
      }
      await prisma.payment.createMany({ data: payments });
      await prisma.expense.createMany({ data: expenses });
    });

    afterAll(async () => {
      await prisma.payment.deleteMany({ where: { organizationId: org } });
      await prisma.expense.deleteMany({ where: { organizationId: org } });
      await prisma.lease.deleteMany({ where: { organizationId: org } });
      await prisma.unit.deleteMany({ where: { organizationId: org } });
      await prisma.property.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
      await prisma.$disconnect();
    });

    async function ledgerTotals(period: ResolvedPeriod) {
      const [payments, expenses] = await Promise.all([
        prisma.payment.findMany({
          where: {
            organizationId: org,
            status: 'SUCCEEDED',
            paidAt: { gte: period.start, lt: period.end },
          },
        }),
        prisma.expense.findMany({
          where: { organizationId: org, occurredOn: { gte: period.start, lt: period.end } },
        }),
      ]);
      return {
        income: payments.reduce((t, p) => t + cents(p.amount), 0),
        expenses: expenses.reduce((t, e) => t + cents(e.amount), 0),
      };
    }

    for (const key of ['12M', '2Y', '3Y', '5Y', 'ALL'] as const) {
      it(`${key}: portfolio, property and chart totals equal the ledger`, async () => {
        const period = resolvePeriod(key, now, {
          earliest: key === 'ALL' ? monthsAgo(74, 1) : null,
        });
        const ledger = await ledgerTotals(period);
        expect(ledger.income).toBeGreaterThan(0);

        const overview = await loadReturnsOverview(org, period, prisma);
        expect(overview.portfolio?.metrics.incomeCents).toBe(ledger.income);
        expect(overview.portfolio?.metrics.expensesCents).toBe(ledger.expenses);
        expect(overview.monthly.reduce((t, p) => t + p.incomeCents, 0)).toBe(ledger.income);
        expect(overview.monthly.reduce((t, p) => t + p.expensesCents, 0)).toBe(ledger.expenses);
        expect(overview.yearly.reduce((t, y) => t + y.incomeCents, 0)).toBe(ledger.income);
        expect(overview.yearly.reduce((t, y) => t + y.expensesCents, 0)).toBe(ledger.expenses);
        expect(overview.expenseBreakdown.reduce((t, e) => t + e.amountCents, 0)).toBe(
          ledger.expenses,
        );
        if (period.granularity === 'month') expect(overview.monthly).toHaveLength(period.months);
        else expect(overview.monthly[0]?.month).toMatch(/^\d{4}-Q[1-4]$/);

        const workspace = await loadPropertyWorkspaceReturns(org, propertyId, period, prisma);
        expect(workspace?.property.collectedCents).toBe(ledger.income);
        expect(workspace?.property.metrics.expensesCents).toBe(ledger.expenses);
        expect(workspace?.property.monthly.reduce((t, p) => t + p.incomeCents, 0)).toBe(
          ledger.income,
        );
        expect(workspace?.units.reduce((t, u) => t + u.collectedCents, 0)).toBe(ledger.income);
      });
    }

    it('keeps a custom range to its own months', async () => {
      const period = resolvePeriod('CUSTOM', now, { from: '2024-01', to: '2024-03' });
      const ledger = await ledgerTotals(period);
      const overview = await loadReturnsOverview(org, period, prisma);
      expect(overview.monthly.map((p) => p.month)).toEqual(['2024-01', '2024-02', '2024-03']);
      expect(overview.portfolio?.metrics.incomeCents).toBe(ledger.income);
    });

    it('dashboard collection series matches settled payments per month', async () => {
      const series = await loadCollectionSeries(org, now, 60, prisma);
      expect(series).toHaveLength(60);
      const ledger = await ledgerTotals(resolvePeriod('5Y', now));
      expect(series.reduce((t, m) => t + m.collectedCents, 0)).toBe(ledger.income);
      expect(series.at(-1)?.dueCents).toBe(300_000);
    });
  },
);

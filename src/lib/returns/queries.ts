import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategoryValue } from '@/lib/expenses';
import { toCents } from '@/lib/ledger/core';
import { computeReturns, type ReturnsMetrics } from './core';
import {
  bucketSeries,
  periodKeyFrom,
  resolvePeriod,
  yearlyTotals,
  type ResolvedPeriod,
  type YearlyPoint,
} from './period';

export type PropertyReturns = {
  propertyId: string;
  propertyName: string;
  units: number;
  occupied: number;
  metrics: ReturnsMetrics;
};

export type MonthlyPoint = { month: string; incomeCents: number; expensesCents: number };

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

type IncomeRow = { propertyId: string; month: string; cents: number };
type ExpenseRow = { propertyId: string; category: ExpenseCategoryValue; month: string; cents: number };

/**
 * Settled rent per property and month, summed in SQL (never row by row in
 * JS): a few hundred rows come back however many payments the ledger holds.
 */
async function aggregateIncome(
  client: PrismaClient,
  organizationId: string,
  period: ResolvedPeriod,
): Promise<IncomeRow[]> {
  const rows = await client.$queryRaw<{ propertyId: string; month: string; cents: bigint }[]>`
    SELECT u."propertyId" AS "propertyId",
           to_char(date_trunc('month', p."paidAt"), 'YYYY-MM') AS month,
           (SUM(p.amount) * 100)::bigint AS cents
    FROM "Payment" p
    JOIN "Lease" l ON l.id = p."leaseId" AND l."organizationId" = p."organizationId"
    JOIN "Unit" u ON u.id = l."unitId" AND u."organizationId" = l."organizationId"
    WHERE p."organizationId" = ${organizationId}
      AND p.status = 'SUCCEEDED'
      AND p."paidAt" >= ${isoDay(period.start)}::timestamp
      AND p."paidAt" < ${isoDay(period.end)}::timestamp
    GROUP BY 1, 2`;
  return rows.map((row) => ({ ...row, cents: Number(row.cents) }));
}

async function aggregateExpenses(
  client: PrismaClient,
  organizationId: string,
  period: ResolvedPeriod,
): Promise<ExpenseRow[]> {
  const rows = await client.$queryRaw<
    { propertyId: string; category: ExpenseCategoryValue; month: string; cents: bigint }[]
  >`
    SELECT e."propertyId" AS "propertyId",
           e.category::text AS category,
           to_char(date_trunc('month', e."occurredOn"), 'YYYY-MM') AS month,
           (SUM(e.amount) * 100)::bigint AS cents
    FROM "Expense" e
    WHERE e."organizationId" = ${organizationId}
      AND e."occurredOn" >= ${isoDay(period.start)}::date
      AND e."occurredOn" < ${isoDay(period.end)}::date
    GROUP BY 1, 2, 3`;
  return rows.map((row) => ({ ...row, cents: Number(row.cents) }));
}

/**
 * Month of the oldest settled payment or expense, for the "All" range.
 * Scoped to one property when given. Two index-backed MIN aggregates.
 */
export async function loadEarliestActivity(
  organizationId: string,
  propertyId?: string,
  client: PrismaClient = db,
): Promise<Date | null> {
  const [payment, expense] = await Promise.all([
    client.payment.aggregate({
      _min: { paidAt: true },
      where: {
        organizationId,
        status: 'SUCCEEDED',
        ...(propertyId ? { lease: { unit: { propertyId } } } : {}),
      },
    }),
    client.expense.aggregate({
      _min: { occurredOn: true },
      where: { organizationId, ...(propertyId ? { propertyId } : {}) },
    }),
  ]);
  const dates = [payment._min.paidAt, expense._min.occurredOn].filter((d): d is Date => !!d);
  if (!dates.length) return null;
  const first = new Date(Math.min(...dates.map((d) => d.getTime())));
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
}

export type PeriodParams = { period?: string | null; from?: string | null; to?: string | null };

/** Resolves the `period`, `from` and `to` URL params into a reporting period. */
export async function resolveReturnsPeriod(
  organizationId: string,
  params: PeriodParams,
  now: Date,
  propertyId?: string,
  client: PrismaClient = db,
): Promise<ResolvedPeriod> {
  const key = periodKeyFrom(params.period);
  const earliest = key === 'ALL' ? await loadEarliestActivity(organizationId, propertyId, client) : null;
  return resolvePeriod(key, now, { from: params.from, to: params.to, earliest });
}

export type ReturnsOverview = {
  period: ResolvedPeriod;
  properties: PropertyReturns[];
  portfolio: (PropertyReturns & { propertyName: 'Portfolio' }) | null;
  /** Chart series: one point per month, or per quarter for ranges beyond two years. */
  monthly: MonthlyPoint[];
  yearly: YearlyPoint[];
  expenseBreakdown: { category: ExpenseCategoryValue; label: string; amountCents: number }[];
  totalUnits: number;
  occupiedUnits: number;
};

/**
 * Loads the returns overview for one organization and period. Income is the
 * rent ledger: SUCCEEDED payments whose paidAt falls in the period, attributed
 * to a property through lease -> unit. Costs are the Expense rows in the
 * period. Debt service prorates each property's annual figure by the period
 * length, and scheduled rent annualizes active leases the same way, so every
 * metric on the screen describes the same window.
 */
export async function loadReturnsOverview(
  organizationId: string,
  period: ResolvedPeriod,
  client: PrismaClient = db,
): Promise<ReturnsOverview> {
  const properties = await client.property.findMany({
    where: { organizationId, archivedAt: null },
    include: { units: { select: { id: true, status: true } } },
    orderBy: { name: 'asc' },
  });

  const [incomeRows, expenseRows] = await Promise.all([
    aggregateIncome(client, organizationId, period),
    aggregateExpenses(client, organizationId, period),
  ]);

  const leases = await client.lease.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: {
      monthlyRent: true,
      unit: { select: { propertyId: true } },
    },
  });

  const incomeByProperty = new Map<string, number>();
  const monthlyIncome = new Map<string, number>();
  for (const row of incomeRows) {
    incomeByProperty.set(row.propertyId, (incomeByProperty.get(row.propertyId) ?? 0) + row.cents);
    monthlyIncome.set(row.month, (monthlyIncome.get(row.month) ?? 0) + row.cents);
  }

  const expensesByProperty = new Map<string, number>();
  const monthlyExpenses = new Map<string, number>();
  const expensesByCategory = new Map<ExpenseCategoryValue, number>();
  for (const row of expenseRows) {
    expensesByProperty.set(row.propertyId, (expensesByProperty.get(row.propertyId) ?? 0) + row.cents);
    monthlyExpenses.set(row.month, (monthlyExpenses.get(row.month) ?? 0) + row.cents);
    expensesByCategory.set(row.category, (expensesByCategory.get(row.category) ?? 0) + row.cents);
  }

  const scheduledByProperty = new Map<string, number>();
  for (const lease of leases) {
    const propertyId = lease.unit.propertyId;
    scheduledByProperty.set(
      propertyId,
      (scheduledByProperty.get(propertyId) ?? 0) + toCents(lease.monthlyRent) * period.months,
    );
  }

  const rows: PropertyReturns[] = properties.map((property) => {
    const occupied = property.units.filter((u) => u.status === 'OCCUPIED').length;
    const annualDebt = property.annualDebtService ? toCents(property.annualDebtService) : 0;
    const metrics = computeReturns({
      incomeCents: incomeByProperty.get(property.id) ?? 0,
      expensesCents: expensesByProperty.get(property.id) ?? 0,
      debtServiceCents: Math.round((annualDebt * period.months) / 12),
      purchasePriceCents: property.purchasePrice ? toCents(property.purchasePrice) : null,
      downPaymentCents: property.downPayment ? toCents(property.downPayment) : null,
      scheduledRentCents: scheduledByProperty.get(property.id) ?? 0,
      periodMonths: period.months,
    });
    return {
      propertyId: property.id,
      propertyName: property.name,
      units: property.units.length,
      occupied,
      metrics,
    };
  });

  const sum = (pick: (m: ReturnsMetrics) => number) =>
    rows.reduce((total, row) => total + pick(row.metrics), 0);
  const totalValue = properties.reduce(
    (total, p) => total + (p.purchasePrice ? toCents(p.purchasePrice) : 0),
    0,
  );
  const totalDown = properties.reduce(
    (total, p) =>
      total +
      (p.downPayment
        ? toCents(p.downPayment)
        : p.purchasePrice
          ? toCents(p.purchasePrice)
          : 0),
    0,
  );
  const portfolioMetrics = computeReturns({
    incomeCents: sum((m) => m.incomeCents),
    expensesCents: sum((m) => m.expensesCents),
    debtServiceCents: sum((m) => m.debtServiceCents),
    purchasePriceCents: totalValue > 0 ? totalValue : null,
    downPaymentCents: totalDown > 0 ? totalDown : null,
    scheduledRentCents: sum((m) => m.incomeCents) >= 0
      ? [...scheduledByProperty.values()].reduce((a, b) => a + b, 0)
      : 0,
    periodMonths: period.months,
  });

  const totalUnits = rows.reduce((t, r) => t + r.units, 0);
  const occupiedUnits = rows.reduce((t, r) => t + r.occupied, 0);

  return {
    period,
    properties: rows,
    portfolio: {
      propertyId: 'portfolio',
      propertyName: 'Portfolio',
      units: totalUnits,
      occupied: occupiedUnits,
      metrics: portfolioMetrics,
    },
    monthly: bucketSeries(period, monthlyIncome, monthlyExpenses),
    yearly: yearlyTotals(monthlyIncome, monthlyExpenses, period),
    expenseBreakdown: [...expensesByCategory.entries()]
      .map(([category, amountCents]) => ({
        category,
        label: EXPENSE_CATEGORY_LABELS[category],
        amountCents,
      }))
      .sort((a, b) => b.amountCents - a.amountCents),
    totalUnits,
    occupiedUnits,
  };
}

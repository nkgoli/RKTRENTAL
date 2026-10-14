import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { expensesDb, EXPENSE_CATEGORY_LABELS, type ExpenseCategoryValue } from '@/lib/expenses';
import { toCents } from '@/lib/ledger/core';
import { computeReturns, type ReturnsMetrics } from './core';
import { monthBucket, periodBuckets, type ResolvedPeriod } from './period';

export type PropertyReturns = {
  propertyId: string;
  propertyName: string;
  units: number;
  occupied: number;
  metrics: ReturnsMetrics;
};

export type MonthlyPoint = { month: string; incomeCents: number; expensesCents: number };

export type ReturnsOverview = {
  period: ResolvedPeriod;
  properties: PropertyReturns[];
  portfolio: (PropertyReturns & { propertyName: 'Portfolio' }) | null;
  monthly: MonthlyPoint[];
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

  const payments = await client.payment.findMany({
    where: {
      organizationId,
      status: 'SUCCEEDED',
      paidAt: { gte: period.start, lt: period.end },
    },
    select: {
      amount: true,
      paidAt: true,
      lease: { select: { unit: { select: { propertyId: true } } } },
    },
  });

  const expenses = await expensesDb(organizationId, client).listExpenses(period);

  const leases = await client.lease.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: {
      monthlyRent: true,
      unit: { select: { propertyId: true } },
    },
  });

  const incomeByProperty = new Map<string, number>();
  const monthlyIncome = new Map<string, number>();
  for (const payment of payments) {
    const cents = toCents(payment.amount);
    const propertyId = payment.lease.unit.propertyId;
    incomeByProperty.set(propertyId, (incomeByProperty.get(propertyId) ?? 0) + cents);
    if (payment.paidAt) {
      const bucket = monthBucket(payment.paidAt);
      monthlyIncome.set(bucket, (monthlyIncome.get(bucket) ?? 0) + cents);
    }
  }

  const expensesByProperty = new Map<string, number>();
  const monthlyExpenses = new Map<string, number>();
  const expensesByCategory = new Map<ExpenseCategoryValue, number>();
  for (const expense of expenses) {
    expensesByProperty.set(
      expense.propertyId,
      (expensesByProperty.get(expense.propertyId) ?? 0) + expense.amountCents,
    );
    const bucket = monthBucket(expense.occurredOn);
    monthlyExpenses.set(bucket, (monthlyExpenses.get(bucket) ?? 0) + expense.amountCents);
    expensesByCategory.set(
      expense.category,
      (expensesByCategory.get(expense.category) ?? 0) + expense.amountCents,
    );
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
    monthly: periodBuckets(period).map((month) => ({
      month,
      incomeCents: monthlyIncome.get(month) ?? 0,
      expensesCents: monthlyExpenses.get(month) ?? 0,
    })),
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

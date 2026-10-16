import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategoryValue } from '@/lib/expenses';
import { toCents } from '@/lib/ledger/core';
import { type ResolvedPeriod } from '@/lib/returns/period';
import { computeScopedReturns, type ScopedReturns } from './scoped';

export type PropertyWorkspaceReturns = {
  property: ScopedReturns;
  units: ScopedReturns[];
  unitFacts: {
    id: string;
    number: string;
    status: string;
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
    currentRent: number | null;
    listedRent: number | null;
    marketRent: number | null;
    leaseStartDate: Date | null;
    leaseEndDate: Date | null;
    tenantName: string | null;
  }[];
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const monthStart = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));

/** Loads property and unit returns using the portfolio's existing income/expense sources. */
export async function loadPropertyWorkspaceReturns(
  organizationId: string,
  propertyId: string,
  period: ResolvedPeriod,
  client: PrismaClient = db,
): Promise<PropertyWorkspaceReturns | null> {
  const property = await client.property.findFirst({
    where: { id: propertyId, organizationId },
    select: {
      purchasePrice: true,
      downPayment: true,
      annualDebtService: true,
      units: {
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
          status: true,
          listedRent: true,
          marketRent: true,
          bedrooms: true,
          bathrooms: true,
          squareFeet: true,
          leases: {
            where: { status: 'ACTIVE' },
            select: {
              monthlyRent: true,
              startDate: true,
              endDate: true,
              tenants: { orderBy: { isPrimary: 'desc' }, select: { tenant: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!property) return null;

  // Settled rent per unit and month, and expenses per category and month,
  // summed in SQL so the row count is bounded by units x months.
  const [payments, expenses] = await Promise.all([
    client.$queryRaw<{ unitId: string; month: string; cents: bigint }[]>`
      SELECT l."unitId" AS "unitId",
             to_char(date_trunc('month', p."paidAt"), 'YYYY-MM') AS month,
             (SUM(p.amount) * 100)::bigint AS cents
      FROM "Payment" p
      JOIN "Lease" l ON l.id = p."leaseId" AND l."organizationId" = p."organizationId"
      JOIN "Unit" u ON u.id = l."unitId" AND u."organizationId" = l."organizationId"
      WHERE p."organizationId" = ${organizationId}
        AND u."propertyId" = ${propertyId}
        AND p.status = 'SUCCEEDED'
        AND p."paidAt" >= ${isoDay(period.start)}::timestamp
        AND p."paidAt" < ${isoDay(period.end)}::timestamp
      GROUP BY 1, 2`,
    client.$queryRaw<{ category: ExpenseCategoryValue; month: string; cents: bigint }[]>`
      SELECT e.category::text AS category,
             to_char(date_trunc('month', e."occurredOn"), 'YYYY-MM') AS month,
             (SUM(e.amount) * 100)::bigint AS cents
      FROM "Expense" e
      WHERE e."organizationId" = ${organizationId}
        AND e."propertyId" = ${propertyId}
        AND e."occurredOn" >= ${isoDay(period.start)}::date
        AND e."occurredOn" < ${isoDay(period.end)}::date
      GROUP BY 1, 2`,
  ]);

  const units = property.units.map((unit) => ({
    id: unit.id,
    number: unit.number,
    status: unit.status,
    monthlyRentCents: unit.leases.reduce((sum, lease) => sum + toCents(lease.monthlyRent), 0),
    listedRentCents: unit.listedRent == null ? null : toCents(unit.listedRent),
  }));
  const unitFacts = property.units.map((unit) => ({
    id: unit.id,
    number: unit.number,
    status: unit.status,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms == null ? null : Number(unit.bathrooms),
    squareFeet: unit.squareFeet,
    currentRent: unit.leases.reduce((sum, lease) => sum + Number(lease.monthlyRent), 0) || null,
    listedRent: unit.listedRent == null ? null : Number(unit.listedRent),
    marketRent: unit.marketRent == null ? null : Number(unit.marketRent),
    leaseStartDate: unit.leases[0]?.startDate ?? null,
    leaseEndDate: unit.leases[0]?.endDate ?? null,
    tenantName: unit.leases[0]?.tenants[0]?.tenant.name ?? null,
  }));
  const input = {
    property: {
      purchasePriceCents: property.purchasePrice == null ? null : toCents(property.purchasePrice),
      downPaymentCents: property.downPayment == null ? null : toCents(property.downPayment),
      annualDebtServiceCents: toCents(property.annualDebtService),
    },
    units,
    payments: payments.map((row) => ({
      unitId: row.unitId,
      amountCents: Number(row.cents),
      paidAt: monthStart(row.month),
    })),
    expenses: expenses.map((row) => ({
      category: row.category,
      label: EXPENSE_CATEGORY_LABELS[row.category],
      amountCents: Number(row.cents),
      occurredOn: monthStart(row.month),
    })),
    period,
  };

  const summaries = units.map((unit) => computeScopedReturns({ ...input, unitId: unit.id }));
  return {
    property: computeScopedReturns(input),
    units: summaries,
    unitFacts,
  };
}

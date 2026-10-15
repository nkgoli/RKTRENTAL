import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { expensesDb, EXPENSE_CATEGORY_LABELS } from '@/lib/expenses';
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

  const [payments, expenses] = await Promise.all([
    client.payment.findMany({
      where: {
        organizationId,
        status: 'SUCCEEDED',
        paidAt: { gte: period.start, lt: period.end },
        lease: { unit: { propertyId } },
      },
      select: {
        amount: true,
        paidAt: true,
        lease: { select: { unitId: true } },
      },
    }),
    expensesDb(organizationId, client).listExpenses(period),
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
    payments: payments.flatMap((payment) =>
      payment.paidAt
        ? [{ unitId: payment.lease.unitId, amountCents: toCents(payment.amount), paidAt: payment.paidAt }]
        : [],
    ),
    expenses: expenses
      .filter((expense) => expense.propertyId === propertyId)
      .map((expense) => ({
        category: expense.category,
        label: EXPENSE_CATEGORY_LABELS[expense.category],
        amountCents: expense.amountCents,
        occurredOn: expense.occurredOn,
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

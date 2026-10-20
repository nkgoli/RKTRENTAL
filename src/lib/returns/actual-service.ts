import type { PrismaClient } from '@prisma/client';
import type { AuthSession } from '@/lib/auth/session';
import { toCents } from '@/lib/ledger/core';
import { actualPeriod, computeActualReturns, type ActualReturns, type PeriodError } from './actual';

type Manager = Pick<AuthSession, 'organizationId' | 'role'>;

export type ActualReturnsRequest = { propertyId: string; from: string; to: string };

export type ActualReturnsFailure = {
  ok: false;
  /** NOT_FOUND is the same for absent, archived and other organizations' properties. */
  code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID';
  issues?: (PeriodError | { path: 'propertyId'; message: string })[];
};

export type ActualReturnsResult = { ok: true; data: ActualReturns } | ActualReturnsFailure;

const cents = (value: { toString(): string } | null) => (value === null ? null : toCents(value));

/**
 * Recorded returns for one property and an explicit inclusive day range. Pass only a trusted
 * server session (requireManagerRole); the organization always comes from it, never from the
 * request. Every query is filtered by that organization. `now` is injectable for tests.
 */
export function actualReturnsService(
  session: Manager,
  client: PrismaClient,
  now = () => new Date(),
) {
  const organizationId = session.organizationId;
  const allowed = session.role === 'MANAGER' && !!organizationId?.trim();

  async function load(request: unknown): Promise<ActualReturnsResult> {
    if (!allowed) return { ok: false, code: 'FORBIDDEN' };
    const body = (request ?? {}) as Partial<Record<keyof ActualReturnsRequest, unknown>>;
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
    const parsed = actualPeriod(body.from, body.to);
    const issues: NonNullable<ActualReturnsFailure['issues']> = parsed.ok ? [] : [...parsed.issues];
    if (!propertyId || propertyId.length > 128)
      issues.unshift({ path: 'propertyId', message: 'Choose a property.' });
    if (issues.length || !parsed.ok) return { ok: false, code: 'INVALID', issues };
    const period = parsed.period;

    const property = await client.property.findFirst({
      where: { id: propertyId, organizationId, archivedAt: null },
      select: {
        id: true,
        name: true,
        purchasePrice: true,
        downPayment: true,
        loanAmount: true,
        annualDebtService: true,
      },
    });
    if (!property) return { ok: false, code: 'NOT_FOUND' };

    const leaseScope = { organizationId, unit: { propertyId, organizationId } };
    const leases = await client.lease.findMany({
      where: { ...leaseScope, status: { not: 'DRAFT' } },
      select: { id: true, startDate: true, endDate: true },
    });
    const leaseIds = leases.map((l) => l.id);
    const inPeriod = { gte: period.start, lt: period.endExclusive };

    const [charges, payments, excludedPayments, expenseGroups, expenseDays, earliestExpense] =
      await Promise.all([
        client.charge.findMany({
          where: { organizationId, leaseId: { in: leaseIds } },
          select: {
            id: true,
            leaseId: true,
            kind: true,
            amount: true,
            dueDate: true,
            description: true,
          },
        }),
        // Settlement order only depends on earlier receipts, so later ones are not loaded.
        client.payment.findMany({
          where: {
            organizationId,
            leaseId: { in: leaseIds },
            status: 'SUCCEEDED',
            OR: [{ paidAt: { lt: period.endExclusive } }, { paidAt: null }],
          },
          select: { id: true, leaseId: true, amount: true, paidAt: true, createdAt: true },
        }),
        client.payment.findMany({
          where: {
            organizationId,
            leaseId: { in: leaseIds },
            status: { in: ['PENDING', 'FAILED', 'REFUNDED'] },
            OR: [{ paidAt: inPeriod }, { paidAt: null, createdAt: inPeriod }],
          },
          select: { status: true, amount: true },
        }),
        client.expense.groupBy({
          by: ['category'],
          where: { organizationId, propertyId, occurredOn: inPeriod },
          _sum: { amount: true },
          _count: { _all: true },
          _min: { occurredOn: true },
          _max: { occurredOn: true },
        }),
        // Distinct days are bounded by the period length (at most 50 years of days).
        client.expense.findMany({
          where: { organizationId, propertyId, occurredOn: inPeriod },
          select: { occurredOn: true },
          distinct: ['occurredOn'],
        }),
        client.expense.aggregate({
          where: { organizationId, propertyId },
          _min: { occurredOn: true },
        }),
      ]);

    return {
      ok: true,
      data: computeActualReturns({
        property: {
          id: property.id,
          name: property.name,
          purchasePriceCents: cents(property.purchasePrice),
          downPaymentCents: cents(property.downPayment),
          loanAmountCents: cents(property.loanAmount),
          annualDebtServiceCents: toCents(property.annualDebtService),
        },
        period,
        asOf: now(),
        leases,
        charges: charges.map((c) => ({ ...c, amountCents: toCents(c.amount) })),
        payments: payments.map((p) => ({ ...p, amountCents: toCents(p.amount) })),
        excludedPayments: excludedPayments.map((p) => ({
          status: p.status as 'PENDING' | 'FAILED' | 'REFUNDED',
          amountCents: toCents(p.amount),
        })),
        expenses: expenseGroups.map((g) => ({
          category: g.category,
          amountCents: g._sum.amount ? toCents(g._sum.amount) : 0,
          count: g._count._all,
          firstOn: g._min.occurredOn as Date,
          lastOn: g._max.occurredOn as Date,
        })),
        expenseDays: expenseDays.map((e) => e.occurredOn),
        earliestExpenseOn: earliestExpense._min.occurredOn,
      }),
    };
  }

  return { load };
}

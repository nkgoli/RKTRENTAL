import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { centsToDecimal, toCents } from '@/lib/ledger/core';
import type { ExpenseCategoryValue } from './categories';
import type { ExpenseInput } from './validation';

export type ExpenseRecord = {
  id: string;
  propertyId: string;
  category: ExpenseCategoryValue;
  amountCents: number;
  occurredOn: Date;
  description: string | null;
  vendor: string | null;
};

/**
 * Org-scoped expense writes and reads. Every query carries organizationId and
 * the property is re-checked against it, so another organization's property
 * reads as "not found" instead of accepting a cross-tenant expense.
 */
export function expensesDb(organizationId: string, client: PrismaClient = db) {
  if (!organizationId.trim()) throw new Error('organizationId is required');

  return {
    async createExpense(input: ExpenseInput): Promise<ExpenseRecord> {
      const property = await client.property.findFirst({
        where: { id: input.propertyId, organizationId },
        select: { id: true },
      });
      if (!property) throw new Error('Property not found');
      const row = await client.expense.create({
        data: {
          organizationId,
          propertyId: input.propertyId,
          category: input.category,
          amount: centsToDecimal(input.amountCents),
          occurredOn: input.occurredOn,
          description: input.description ?? null,
          vendor: input.vendor ?? null,
        },
      });
      return {
        id: row.id,
        propertyId: row.propertyId,
        category: row.category,
        amountCents: toCents(row.amount),
        occurredOn: row.occurredOn,
        description: row.description,
        vendor: row.vendor,
      };
    },

    async listExpenses(range: { start: Date; end: Date }): Promise<ExpenseRecord[]> {
      const rows = await client.expense.findMany({
        where: {
          organizationId,
          occurredOn: { gte: range.start, lt: range.end },
        },
        orderBy: { occurredOn: 'desc' },
      });
      return rows.map((row) => ({
        id: row.id,
        propertyId: row.propertyId,
        category: row.category,
        amountCents: toCents(row.amount),
        occurredOn: row.occurredOn,
        description: row.description,
        vendor: row.vendor,
      }));
    },
  };
}

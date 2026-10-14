import { toCents } from '@/lib/ledger/core';
import { expenseCategoryFrom, type ExpenseCategoryValue } from './categories';

export type ExpenseInput = {
  propertyId: string;
  category: ExpenseCategoryValue;
  amountCents: number;
  occurredOn: Date;
  description?: string;
  vendor?: string;
};

export type ExpenseFieldErrors = Partial<
  Record<'propertyId' | 'category' | 'amount' | 'occurredOn', string>
>;

/** Parses "1,850.50" style input into cents; null when not a positive amount. */
export function parseExpenseAmount(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = toCents(cleaned);
  return cents > 0 ? cents : null;
}

/** Parses a YYYY-MM-DD date as a UTC calendar day; null when invalid. */
export function parseExpenseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  )
    return null;
  return date;
}

export function validateExpenseInput(raw: {
  propertyId?: string;
  category?: string;
  amount?: string;
  occurredOn?: string;
  description?: string;
  vendor?: string;
}): { ok: true; input: ExpenseInput } | { ok: false; errors: ExpenseFieldErrors } {
  const errors: ExpenseFieldErrors = {};
  const propertyId = (raw.propertyId ?? '').trim();
  if (!propertyId) errors.propertyId = 'Choose a property';
  const category = expenseCategoryFrom(raw.category);
  if (!category) errors.category = 'Choose a category';
  const amountCents = parseExpenseAmount(raw.amount ?? '');
  if (amountCents == null) errors.amount = 'Enter an amount greater than zero, like 250.00';
  const occurredOn = parseExpenseDate(raw.occurredOn ?? '');
  if (!occurredOn) errors.occurredOn = 'Enter the date the expense occurred';
  if (Object.keys(errors).length > 0 || !category || amountCents == null || !occurredOn)
    return { ok: false, errors };
  return {
    ok: true,
    input: {
      propertyId,
      category,
      amountCents,
      occurredOn,
      description: raw.description?.trim() || undefined,
      vendor: raw.vendor?.trim() || undefined,
    },
  };
}

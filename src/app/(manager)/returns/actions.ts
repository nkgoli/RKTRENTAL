'use server';

import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { expensesDb, validateExpenseInput } from '@/lib/expenses';
import { periodKeyFrom } from '@/lib/returns';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

function back(notice: string, period: string, property: string, range: string[]): never {
  const params = new URLSearchParams({ notice, period });
  if (period === 'CUSTOM') {
    params.set('from', range[0] ?? '');
    params.set('to', range[1] ?? '');
  }
  if (property && property !== 'all') params.set('property', property);
  redirect(`/returns?${params}`);
}

export async function addExpenseAction(data: FormData) {
  const session = await requireManagerRole();
  const period = periodKeyFrom(text(data, 'period'));
  const property = text(data, 'returnProperty') || 'all';
  const range = [text(data, 'from'), text(data, 'to')];
  const result = validateExpenseInput({
    propertyId: text(data, 'propertyId'),
    category: text(data, 'category'),
    amount: text(data, 'amount'),
    occurredOn: text(data, 'occurredOn'),
    description: text(data, 'description'),
    vendor: text(data, 'vendor'),
  });
  if (!result.ok) back('expense-invalid', period, property, range);
  try {
    await expensesDb(session.organizationId).createExpense(result.input);
  } catch (error) {
    if (error instanceof Error && error.message === 'Property not found')
      back('expense-invalid', period, property, range);
    throw error;
  }
  back('expense-added', period, property, range);
}

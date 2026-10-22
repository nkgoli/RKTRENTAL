import { expensesDb, validateExpenseInput } from '@/lib/expenses';
import { periodKeyFrom } from '@/lib/returns';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

/** The report URL to show after a submission: the same period and property, plus a notice. */
function back(notice: string, period: string, property: string, range: string[]): string {
  const params = new URLSearchParams({ notice, period });
  if (period === 'CUSTOM') {
    params.set('from', range[0] ?? '');
    params.set('to', range[1] ?? '');
  }
  if (property && property !== 'all') params.set('property', property);
  return `/returns?${params}`;
}

/** Validates and records one Add expense submission; returns where the report continues. */
export async function addExpense(data: FormData, organizationId: string): Promise<string> {
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
  if (!result.ok) return back('expense-invalid', period, property, range);
  try {
    await expensesDb(organizationId).createExpense(result.input);
  } catch (error) {
    if (error instanceof Error && error.message === 'Property not found')
      return back('expense-invalid', period, property, range);
    throw error;
  }
  return back('expense-added', period, property, range);
}

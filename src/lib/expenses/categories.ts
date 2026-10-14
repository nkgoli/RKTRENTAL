export const EXPENSE_CATEGORIES = [
  'TAXES',
  'INSURANCE',
  'REPAIRS',
  'MANAGEMENT',
  'UTILITIES',
  'OTHER',
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategoryValue, string> = {
  TAXES: 'Property taxes',
  INSURANCE: 'Insurance',
  REPAIRS: 'Repairs and maintenance',
  MANAGEMENT: 'Management fees',
  UTILITIES: 'Utilities',
  OTHER: 'Other (admin, landscaping)',
};

export function expenseCategoryFrom(value: string | undefined | null): ExpenseCategoryValue | null {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategoryValue)
    ? (value as ExpenseCategoryValue)
    : null;
}

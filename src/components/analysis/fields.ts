import type { AnalysisPayload } from '@/lib/analysis';

export type FieldSpec = {
  path: string;
  label: string;
  kind?: 'date' | 'select' | 'boolean';
  choices?: string[];
  optional?: boolean;
};
const fields = (section: string, entries: [string, string, boolean?][]): FieldSpec[] =>
  entries.map(([key, label, optional]) => ({ path: `input.${section}.${key}`, label, optional }));
export const groups: { title: string; fields: FieldSpec[] }[] = [
  {
    title: 'Purchase & financing',
    fields: [
      ...fields('purchase', [
        ['purchasePrice', 'Purchase price ($)'],
        ['afterRepairValue', 'After repair value ($)', true],
        ['closingCosts', 'Closing costs ($)'],
        ['rehabCosts', 'Rehab costs ($)'],
        ['furnishingCosts', 'Furnishing costs ($)'],
      ]),
      {
        path: 'input.purchase.acquisitionDate',
        label: 'Acquisition date',
        kind: 'date',
        optional: true,
      },
      ...fields('financing', [
        ['downPaymentPercent', 'Down payment (%)'],
        ['loanAmount', 'Loan amount ($, overrides down payment)', true],
        ['interestRate', 'Interest rate (%)'],
        ['loanTermYears', 'Loan term (years)'],
        ['amortizationYears', 'Amortization (years)', true],
        ['pointsPaid', 'Points (%)'],
        ['lenderFees', 'Lender fees ($)'],
      ]),
      {
        path: 'input.financing.loanType',
        label: 'Loan type',
        kind: 'select',
        choices: ['conventional', 'fha', 'va', 'commercial', 'portfolio', 'hard_money'],
      },
    ],
  },
  {
    title: 'Income & vacancy',
    fields: fields('income', [
      ['monthlyRent', 'Scheduled rent ($ / month)'],
      ['otherMonthlyIncome', 'Other income ($ / month)'],
      ['vacancyRate', 'Vacancy (%)'],
      ['annualRentGrowth', 'Annual rent growth (%)'],
    ]),
  },
  {
    title: 'Expenses & reserves',
    fields: fields('expenses', [
      ['propertyTax', 'Property tax ($ / year)'],
      ['insurance', 'Insurance ($ / year)'],
      ['hoaMonthly', 'HOA ($ / month)'],
      ['maintenance', 'Maintenance fixed ($ / year)', true],
      ['maintenancePercent', 'Maintenance (% gross rent)'],
      ['capex', 'Capital reserve fixed ($ / year)', true],
      ['capexPercent', 'Capital reserve (% gross rent)'],
      ['propertyManagement', 'Management fixed ($ / year)', true],
      ['propertyManagementPercent', 'Management (% effective income)'],
      ['utilitiesMonthly', 'Utilities ($ / month)'],
      ['leasingCosts', 'Leasing costs ($ / year)'],
      ['otherExpenses', 'Other expenses ($ / year)'],
      ['annualExpenseGrowth', 'Annual expense growth (%)'],
    ]),
  },
  {
    title: 'Growth & exit',
    fields: fields('appreciationExit', [
      ['annualAppreciation', 'Annual appreciation (%)'],
      ['holdingPeriodYears', 'Holding period (years)'],
      ['sellingCostsPercent', 'Selling costs (%)'],
      ['salePriceOverride', 'Sale price override ($)', true],
    ]),
  },
  {
    title: 'Projection assumptions',
    fields: [
      { path: 'options.startDate', label: 'Projection start date', kind: 'date' },
      { path: 'options.discountRate', label: 'Discount rate (fraction, 0.08 = 8%)' },
    ],
  },
];
export const taxFields: FieldSpec[] = [
  ...[
    'marginalTaxRate',
    'stateTaxRate',
    'capitalGainsTaxRate',
    'recaptureTaxRate',
    'depreciationYears',
    'landValuePercent',
  ].map((key) => ({
    path: `options.tax.${key}`,
    label: (
      {
        marginalTaxRate: 'Federal income tax (%)',
        stateTaxRate: 'State income tax (%)',
        capitalGainsTaxRate: 'Capital gains tax (%)',
        recaptureTaxRate: 'Recapture tax (%)',
        depreciationYears: 'Depreciation years',
        landValuePercent: 'Land value (%)',
      } as Record<string, string>
    )[key],
  })),
  { path: 'options.tax.depreciationEnabled', label: 'Enable depreciation', kind: 'boolean' },
  {
    path: 'options.tax.allowImmediateLossBenefit',
    label: 'Allow immediate loss benefit',
    kind: 'boolean',
  },
];
export const allFields = [...groups.flatMap((g) => g.fields), ...taxFields];
export type Values = Record<string, string>;
export function readPath(object: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      object,
    );
}
export function valuesFrom(payload: AnalysisPayload): Values {
  return Object.fromEntries(
    allFields.map((f) => {
      const v = readPath(payload, f.path);
      return [
        f.path,
        v === undefined ? '' : f.kind === 'date' ? String(v).slice(0, 10) : String(v),
      ];
    }),
  );
}
export function applyValues(
  payload: AnalysisPayload,
  values: Values,
  taxEnabled: boolean,
): AnalysisPayload {
  const copy = structuredClone(payload);
  for (const f of allFields) {
    if (f.path.startsWith('options.tax.') && !taxEnabled) continue;
    const keys = f.path.split('.');
    let parent = copy as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) {
      parent[key] ??= {};
      parent = parent[key] as Record<string, unknown>;
    }
    const raw = values[f.path]?.trim() ?? '';
    const key = keys[keys.length - 1];
    if (!raw) delete parent[key];
    else
      parent[key] =
        f.kind === 'date'
          ? `${raw}T00:00:00.000Z`
          : f.kind === 'boolean'
            ? raw === 'true'
            : f.kind === 'select'
              ? raw
              : Number(raw);
  }
  if (!taxEnabled) delete copy.options.tax;
  return copy;
}

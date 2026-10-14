export const WIZARD_STEPS = [
  'Unit and tenants',
  'Terms',
  'Rent and deposit',
  'Clauses and documents',
  'Review and send',
] as const;

export type WizardStepIndex = 0 | 1 | 2 | 3 | 4;

/** Stringly draft as held by the wizard form (dates and money as typed). */
export type WizardDraft = {
  unitId: string;
  tenantIds: string[];
  primaryTenantId: string;
  leaseType: 'fixed' | 'month-to-month';
  startDate: string;
  endDate: string;
  renewalNoticeDays: number;
  monthlyRent: string;
  deposit: string;
  lateFee: string;
  graceDays: number;
  rentDueDay: number;
  clauses: string[];
  customClause: string;
  documentNames: string[];
};

export type WizardErrors = Record<string, string>;

export type TenantOption = { id: string; name: string; email: string | null };
export type UnitOption = {
  id: string;
  label: string;
  status: string;
  listedRent: string | null;
};

export const emptyDraft = (overrides: Partial<WizardDraft> = {}): WizardDraft => ({
  unitId: '',
  tenantIds: [],
  primaryTenantId: '',
  leaseType: 'fixed',
  startDate: '',
  endDate: '',
  renewalNoticeDays: 60,
  monthlyRent: '',
  deposit: '',
  lateFee: '75',
  graceDays: 5,
  rentDueDay: 1,
  clauses: ['residential-use', 'utilities'],
  customClause: '',
  documentNames: [],
  ...overrides,
});

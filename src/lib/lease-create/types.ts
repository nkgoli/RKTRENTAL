export const WIZARD_STEPS = [
  'Lease term',
  'Rent, deposit & fees',
  'Tenants',
  'Options',
  'Clauses',
  'Rules',
  'Disclosures',
  'Attachments',
  'Lessor info',
  'Review & send',
] as const;

export const STEP_COUNT = WIZARD_STEPS.length;
export const STEP = {
  term: 0,
  rent: 1,
  tenants: 2,
  options: 3,
  clauses: 4,
  rules: 5,
  disclosures: 6,
  attachments: 7,
  lessor: 8,
  review: 9,
} as const;

export type WizardStepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type EndDateOption = 'full-year' | 'month-to-month' | 'custom';

/** Stringly draft as held by the wizard form (dates and money as typed). */
export type WizardDraft = {
  unitId: string;
  tenantIds: string[];
  primaryTenantId: string;
  leaseType: 'fixed' | 'month-to-month';
  startDate: string;
  /** Resolved from endOption: the calculated date, or the custom one. */
  endDate: string;
  endOption: EndDateOption;
  customEndDate: string;
  renewalNoticeDays: number;
  monthlyRent: string;
  deposit: string;
  /** Flat late fee; only charged when lateFeeEnabled. */
  lateFee: string;
  lateFeeEnabled: boolean;
  graceDays: number;
  rentDueDay: number;
  prorateFirstMonth: boolean;
  moveInFeeEnabled: boolean;
  moveInFee: string;
  petDepositEnabled: boolean;
  petDeposit: string;
  occupants: string;
  options: string[];
  clauses: string[];
  customClause: string;
  rules: string[];
  customRules: string;
  disclosures: string[];
  lessorName: string;
  lessorAddress: string;
  lessorPhone: string;
  lessorEmail: string;
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
  endOption: 'full-year',
  customEndDate: '',
  renewalNoticeDays: 60,
  monthlyRent: '',
  deposit: '',
  lateFee: '75',
  lateFeeEnabled: true,
  graceDays: 5,
  rentDueDay: 1,
  prorateFirstMonth: true,
  moveInFeeEnabled: false,
  moveInFee: '',
  petDepositEnabled: false,
  petDeposit: '',
  occupants: '',
  options: [],
  clauses: ['residential-use', 'utilities'],
  customClause: '',
  rules: [],
  customRules: '',
  disclosures: [],
  lessorName: '',
  lessorAddress: '',
  lessorPhone: '',
  lessorEmail: '',
  documentNames: [],
  ...overrides,
});

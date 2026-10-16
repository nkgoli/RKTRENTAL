import {
  nextLeaseStart,
  overlaps,
  parseLeaseDate,
  parseMoney,
  renewalEnd,
} from '@/lib/leases/core';
import { planSetupCharges } from '@/lib/ledger/lease-setup';
import { CLAUSE_OPTIONS, DISCLOSURE_OPTIONS, OPTION_CHOICES, RULE_OPTIONS } from './clauses';
import { feesFromDraft } from './fees';
import {
  STEP,
  type EndDateOption,
  type TenantOption,
  type WizardDraft,
  type WizardErrors,
} from './types';

export { nextLeaseStart, renewalEnd };

/** Renewal window that follows an existing lease: starts the day after it ends, runs one year. */
export function renewalWindow(sourceEnd: Date): { startDate: Date; endDate: Date } {
  const startDate = nextLeaseStart(sourceEnd);
  return { startDate, endDate: renewalEnd(startDate) };
}

export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

/** Last day of the month `start` falls in. */
export function endOfMonth(start: Date): Date {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
}

/** Suggested end date for a new term starting on `start`. */
export function suggestedEndDate(start: Date, leaseType: WizardDraft['leaseType']): Date {
  return leaseType === 'month-to-month' ? endOfMonth(start) : renewalEnd(start);
}

/** The end date an option implies: a full year is start + 1 year − 1 day; month-to-month ends the first month. */
export function endDateFor(start: Date, option: EndDateOption, custom: Date | null): Date | null {
  if (option === 'custom') return custom;
  return suggestedEndDate(start, option === 'month-to-month' ? 'month-to-month' : 'fixed');
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** The dates the Lease term step shows next to each option; empty strings until the start date is valid. */
export function endOptionDates(startDate: string): { fullYear: string; monthToMonth: string } {
  const start = parseLeaseDate(startDate);
  if (!start) return { fullYear: '', monthToMonth: '' };
  return {
    fullYear: iso(suggestedEndDate(start, 'fixed')),
    monthToMonth: iso(suggestedEndDate(start, 'month-to-month')),
  };
}

/** Applies the chosen end-date option to the draft: end date and lease type follow the option. */
export function withResolvedEnd(draft: WizardDraft): WizardDraft {
  const start = parseLeaseDate(draft.startDate);
  const custom = parseLeaseDate(draft.customEndDate);
  const end = start ? endDateFor(start, draft.endOption, custom) : custom;
  return {
    ...draft,
    leaseType: draft.endOption === 'month-to-month' ? 'month-to-month' : 'fixed',
    endDate: end ? iso(end) : draft.endOption === 'custom' ? draft.customEndDate : '',
  };
}

export function validateUnitAndTenants(
  draft: WizardDraft,
  opts: { isRenewal?: boolean } = {},
): WizardErrors {
  const errors: WizardErrors = {};
  if (!opts.isRenewal && !draft.unitId) errors.unitId = 'Select a unit for this lease.';
  if (!draft.tenantIds.length) errors.tenantIds = 'Select at least one tenant.';
  if (draft.tenantIds.length && !draft.tenantIds.includes(draft.primaryTenantId))
    errors.primaryTenantId = 'Choose a primary tenant from the selected tenants.';
  if (new Set(draft.tenantIds).size !== draft.tenantIds.length)
    errors.tenantIds = 'Each tenant can be added only once.';
  return errors;
}

export function validateTerms(
  draft: WizardDraft,
  opts: { renewalSourceEnd?: Date | null } = {},
): WizardErrors {
  const errors: WizardErrors = {};
  const start = parseLeaseDate(draft.startDate);
  const end = parseLeaseDate(draft.endDate);
  if (!start) errors.startDate = 'Enter a valid start date.';
  if (!end) errors.endDate = 'Enter a valid end date.';
  if (start && end && end < start) errors.endDate = 'End date must be on or after start date.';
  if (start && opts.renewalSourceEnd) {
    const earliest = nextLeaseStart(opts.renewalSourceEnd);
    if (start < earliest) errors.startDate = 'Renewal must begin after the current lease ends.';
  }
  if (![30, 60, 90].includes(draft.renewalNoticeDays))
    errors.renewalNoticeDays = 'Choose a renewal notice period of 30, 60 or 90 days.';
  return errors;
}

export function validateRentAndDeposit(draft: WizardDraft): WizardErrors {
  const errors: WizardErrors = {};
  const rent = parseMoney(draft.monthlyRent);
  const deposit = parseMoney(draft.deposit);
  const lateFee = parseMoney(draft.lateFee || '0');
  if (!rent || Number(rent) <= 0) errors.monthlyRent = 'Enter a monthly rent greater than zero.';
  if (!deposit) errors.deposit = 'Enter a valid deposit.';
  if (deposit && Number(deposit) < 0) errors.deposit = 'Enter a valid deposit.';
  if (draft.lateFeeEnabled && !lateFee) errors.lateFee = 'Enter a valid late fee.';
  const positive = (value: string) => {
    const money = parseMoney(value);
    return Boolean(money) && Number(money) > 0;
  };
  if (draft.moveInFeeEnabled && !positive(draft.moveInFee))
    errors.moveInFee = 'Enter a move-in fee greater than zero.';
  if (draft.petDepositEnabled && !positive(draft.petDeposit))
    errors.petDeposit = 'Enter a pet deposit greater than zero.';
  if (!Number.isInteger(draft.graceDays) || draft.graceDays < 0 || draft.graceDays > 31)
    errors.graceDays = 'Enter 0 to 31 days.';
  if (!Number.isInteger(draft.rentDueDay) || draft.rentDueDay < 1 || draft.rentDueDay > 28)
    errors.rentDueDay = 'Enter a rent due day between 1 and 28.';
  return errors;
}

export function validateClausesAndDocuments(draft: WizardDraft): WizardErrors {
  const errors: WizardErrors = {};
  const known = new Set(CLAUSE_OPTIONS.map((c) => c.id));
  if (!draft.clauses.length) errors.clauses = 'Include at least one lease clause.';
  if (draft.clauses.some((id) => !known.has(id))) errors.clauses = 'Remove the unknown clause.';
  if (draft.customClause.trim().length > 500)
    errors.customClause = 'Keep the custom clause to 500 characters or fewer.';
  const names = draft.documentNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length)
    errors.documentNames = 'Each document can be listed only once.';
  return errors;
}

export function validateOptions(draft: WizardDraft): WizardErrors {
  const errors: WizardErrors = {};
  if (![30, 60, 90].includes(draft.renewalNoticeDays))
    errors.renewalNoticeDays = 'Choose a renewal notice period of 30, 60 or 90 days.';
  if (draft.options.some((id) => !OPTION_CHOICES.some((o) => o.id === id)))
    errors.options = 'Remove the unknown option.';
  if (draft.occupants.trim().length > 200)
    errors.occupants = 'Keep the occupant list to 200 characters or fewer.';
  return errors;
}

export function validateRules(draft: WizardDraft): WizardErrors {
  const errors: WizardErrors = {};
  if (draft.rules.some((id) => !RULE_OPTIONS.some((r) => r.id === id)))
    errors.rules = 'Remove the unknown rule.';
  if (draft.customRules.trim().length > 1000)
    errors.customRules = 'Keep the extra rules to 1,000 characters or fewer.';
  return errors;
}

export function validateDisclosures(draft: WizardDraft): WizardErrors {
  const errors: WizardErrors = {};
  if (draft.disclosures.some((id) => !DISCLOSURE_OPTIONS.some((d) => d.id === id)))
    errors.disclosures = 'Remove the unknown disclosure.';
  return errors;
}

export function validateLessor(draft: WizardDraft): WizardErrors {
  const errors: WizardErrors = {};
  if (!draft.lessorName.trim()) errors.lessorName = 'Enter the lessor’s name.';
  if (!draft.lessorAddress.trim()) errors.lessorAddress = 'Enter the lessor’s address.';
  const email = draft.lessorEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.lessorEmail = 'Enter a valid email address.';
  return errors;
}

type ReviewOptions = {
  tenants?: TenantOption[];
  renewalSourceEnd?: Date | null;
  isRenewal?: boolean;
};

export function validateReview(draft: WizardDraft, opts: ReviewOptions = {}): WizardErrors {
  const errors: WizardErrors = {
    ...validateUnitAndTenants(draft, opts),
    ...validateTerms(draft, opts),
    ...validateRentAndDeposit(draft),
    ...validateClausesAndDocuments(draft),
    ...validateOptions(draft),
    ...validateRules(draft),
    ...validateDisclosures(draft),
    ...validateLessor(draft),
  };
  const primary = opts.tenants?.find((t) => t.id === draft.primaryTenantId);
  if (opts.tenants && primary && !primary.email)
    errors.primaryTenantId =
      'The primary tenant needs an email address before the lease can be sent for e-signature. Save as a draft instead.';
  return errors;
}

export function validateStep(
  step: number,
  draft: WizardDraft,
  opts: ReviewOptions = {},
): WizardErrors {
  switch (step) {
    case STEP.term:
      return validateTerms(draft, opts);
    case STEP.rent:
      return validateRentAndDeposit(draft);
    case STEP.tenants:
      return validateUnitAndTenants(draft, opts);
    case STEP.options:
      return validateOptions(draft);
    case STEP.clauses:
      return validateClausesAndDocuments(draft);
    case STEP.rules:
      return validateRules(draft);
    case STEP.disclosures:
      return validateDisclosures(draft);
    case STEP.lessor:
      return validateLessor(draft);
    case STEP.review:
      return validateReview(draft, opts);
    default:
      return {};
  }
}

/** Overlap check shared with the leases lib: one active lease per unit, no overlaps. */
export function hasOverlap(
  proposed: { startDate: Date; endDate: Date },
  existing: { startDate: Date; endDate: Date }[],
): boolean {
  return existing.some((lease) => overlaps(lease, proposed));
}

export type ParsedTerms = {
  startDate: Date;
  endDate: Date;
  monthlyRent: string;
  deposit: string;
  lateFee: string;
  graceDays: number;
  rentDueDay: number;
  prorateFirstMonth: boolean;
  moveInFee: string;
  petDeposit: string;
  occupants: string | null;
};

export function parseWizardTerms(draft: WizardDraft): ParsedTerms | null {
  const startDate = parseLeaseDate(draft.startDate);
  const endDate = parseLeaseDate(draft.endDate);
  const monthlyRent = parseMoney(draft.monthlyRent);
  const deposit = parseMoney(draft.deposit);
  const lateFee = draft.lateFeeEnabled ? parseMoney(draft.lateFee || '0') : '0.00';
  if (!startDate || !endDate || !monthlyRent || !deposit || !lateFee) return null;
  return {
    startDate,
    endDate,
    monthlyRent,
    deposit,
    lateFee,
    graceDays: draft.graceDays,
    rentDueDay: draft.rentDueDay,
    prorateFirstMonth: draft.prorateFirstMonth,
    moveInFee: draft.moveInFeeEnabled ? parseMoney(draft.moveInFee) ?? '0.00' : '0.00',
    petDeposit: draft.petDepositEnabled ? parseMoney(draft.petDeposit) ?? '0.00' : '0.00',
    occupants: draft.occupants.trim() || null,
  };
}

/** Dollars charged when the lease starts: first month (prorated when it applies), deposits and fees. */
export function dueAtSigning(draft: WizardDraft): number {
  const start = parseLeaseDate(draft.startDate);
  const end = parseLeaseDate(draft.endDate);
  const rent = parseMoney(draft.monthlyRent);
  const deposit = parseMoney(draft.deposit);
  if (!start || !end || !rent || !deposit) return 0;
  const fees = feesFromDraft(draft);
  const setup = planSetupCharges({ leaseId: 'draft', startDate: start, endDate: end, fees });
  const prorated = setup.some((c) => c.kind === 'RENT');
  const total = setup.reduce((sum, c) => sum + c.amountCents, 0);
  return (total + (prorated ? 0 : fees.monthlyRentCents)) / 100;
}

export function termLabel(draft: WizardDraft): string {
  const start = parseLeaseDate(draft.startDate);
  const end = parseLeaseDate(draft.endDate);
  if (!start || !end) return '—';
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

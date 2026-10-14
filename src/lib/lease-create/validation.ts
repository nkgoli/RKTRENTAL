import {
  nextLeaseStart,
  overlaps,
  parseLeaseDate,
  parseMoney,
  renewalEnd,
} from '@/lib/leases/core';
import { CLAUSE_OPTIONS } from './clauses';
import type { TenantOption, WizardDraft, WizardErrors } from './types';

export { nextLeaseStart, renewalEnd };

/** Renewal window that follows an existing lease: starts the day after it ends, runs one year. */
export function renewalWindow(sourceEnd: Date): { startDate: Date; endDate: Date } {
  const startDate = nextLeaseStart(sourceEnd);
  return { startDate, endDate: renewalEnd(startDate) };
}

export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

/** Suggested end date for a new term starting on `start`. */
export function suggestedEndDate(start: Date, leaseType: WizardDraft['leaseType']): Date {
  if (leaseType === 'month-to-month') {
    const next = addMonths(start, 1);
    return new Date(next.getTime() - 86_400_000);
  }
  return renewalEnd(start);
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
  if (!lateFee) errors.lateFee = 'Enter a valid late fee.';
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

export function validateReview(
  draft: WizardDraft,
  opts: { tenants?: TenantOption[]; renewalSourceEnd?: Date | null; isRenewal?: boolean } = {},
): WizardErrors {
  const errors: WizardErrors = {
    ...validateUnitAndTenants(draft, opts),
    ...validateTerms(draft, opts),
    ...validateRentAndDeposit(draft),
    ...validateClausesAndDocuments(draft),
  };
  const primary = opts.tenants?.find((t) => t.id === draft.primaryTenantId);
  if (opts.tenants && primary && !primary.email)
    errors.primaryTenantId =
      'The primary tenant needs an email address before the lease can be sent for e-signature. Save as a draft instead.';
  return errors;
}

export const STEP_VALIDATORS = [
  (d: WizardDraft) => validateUnitAndTenants(d),
  (d: WizardDraft) => validateTerms(d),
  (d: WizardDraft) => validateRentAndDeposit(d),
  (d: WizardDraft) => validateClausesAndDocuments(d),
  (d: WizardDraft) => validateReview(d),
] as const;

export function validateStep(
  step: number,
  draft: WizardDraft,
  opts: { tenants?: TenantOption[]; renewalSourceEnd?: Date | null; isRenewal?: boolean } = {},
): WizardErrors {
  if (step === 0) return validateUnitAndTenants(draft, opts);
  if (step === 1) return validateTerms(draft, opts);
  if (step === 2) return validateRentAndDeposit(draft);
  if (step === 3) return validateClausesAndDocuments(draft);
  return validateReview(draft, opts);
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
};

export function parseWizardTerms(draft: WizardDraft): ParsedTerms | null {
  const startDate = parseLeaseDate(draft.startDate);
  const endDate = parseLeaseDate(draft.endDate);
  const monthlyRent = parseMoney(draft.monthlyRent);
  const deposit = parseMoney(draft.deposit);
  const lateFee = parseMoney(draft.lateFee || '0');
  if (!startDate || !endDate || !monthlyRent || !deposit || !lateFee) return null;
  return { startDate, endDate, monthlyRent, deposit, lateFee, graceDays: draft.graceDays };
}

export function dueAtSigning(draft: WizardDraft): number {
  const rent = parseMoney(draft.monthlyRent);
  const deposit = parseMoney(draft.deposit);
  if (!rent || !deposit) return 0;
  return Number(rent) + Number(deposit);
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

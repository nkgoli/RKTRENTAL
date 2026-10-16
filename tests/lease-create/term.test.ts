import { describe, expect, it } from 'vitest';
import { coerceDraft } from '@/lib/lease-create/drafts';
import { emptyDraft } from '@/lib/lease-create/types';
import {
  dueAtSigning,
  endDateFor,
  endOptionDates,
  validateStep,
  withResolvedEnd,
} from '@/lib/lease-create/validation';
import { parseLeaseDate } from '@/lib/leases/core';

const day = (v: string) => parseLeaseDate(v)!;
const iso = (d: Date | null) => d?.toISOString().slice(0, 10);

describe('lease term end dates', () => {
  it('full year runs start + 1 year − 1 day', () => {
    expect(iso(endDateFor(day('2027-05-01'), 'full-year', null))).toBe('2028-04-30');
    expect(iso(endDateFor(day('2027-05-15'), 'full-year', null))).toBe('2028-05-14');
    expect(iso(endDateFor(day('2027-01-01'), 'full-year', null))).toBe('2027-12-31');
  });

  it('handles leap days without spilling into the next month', () => {
    expect(iso(endDateFor(day('2027-03-01'), 'full-year', null))).toBe('2028-02-29');
    expect(iso(endDateFor(day('2028-02-29'), 'full-year', null))).toBe('2029-02-28');
  });

  it('month-to-month ends on the last day of the first month', () => {
    expect(iso(endDateFor(day('2027-05-01'), 'month-to-month', null))).toBe('2027-05-31');
    expect(iso(endDateFor(day('2027-05-15'), 'month-to-month', null))).toBe('2027-05-31');
    expect(iso(endDateFor(day('2027-02-10'), 'month-to-month', null))).toBe('2027-02-28');
    expect(iso(endDateFor(day('2028-02-10'), 'month-to-month', null))).toBe('2028-02-29');
    expect(iso(endDateFor(day('2027-12-31'), 'month-to-month', null))).toBe('2027-12-31');
  });

  it('custom uses the date typed, and nothing until one is typed', () => {
    expect(iso(endDateFor(day('2027-05-01'), 'custom', day('2027-09-30')))).toBe('2027-09-30');
    expect(endDateFor(day('2027-05-01'), 'custom', null)).toBeNull();
  });

  it('shows the calculated dates next to the options', () => {
    expect(endOptionDates('2027-05-01')).toEqual({
      fullYear: '2028-04-30',
      monthToMonth: '2027-05-31',
    });
    expect(endOptionDates('not a date')).toEqual({ fullYear: '', monthToMonth: '' });
  });

  it('resolves the draft end date and lease type from the chosen option', () => {
    const base = emptyDraft({ startDate: '2027-05-01', customEndDate: '2027-11-30' });
    expect(withResolvedEnd({ ...base, endOption: 'full-year' })).toMatchObject({
      endDate: '2028-04-30',
      leaseType: 'fixed',
    });
    expect(withResolvedEnd({ ...base, endOption: 'month-to-month' })).toMatchObject({
      endDate: '2027-05-31',
      leaseType: 'month-to-month',
    });
    expect(withResolvedEnd({ ...base, endOption: 'custom' })).toMatchObject({
      endDate: '2027-11-30',
      leaseType: 'fixed',
    });
  });

  it('rejects a custom end before the start', () => {
    const draft = withResolvedEnd(
      emptyDraft({ startDate: '2027-05-01', endOption: 'custom', customEndDate: '2027-04-01' }),
    );
    expect(validateStep(0, draft).endDate).toContain('on or after');
    expect(validateStep(0, { ...draft, startDate: '' }).startDate).toContain('valid start');
  });
});

describe('rent step validation and due at signing', () => {
  const base = () =>
    emptyDraft({
      startDate: '2027-05-15',
      endDate: '2028-05-14',
      monthlyRent: '3100',
      deposit: '3100',
    });

  it('only requires fee amounts for the fees that are switched on', () => {
    expect(validateStep(1, base())).toEqual({});
    expect(validateStep(1, { ...base(), moveInFeeEnabled: true }).moveInFee).toBeTruthy();
    expect(validateStep(1, { ...base(), petDepositEnabled: true, petDeposit: '0' }).petDeposit).toBeTruthy();
    expect(validateStep(1, { ...base(), lateFeeEnabled: false, lateFee: 'x' })).toEqual({});
    expect(validateStep(1, { ...base(), lateFeeEnabled: true, lateFee: 'x' }).lateFee).toBeTruthy();
  });

  it('adds the prorated first month, deposit and fees', () => {
    // May 15–31 is 17 of 31 days: 3100 × 17 / 31 = 1700.
    expect(dueAtSigning(base())).toBe(1700 + 3100);
    expect(
      dueAtSigning({ ...base(), moveInFeeEnabled: true, moveInFee: '150', petDepositEnabled: true, petDeposit: '250' }),
    ).toBe(1700 + 3100 + 150 + 250);
    // Without proration the first month is a full month of rent.
    expect(dueAtSigning({ ...base(), prorateFirstMonth: false })).toBe(3100 + 3100);
  });
});

describe('draft payloads', () => {
  it('rebuilds a complete draft from partial or hostile JSON', () => {
    const draft = coerceDraft({
      startDate: '2027-05-01',
      endOption: 'month-to-month',
      tenantIds: ['a', 7, 'b'],
      rules: 'quiet-hours',
      graceDays: '3',
      monthlyRent: 1850,
    });
    expect(draft).toMatchObject({
      startDate: '2027-05-01',
      endDate: '2027-05-31',
      leaseType: 'month-to-month',
      tenantIds: ['a', 'b'],
      rules: [],
      graceDays: 3,
      monthlyRent: '',
      lateFeeEnabled: true,
    });
    expect(coerceDraft(null)).toMatchObject({ endOption: 'full-year', clauses: ['residential-use', 'utilities'] });
  });
});

import type { ProviderKind } from '@prisma/client';
import type { IntegrationGroup } from './catalog';

/** Group-level settings live in one ProviderConnection row per kind under this provider key. */
export const SETTINGS_PROVIDER = 'settings';

export const PAYOUT_ACCOUNTS = [
  { value: 'operating-4082', label: 'Operating account •••• 4082' },
  { value: 'add-account', label: 'Add another bank account' },
] as const;
export const PAYOUT_SCHEDULES = [
  { value: 'monthly-18', label: 'Monthly · 18th' },
  { value: 'weekly', label: 'Weekly' },
] as const;
export const SCREENING_PACKAGES = [
  { value: 'smartmove-plus', label: 'SmartMove Plus · credit, background, eviction' },
  { value: 'smartmove-basic', label: 'SmartMove Basic · credit' },
  { value: 'checkr-background', label: 'Checkr · background check' },
] as const;
export const CONSENT_MODES = [
  { value: 'required-before-report', label: 'Required before each report' },
] as const;
export const COMPS_RADII = [
  { value: '1', label: '1 mile' },
  { value: '2', label: '2 miles' },
  { value: '3', label: '3 miles' },
  { value: '5', label: '5 miles' },
] as const;
export const COMPS_REFRESH = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
] as const;

export type PaymentSettings = {
  payoutAccount: string;
  payoutSchedule: string;
  passProcessingFees: boolean;
};
export type ScreeningSettings = { defaultPackage: string; applicantConsent: string };
export type CompsSettings = { radiusMiles: number; refresh: string };

export type SettingsByGroup = {
  payments: PaymentSettings;
  screening: ScreeningSettings;
  comps: CompsSettings;
};

export const DEFAULT_SETTINGS: SettingsByGroup = {
  payments: {
    payoutAccount: 'operating-4082',
    payoutSchedule: 'monthly-18',
    passProcessingFees: true,
  },
  screening: { defaultPackage: 'smartmove-plus', applicantConsent: 'required-before-report' },
  comps: { radiusMiles: 2, refresh: 'daily' },
};

export const GROUP_KIND: Record<IntegrationGroup, ProviderKind> = {
  payments: 'PAYMENTS',
  screening: 'SCREENING',
  comps: 'COMPS',
};

export class SettingsError extends Error {}

type Option = { readonly value: string };
function pick(options: readonly Option[], value: unknown, field: string): string {
  if (typeof value === 'string' && options.some((option) => option.value === value)) return value;
  throw new SettingsError(`Unsupported value for ${field}`);
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 'on';
}

/** Validates untrusted form input. Unknown or invalid values throw SettingsError. */
export function parseSettings<G extends IntegrationGroup>(
  group: G,
  input: Record<string, unknown>,
): SettingsByGroup[G];
export function parseSettings(
  group: IntegrationGroup,
  input: Record<string, unknown>,
): SettingsByGroup[IntegrationGroup] {
  switch (group) {
    case 'payments':
      return {
        payoutAccount: pick(PAYOUT_ACCOUNTS, input.payoutAccount, 'payout account'),
        payoutSchedule: pick(PAYOUT_SCHEDULES, input.payoutSchedule, 'payout schedule'),
        passProcessingFees: bool(input.passProcessingFees),
      };
    case 'screening':
      return {
        defaultPackage: pick(SCREENING_PACKAGES, input.defaultPackage, 'screening package'),
        applicantConsent: pick(CONSENT_MODES, input.applicantConsent, 'applicant consent'),
      };
    case 'comps':
      return {
        radiusMiles: Number(pick(COMPS_RADII, String(input.radiusMiles), 'search radius')),
        refresh: pick(COMPS_REFRESH, input.refresh, 'data refresh'),
      };
    default:
      throw new SettingsError('Unknown settings group');
  }
}

/** Merges stored JSON over defaults, falling back to defaults when it no longer validates. */
export function readSettings<G extends IntegrationGroup>(
  group: G,
  stored: unknown,
): SettingsByGroup[G] {
  const defaults = DEFAULT_SETTINGS[group];
  const record = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  try {
    return parseSettings(group, { ...defaults, ...record });
  } catch {
    return defaults;
  }
}

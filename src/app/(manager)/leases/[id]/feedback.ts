export const leaseResultMessages = {
  terms: 'Lease terms saved.',
  notice: 'Notice recorded.',
  activated: 'Lease activated.',
  terminated: 'Lease terminated.',
} as const;

export type LeaseResult = keyof typeof leaseResultMessages;
export type LeaseReturnScope = 'property' | 'unit' | undefined;

export function leaseResult(value: string | null | undefined): LeaseResult | undefined {
  return value && Object.hasOwn(leaseResultMessages, value) ? (value as LeaseResult) : undefined;
}

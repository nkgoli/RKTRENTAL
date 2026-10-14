export type TenantStatus = 'CURRENT' | 'LATE' | 'PAST' | 'PROSPECT';

export const STATUS_FILTERS = ['all', 'current', 'late', 'past', 'prospect'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_LABEL: Record<TenantStatus, string> = {
  CURRENT: 'Current',
  LATE: 'Late',
  PAST: 'Past tenant',
  PROSPECT: 'No lease',
};

export const STATUS_TONE: Record<TenantStatus, 'success' | 'danger' | 'neutral' | 'info'> = {
  CURRENT: 'success',
  LATE: 'danger',
  PAST: 'neutral',
  PROSPECT: 'info',
};

type LeaseStatusLike = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'TERMINATED';

/** Balance owed in cents: charges due on or before `asOf` minus succeeded payments. */
export function balanceCents(charges: number[], payments: number[]): number {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  return Math.max(0, sum(charges) - sum(payments));
}

export function deriveStatus(leaseStatuses: LeaseStatusLike[], balance: number): TenantStatus {
  if (leaseStatuses.includes('ACTIVE')) return balance > 0 ? 'LATE' : 'CURRENT';
  if (leaseStatuses.some((s) => s === 'ENDED' || s === 'TERMINATED')) return 'PAST';
  return 'PROSPECT';
}

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(value ?? '')
    ? (value as StatusFilter)
    : 'all';
}

export function matchesStatusFilter(status: TenantStatus, filter: StatusFilter): boolean {
  return filter === 'all' || status.toLowerCase() === filter;
}

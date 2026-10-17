import type { MaintenanceStatus } from '@prisma/client';

export const MAINTENANCE_PAGE_SIZE = 20;
export const RECENT_DONE_DAYS = 90;

export const MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

type Raw = string | string[] | undefined;

export type MaintenanceListParams = {
  status?: Raw;
  from?: Raw;
  to?: Raw;
  history?: Raw;
  page?: Raw;
};

/** URL-backed list state for the maintenance board and the property/unit Maintenance tabs. */
export type MaintenanceListQuery = {
  /** Exact status; undefined means the default "open + recently done" view (or all history). */
  status?: MaintenanceStatus;
  /** Inclusive created-date bounds as YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** "Show all history": drops the recent window. */
  allHistory: boolean;
  page: number;
};

const one = (value: Raw) => {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  return v ? v : undefined;
};

const dateOnly = (value: Raw) => {
  const v = one(value);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  return Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? undefined : v;
};

export function parseMaintenanceQuery(params: MaintenanceListParams): MaintenanceListQuery {
  const status = one(params.status)?.toUpperCase();
  const page = Number.parseInt(one(params.page) ?? '1', 10);
  return {
    status: MAINTENANCE_STATUSES.find((s) => s === status),
    from: dateOnly(params.from),
    to: dateOnly(params.to),
    allHistory: one(params.history) === 'all',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** True when the default recent window applies (no explicit status, dates or full history). */
export const usesRecentWindow = (query: MaintenanceListQuery) =>
  !query.allHistory && !query.status && !query.from && !query.to;

/** Query string for a list state, omitting defaults so the default view has a clean URL. */
export function maintenanceQueryString(
  query: MaintenanceListQuery,
  extra: Record<string, string | undefined> = {},
  overrides: Partial<MaintenanceListQuery> = {},
) {
  const merged = { ...query, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) if (value) search.set(key, value);
  if (merged.status) search.set('status', merged.status);
  if (merged.from) search.set('from', merged.from);
  if (merged.to) search.set('to', merged.to);
  if (merged.allHistory) search.set('history', 'all');
  if (merged.page > 1) search.set('page', String(merged.page));
  const text = search.toString();
  return text ? `?${text}` : '';
}

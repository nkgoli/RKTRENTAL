import Link from 'next/link';
import styles from './maintenance.module.css';
import {
  MAINTENANCE_PAGE_SIZE,
  MAINTENANCE_STATUSES,
  RECENT_DONE_DAYS,
  maintenanceQueryString,
  usesRecentWindow,
  type MaintenanceListQuery,
} from '@/lib/maintenance/query';

const statusLabel = (status: string) =>
  status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

/**
 * GET form so filters live in the URL. `hidden` carries the page's own params (scope, unit).
 * Submitting resets to page 1 because no page field is sent.
 */
export function MaintenanceFilters({
  action,
  hidden = {},
  query,
}: {
  action: string;
  hidden?: Record<string, string | undefined>;
  query: MaintenanceListQuery;
}) {
  const filtered = Boolean(query.status || query.from || query.to);
  return (
    <form
      action={action}
      method="get"
      className={styles.filters}
      role="search"
      aria-label="Filter requests"
    >
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      {query.allHistory && <input type="hidden" name="history" value="all" />}
      <label className="field">
        Filter by status
        <select name="status" defaultValue={query.status ?? ''}>
          <option value="">{query.allHistory ? 'All statuses' : 'Open + recent'}</option>
          {MAINTENANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Created from
        <input type="date" name="from" defaultValue={query.from ?? ''} />
      </label>
      <label className="field">
        Created to
        <input type="date" name="to" defaultValue={query.to ?? ''} />
      </label>
      <button className="btn btn-secondary btn-sm" type="submit">
        Apply filters
      </button>
      {filtered && (
        <Link
          className="btn btn-ghost btn-sm"
          href={`${action}${maintenanceQueryString({ allHistory: query.allHistory, page: 1 }, hidden)}`}
        >
          Clear filters
        </Link>
      )}
    </form>
  );
}

/** Scope note, "Show all history" toggle and the Previous/Next pager. */
export function MaintenanceListFooter({
  action,
  hidden = {},
  query,
  page,
  pageCount,
  total,
}: {
  action: string;
  hidden?: Record<string, string | undefined>;
  query: MaintenanceListQuery;
  page: number;
  pageCount: number;
  total: number;
}) {
  const href = (overrides: Partial<MaintenanceListQuery>) =>
    `${action}${maintenanceQueryString(query, hidden, overrides)}`;
  const first = total === 0 ? 0 : (page - 1) * MAINTENANCE_PAGE_SIZE + 1;
  const last = Math.min(page * MAINTENANCE_PAGE_SIZE, total);
  return (
    <nav className="pager" aria-label="Request pagination">
      <p className="muted" style={{ fontSize: 13 }}>
        {usesRecentWindow(query)
          ? `Showing open requests and requests completed in the last ${RECENT_DONE_DAYS} days. `
          : query.allHistory
            ? 'Showing all history. '
            : ''}
        {total === 0 ? 'No matching requests.' : `${first}\u2013${last} of ${total}`}
      </p>
      {usesRecentWindow(query) && (
        <Link className="btn btn-ghost btn-sm" href={href({ allHistory: true, page: 1 })}>
          Show all history
        </Link>
      )}
      {query.allHistory && !query.status && !query.from && !query.to && (
        <Link className="btn btn-ghost btn-sm" href={href({ allHistory: false, page: 1 })}>
          Show recent only
        </Link>
      )}
      {pageCount > 1 && (
        <span className="pager-links">
          {page > 1 ? (
            <Link className="chip" rel="prev" href={href({ page: page - 1 })}>
              ‹ Prev
            </Link>
          ) : (
            <span className="chip" aria-disabled="true">
              ‹ Prev
            </span>
          )}
          <span className="chip active" aria-current="page">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link className="chip" rel="next" href={href({ page: page + 1 })}>
              Next ›
            </Link>
          ) : (
            <span className="chip" aria-disabled="true">
              Next ›
            </span>
          )}
        </span>
      )}
    </nav>
  );
}

import Link from 'next/link';
import styles from './tenants.module.css';

/** Always-visible pager used by the tenant directory, status list and payment history. */
export function TenantPager({
  page,
  total,
  size = 20,
  noun,
  href,
}: {
  page: number;
  total: number;
  size?: number;
  noun: string;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <div className={styles.pager}>
      <span>
        {from}–{to} of {total} {noun}
      </span>
      <div className={styles.actions}>
        {page > 1 ? (
          <Link className="btn btn-sm" href={href(page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <button className="btn btn-sm" type="button" disabled>
            Previous
          </button>
        )}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link className="btn btn-sm" href={href(page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <button className="btn btn-sm" type="button" disabled>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

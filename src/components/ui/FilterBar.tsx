import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * One toolbar for list filters: every control applies itself (SearchField debounces, selects use
 * AutoSubmitSelect, chips are links), a result count sits on the right and "Clear" resets. It is
 * a GET form so a JS-free submit still works; there is never an Apply button.
 */
export function FilterBar({
  action,
  label = 'Filters',
  hidden = {},
  children,
  count,
  clearHref,
  className,
}: {
  action: string;
  label?: string;
  /** Params carried across changes (scope, tab, view). */
  hidden?: Record<string, string | undefined>;
  children: ReactNode;
  /** "41 tenants" shown next to Clear. */
  count?: ReactNode;
  /** Shown only when a filter is active. */
  clearHref?: string;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label={label}
      className={cx('filterbar', className)}
    >
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      {children}
      {(count !== undefined || clearHref) && (
        <span className="filterbar-end">
          {count !== undefined && <span className="muted">{count}</span>}
          {clearHref && (
            <Link className="filterbar-clear" href={clearHref}>
              Clear filters
            </Link>
          )}
        </span>
      )}
    </form>
  );
}

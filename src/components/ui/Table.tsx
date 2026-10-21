import type { ReactNode, TableHTMLAttributes } from 'react';
import { Avatar } from './Badge';
import { cx } from './cx';

/**
 * Shared table. `mobile="cards"` turns every body row into a two-column card below 640px;
 * cells opt into a slot with `data-cell`:
 *   title   – first line, left (name + avatar)
 *   status  – first line, right (a Badge)
 *   meta    – second line, left, muted
 *   amount  – second line, right, tabular
 *   sub     – full-width muted line
 *   actions – full-width row of buttons at the end
 *   hide    – not shown on phone
 * A row with `className="row-link"` and one `<a className="row-anchor">` is clickable as a whole.
 */
export function Table({
  children,
  mobile,
  className,
  ...rest
}: TableHTMLAttributes<HTMLTableElement> & { mobile?: 'cards' }) {
  return (
    <table className={cx('table', className)} data-mobile={mobile} {...rest}>
      {children}
    </table>
  );
}

export function TableHead({ columns }: { columns: ReactNode[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c, i) => (
          <th key={i} scope="col">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function CellMain({
  initials,
  title,
  subtitle,
}: {
  initials?: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="cell-main">
      {initials && <Avatar initials={initials} size="sm" />}
      <div>
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}

/** Opt-in named keyboard-accessible overflow for dense financial tables. */
export function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="table-region" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

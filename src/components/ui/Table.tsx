import type { ReactNode, TableHTMLAttributes } from 'react';
import { Avatar } from './Badge';

export function Table({ children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className="table" {...rest}>
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

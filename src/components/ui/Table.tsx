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
          <th key={i}>{c}</th>
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

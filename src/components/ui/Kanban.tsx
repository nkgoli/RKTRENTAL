import type { ReactNode } from 'react';
import { EmptyState } from '../RouteStates';

export function KanbanBoard({ children }: { children: ReactNode }) {
  return <div className="kanban">{children}</div>;
}

export function KanbanColumn({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <section className="column" aria-label={title}>
      <h4>
        <span>{title}</span>
        {count !== undefined && <span>{count}</span>}
      </h4>
      {count === 0 ? <EmptyState size="inline" title="No requests" /> : children}
    </section>
  );
}

export function Ticket({ children }: { children: ReactNode }) {
  return <div className="ticket">{children}</div>;
}

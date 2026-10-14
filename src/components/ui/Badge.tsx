import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx('badge', tone !== 'neutral' && tone)}>{children}</span>;
}

export function Avatar({ initials, size }: { initials: string; size?: 'sm' | 'lg' }) {
  return <span className={cx('avatar', size)}>{initials}</span>;
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="chips">{children}</div>;
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  const className = cx('chip', active && 'active');
  return onClick ? (
    <button type="button" className={className} aria-pressed={!!active} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );
}

import Link from 'next/link';
import { cx } from './cx';

export type TabItem = { label: string; href: string; active?: boolean };

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cx(t.active && 'active')}
          aria-current={t.active ? 'page' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

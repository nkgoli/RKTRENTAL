'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { cx } from './cx';

export type TabItem = { label: string; href: string; active?: boolean; count?: number };

/**
 * Underline tabs. When the strip is wider than its container (phone) the active tab is scrolled
 * into view and the strip fades at its scrollable edge instead of showing a bare scrollbar.
 */
export function Tabs({ items, label = 'Sections' }: { items: TabItem[]; label?: string }) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const update = () => {
      const scrollable = el.scrollWidth > el.clientWidth + 1;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      el.dataset.overflow = scrollable ? (atEnd ? 'start' : 'end') : 'none';
    };
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({
      inline: 'center',
      block: 'nearest',
    });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [items]);
  return (
    <nav className="tabs" aria-label={label} ref={nav}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cx(t.active && 'active')}
          aria-current={t.active ? 'page' : undefined}
        >
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

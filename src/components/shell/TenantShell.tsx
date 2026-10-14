'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Avatar } from '../ui/Badge';
import { cx } from '../ui/cx';
import { findTenantTab, isActive, tenantTabs } from './nav';

export function TenantShell({
  children,
  initials = 'AR',
}: {
  children: ReactNode;
  initials?: string;
}) {
  const pathname = usePathname() ?? '';
  const current = findTenantTab(pathname);

  return (
    <div className="phone">
      <header className="phone-top">
        <span className="brand-mark">R</span>
        <span className="title">{current?.label ?? 'RocketRental'}</span>
        <Avatar initials={initials} size="sm" />
      </header>
      <main className="phone-body">{children}</main>
      <nav className="tabbar" aria-label="Tenant">
        {tenantTabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(active && 'active')}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

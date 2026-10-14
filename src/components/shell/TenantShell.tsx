'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '../ui/cx';
import { AccountMenu } from './AccountMenu';
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
        <AccountMenu initials={initials} />
      </header>
      <main className="phone-body">{children}</main>
      <nav className="tabbar" aria-label="Tenant">
        {tenantTabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={cx(active && 'active')}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

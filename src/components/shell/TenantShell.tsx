'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '../ui/cx';
import { AccountMenu } from './AccountMenu';
import { findTenantTab, isActive, tenantTabs } from './nav';
import focus from './focus.module.css';

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
    <>
    <a className={focus.skip} href="#tenant-main">Skip to main content</a>
    <div className={`phone ${focus.scope}`}>
      <header className="phone-top">
        <span className="brand-mark">R</span>
        <span className="title">{current?.label ?? 'RocketRental'}</span>
        <AccountMenu initials={initials} />
      </header>
      <main className="phone-body" id="tenant-main" tabIndex={-1}>{children}</main>
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
    </>
  );
}

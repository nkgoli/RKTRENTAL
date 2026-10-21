'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '../ui/cx';
import { Icon } from './Icons';
import { AccountMenu } from './AccountMenu';
import { findTenantTab, isActive, tenantTabs } from './nav';
import { ToastProvider } from '../ui/Toast';
import { RoleNotice } from './RoleNotice';
import focus from './focus.module.css';
import styles from './tenant-shell.module.css';

export function TenantShell({
  children,
  initials = 'AR',
  name,
  premises,
}: {
  children: ReactNode;
  initials?: string;
  name?: string;
  premises?: string;
}) {
  const pathname = usePathname() ?? '';
  const current = findTenantTab(pathname);

  return (
    <ToastProvider offset="tabbar">
      <a className={focus.skip} href="#tenant-main">
        Skip to main content
      </a>
      <div className={`phone ${focus.scope} ${styles.shell}`}>
        <header className={`phone-top ${styles.header}`}>
          <a className="brand-mark" href="/home" aria-label="RocketRental home">
            <Icon name="brand" />
          </a>
          <span className="title">{current?.label ?? 'RocketRental'}</span>
          <AccountMenu initials={initials} name={name} description={premises} />
        </header>
        <nav className={styles.topTabs} aria-label="Tenant desktop">
          {tenantTabs.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              aria-current={isActive(pathname, tab.href) ? 'page' : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>
        <main className={`phone-body ${styles.body}`} id="tenant-main" tabIndex={-1}>
          <RoleNotice role="tenant" />
          {children}
        </main>
        <nav className={`tabbar ${styles.navigation}`} aria-label="Tenant">
          {tenantTabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={cx(active && 'active')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  name={
                    tab.href === '/home'
                      ? 'property-house'
                      : tab.href === '/pay'
                        ? 'payments'
                        : tab.href === '/lease'
                          ? 'leases'
                          : 'maintenance'
                  }
                />
                {tab.label}
              </a>
            );
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}

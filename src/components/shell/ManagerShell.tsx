'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Avatar } from '../ui/Badge';
import { cx } from '../ui/cx';
import { Icon } from './Icons';
import { PageHeaderContext, type PageHeaderConfig } from './PageHeader';
import { findManagerItem, isActive, managerNav } from './nav';
import focus from './focus.module.css';

export type ManagerUser = { name: string; role: string; initials: string };

const defaultUser: ManagerUser = { name: 'Jordan Mills', role: 'Property manager', initials: 'JM' };

export function ManagerShell({
  children,
  user = defaultUser,
}: {
  children: ReactNode;
  user?: ManagerUser;
}) {
  const pathname = usePathname() ?? '';
  const current = findManagerItem(pathname);
  const [override, setOverride] = useState<PageHeaderConfig | null>(null);
  const eyebrow = override?.eyebrow ?? current?.group.label ?? 'RocketRental';
  const title =
    override?.title ?? (current ? (current.item.title ?? current.item.label) : 'RocketRental');
  const actions = override?.actions ?? current?.item.actions;

  return (
    <>
    <a className={focus.skip} href="#main-content">Skip to main content</a>
    <div className={`app ${focus.scope}`}>
      <aside className="sidebar">
        <a className="brand" href="/dashboard">
          <span className="brand-mark">R</span>RocketRental
        </a>
        <nav className="nav" aria-label="Main">
          {managerNav.map((group) => (
            <div className="nav-section" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cx(active && 'active')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Avatar initials={user.initials} />
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <a className={cx('btn', 'btn-ghost', 'btn-sm')} href="/sign-out">
            Sign out
          </a>
        </div>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            {actions?.map((a) => (
              <a
                key={a.label}
                className={cx('btn', a.primary ? 'btn-primary' : 'btn-secondary')}
                href={a.href}
              >
                {a.label}
              </a>
            ))}
          </div>
        </header>
        <div className="page">
          <PageHeaderContext.Provider value={setOverride}>{children}</PageHeaderContext.Provider>
        </div>
      </main>
    </div>
    </>
  );
}

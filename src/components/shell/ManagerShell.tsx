'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Avatar } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { Icon } from './Icons';
import { findManagerItem, isActive, managerNav } from './nav';

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

  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">R</span>RocketRental
        </Link>
        <nav className="nav" aria-label="Main">
          {managerNav.map((group) => (
            <div className="nav-section" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(active && 'active')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
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
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{current?.group.label ?? 'RocketRental'}</p>
            <h1>{current ? (current.item.title ?? current.item.label) : 'RocketRental'}</h1>
          </div>
          <div className="topbar-actions">
            {current?.item.actions?.map((a) => (
              <Button key={a.label} href={a.href} variant={a.primary ? 'primary' : 'secondary'}>
                {a.label}
              </Button>
            ))}
          </div>
        </header>
        <div className="page">{children}</div>
      </main>
    </div>
  );
}

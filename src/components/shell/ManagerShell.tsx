'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cx } from '../ui/cx';
import { AccountMenu } from './AccountMenu';
import { Icon } from './Icons';
import { PageHeaderContext, type PageHeaderConfig } from './PageHeader';
import { activeMobileTab, findManagerItem, isItemActive, managerNav, mobileTabs } from './nav';
import { ToastProvider } from '../ui/Toast';
import { RoleNotice } from './RoleNotice';
import { signOutAction } from '@/app/(auth)/sign-out/actions';
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
  const workspaceRoute =
    (/^\/properties\/[^/]+(?:\/|$)/.test(pathname) &&
      pathname !== '/properties/new' &&
      !pathname.endsWith('/edit')) ||
    pathname === '/roi-analysis' ||
    pathname === '/leases/new';
  const current = findManagerItem(pathname);
  const [override, setOverride] = useState<PageHeaderConfig | null>(null);
  const eyebrow = override?.eyebrow ?? current?.group.label ?? 'RocketRental';
  const title =
    override?.title ?? (current ? (current.item.title ?? current.item.label) : 'RocketRental');
  const actions = override?.actions ?? current?.item.actions;
  const meta = override?.meta;
  const back = override?.back;
  const mobileTab = activeMobileTab(pathname);

  return (
    <ToastProvider>
      <a className={focus.skip} href="#main-content">
        Skip to main content
      </a>
      <div className={cx('app', focus.scope)}>
        <aside className="sidebar" id="manager-sidebar">
          <div className="sidebar-head">
            <a className="brand" href="/dashboard">
              RocketRental
            </a>
            <p className="sidebar-user">
              {user.name} · {user.role}
            </p>
          </div>
          <nav className="nav" aria-label="Main">
            {managerNav.map((group) => {
              const items = group.items.filter((item) => !item.hidden);
              if (items.length === 0 || group.pinned) return null;
              return (
                <div className="nav-section" key={group.label}>
                  {!group.hideLabel && <p className="nav-label">{group.label}</p>}
                  {items.map((item) => {
                    const active = isItemActive(pathname, item);
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className={cx(active && 'active')}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon name={active ? 'check' : item.icon} />
                        {item.label}
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="sidebar-foot">
            {managerNav
              .filter((group) => group.pinned)
              .flatMap((group) => group.items.filter((item) => !item.hidden))
              .map((item) => {
                const active = isItemActive(pathname, item);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cx('sidebar-integrations', active && 'active')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={item.icon} />
                    <span>
                      {item.label}
                      <small>Owner payout setup · coming soon</small>
                    </span>
                  </a>
                );
              })}
            <form action={signOutAction}>
              <button type="submit" className="sidebar-signout">
                <Icon name="sign-out" />
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <header className="appbar">
          <a className="brand" href="/dashboard">
            RocketRental
          </a>
          <div className="appbar-actions">
            <a
              className={cx('appbar-icon', pathname === '/notifications' && 'active')}
              href="/notifications"
              aria-label="Notifications"
              aria-current={pathname === '/notifications' ? 'page' : undefined}
            >
              <Icon name="bell" />
            </a>
            <AccountMenu initials={user.initials} name={user.name} description={user.role} />
          </div>
        </header>
        <main className="main" id="main-content" tabIndex={-1}>
          <header
            className={cx('topbar', workspaceRoute && focus.workspaceTopbar, meta && 'topbar-meta')}
          >
            {!workspaceRoute && (
              <div>
                <p className="eyebrow">
                  {back ? (
                    <>
                      <a className="topbar-back" href={back.href}>
                        <Icon name="arrow-left" />
                        {back.label}
                      </a>
                      <span aria-hidden="true"> / </span>
                    </>
                  ) : null}
                  {eyebrow}
                </p>
                <h1>{title}</h1>
                {meta && <p className="topbar-sub">{meta}</p>}
              </div>
            )}
            {!workspaceRoute && actions?.length ? (
              <div className="topbar-actions">
                {actions.map((a) => (
                  <a
                    key={a.label}
                    className={cx('btn', a.primary ? 'btn-primary' : 'btn-secondary')}
                    href={a.href}
                  >
                    {a.icon && <Icon name={a.icon} />}
                    {a.label}
                  </a>
                ))}
              </div>
            ) : null}
          </header>
          <div className="page">
            <RoleNotice role="manager" />
            <PageHeaderContext.Provider value={setOverride}>{children}</PageHeaderContext.Provider>
          </div>
        </main>
        <nav className="tabbar manager-tabbar" aria-label="Sections">
          {mobileTabs.map((tab) => {
            const active = tab.href === mobileTab;
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={cx(active && 'active')}
                // More stays highlighted for sections reached from it, without claiming to be the page.
                aria-current={active ? (pathname === tab.href ? 'page' : 'true') : undefined}
              >
                <Icon name={tab.icon} />
                <span>{tab.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}

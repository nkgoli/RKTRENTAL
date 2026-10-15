'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../ui/Badge';
import { cx } from '../ui/cx';
import { DOCKED_QUERY, FOCUSABLE, nextTrapIndex } from './drawer';
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
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) menuBtn.current?.focus();
  }, []);

  // Route change closes the drawer without stealing focus from the new page.
  useEffect(() => setOpen(false), [pathname]);

  // Moving up to the docked breakpoint also dismisses the drawer.
  useEffect(() => {
    const mq = window.matchMedia(DOCKED_QUERY);
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !sidebar.current) return;
      const items = Array.from(sidebar.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const at = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      items[nextTrapIndex(items.length, at, e.shiftKey)]?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
    <a className={focus.skip} href="#main-content">Skip to main content</a>
    <div className={cx('app', focus.scope, open && 'drawer-open')}>
      {open && <button type="button" className="scrim" aria-label="Close menu" tabIndex={-1} onClick={() => close()} />}
      <aside
        className="sidebar"
        id="manager-sidebar"
        ref={sidebar}
        {...(open ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Main menu' } : {})}
      >
        <div className="sidebar-head">
          <a className="brand" href="/dashboard">
            <span className="brand-mark">R</span>RocketRental
          </a>
          <button
            type="button"
            className="drawer-close"
            ref={closeBtn}
            aria-label="Close menu"
            onClick={() => close()}
          >
            ✕
          </button>
        </div>
        <nav className="nav" aria-label="Main">
          {managerNav.map((group) => {
            const items = group.items.filter((item) => !item.hidden);
            if (items.length === 0) return null;
            return (
              <div className={cx('nav-section', group.pinned && 'nav-pinned')} key={group.label}>
                {!group.hideLabel && <p className="nav-label">{group.label}</p>}
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={cx(active && 'active')}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => close(false)}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </a>
                  );
                })}
              </div>
            );
          })}
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
      </aside>      <main className="main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            ref={menuBtn}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="manager-sidebar"
            onClick={() => setOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
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

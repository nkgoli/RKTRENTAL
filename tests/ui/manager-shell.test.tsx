// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerShell } from '@/components/shell/ManagerShell';
import { managerNav } from '@/components/shell/nav';

let pathname = '/dashboard';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/app/(auth)/sign-out/actions', () => ({ signOutAction: vi.fn() }));

beforeEach(() => {
  pathname = '/dashboard';
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

const ui = () => <ManagerShell>content</ManagerShell>;
const sidebar = () => document.getElementById('manager-sidebar')!;
const tabbar = () => screen.getByRole('navigation', { name: 'Sections' });

describe('ManagerShell phone navigation', () => {
  it('replaces the drawer with an app bar, notifications and the account menu', () => {
    render(ui());
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Notifications' }).getAttribute('href')).toBe(
      '/notifications',
    );
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeTruthy();
    expect(sidebar().getAttribute('role')).toBeNull();
    expect(document.getElementById('main-content')!.hasAttribute('inert')).toBe(false);
  });

  it('offers Home, Properties, People, Payments and More in the tab bar', () => {
    render(ui());
    const links = within(tabbar()).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Home', '/dashboard'],
      ['Properties', '/properties'],
      ['People', '/tenants'],
      ['Payments', '/payments'],
      ['More', '/more'],
    ]);
    expect(within(tabbar()).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('marks More for sections reached from it without claiming to be the page', () => {
    for (const [path, current] of [
      ['/leases/abc', 'true'],
      ['/maintenance', 'true'],
      ['/more', 'page'],
    ] as const) {
      pathname = path;
      const { unmount } = render(ui());
      const more = within(tabbar()).getByRole('link', { name: 'More' });
      expect(more.classList.contains('active')).toBe(true);
      expect(more.getAttribute('aria-current')).toBe(current);
      expect(
        within(tabbar())
          .getAllByRole('link')
          .filter((l) => l.classList.contains('active')),
      ).toHaveLength(1);
      unmount();
    }
  });

  it('keeps a nested route on its own tab', () => {
    pathname = '/properties/maple/units/4b';
    render(ui());
    const active = within(tabbar())
      .getAllByRole('link')
      .filter((link) => link.classList.contains('active'));
    expect(active.map((link) => link.textContent)).toEqual(['Properties']);
  });

  it('does not intercept Escape or Tab', () => {
    render(ui());
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(document.body);
  });
});
describe('ManagerShell navigation', () => {
  const visible = managerNav.flatMap((g) => g.items).filter((i) => !i.hidden);

  it('exposes distinct analysis entries without choosing a property', () => {
    render(ui());
    for (const [label, href] of [
      ['Returns & ROI', '/roi-analysis'],
      ['Rent analysis', '/rent-analysis'],
    ]) {
      const links = within(sidebar()).getAllByRole('link', { name: label });
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toBe(href);
    }
    // Returns and ROI are one workspace; portfolio returns is reached from it, not a rival entry.
    expect(within(sidebar()).queryByRole('link', { name: /^(Returns|ROI Analysis)$/ })).toBeNull();
  });

  it('updates the title and highlight on selection, return and legacy navigation', () => {
    const { rerender } = render(ui());
    for (const [path, title, activeCount] of [
      ['/rent-analysis', 'Rent analysis', 1],
      ['/rent-analysis/property-123', 'Rent analysis', 1],
      ['/roi-analysis', 'Returns & ROI', 1],
      ['/returns', 'Portfolio returns', 1],
      ['/rent-comps', 'Rent comps', 0],
      ['/rent-analysis', 'Rent analysis', 1],
    ] as const) {
      pathname = path;
      rerender(ui());
      if (path === '/roi-analysis') {
        // The ROI workspace owns its property-specific heading.
        expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
      } else {
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
      }
      expect(sidebar().querySelectorAll('[aria-current="page"]')).toHaveLength(activeCount);
    }
  });

  it('keeps Returns & ROI current on portfolio returns', () => {
    pathname = '/returns';
    render(ui());
    const active = Array.from(sidebar().querySelectorAll('a.active'));
    expect(active.map((a) => a.textContent)).toEqual(['Returns & ROI']);
    expect(active[0].getAttribute('href')).toBe('/roi-analysis');
  });

  it('hides Rent comps from the sidebar', () => {
    render(ui());
    expect(within(sidebar()).queryByRole('link', { name: 'Rent comps' })).toBeNull();
    expect(visible.some((i) => i.label === 'Rent comps')).toBe(false);
  });

  it.each(visible.map((i) => [i.label, i.href] as const))(
    'marks only %s active on %s',
    (label, href) => {
      for (const path of [href, `${href}/abc`]) {
        pathname = path;
        const { unmount } = render(ui());
        const active = Array.from(sidebar().querySelectorAll('a.active'));
        expect(active).toHaveLength(1);
        expect(active[0].textContent?.startsWith(label)).toBe(true);
        expect(active[0].getAttribute('aria-current')).toBe('page');
        expect(sidebar().querySelectorAll('[aria-current]')).toHaveLength(1);
        unmount();
      }
    },
  );

  it('has no active item on the hidden Rent comps route but keeps its title', () => {
    pathname = '/rent-comps';
    render(ui());
    expect(sidebar().querySelectorAll('a.active')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rent comps');
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const hamburger = () => screen.getByRole('button', { name: 'Open menu' });
// The sidebar close X and the scrim share the "Close menu" name.
const closeX = () => document.querySelector<HTMLButtonElement>('.drawer-close')!;
const scrim = () => document.querySelector<HTMLButtonElement>('.scrim');
const sidebar = () => document.getElementById('manager-sidebar')!;

describe('ManagerShell drawer', () => {
  it('starts closed with correct aria state', () => {
    render(ui());
    expect(hamburger().getAttribute('aria-expanded')).toBe('false');
    expect(hamburger().getAttribute('aria-controls')).toBe('manager-sidebar');
    expect(scrim()).toBeNull();
    expect(sidebar().getAttribute('role')).toBeNull();
    expect(sidebar().getAttribute('aria-modal')).toBeNull();
  });

  it('opens from the hamburger as a modal dialog', async () => {
    const user = userEvent.setup();
    render(ui());
    await user.click(hamburger());
    expect(hamburger().getAttribute('aria-expanded')).toBe('true');
    expect(sidebar().getAttribute('role')).toBe('dialog');
    expect(sidebar().getAttribute('aria-modal')).toBe('true');
    expect(sidebar().getAttribute('aria-label')).toBe('Main menu');
    expect(scrim()).not.toBeNull();
    expect(document.querySelector('.app')!.classList.contains('drawer-open')).toBe(true);
  });

  async function openThenClose(close: (user: ReturnType<typeof userEvent.setup>) => Promise<void>) {
    const user = userEvent.setup();
    render(ui());
    await user.click(hamburger());
    await close(user);
    expect(hamburger().getAttribute('aria-expanded')).toBe('false');
    expect(scrim()).toBeNull();
    expect(sidebar().getAttribute('role')).toBeNull();
    expect(document.querySelector('.app')!.classList.contains('drawer-open')).toBe(false);
  }

  it('closes on Escape and restores focus to the hamburger', async () => {
    await openThenClose((user) => user.keyboard('{Escape}'));
    expect(document.activeElement).toBe(hamburger());
  });

  it('closes on scrim click and restores focus', async () => {
    await openThenClose((user) => user.click(scrim()!));
    expect(document.activeElement).toBe(hamburger());
  });

  it('closes on the X button and restores focus', async () => {
    await openThenClose((user) => user.click(closeX()));
    expect(document.activeElement).toBe(hamburger());
  });

  it('closes on a nav link click', async () => {
    await openThenClose(async (user) => {
      const link = within(sidebar()).getByRole('link', { name: 'Tenants' });
      link.addEventListener('click', (e) => e.preventDefault());
      await user.click(link);
    });
  });

  it('closes on route change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(ui());
    await user.click(hamburger());
    expect(hamburger().getAttribute('aria-expanded')).toBe('true');
    pathname = '/tenants';
    rerender(ui());
    expect(hamburger().getAttribute('aria-expanded')).toBe('false');
    expect(scrim()).toBeNull();
  });

  it('closes when the viewport reaches the docked breakpoint', async () => {
    let listener: (() => void) | undefined;
    const mq = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => (listener = fn),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mq) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    render(ui());
    await user.click(hamburger());
    mq.matches = true;
    act(() => listener?.());
    expect(hamburger().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves focus to the close button on open', async () => {
    const user = userEvent.setup();
    render(ui());
    await user.click(hamburger());
    expect(document.activeElement).toBe(closeX());
  });

  it('isolates the page and locks scrolling until the menu closes', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'auto';
    render(ui());
    await user.click(hamburger());
    expect(document.getElementById('main-content')!.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.getElementById('main-content')!.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('skips hidden controls when cycling keyboard focus', async () => {
    const user = userEvent.setup();
    render(ui());
    await user.click(hamburger());
    const hidden = document.createElement('button');
    hidden.hidden = true;
    sidebar().append(hidden);
    const last = within(sidebar()).getByRole('button', { name: 'Sign out' });
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(
      within(sidebar()).getByRole('link', { name: 'RocketRental' }),
    );
  });

  it('traps Tab and Shift+Tab inside the drawer', async () => {
    const user = userEvent.setup();
    render(ui());
    await user.click(hamburger());
    const items = Array.from(
      sidebar().querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );
    expect(items[1]).toBe(closeX());
    const last = items[items.length - 1];

    // Focus starts on the close button; Shift+Tab moves to the brand link (first item).
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(items[0]);
    // Shift+Tab from the first item wraps to the last.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
    // Tab from the last wraps to the first.
    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    // Tabbing through every item never leaves the sidebar.
    for (let i = 0; i < items.length * 2; i++) {
      await user.tab();
      expect(sidebar().contains(document.activeElement)).toBe(true);
    }
  });

  it('does not intercept Escape or Tab while closed', () => {
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
      ['Rent Analysis', '/rent-analysis'],
    ]) {
      const links = within(sidebar()).getAllByRole('link', { name: label });
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toBe(href);
    }
    // Returns and ROI are one workspace; portfolio returns is reached from it, not a rival entry.
    expect(within(sidebar()).queryByRole('link', { name: /^(Returns|ROI Analysis)$/ })).toBeNull();
  });

  it.each(['Returns & ROI', 'Rent Analysis'])(
    'closes the mobile menu on keyboard entry to %s',
    async (label) => {
      const user = userEvent.setup();
      render(ui());
      await user.click(hamburger());
      const link = within(sidebar()).getByRole('link', { name: label });
      link.addEventListener('click', (event) => event.preventDefault());
      link.focus();
      await user.keyboard('{Enter}');
      expect(hamburger().getAttribute('aria-expanded')).toBe('false');
      expect(scrim()).toBeNull();
      expect(document.getElementById('main-content')!.hasAttribute('inert')).toBe(false);
    },
  );

  it('updates the title and highlight on selection, return and legacy navigation', () => {
    const { rerender } = render(ui());
    for (const [path, title, activeCount] of [
      ['/rent-analysis', 'Rent Analysis', 1],
      ['/rent-analysis/property-123', 'Rent Analysis', 1],
      ['/roi-analysis', 'Returns & ROI', 1],
      ['/returns', 'Portfolio returns', 1],
      ['/rent-comps', 'Rent comps', 0],
      ['/rent-analysis', 'Rent Analysis', 1],
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
        expect(active[0].textContent).toBe(label);
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

// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ManagerShell } from '@/components/shell/ManagerShell';

let pathname = '/dashboard';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));
const mocks = vi.hoisted(() => ({ properties: vi.fn(), facts: vi.fn(), leases: vi.fn() }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'authorized-org', role: 'MANAGER' }),
}));
vi.mock('@/lib/db/client', () => ({
  db: { property: { findFirst: mocks.facts }, lease: { findMany: mocks.leases } },
}));
vi.mock('@/lib/analysis/rent', async (original) => ({
  ...(await original<object>()),
  loadRentProperties: mocks.properties,
}));
import RentPage from '../../src/app/(manager)/rent-analysis/page';

beforeEach(() => {
  pathname = '/dashboard';
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  mocks.properties.mockResolvedValue([
    {
      id: 'authorized-maple',
      name: 'Maple Court',
      street: '1 Main',
      city: 'Austin',
      state: 'TX',
      postalCode: '78704',
      units: [
        { id: 'unit-1', number: '1A', status: 'OCCUPIED', listedRent: 1500, marketRent: 1700 },
      ],
    },
  ]);
  mocks.facts.mockResolvedValue({
    type: 'MULTI_UNIT',
    units: [{ id: 'unit-1', isImplicit: false }],
  });
  mocks.leases.mockResolvedValue([]);
});
afterEach(cleanup);

it('follows the real menu to explicit selection, selected dashboard and return selection', async () => {
  const user = userEvent.setup();
  const view = render(<ManagerShell>Dashboard</ManagerShell>);
  const nav = within(document.getElementById('manager-sidebar')!);
  const entry = nav.getByRole('link', { name: 'Rent analysis' });
  expect(entry.getAttribute('href')).toBe('/rent-analysis');
  entry.addEventListener('click', (event) => event.preventDefault());
  entry.focus();
  await user.keyboard('{Enter}');

  async function navigate(href: string) {
    const url = new URL(href, 'http://navigation.test');
    pathname = url.pathname;
    const page = await RentPage({
      searchParams: Promise.resolve(Object.fromEntries(url.searchParams)),
    });
    view.rerender(<ManagerShell>{page}</ManagerShell>);
  }
  await navigate(entry.getAttribute('href')!);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Choose a property');
  expect(screen.queryByRole('heading', { name: 'Every unit vs saved market rent' })).toBeNull();
  expect(nav.getByRole('link', { name: 'Rent analysis' }).getAttribute('aria-current')).toBe(
    'page',
  );
  expect(nav.getByRole('link', { name: 'Returns & ROI' }).hasAttribute('aria-current')).toBe(false);
  const select = screen.getByRole('link', { name: 'Open rent analysis' });
  expect(select.getAttribute('href')).toBe('/rent-analysis?property=authorized-maple');
  await navigate(select.getAttribute('href')!);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maple Court');
  expect(screen.getByRole('heading', { name: 'Every unit vs saved market rent' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Unit 1A' }).getAttribute('href')).toContain(
    'unit=unit-1',
  );
  await navigate(screen.getByRole('link', { name: 'Change property' }).getAttribute('href')!);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Choose a property');
  expect(screen.queryByRole('heading', { name: 'Every unit vs saved market rent' })).toBeNull();
});

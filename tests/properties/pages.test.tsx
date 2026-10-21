// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { directoryReturn } from '@/app/(manager)/properties/navigation';
import NewPropertyPage from '@/app/(manager)/properties/new/page';
import EditPropertyPage from '@/app/(manager)/properties/[id]/edit/page';
import PropertiesPage from '@/app/(manager)/properties/page';
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Error(url);
  }),
}));
vi.mock('@/components/shell/PageHeader', () => ({ PageHeader: ({ title, back }: { title: string; back: { href: string; label: string } }) => <header><h1>{title}</h1><a href={back.href}>Back to {back.label}</a></header> }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'own' }),
}));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: () => {
    throw Error('not found');
  },
}));
vi.mock('@/lib/properties/data', () => ({
  propertiesDb: () => ({ listOwners: async () => [], getProperty: mocks.get }),
  propertyFilterFrom: () => 'multi',
}));
vi.mock('@/app/(manager)/properties/_components/PropertyForm', () => ({
  PropertyForm: ({ cancelHref, initial }: { cancelHref: string; initial?: { name: string } }) => (
    <form aria-label="Property form">
      <a href={cancelHref}>Cancel</a>
      <span>{initial?.name}</span>
    </form>
  ),
}));
afterEach(cleanup);
it('renders dedicated Add and Edit forms with appropriate return navigation', async () => {
  render(
    await NewPropertyPage({
      searchParams: Promise.resolve({ returnTo: '/properties?filter=multi' }),
    }),
  );
  expect(screen.getByRole('heading', { name: 'Add property' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(
    '/properties?filter=multi',
  );
  cleanup();
  mocks.get.mockResolvedValue({ id: 'a', name: 'Existing home', units: [], owner: null });
  render(await EditPropertyPage({ params: Promise.resolve({ id: 'a' }) }));
  expect(screen.getByRole('heading', { name: 'Edit property' })).toBeTruthy();
  expect(screen.getByText('Existing home', { selector: 'span' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/properties/a');
});
it('resolves all legacy add links to the dedicated page without a dialog', async () => {
  await expect(
    PropertiesPage({
      searchParams: Promise.resolve({ add: '1', filter: 'multi', q: 'Oak', view: 'list' }),
    }),
  ).rejects.toThrow('/properties/new?returnTo=');
  expect(mocks.redirect).toHaveBeenCalledWith(
    '/properties/new?returnTo=%2Fproperties%3Fview%3Dlist%26filter%3Dmulti%26q%3DOak',
  );
});
it('limits return navigation to the local property directory and removes stale add flags', () => {
  expect(directoryReturn('https://elsewhere.test')).toBe('/properties');
  expect(directoryReturn('//elsewhere.test')).toBe('/properties');
  expect(directoryReturn('/properties?view=list&add=1&q=Oak')).toBe('/properties?q=Oak&view=list');
});

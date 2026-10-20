// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertiesPage from '@/app/(manager)/properties/page';
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  counts: vi.fn(),
  owners: vi.fn(),
  db: vi.fn(),
  auth: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({ requireManagerRole: mocks.auth }));
vi.mock('@/lib/properties/data', () => ({
  propertiesDb: mocks.db,
  propertyFilterFrom: (v: string) =>
    ['multi', 'single', 'vacancies', 'archived'].includes(v) ? v : 'all',
}));
const property = (extra = {}) => ({
  id: 'fixture-property',
  name: 'Fixture Court',
  street: '1 Test St',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  type: 'MULTI_UNIT',
  archived: false,
  unitCount: 4,
  occupied: 3,
  vacant: 1,
  monthlyRent: 4500,
  coverPhotoId: null,
  ...extra,
});
beforeEach(() => {
  mocks.auth.mockResolvedValue({ organizationId: 'fixture-org' });
  mocks.db.mockReturnValue({
    listProperties: mocks.list,
    countByFilter: mocks.counts,
    listOwners: mocks.owners,
  });
  mocks.list.mockResolvedValue({
    properties: [property()],
    totals: { units: 4, occupied: 3, vacant: 1 },
  });
  mocks.counts.mockResolvedValue({ all: 1, multi: 1, single: 0, archived: 0 });
  mocks.owners.mockResolvedValue([]);
});
afterEach(cleanup);
async function page(params = {}) {
  render(await PropertiesPage({ searchParams: Promise.resolve(params) }));
}
describe('property directory presentation', () => {
  it('uses scoped data and keeps calculated metrics and card destinations', async () => {
    await page();
    expect(mocks.db).toHaveBeenCalledWith('fixture-org');
    expect(mocks.list).toHaveBeenCalledWith({ q: undefined, filter: 'all' });
    expect(screen.getByText('75% occupancy')).toBeTruthy();
    expect(screen.getByText('3/4 occupied')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Fixture Court/ }).getAttribute('href')).toBe(
      '/properties/fixture-property',
    );
    expect(
      screen
        .getByRole('region', { name: 'Properties in this view' })
        .compareDocumentPosition(screen.getByRole('search')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it('preserves query and filter when switching Grid/List and all query fields in search', async () => {
    await page({ q: 'Test & Co', filter: 'vacancies', view: 'list' });
    expect(screen.getByRole('link', { name: 'Grid' }).getAttribute('href')).toBe(
      '/properties?filter=vacancies&q=Test+%26+Co',
    );
    expect(screen.getByRole('link', { name: 'Multi-unit 1' }).getAttribute('href')).toBe(
      '/properties?view=list&filter=multi&q=Test+%26+Co',
    );
    const form = screen.getByRole('search');
    expect(form.querySelector<HTMLInputElement>('[name=filter]')?.value).toBe('vacancies');
    expect(form.querySelector<HTMLInputElement>('[name=view]')?.value).toBe('list');
    const region = screen.getByRole('region', { name: /Property directory table/ });
    expect(region.tabIndex).toBe(0);
    expect(within(region).getAllByRole('columnheader')).toHaveLength(6);
    expect(within(region).getByRole('link', { name: 'Fixture Court' }).getAttribute('href')).toBe(
      '/properties/fixture-property',
    );
  });
  it.each([
    [{ type: 'SINGLE_UNIT', unitCount: 1, occupied: 1, vacant: 0 }, 'Occupied'],
    [{ type: 'SINGLE_UNIT', unitCount: 1, occupied: 0, vacant: 1 }, 'Vacant'],
    [{ unitCount: 0, occupied: 0, vacant: 0 }, 'No units yet'],
    [{ archived: true }, 'Archived'],
  ])('retains occupancy branch %j', async (extra, label) => {
    mocks.list.mockResolvedValue({
      properties: [property(extra)],
      totals: { units: 0, occupied: 0, vacant: 0 },
    });
    await page();
    expect(
      within(screen.getByRole('region', { name: 'Property directory' })).getByText(label),
    ).toBeTruthy();
  });
  it.each([
    [{}, 'No properties yet', '/properties/new?returnTo=%2Fproperties'],
    [{ q: 'absent' }, 'No properties match this view', '/properties'],
  ])('offers the correct empty recovery', async (params, title, destination) => {
    mocks.list.mockResolvedValue({ properties: [], totals: { units: 0, occupied: 0, vacant: 0 } });
    await page(params);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'q' in params ? 'Clear filters' : 'Add a property' })
        .getAttribute('href'),
    ).toBe(destination);
    expect(screen.getByText('0% occupancy')).toBeTruthy();
  });
});

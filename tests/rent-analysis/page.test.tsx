import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const mocks = vi.hoisted(() => ({ properties: vi.fn(), facts: vi.fn(), leases: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org', role: 'MANAGER' }),
}));
vi.mock('@/lib/db/client', () => ({
  db: { property: { findFirst: mocks.facts }, lease: { findMany: mocks.leases } },
}));
vi.mock('@/lib/analysis/rent', async (original) => ({
  ...(await original<object>()),
  loadRentProperties: mocks.properties,
}));
vi.mock('@/app/(manager)/rent-analysis/RentAnalysisComps', () => ({
  RentAnalysisComps: (props: {
    unitId: string;
    currentLeaseRent: number;
    propertyLevel: boolean;
  }) => (
    <div>
      Subject {props.unitId}; lease {props.currentLeaseRent}; home {String(props.propertyLevel)}
    </div>
  ),
}));
import Page from '../../src/app/(manager)/rent-analysis/page';
const property = {
  id: 'maple',
  name: 'Maple',
  street: '1 Main',
  city: 'Austin',
  state: 'TX',
  postalCode: '78704',
  units: [{ id: 'u1', number: '1A', status: 'OCCUPIED', listedRent: 1500, marketRent: 1700 }],
};
beforeEach(() => {
  mocks.properties.mockResolvedValue([property]);
  mocks.facts.mockResolvedValue({ type: 'MULTI_UNIT', units: [{ id: 'u1', isImplicit: false }] });
  mocks.leases.mockResolvedValue([{ id: 'lease', unitId: 'u1', monthlyRent: 1600 }]);
});
const render = async (q: Record<string, string | undefined>) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve(q) }));
it('shows explicit searchable selection without choosing the first property', async () => {
  expect(await render({})).toContain('aria-label="Search properties"');
  expect(await render({ q: 'absent' })).toContain('No matching properties');
});
it('rejects missing property and mismatched units without a panel', async () => {
  for (const q of [{ property: 'foreign' }, { property: 'maple', unit: 'other' }, { unit: 'u1' }])
    expect(await render(q)).toContain('Property or unit unavailable');
});
it('shows separate current, listed and saved values in the overview', async () => {
  const html = await render({ property: 'maple' });
  for (const text of ['$1,600', '$1,500', '$1,700', '$100']) expect(html).toContain(text);
  expect(html).not.toContain('Subject u1');
});
it('uses only the current dated active lease and scopes the workbench', async () => {
  expect(await render({ property: 'maple', unit: 'u1' })).toContain('Subject u1; lease 1600');
  expect(mocks.leases).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org',
        status: 'ACTIVE',
        startDate: expect.objectContaining({ lte: expect.any(Date) }),
        endDate: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    }),
  );
});
it('opens an implicit single-family subject without requiring a unit query', async () => {
  mocks.facts.mockResolvedValue({ type: 'SINGLE_UNIT', units: [{ id: 'u1', isImplicit: true }] });
  const html = await render({ property: 'maple' });
  expect(html).toContain('home true');
  expect(html).not.toContain('Every unit vs saved market rent');
});

const unitHref = (html: string) =>
  new URL(
    html.match(/href="([^"]+)"[^>]*>Unit 1A<\/a>/)![1].replaceAll('&amp;', '&'),
    'https://example.test',
  );

it('carries explicit comparison filters through overview row navigation and refresh', async () => {
  const filters = {
    radius: '3',
    beds: '2',
    baths: 'any',
    minSqft: '',
    maxSqft: '1200',
    days: '30',
    status: 'leased',
  };
  const query = { property: 'maple', ...filters };
  const destination = unitHref(await render(query));
  expect(Object.fromEntries(destination.searchParams)).toEqual({ ...query, unit: 'u1' });
  const refreshed = await render(Object.fromEntries(destination.searchParams));
  expect(unitHref(refreshed).href).toBe(destination.href);
  expect(refreshed).toContain('href="/rent-analysis"'); // Change property intentionally resets.
});

it('does not propagate invalid filters or invent subject defaults in row links', async () => {
  const url = unitHref(
    await render({
      property: 'maple',
      radius: '3',
      beds: '-1',
      baths: 'Infinity',
      days: '7',
      status: 'bad',
      minSqft: 'bad',
      returnTo: 'https://evil.test',
    }),
  );
  expect(Object.fromEntries(url.searchParams)).toEqual({
    property: 'maple',
    unit: 'u1',
    radius: '3',
  });
  expect(Object.fromEntries(unitHref(await render({ property: 'maple' })).searchParams)).toEqual({
    property: 'maple',
    unit: 'u1',
  });
});

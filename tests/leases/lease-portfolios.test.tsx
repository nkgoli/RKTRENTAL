import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LeaseListItem } from '@/lib/leases/queries';
const fixture = vi.hoisted(() => ({ leases: [] as LeaseListItem[] }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org' }),
}));
vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/components/workspace/ScopedWorkspace', () => ({ ScopedWorkspace: () => null }));
vi.mock('@/components/shell/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/lib/leases/queries', () => ({
  leasesDb: () => ({
    list: async () => ({
      leases: fixture.leases,
      counts: { active: 22, expiring: 22, drafts: 1, ended: 1, awaiting: 0 },
      today: new Date('2026-10-19'),
      in60: new Date('2026-12-18'),
    }),
  }),
}));
import LeasesPage from '@/app/(manager)/leases/page';
import { LeasesPanel } from '@/components/workspace/panels/leasing/LeasesPanel';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
const scope = { propertyId: 'property-1', unitId: 'unit-1' };
beforeEach(() => {
  fixture.leases = Array.from(
    { length: 24 },
    (_, i) =>
      ({
        id: `lease-${i}`,
        status: i === 22 ? 'DRAFT' : i === 23 ? 'ENDED' : 'ACTIVE',
        eSignStatus: 'SIGNED',
        unitId: 'unit-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-11-30'),
        monthlyRent: '1850',
        unit: {
          number: '4B',
          isImplicit: false,
          property: { id: 'property-1', name: 'Maple Court' },
        },
        tenants: [
          {
            isPrimary: true,
            tenant: { id: `tenant-${i}`, name: `Tenant ${i}`, email: `t${i}@example.com` },
          },
        ],
      }) as unknown as LeaseListItem,
  );
});
async function list(query: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await LeasesPage({ searchParams: Promise.resolve({ ...scope, ...query }) }),
  );
}
it('filters and pages source rows while retaining scope and lease identity', async () => {
  const first = await list();
  expect(first).toContain('22 active leases');
  expect(first).not.toContain('data-lease="lease-22"');
  expect(first).toContain('/leases/lease-0?propertyId=property-1&amp;unitId=unit-1');
  expect(first).toContain('renew=lease-0');
  expect(first).toContain('property=property-1&amp;unit=unit-1');
  const second = await list({ page: '3' });
  expect(second).toContain('Tenant 21');
  expect(second).not.toContain('Tenant 0');
  expect(first).toContain('page=2');
  expect(second).toContain('22 of 22 active leases');
  expect(first).toContain('data-mobile="cards"');
  expect(first).not.toContain('Tenant 10');
  expect(first).not.toContain('>Signed</span>');
  expect(first).not.toContain('>View</a>');
});
it('search and empty reset preserve the selected view and scope', async () => {
  const match = await list({ q: 'Tenant 21' });
  expect(match).toContain('1 active lease');
  expect(match).not.toContain('Tenant 0');
  const empty = await list({ q: 'Missing', tab: 'drafts' });
  expect(empty).toContain('No leases match this view');
  expect(empty).toContain('/leases?propertyId=property-1&amp;unitId=unit-1&amp;tab=drafts');
  const draft = await list({ tab: 'drafts' });
  expect(draft).toContain('draft=lease-22');
  expect(draft).not.toContain('renew=lease-22');
  expect(await list({ tab: 'ended' })).toContain('Tenant 23');
  expect(await list({ tab: 'expiring' })).toContain('22 expiring leases');
});
it('scoped current, draft and past sections keep setup, resume and renewal context', async () => {
  const html = renderToStaticMarkup(await LeasesPanel({ organizationId: 'org', scope }));
  for (const text of [
    'Current',
    'Drafts',
    'Past',
    'Continue setup',
    'draft=lease-22',
    'renew=lease-0',
    'propertyId=property-1&amp;unitId=unit-1&amp;property=property-1&amp;unit=unit-1',
  ])
    expect(html).toContain(text);
  fixture.leases = [];
  const empty = renderToStaticMarkup(await LeasesPanel({ organizationId: 'org', scope }));
  expect(empty).toContain('No leases yet');
  expect(empty).toContain('unit=unit-1');
});

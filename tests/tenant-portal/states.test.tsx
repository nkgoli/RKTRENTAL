import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/access', () => ({
  requireTenantRole: async () => ({
    name: 'Demo tenant',
    tenantId: 'demo-tenant',
    organizationId: 'demo-org',
  }),
}));
vi.mock('@/lib/tenant-portal', () => ({
  loadTenantHome: async () => null,
  loadTenantLease: async () => null,
}));
vi.mock('@/lib/tenant-pay', () => ({ loadTenantPayView: async () => null }));
vi.mock('@/app/(tenant)/repairs/data', () => ({ loadTenantRepairs: async () => null }));
vi.mock('@/app/(tenant)/pay/actions', () => ({
  addPaymentMethodAction: vi.fn(),
  payRentAction: vi.fn(),
  setAutopayAction: vi.fn(),
}));
vi.mock('@/app/(tenant)/repairs/actions', () => ({ commentRepairAction: vi.fn() }));
import Home from '@/app/(tenant)/home/page';
import Lease from '@/app/(tenant)/lease/page';
import Pay from '@/app/(tenant)/pay/page';
import Repairs from '@/app/(tenant)/repairs/page';
import Loading from '@/app/(tenant)/loading';
import NotFound from '@/app/(tenant)/not-found';

it('gives each unassigned tenant screen a clear explanation and retry link', async () => {
  for (const [page, href] of [
    [await Home(), '/home'],
    [await Lease(), '/lease'],
    [await Pay({ searchParams: Promise.resolve({}) }), '/pay'],
    [await Repairs({ searchParams: Promise.resolve({}) }), '/repairs'],
  ] as const) {
    const html = renderToStaticMarkup(page);
    expect(html).toContain('No active lease');
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('Check again');
    expect(html).not.toContain('type="submit"');
  }
});
it('announces loading and offers home recovery for unavailable tenant pages', () => {
  expect(renderToStaticMarkup(<Loading />)).toContain('role="status"');
  expect(renderToStaticMarkup(<NotFound />)).toContain('href="/home"');
});

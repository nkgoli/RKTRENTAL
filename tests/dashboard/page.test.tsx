import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardView } from '@/components/dashboard/assemble';

const { load, guard } = vi.hoisted(() => ({ load: vi.fn(), guard: vi.fn() }));
vi.mock('@/components/dashboard/assemble', () => ({
  loadDashboardView: load,
  initialsOf: () => 'AR',
}));
vi.mock('@/lib/auth/access', () => ({ requireManagerRole: guard }));
import DashboardPage from '@/app/(manager)/dashboard/page';
import DashboardError from '@/app/(manager)/dashboard/error';

const empty: DashboardView = {
  monthLabel: 'October 2026',
  unitsOccupied: 0,
  unitsTotal: 0,
  propertyCount: 0,
  occupancyPercent: 0,
  rentDueCents: 0,
  rentCollectedCents: 0,
  overdueCents: 0,
  overdueLeaseCount: 0,
  openApplications: 0,
  openMaintenanceRequests: 0,
  urgentMaintenanceRequests: 0,
  collection: [],
  expiringLeases: [],
  activity: [],
  expiringSoonCount: 0,
  pastDueTenants: [],
  attention: [],
  properties: [],
};

describe('dashboard presentation', () => {
  it('keeps empty data explicit and passes organization and URL range to the real loader', async () => {
    guard.mockResolvedValue({ organizationId: 'org-current' });
    load.mockResolvedValue(empty);
    const html = renderToStaticMarkup(
      await DashboardPage({ searchParams: Promise.resolve({ range: '2Y' }) }),
    );
    expect(load).toHaveBeenLastCalledWith(
      'org-current',
      expect.any(Date),
      undefined,
      expect.any(Function),
      '2Y',
    );
    expect(html).toContain('No rent due this month');
    expect(html).toContain('No active leases end in the next 90 days');
    expect(html).toContain('No overdue rent balances');
    expect(html).toContain('Add your first property');
    expect(html).toContain('New payments and lease updates will appear here');
    expect(html).not.toContain('NaN');
  });

  it('retains the ledger meanings and identity-specific lease, unit and property links', async () => {
    guard.mockResolvedValue({ organizationId: 'org-current' });
    load.mockResolvedValue({
      ...empty,
      rentDueCents: 100000,
      rentCollectedCents: 75000,
      overdueCents: 30000,
      overdueLeaseCount: 1,
      expiringLeases: [
        {
          id: 'lease-a',
          propertyId: 'property-a',
          unitId: 'unit-a',
          tenantName: 'Alex Rivera',
          propertyName: 'Maple Court',
          unitLabel: '4B',
          rentCents: 100000,
          endDate: new Date('2026-11-30'),
          daysUntil: 42,
        },
      ],
    });
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('75% collected');
    expect(html).toContain('$250');
    expect(html).toContain('$300');
    expect(html).toContain('href="/leases/lease-a"');
    expect(html).toContain('href="/properties/property-a/units/unit-a"');
    expect(html).toContain('href="/properties/property-a"');
    expect(html).toContain('href="/payments?filter=late"');
  });

  it('provides a recoverable error with a direct property destination', () => {
    const html = renderToStaticMarkup(<DashboardError reset={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Try again');
    expect(html).toContain('href="/properties"');
  });
});

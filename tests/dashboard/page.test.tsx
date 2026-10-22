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
  endingWithin60Count: 0,
  pastDueTenants: [],
  attention: [],
  properties: [],
  rentRoll: { openCents: 0, openCount: 0, lateCents: 0, lateCount: 0, lateTenants: [] },
  applicationStatusCounts: { SUBMITTED: 0, SCREENING: 0, REVIEW: 0 },
  urgentRequest: null,
};

describe('dashboard presentation', () => {
  it('keeps empty data explicit and passes organization and URL range to the real loader', async () => {
    guard.mockResolvedValue({ organizationId: 'org-current', name: 'Jordan Mills' });
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
    expect(html).toContain('No rent is due this month');
    expect(html).toContain('No active leases end in the next 90 days');
    expect(html).toContain('No rent is late');
    expect(html).toContain('No urgent repairs');
    expect(html).toContain('Add your first property');
    expect(html).toContain('New payments and lease updates will appear here');
    expect(html).not.toContain('NaN');
  });

  it('separates open balances from rent late past grace and keeps identity-specific links', async () => {
    guard.mockResolvedValue({ organizationId: 'org-current', name: 'Jordan Mills' });
    load.mockResolvedValue({
      ...empty,
      rentDueCents: 100000,
      rentCollectedCents: 75000,
      rentRoll: {
        openCents: 30000,
        openCount: 2,
        lateCents: 25000,
        lateCount: 1,
        lateTenants: ['Chloe Fisher'],
      },
      openApplications: 3,
      applicationStatusCounts: { SUBMITTED: 1, SCREENING: 0, REVIEW: 2 },
      urgentRequest: {
        id: 'req-1',
        title: 'Kitchen sink leak',
        propertyName: 'Maple Court',
        unitLabel: '4B',
        createdAt: new Date('2026-10-20T00:00:00Z'),
        assigned: false,
        photoCount: 1,
      },
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
    expect(html).toContain('$300 open across 2 leases · 1 late past grace');
    expect(html).toContain('1 lease late · $250');
    expect(html).toContain('Chloe Fisher');
    expect(html).toContain('1 awaiting consent · 2 ready for decision');
    expect(html).toContain('Kitchen sink leak · Maple Court 4B');
    expect(html).toContain('href="/maintenance/req-1/edit"');
    expect(html).toContain('href="/leases/lease-a"');
    expect(html).toContain('href="/properties/property-a/units/unit-a"');
    expect(html).toContain('href="/properties/property-a"');
    expect(html).toContain('href="/payments?filter=late"');
    // Renewals under 60 days use the warning tone.
    expect(html).toContain('<span class="badge warning">Nov 30 · 42 days</span>');
  });

  it('renders each panel as a bordered card', async () => {
    guard.mockResolvedValue({ organizationId: 'org-current', name: 'Jordan Mills' });
    load.mockResolvedValue(empty);
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('class="summary-band"');
    for (const id of [
      'needs-heading',
      'history-heading',
      'occupancy-heading',
      'renewals-heading',
      'activity-heading',
    ]) {
      const before = html.slice(0, html.indexOf(`id="${id}"`));
      const tag = before.slice(before.lastIndexOf('<section'));
      expect(tag).toMatch(/^<section class="card\b/);
    }
  });

  it('provides a recoverable error with a direct property destination', () => {
    const html = renderToStaticMarkup(<DashboardError reset={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Try again');
    expect(html).toContain('href="/properties"');
  });
});

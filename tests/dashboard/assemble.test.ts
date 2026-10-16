import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  assembleLeaseSignals,
  attentionStrip,
  EXPIRING_STRIP_DAYS,
  initialsOf,
} from '@/components/dashboard/assemble';
import { coverKindFor } from '@/components/dashboard/MiniCover';
import { trendOf } from '@/components/dashboard/trend';

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const now = new Date('2026-10-14T12:00:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const lease = (id: string, tenant: string, endDate: Date, unpaidDue: string | null) => ({
  id,
  lateFee: '0.00',
  graceDays: 5,
  endDate,
  tenants: [{ isPrimary: true, tenant: { name: tenant } }],
  charges: unpaidDue
    ? [
        {
          id: `c-${id}`, leaseId: id, kind: 'RENT' as const, amount: '1000.00',
          dueDate: day(unpaidDue), description: `rent:${id}`,
        },
      ]
    : [],
  payments: [],
});

describe('attention strip', () => {
  const counts = {
    overdueLeaseCount: 2,
    overdueCents: 250_000,
    openMaintenanceRequests: 5,
    urgentMaintenanceRequests: 1,
  };

  it('reports the three counts with links to filtered pages', () => {
    const strip = attentionStrip(counts, 3, usd);
    expect(strip.map((item) => [item.key, item.count, item.href])).toEqual([
      ['overdue', 2, '/payments?filter=late'],
      ['expiring', 3, '/leases?tab=expiring'],
      ['repairs', 5, '/maintenance'],
    ]);
    expect(strip[0]).toMatchObject({ detail: '$2500.00 past grace', tone: 'danger' });
    expect(strip[1]?.detail).toBe(`in the next ${EXPIRING_STRIP_DAYS} days`);
    expect(strip[2]).toMatchObject({ detail: '1 urgent', tone: 'danger' });
  });

  it('goes quiet when nothing needs attention', () => {
    const strip = attentionStrip(
      { overdueLeaseCount: 0, overdueCents: 0, openMaintenanceRequests: 0, urgentMaintenanceRequests: 0 },
      0,
      usd,
    );
    expect(strip.map((item) => item.count)).toEqual([0, 0, 0]);
    expect(strip.every((item) => item.tone === 'info')).toBe(true);
    expect(strip[0]?.detail).toBe('Everyone is paid up');
  });
});

describe('dashboard lease signals', () => {
  it('lists real past-due tenants and counts leases ending inside the strip window', () => {
    const signals = assembleLeaseSignals(
      [
        lease('late', 'Alex Rivera', day('2026-11-30'), '2026-10-01'),
        lease('in-grace', 'Sam Okafor', day('2027-06-30'), '2026-10-13'),
        lease('paid-up', 'Dana Lee', day('2026-12-31'), null),
        lease('ending-today', 'Mia Chen', day('2026-10-14'), null),
        lease('ended', 'Old Tenant', day('2026-10-01'), null),
      ],
      now,
    );
    expect(signals.pastDueTenants).toEqual([{ leaseId: 'late', name: 'Alex Rivera', initials: 'AR' }]);
    // Nov 30 is 47 days out and today counts; Dec 31 is beyond 60 days; Oct 1 is already past.
    expect(signals.expiringSoonCount).toBe(2);
  });

  it('falls back to a generic name when a lease has no tenant', () => {
    const orphan = { ...lease('late', 'x', day('2027-01-01'), '2026-10-01'), tenants: [] };
    expect(assembleLeaseSignals([orphan], now).pastDueTenants[0]).toMatchObject({ name: 'Tenant', initials: 'T' });
  });
});

describe('dashboard helpers', () => {
  it('builds initials from the first two words', () => {
    expect(initialsOf('olivia  reed jr')).toBe('OR');
    expect(initialsOf('')).toBe('');
  });

  it('chooses a cover from the property shape', () => {
    expect(coverKindFor({ type: 'SINGLE_UNIT', unitCount: 1 })).toBe('house');
    expect(coverKindFor({ type: 'MULTI_UNIT', unitCount: 12 })).toBe('apartment');
    expect(coverKindFor({ type: 'MULTI_UNIT', unitCount: 3 })).toBe('townhomes');
  });

  it('computes month-over-month trends and which direction is good', () => {
    expect(trendOf([100, 120])).toEqual({ label: '▲ 20%', warm: false });
    expect(trendOf([100, 80])).toEqual({ label: '▼ 20%', warm: true });
    expect(trendOf([100, 120], false)).toEqual({ label: '▲ 20%', warm: true });
    expect(trendOf([0, 50])).toBeNull();
    expect(trendOf([5])).toBeNull();
  });
});

describe('loadDashboardView', () => {
  it('merges dashboard data with past-due tenants and the property list for one organization', async () => {
    const property = {
      id: 'property-1', name: 'Maple Court', type: 'MULTI_UNIT', street: '1 Main', city: 'Austin',
      state: 'TX', postalCode: '78701', archivedAt: null,
      units: [
        { id: 'unit-1', status: 'OCCUPIED', leases: [{ monthlyRent: '1000.00' }] },
        { id: 'unit-2', status: 'VACANT', leases: [] },
      ],
    };
    const lease = {
      id: 'lease-1', organizationId: 'org-1', unitId: 'unit-1', status: 'ACTIVE',
      startDate: new Date('2025-12-01T00:00:00Z'), endDate: new Date('2026-11-30T00:00:00Z'),
      monthlyRent: '1000.00', lateFee: '0.00', graceDays: 5,
      unit: { id: 'unit-1', number: '4B', isImplicit: false, property: { id: 'property-1', name: 'Maple Court' } },
      tenants: [{ isPrimary: true, tenant: { id: 't1', name: 'Alex Rivera' } }],
      charges: [{
        id: 'c1', leaseId: 'lease-1', organizationId: 'org-1', kind: 'RENT', amount: '1000.00',
        dueDate: new Date('2026-10-01T00:00:00Z'), description: 'rent:lease-1:2026-10',
      }],
      payments: [],
      events: [],
    };
    const client = {
      unit: { findMany: vi.fn().mockResolvedValue([{ id: 'unit-1', propertyId: 'property-1' }, { id: 'unit-2', propertyId: 'property-1' }]) },
      lease: { findMany: vi.fn().mockResolvedValue([lease]) },
      application: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      property: { findMany: vi.fn().mockResolvedValue([property]) },
      document: { findMany: vi.fn().mockResolvedValue([{ id: 'photo-1', propertyId: 'property-1' }]) },
      $queryRaw: vi.fn().mockResolvedValue([{ month: '2026-10', due: 100000n, collected: 85000n }]),
    } as unknown as PrismaClient;
    // loadDashboardData reads the maintenance board through the default loader, which needs a database.
    vi.doMock('@/lib/maintenance', () => ({ listMaintenanceBoard: async () => [{ status: 'NEW', priority: 'URGENT' }] }));
    vi.resetModules();
    const { loadDashboardView: load } = await import('@/components/dashboard/assemble');

    const view = await load('org-1', now, client, usd);

    expect(view.pastDueTenants).toEqual([{ leaseId: 'lease-1', name: 'Alex Rivera', initials: 'AR' }]);
    expect(view.expiringSoonCount).toBe(1);
    expect(view.collection).toEqual([
      { key: '2026-10', label: 'Oct', dueCents: 100_000, collectedCents: 85_000 },
    ]);
    expect(view.attention.map((item) => item.count)).toEqual([1, 1, 1]);
    expect(view.properties).toEqual([
      expect.objectContaining({
        id: 'property-1', occupied: 1, unitCount: 2, occupancyPercent: 50, address: 'Austin, TX',
        cover: { type: 'MULTI_UNIT', unitCount: 2, coverPhotoId: 'photo-1' },
      }),
    ]);
    expect(vi.mocked(client.lease.findMany).mock.calls.every(([args]) => args?.where?.organizationId === 'org-1')).toBe(true);
  });
});

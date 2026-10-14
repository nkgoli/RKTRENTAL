import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { collectionMonths, loadDashboardData, overdueSummary } from '@/lib/dashboard/queries';

const now = new Date('2026-10-14T12:00:00.000Z');

describe('dashboard ledger summaries', () => {
  it('plots expected rent and only settled payments for each of the last six months', () => {
    const series = collectionMonths(
      [
        {
          startDate: new Date('2026-09-15T00:00:00.000Z'),
          endDate: new Date('2027-01-31T00:00:00.000Z'),
          monthlyRent: '1000.00',
          payments: [
            { status: 'SUCCEEDED', amount: '1000.00', paidAt: new Date('2026-09-03T00:00:00Z') },
            { status: 'SUCCEEDED', amount: '850.00', paidAt: new Date('2026-10-03T00:00:00Z') },
            { status: 'FAILED', amount: '500.00', paidAt: new Date('2026-10-04T00:00:00Z') },
            { status: 'REFUNDED', amount: '250.00', paidAt: new Date('2026-10-05T00:00:00Z') },
          ],
        },
      ],
      now,
    );

    expect(series.map((month) => month.key)).toEqual([
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]);
    expect(series.at(-2)).toMatchObject({ dueCents: 100_000, collectedCents: 100_000 });
    expect(series.at(-1)).toMatchObject({ dueCents: 100_000, collectedCents: 85_000 });
  });

  it('counts unpaid rent after grace and ledger late fees as overdue', () => {
    const summary = overdueSummary(
      [
        {
          id: 'lease-late',
          lateFee: '75.00',
          graceDays: 5,
          charges: [
            {
              id: 'rent-oct', leaseId: 'lease-late', kind: 'RENT', amount: '1850.00',
              dueDate: new Date('2026-10-01T00:00:00Z'), description: 'rent:lease-late:2026-10',
            },
            {
              id: 'fee-oct', leaseId: 'lease-late', kind: 'LATE_FEE', amount: '75.00',
              dueDate: new Date('2026-10-07T00:00:00Z'), description: 'late-fee:lease-late:2026-10',
            },
          ],
          payments: [
            {
              id: 'partial', leaseId: 'lease-late', amount: '1000.00', status: 'SUCCEEDED',
              paidAt: new Date('2026-10-03T00:00:00Z'), createdAt: new Date('2026-10-03T00:00:00Z'),
            },
            {
              id: 'failed', leaseId: 'lease-late', amount: '600.00', status: 'FAILED',
              paidAt: new Date('2026-10-04T00:00:00Z'), createdAt: new Date('2026-10-04T00:00:00Z'),
            },
          ],
        },
        {
          id: 'lease-in-grace', lateFee: '0.00', graceDays: 5,
          charges: [{
            id: 'rent-recent', leaseId: 'lease-in-grace', kind: 'RENT', amount: '900.00',
            dueDate: new Date('2026-10-13T00:00:00Z'), description: 'rent:lease-in-grace:2026-10',
          }],
          payments: [],
        },
      ],
      new Date('2026-10-14T23:59:59.999Z'),
    );

    expect(summary).toEqual({ overdueCents: 92_500, overdueLeaseCount: 1 });
  });
});

describe('loadDashboardData', () => {
  it('scopes its portfolio queries to the signed-in organization and returns linked expiring leases', async () => {
    const lease = {
      id: 'seed-lease-maple-11',
      organizationId: 'org-1',
      unitId: 'unit-1',
      status: 'ACTIVE',
      startDate: new Date('2025-12-01T00:00:00Z'),
      endDate: new Date('2026-11-30T00:00:00Z'),
      monthlyRent: '1850.00',
      lateFee: '75.00',
      graceDays: 5,
      unit: {
        id: 'unit-1', number: '4B', isImplicit: false,
        property: { id: 'property-1', name: 'Maple Court', archivedAt: null },
      },
      tenants: [{ isPrimary: true, tenant: { id: 'tenant-1', name: 'Alex Rivera' } }],
      charges: [
        {
          id: 'rent-oct', leaseId: 'seed-lease-maple-11', organizationId: 'org-1', kind: 'RENT',
          amount: '1850.00', dueDate: new Date('2026-10-01T00:00:00Z'), description: 'rent:seed-lease-maple-11:2026-10',
        },
      ],
      payments: [
        {
          id: 'payment-1', leaseId: 'seed-lease-maple-11', organizationId: 'org-1', amount: '1850.00',
          status: 'SUCCEEDED', paidAt: new Date('2026-10-03T09:12:00Z'), createdAt: new Date('2026-10-03T09:12:00Z'),
        },
      ],
      events: [
        {
          id: 'event-1', kind: 'SIGNED', createdAt: new Date('2026-10-10T12:00:00Z'),
          message: 'Lease signed', tenant: { name: 'Alex Rivera' },
        },
      ],
    };
    const client = {
      unit: { findMany: vi.fn().mockResolvedValue([{ id: 'unit-1', propertyId: 'property-1' }]) },
      lease: { findMany: vi.fn().mockResolvedValue([lease]) },
      application: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'application-1', status: 'SCREENING', applicantName: 'Olivia Reed',
            appliedAt: new Date('2026-10-12T12:00:00Z'),
            unit: {
              id: 'unit-2', number: '3A', isImplicit: false,
              property: { id: 'property-1', name: 'Maple Court' },
            },
          },
        ]),
      },
    } as unknown as PrismaClient;

    const dashboard = await loadDashboardData('org-1', now, client);
    const leaseQuery = vi.mocked(client.lease.findMany).mock.calls[0]?.[0];

    expect(leaseQuery?.where).toMatchObject({
      organizationId: 'org-1',
      unit: { property: { archivedAt: null } },
    });
    expect(leaseQuery?.include).toMatchObject({
      charges: { where: { organizationId: 'org-1' } },
      payments: { where: { organizationId: 'org-1' } },
      events: { where: { organizationId: 'org-1' } },
    });
    expect(vi.mocked(client.unit.findMany).mock.calls[0]?.[0]?.where).toMatchObject({
      organizationId: 'org-1', property: { archivedAt: null },
    });
    expect(vi.mocked(client.application.count).mock.calls[0]?.[0]?.where).toMatchObject({
      organizationId: 'org-1',
    });
    expect(dashboard).toMatchObject({
      unitsOccupied: 1,
      unitsTotal: 1,
      propertyCount: 1,
      rentDueCents: 185_000,
      rentCollectedCents: 185_000,
      openApplications: 2,
      expiringLeases: [{ id: 'seed-lease-maple-11', tenantName: 'Alex Rivera', propertyName: 'Maple Court' }],
    });
    expect(dashboard.activity.map((item) => item.title)).toContain('New rental application');
  });
});

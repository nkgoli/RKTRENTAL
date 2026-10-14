import type { LeaseStatus, Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { todayUtc, toCents } from './format';
import {
  balanceCents,
  deriveStatus,
  matchesStatusFilter,
  type StatusFilter,
  type TenantStatus,
} from './status';

export const PAGE_SIZE = 25;

export type TenantFilters = {
  q?: string;
  propertyId?: string;
  status?: StatusFilter;
  page?: number;
};

export type TenantRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: TenantStatus;
  balanceCents: number;
  property: { id: string; name: string; isImplicit: boolean } | null;
  unit: { id: string; number: string } | null;
  lease: { id: string; endDate: Date } | null;
};

export type TenantStats = {
  activeTenants: number;
  moveIns30: number;
  endingSoon: number;
  outstandingCents: number;
  lateTenants: number;
};

const LEASE_RANK: Record<LeaseStatus, number> = { ACTIVE: 0, DRAFT: 1, ENDED: 2, TERMINATED: 3 };

/** Where-clause for the tenants list: always scoped to the organization. */
export function buildTenantWhere(
  organizationId: string,
  filters: Pick<TenantFilters, 'q' | 'propertyId'> = {},
): Prisma.TenantWhereInput {
  const where: Prisma.TenantWhereInput = { organizationId };
  const and: Prisma.TenantWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          leases: {
            some: {
              organizationId,
              lease: { unit: { number: { contains: q, mode: 'insensitive' } } },
            },
          },
        },
      ],
    });
  }
  if (filters.propertyId) {
    and.push({
      leases: {
        some: { organizationId, lease: { unit: { propertyId: filters.propertyId } } },
      },
    });
  }
  if (and.length) where.AND = and;
  return where;
}

async function balancesFor(
  client: PrismaClient,
  organizationId: string,
  leaseIds: string[],
  today: Date,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!leaseIds.length) return result;
  const [charges, payments] = await Promise.all([
    client.charge.groupBy({
      by: ['leaseId'],
      where: { organizationId, leaseId: { in: leaseIds }, dueDate: { lte: today } },
      _sum: { amount: true },
    }),
    client.payment.groupBy({
      by: ['leaseId'],
      where: { organizationId, leaseId: { in: leaseIds }, status: 'SUCCEEDED' },
      _sum: { amount: true },
    }),
  ]);
  const paid = new Map(payments.map((p) => [p.leaseId, toCents(p._sum.amount ?? 0)]));
  for (const charge of charges) {
    result.set(
      charge.leaseId,
      balanceCents([toCents(charge._sum.amount ?? 0)], [paid.get(charge.leaseId) ?? 0]),
    );
  }
  return result;
}

export function organizationTenants(
  organizationId: string,
  client: PrismaClient = db,
  now: Date = new Date(),
) {
  if (!organizationId.trim()) throw new Error('organizationId is required');
  const today = todayUtc(now);

  async function loadRows(filters: TenantFilters = {}): Promise<TenantRow[]> {
    const tenants = await client.tenant.findMany({
      where: buildTenantWhere(organizationId, filters),
      orderBy: { name: 'asc' },
      include: {
        leases: {
          where: { organizationId },
          include: { lease: { include: { unit: { include: { property: true } } } } },
        },
      },
    });
    const activeLeaseIds = tenants.flatMap((t) =>
      t.leases.filter((l) => l.lease.status === 'ACTIVE').map((l) => l.leaseId),
    );
    const balances = await balancesFor(client, organizationId, activeLeaseIds, today);

    return tenants.map((tenant) => {
      const leases = [...tenant.leases]
        .map((l) => l.lease)
        .sort(
          (a, b) =>
            LEASE_RANK[a.status] - LEASE_RANK[b.status] ||
            b.endDate.getTime() - a.endDate.getTime(),
        );
      const current = leases[0] ?? null;
      const balance = leases
        .filter((l) => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + (balances.get(l.id) ?? 0), 0);
      return {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        status: deriveStatus(
          leases.map((l) => l.status),
          balance,
        ),
        balanceCents: balance,
        property: current
          ? {
              id: current.unit.property.id,
              name: current.unit.property.name,
              isImplicit: current.unit.isImplicit,
            }
          : null,
        unit: current ? { id: current.unit.id, number: current.unit.number } : null,
        lease: current ? { id: current.id, endDate: current.endDate } : null,
      };
    });
  }

  return {
    loadRows,

    async list(filters: TenantFilters = {}) {
      const status = filters.status ?? 'all';
      const rows = (await loadRows(filters)).filter((r) => matchesStatusFilter(r.status, status));
      const page = Math.max(1, Math.floor(filters.page ?? 1));
      return {
        total: rows.length,
        page,
        rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      };
    },

    async stats(): Promise<TenantStats> {
      const rows = await loadRows();
      const in60 = new Date(today.getTime() + 60 * 86_400_000);
      const ago30 = new Date(today.getTime() - 30 * 86_400_000);
      const [moveIns30, endingSoon] = await Promise.all([
        client.lease.count({
          where: { organizationId, status: 'ACTIVE', startDate: { gte: ago30, lte: today } },
        }),
        client.lease.count({
          where: { organizationId, status: 'ACTIVE', endDate: { gte: today, lte: in60 } },
        }),
      ]);
      const owing = rows.filter((r) => r.balanceCents > 0);
      return {
        activeTenants: rows.filter((r) => r.status === 'CURRENT' || r.status === 'LATE').length,
        moveIns30,
        endingSoon,
        outstandingCents: owing.reduce((sum, r) => sum + r.balanceCents, 0),
        lateTenants: owing.length,
      };
    },

    async formOptions() {
      const properties = await client.property.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          units: {
            where: {
              organizationId,
              status: { not: 'ARCHIVED' },
              leases: { none: { status: { in: ['DRAFT', 'ACTIVE'] } } },
            },
            orderBy: { number: 'asc' },
            select: { id: true, number: true },
          },
        },
      });
      return properties.map((p) => ({ id: p.id, name: p.name, units: p.units }));
    },

    async detail(tenantId: string) {
      const tenant = await client.tenant.findFirst({
        where: { id: tenantId, organizationId },
        include: {
          leases: {
            where: { organizationId },
            include: {
              lease: {
                include: {
                  unit: { include: { property: true } },
                  documents: { orderBy: { createdAt: 'desc' } },
                  charges: { where: { dueDate: { lte: today } } },
                  payments: { orderBy: { createdAt: 'desc' } },
                  tenants: { include: { tenant: true } },
                },
              },
            },
          },
        },
      });
      if (!tenant) return null;
      const leases = tenant.leases
        .map((l) => l.lease)
        .sort(
          (a, b) =>
            LEASE_RANK[a.status] - LEASE_RANK[b.status] ||
            b.endDate.getTime() - a.endDate.getTime(),
        );
      const active = leases.filter((l) => l.status === 'ACTIVE');
      const balance = active.reduce(
        (sum, lease) =>
          sum +
          balanceCents(
            lease.charges.map((c) => toCents(c.amount)),
            lease.payments.filter((p) => p.status === 'SUCCEEDED').map((p) => toCents(p.amount)),
          ),
        0,
      );
      return {
        tenant,
        leases,
        currentLease: leases[0] ?? null,
        balanceCents: balance,
        status: deriveStatus(
          leases.map((l) => l.status),
          balance,
        ),
      };
    },
  };
}

export type TenantDetail = NonNullable<
  Awaited<ReturnType<ReturnType<typeof organizationTenants>['detail']>>
>;

import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';

export const leaseInclude = {
  unit: { include: { property: true } },
  tenants: { include: { tenant: true } },
} as const;

export function leasesDb(organizationId: string, client: PrismaClient = db, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in60 = new Date(today.getTime() + 60 * 86_400_000);
  return {
    async list() {
      const leases = await client.lease.findMany({
        where: { organizationId },
        include: leaseInclude,
        orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
      });
      return {
        leases,
        counts: {
          active: leases.filter((l) => l.status === 'ACTIVE').length,
          expiring: leases.filter(
            (l) => l.status === 'ACTIVE' && l.endDate >= today && l.endDate <= in60,
          ).length,
          drafts: leases.filter((l) => l.status === 'DRAFT').length,
          ended: leases.filter((l) => l.status === 'ENDED' || l.status === 'TERMINATED').length,
          awaiting: leases.filter((l) => l.status === 'ACTIVE' && l.eSignStatus !== 'SIGNED')
            .length,
        },
        today,
        in60,
      };
    },
    detail(id: string) {
      return client.lease.findFirst({
        where: { id, organizationId },
        include: {
          ...leaseInclude,
          documents: { orderBy: { createdAt: 'desc' } },
          charges: { orderBy: { dueDate: 'desc' } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });
    },
    async formOptions() {
      const [units, tenants] = await Promise.all([
        client.unit.findMany({
          where: { organizationId, status: { not: 'ARCHIVED' }, property: { archivedAt: null } },
          include: { property: true },
          orderBy: [{ property: { name: 'asc' } }, { number: 'asc' }],
        }),
        client.tenant.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
      ]);
      return { units, tenants };
    },
  };
}

export type LeaseListItem = Awaited<
  ReturnType<ReturnType<typeof leasesDb>['list']>
>['leases'][number];
export type LeaseDetail = NonNullable<Awaited<ReturnType<ReturnType<typeof leasesDb>['detail']>>>;

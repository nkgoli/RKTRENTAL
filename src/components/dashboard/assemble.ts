import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import {
  COLLECTION_RANGES,
  loadCollectionSeries,
  loadDashboardData,
  overdueSummary,
  type CollectionRange,
  type DashboardData,
  type LedgerLease,
} from '@/lib/dashboard/queries';
import { propertiesDb } from '@/lib/properties/data';
import type { CoverSource } from './MiniCover';

const DAY_MS = 86_400_000;
/** Matches the window of the Leases "expiring" tab this strip links to. */
export const EXPIRING_STRIP_DAYS = 60;

export type PastDueTenant = { leaseId: string; name: string; initials: string };

export type AttentionItem = {
  key: 'overdue' | 'expiring' | 'repairs';
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: 'danger' | 'warm' | 'info';
};

export type DashboardProperty = {
  id: string;
  name: string;
  address: string;
  unitCount: number;
  occupied: number;
  occupancyPercent: number;
  cover: CoverSource;
};

export type DashboardView = DashboardData & {
  expiringSoonCount: number;
  pastDueTenants: PastDueTenant[];
  attention: AttentionItem[];
  properties: DashboardProperty[];
};

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

/** The three counts of the attention strip, each linking to a filtered page. */
export function attentionStrip(
  data: Pick<
    DashboardData,
    'overdueLeaseCount' | 'overdueCents' | 'openMaintenanceRequests' | 'urgentMaintenanceRequests'
  >,
  expiringSoonCount: number,
  formatMoney: (cents: number) => string,
): AttentionItem[] {
  return [
    {
      key: 'overdue',
      label: 'Overdue rent',
      count: data.overdueLeaseCount,
      detail: data.overdueLeaseCount
        ? `${formatMoney(data.overdueCents)} past grace`
        : 'Everyone is paid up',
      href: '/payments?filter=late',
      tone: data.overdueLeaseCount ? 'danger' : 'info',
    },
    {
      key: 'expiring',
      label: 'Leases expiring',
      count: expiringSoonCount,
      detail: `in the next ${EXPIRING_STRIP_DAYS} days`,
      href: '/leases?tab=expiring',
      tone: expiringSoonCount ? 'warm' : 'info',
    },
    {
      key: 'repairs',
      label: 'Open repairs',
      count: data.openMaintenanceRequests,
      detail: data.urgentMaintenanceRequests
        ? `${data.urgentMaintenanceRequests} urgent`
        : `no urgent ${plural(data.openMaintenanceRequests, 'request')}`,
      href: '/maintenance',
      tone: data.urgentMaintenanceRequests ? 'danger' : 'info',
    },
  ];
}

type TenantLease = LedgerLease & {
  endDate: Date;
  tenants: { isPrimary: boolean; tenant: { name: string } }[];
};

/** Splits active leases into past-due tenants and the 60-day expiring count. */
export function assembleLeaseSignals(leases: readonly TenantLease[], now: Date) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const asOf = new Date(day + DAY_MS - 1);
  const pastDueTenants: PastDueTenant[] = [];
  let expiringSoonCount = 0;
  for (const lease of leases) {
    const end = lease.endDate.getTime();
    if (end >= day && end <= day + EXPIRING_STRIP_DAYS * DAY_MS) expiringSoonCount += 1;
    if (overdueSummary([lease], asOf).overdueLeaseCount > 0) {
      const name = lease.tenants[0]?.tenant.name ?? 'Tenant';
      pastDueTenants.push({ leaseId: lease.id, name, initials: initialsOf(name) });
    }
  }
  return { pastDueTenants, expiringSoonCount };
}

export async function loadDashboardView(
  organizationId: string,
  now = new Date(),
  client: PrismaClient = db,
  formatMoney: (cents: number) => string = (cents) => `$${(cents / 100).toFixed(2)}`,
  collectionRange: CollectionRange = '6M',
): Promise<DashboardView> {
  const [data, series, leases, list] = await Promise.all([
    loadDashboardData(organizationId, now, client),
    loadCollectionSeries(organizationId, now, COLLECTION_RANGES[collectionRange], client),
    client.lease.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        unit: { property: { archivedAt: null } },
      },
      include: {
        tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } },
        charges: { where: { organizationId }, orderBy: { dueDate: 'asc' } },
        payments: { where: { organizationId }, orderBy: { createdAt: 'asc' } },
      },
    }),
    propertiesDb(organizationId, client).listProperties(),
  ]);
  const { pastDueTenants, expiringSoonCount } = assembleLeaseSignals(leases, now);
  return {
    ...data,
    collection: series,
    expiringSoonCount,
    pastDueTenants,
    attention: attentionStrip(data, expiringSoonCount, formatMoney),
    properties: list.properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: `${p.city}, ${p.state}`,
      unitCount: p.unitCount,
      occupied: p.occupied,
      occupancyPercent: p.unitCount ? Math.round((p.occupied / p.unitCount) * 100) : 0,
      cover: { type: p.type, unitCount: p.unitCount, coverPhotoId: p.coverPhotoId },
    })),
  };
}

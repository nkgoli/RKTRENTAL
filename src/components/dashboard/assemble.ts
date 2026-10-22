import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import {
  COLLECTION_RANGES,
  EXPIRING_WINDOW_DAYS,
  loadCollectionSeries,
  loadDashboardData,
  overdueSummary,
  type CollectionRange,
  type DashboardData,
  type LedgerLease,
} from '@/lib/dashboard/queries';
import { propertiesDb } from '@/lib/properties/data';
import { loadPaymentsOverview, monthKey } from '@/lib/ledger';
import type { CoverSource } from './MiniCover';

const DAY_MS = 86_400_000;
/** Matches the window of the Leases "expiring" tab this strip links to. */
export const EXPIRING_STRIP_DAYS = EXPIRING_WINDOW_DAYS;

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

/** This month's rent roll, with the same open and late definitions as the Payments page. */
export type RentRollSummary = {
  openCents: number;
  openCount: number;
  lateCents: number;
  lateCount: number;
  lateTenants: string[];
};

export type UrgentRequest = {
  id: string;
  title: string;
  propertyName: string;
  unitLabel: string;
  createdAt: Date;
  assigned: boolean;
  photoCount: number;
};

export type DashboardView = DashboardData & {
  expiringSoonCount: number;
  /** Active leases ending within 60 days: the Leases "Expiring soon" window. */
  endingWithin60Count: number;
  pastDueTenants: PastDueTenant[];
  attention: AttentionItem[];
  properties: DashboardProperty[];
  rentRoll: RentRollSummary;
  applicationStatusCounts: { SUBMITTED: number; SCREENING: number; REVIEW: number };
  urgentRequest: UrgentRequest | null;
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

/** Splits active leases into past-due tenants and the shared expiring window count. */
export function assembleLeaseSignals(leases: readonly TenantLease[], now: Date) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const asOf = new Date(day + DAY_MS - 1);
  const pastDueTenants: PastDueTenant[] = [];
  let expiringSoonCount = 0;
  let endingWithin60Count = 0;
  for (const lease of leases) {
    const end = lease.endDate.getTime();
    if (end >= day && end <= day + EXPIRING_STRIP_DAYS * DAY_MS) expiringSoonCount += 1;
    if (end >= day && end <= day + 60 * DAY_MS) endingWithin60Count += 1;
    if (overdueSummary([lease], asOf).overdueLeaseCount > 0) {
      const name = lease.tenants[0]?.tenant.name ?? 'Tenant';
      pastDueTenants.push({ leaseId: lease.id, name, initials: initialsOf(name) });
    }
  }
  return { pastDueTenants, expiringSoonCount, endingWithin60Count };
}

export async function loadDashboardView(
  organizationId: string,
  now = new Date(),
  client: PrismaClient = db,
  formatMoney: (cents: number) => string = (cents) => `$${(cents / 100).toFixed(2)}`,
  collectionRange: CollectionRange = '6M',
): Promise<DashboardView> {
  const [data, series, leases, list, overview, applications, urgent] = await Promise.all([
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
    loadPaymentsOverview(organizationId, monthKey(now), now, client, {}, { payouts: false }),
    client.application.findMany({
      where: {
        organizationId,
        status: { in: ['SUBMITTED', 'SCREENING', 'REVIEW'] },
        unit: { property: { archivedAt: null } },
      },
      select: { status: true },
    }),
    client.maintenanceRequest.findFirst({
      where: {
        organizationId,
        priority: 'URGENT',
        status: { not: 'DONE' },
        property: { archivedAt: null },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        property: { select: { name: true } },
        unit: { select: { number: true, isImplicit: true } },
        _count: { select: { photos: true } },
      },
    }),
  ]);
  const { pastDueTenants, expiringSoonCount, endingWithin60Count } = assembleLeaseSignals(
    leases,
    now,
  );
  const lateRows = overview.rows.filter((row) => row.status === 'LATE');
  const countOf = (status: string) => applications.filter((a) => a.status === status).length;
  return {
    ...data,
    collection: series,
    expiringSoonCount,
    endingWithin60Count,
    rentRoll: {
      openCents: overview.outstandingCents,
      openCount: overview.openCount,
      lateCents: overview.lateCents,
      lateCount: overview.lateCount,
      lateTenants: lateRows.map((row) => row.tenantName),
    },
    applicationStatusCounts: {
      SUBMITTED: countOf('SUBMITTED'),
      SCREENING: countOf('SCREENING'),
      REVIEW: countOf('REVIEW'),
    },
    urgentRequest: urgent
      ? {
          id: urgent.id,
          title: urgent.title,
          propertyName: urgent.property.name,
          unitLabel: urgent.unit.isImplicit ? '' : urgent.unit.number,
          createdAt: urgent.createdAt,
          assigned: Boolean(urgent.vendorId || urgent.vendorName),
          photoCount: urgent._count.photos,
        }
      : null,
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

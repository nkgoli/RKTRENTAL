import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { EVENT_LABEL } from '@/lib/leases/events';
import { listMaintenanceBoard } from '@/lib/maintenance';
import {
  addMonths,
  computeBalance,
  formatUsd,
  isPastGrace,
  monthKey,
  monthStart,
  toCents,
} from '@/lib/ledger';

type MoneyValue = { toString(): string } | string | number;

export type CollectionLease = {
  startDate: Date;
  endDate: Date;
  monthlyRent: MoneyValue;
  payments: { status: string; amount: MoneyValue; paidAt: Date | null }[];
};

export type LedgerLease = {
  id: string;
  lateFee: MoneyValue;
  graceDays: number;
  charges: {
    id: string;
    leaseId: string;
    kind: 'RENT' | 'LATE_FEE' | 'DEPOSIT' | 'OTHER';
    amount: MoneyValue;
    dueDate: Date;
    description: string | null;
  }[];
  payments: {
    id: string;
    leaseId: string;
    amount: MoneyValue;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
    paidAt: Date | null;
    createdAt: Date;
  }[];
};

export type CollectionMonth = {
  key: string;
  label: string;
  dueCents: number;
  collectedCents: number;
};

export type ExpiringLease = {
  id: string;
  propertyId: string;
  unitId: string;
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  rentCents: number;
  endDate: Date;
  daysUntil: number;
};

export type DashboardActivity = {
  id: string;
  title: string;
  description: string;
  propertyName: string;
  propertyHref: string;
  unitLabel: string;
  unitHref: string;
  happenedAt: Date;
  status: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  href: string;
};

export type DashboardData = {
  monthLabel: string;
  unitsOccupied: number;
  unitsTotal: number;
  propertyCount: number;
  occupancyPercent: number;
  rentDueCents: number;
  rentCollectedCents: number;
  overdueCents: number;
  overdueLeaseCount: number;
  openApplications: number;
  openMaintenanceRequests: number;
  urgentMaintenanceRequests: number;
  collection: CollectionMonth[];
  expiringLeases: ExpiringLease[];
  activity: DashboardActivity[];
};

const DAY_MS = 86_400_000;
type DashboardMaintenanceRequest = { status: string; priority: string };

function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The trailing windows the rent collection chart can show, in months. */
export const COLLECTION_RANGES = { '6M': 6, '12M': 12, '2Y': 24, '5Y': 60 } as const;
export type CollectionRange = keyof typeof COLLECTION_RANGES;

export function collectionRangeFrom(value: string | undefined | null): CollectionRange {
  return value && value in COLLECTION_RANGES ? (value as CollectionRange) : '6M';
}

function collectionMonths(
  leases: readonly CollectionLease[],
  now: Date,
  length = 6,
): CollectionMonth[] {
  const currentMonth = monthKey(now);
  return Array.from({ length }, (_, index) => {
    const key = addMonths(currentMonth, index - (length - 1));
    const start = monthStart(key);
    const end = monthStart(addMonths(key, 1));
    const inMonth = leases.filter((lease) => lease.startDate < end && lease.endDate >= start);
    const dueCents = inMonth.reduce((total, lease) => total + toCents(lease.monthlyRent), 0);
    const collectedCents = inMonth.reduce(
      (total, lease) =>
        total +
        lease.payments
          .filter(
            (payment) =>
              payment.status === 'SUCCEEDED' &&
              payment.paidAt !== null &&
              payment.paidAt >= start &&
              payment.paidAt < end,
          )
          .reduce((sum, payment) => sum + toCents(payment.amount), 0),
      0,
    );
    return {
      key,
      label: start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      dueCents,
      collectedCents,
    };
  });
}

/**
 * Rent due and collected for each of the last `length` months, summed in SQL
 * so five years of payments cost one query and `length` rows. Same rules as
 * collectionMonths: leases that overlap the month, settled payments paid in it.
 */
async function loadCollectionSeries(
  organizationId: string,
  now: Date,
  length: number,
  client: PrismaClient = db,
): Promise<CollectionMonth[]> {
  const first = addMonths(monthKey(now), -(length - 1));
  const startIso = monthStart(first).toISOString().slice(0, 10);
  const endIso = monthStart(addMonths(monthKey(now), 1)).toISOString().slice(0, 10);
  const rows = await client.$queryRaw<{ month: string; due: bigint; collected: bigint }[]>`
    WITH months AS (
      SELECT generate_series(${startIso}::date, ${endIso}::date - 1, interval '1 month')::date AS m
    ),
    live AS (
      SELECT l.id, l."startDate", l."endDate", l."monthlyRent"
      FROM "Lease" l
      JOIN "Unit" u ON u.id = l."unitId" AND u."organizationId" = l."organizationId"
      JOIN "Property" pr ON pr.id = u."propertyId" AND pr."organizationId" = u."organizationId"
      WHERE l."organizationId" = ${organizationId}
        AND l.status IN ('ACTIVE', 'ENDED')
        AND pr."archivedAt" IS NULL
    ),
    due AS (
      SELECT m.m, (SUM(live."monthlyRent") * 100)::bigint AS cents
      FROM months m
      JOIN live ON live."startDate" < (m.m + interval '1 month') AND live."endDate" >= m.m
      GROUP BY m.m
    ),
    paid AS (
      SELECT date_trunc('month', p."paidAt")::date AS m, (SUM(p.amount) * 100)::bigint AS cents
      FROM "Payment" p
      JOIN live ON live.id = p."leaseId"
      WHERE p."organizationId" = ${organizationId}
        AND p.status = 'SUCCEEDED'
        AND p."paidAt" >= ${startIso}::timestamp
        AND p."paidAt" < ${endIso}::timestamp
        AND live."startDate" < (date_trunc('month', p."paidAt") + interval '1 month')
        AND live."endDate" >= date_trunc('month', p."paidAt")
      GROUP BY 1
    )
    SELECT to_char(months.m, 'YYYY-MM') AS month,
           COALESCE(due.cents, 0) AS due,
           COALESCE(paid.cents, 0) AS collected
    FROM months
    LEFT JOIN due ON due.m = months.m
    LEFT JOIN paid ON paid.m = months.m
    ORDER BY months.m`;
  return rows.map((row) => ({
    key: row.month,
    label: monthStart(row.month).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    dueCents: Number(row.due),
    collectedCents: Number(row.collected),
  }));
}

function overdueSummary(leases: readonly LedgerLease[], asOf: Date) {
  let overdueCents = 0;
  const overdueLeaseIds = new Set<string>();

  for (const lease of leases) {
    const balance = computeBalance(
      lease.charges.map((charge) => ({
        id: charge.id,
        leaseId: charge.leaseId,
        kind: charge.kind,
        amountCents: toCents(charge.amount),
        dueDate: charge.dueDate,
        description: charge.description,
      })),
      lease.payments.map((payment) => ({
        id: payment.id,
        leaseId: payment.leaseId,
        amountCents: toCents(payment.amount),
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
      asOf,
    );

    for (const allocation of balance.allocations) {
      if (allocation.outstandingCents <= 0) continue;
      const overdueRent =
        allocation.charge.kind === 'RENT' &&
        isPastGrace(allocation.charge.dueDate, lease.graceDays, asOf);
      const postedLateFee = allocation.charge.kind === 'LATE_FEE';
      if (overdueRent || postedLateFee) {
        overdueCents += allocation.outstandingCents;
        overdueLeaseIds.add(lease.id);
      }
    }
  }

  return { overdueCents, overdueLeaseCount: overdueLeaseIds.size };
}

const appStatus = {
  SUBMITTED: 'Submitted',
  SCREENING: 'Screening',
  REVIEW: 'Review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
} as const;

function eventTone(kind: string): DashboardActivity['tone'] {
  if (kind === 'SIGNED' || kind === 'COMPLETED' || kind === 'RENEWED') return 'success';
  if (kind === 'DECLINED') return 'danger';
  if (kind === 'NOTICE_GIVEN') return 'warning';
  return 'info';
}

function paymentActivityTone(status: string): DashboardActivity['tone'] {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'FAILED' || status === 'REFUNDED') return 'danger';
  return 'neutral';
}

export async function loadDashboardData(
  organizationId: string,
  now = new Date(),
  client: PrismaClient = db,
  maintenanceBoard: (organizationId: string) => Promise<DashboardMaintenanceRequest[]> = listMaintenanceBoard,
): Promise<DashboardData> {
  if (!organizationId.trim()) throw new Error('organizationId is required');

  const today = utcDay(now);
  const todayEnd = new Date(today.getTime() + DAY_MS - 1);
  const expiresBy = new Date(today.getTime() + 90 * DAY_MS);
  const month = monthKey(now);
  const currentMonthStart = monthStart(month);
  const nextMonthStart = monthStart(addMonths(month, 1));
  const activitySince = new Date(today.getTime() - 30 * DAY_MS);

  const [units, leases, openApplications, recentApplications, maintenanceRequests] = await Promise.all([
    client.unit.findMany({
      where: {
        organizationId,
        status: { not: 'ARCHIVED' },
        property: { archivedAt: null },
      },
      select: { id: true, propertyId: true },
    }),
    client.lease.findMany({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'ENDED'] },
        unit: { property: { archivedAt: null } },
      },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } },
        charges: { where: { organizationId }, orderBy: { dueDate: 'asc' } },
        payments: { where: { organizationId }, orderBy: { createdAt: 'asc' } },
        events: {
          where: { organizationId, createdAt: { gte: activitySince } },
          include: { tenant: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { endDate: 'asc' },
    }),
    client.application.count({
      where: {
        organizationId,
        status: { in: ['SUBMITTED', 'SCREENING', 'REVIEW'] },
        unit: { property: { archivedAt: null } },
      },
    }),
    client.application.findMany({
      where: {
        organizationId,
        createdAt: { gte: activitySince },
        unit: { property: { archivedAt: null } },
      },
      include: { unit: { include: { property: true } } },
      orderBy: { appliedAt: 'desc' },
      take: 10,
    }),
    maintenanceBoard(organizationId),
  ]);

  const activeLeases = leases.filter(
    (lease) =>
      lease.status === 'ACTIVE' && lease.startDate <= todayEnd && lease.endDate >= today,
  );
  const occupiedUnitIds = new Set(activeLeases.map((lease) => lease.unitId));
  const activeMonthLeases = leases.filter(
    (lease) =>
      lease.startDate < nextMonthStart && lease.endDate >= currentMonthStart,
  );
  const currentCollection = collectionMonths(activeMonthLeases, now).at(-1)!;
  const collection = collectionMonths(leases, now);
  const overdue = overdueSummary(leases, todayEnd);
  const expiryLeases: ExpiringLease[] = activeLeases
    .filter((lease) => lease.endDate >= today && lease.endDate <= expiresBy)
    .map((lease) => ({
      id: lease.id,
      propertyId: lease.unit.property.id,
      unitId: lease.unit.id,
      tenantName: lease.tenants[0]?.tenant.name ?? 'Tenant not assigned',
      propertyName: lease.unit.property.name,
      unitLabel: lease.unit.isImplicit ? 'Single-unit' : `Unit ${lease.unit.number}`,
      rentCents: toCents(lease.monthlyRent),
      endDate: lease.endDate,
      daysUntil: Math.max(0, Math.ceil((utcDay(lease.endDate).getTime() - today.getTime()) / DAY_MS)),
    }));

  const activity: DashboardActivity[] = [];
  for (const lease of leases) {
    const tenantName = lease.tenants[0]?.tenant.name ?? 'Tenant';
    const propertyName = lease.unit.property.name;
    const unitLabel = lease.unit.isImplicit ? 'Single-unit' : lease.unit.number;
    const propertyHref = `/properties/${lease.unit.property.id}`;
    const unitHref = `/properties/${lease.unit.property.id}/units/${lease.unit.id}`;
    const href = `/leases/${lease.id}`;

    for (const event of lease.events) {
      const person = event.tenant?.name ?? tenantName;
      activity.push({
        id: `lease-event-${event.id}`,
        title: EVENT_LABEL[event.kind],
        description: [person, event.message].filter(Boolean).join(' · '),
        propertyName,
        propertyHref,
        unitLabel,
        unitHref,
        happenedAt: event.createdAt,
        status: event.kind === 'SIGNED' || event.kind === 'COMPLETED' ? 'Signed' : 'Lease',
        tone: eventTone(event.kind),
        href,
      });
    }

    for (const payment of lease.payments) {
      const happenedAt = payment.paidAt ?? payment.createdAt;
      if (happenedAt < activitySince) continue;
      const succeeded = payment.status === 'SUCCEEDED';
      activity.push({
        id: `payment-${payment.id}`,
        title: succeeded ? `${tenantName} paid rent` : `Payment ${payment.status.toLowerCase()}`,
        description: `${formatUsd(toCents(payment.amount))}${payment.status === 'SUCCEEDED' ? ' · rent payment' : ''}`,
        propertyName,
        propertyHref,
        unitLabel,
        unitHref,
        happenedAt,
        status: payment.status === 'SUCCEEDED' ? 'Paid' : payment.status[0] + payment.status.slice(1).toLowerCase(),
        tone: paymentActivityTone(payment.status),
        href,
      });
    }
  }

  for (const application of recentApplications) {
    activity.push({
      id: `application-${application.id}`,
      title: 'New rental application',
      description: application.applicantName,
      propertyName: application.unit.property.name,
      propertyHref: `/properties/${application.unit.property.id}`,
      unitLabel: application.unit.isImplicit ? 'Single-unit' : application.unit.number,
      unitHref: `/properties/${application.unit.property.id}/units/${application.unit.id}`,
      happenedAt: application.appliedAt,
      status: appStatus[application.status],
      tone:
        application.status === 'REVIEW'
          ? 'success'
          : application.status === 'DECLINED'
            ? 'danger'
            : 'warning',
      href: `/applications?applicant=${encodeURIComponent(application.id)}`,
    });
  }

  activity.sort((a, b) => b.happenedAt.getTime() - a.happenedAt.getTime());

  return {
    monthLabel: currentMonthStart.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    unitsOccupied: occupiedUnitIds.size,
    unitsTotal: units.length,
    propertyCount: new Set(units.map((unit) => unit.propertyId)).size,
    occupancyPercent: units.length ? Math.round((occupiedUnitIds.size / units.length) * 100) : 0,
    rentDueCents: currentCollection.dueCents,
    rentCollectedCents: currentCollection.collectedCents,
    overdueCents: overdue.overdueCents,
    overdueLeaseCount: overdue.overdueLeaseCount,
    openApplications,
    openMaintenanceRequests: maintenanceRequests.filter((request) => request.status !== 'DONE').length,
    urgentMaintenanceRequests: maintenanceRequests.filter(
      (request) => request.status !== 'DONE' && request.priority === 'URGENT',
    ).length,
    collection,
    expiringLeases: expiryLeases.slice(0, 6),
    activity: activity.slice(0, 6),
  };
}

export { collectionMonths, loadCollectionSeries, overdueSummary };

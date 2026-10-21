import Link from 'next/link';
import { MiniCover } from '@/components/dashboard/MiniCover';
import { Icon } from '@/components/shell/Icons';
import { loadDashboardView, initialsOf } from '@/components/dashboard/assemble';
import { trendOf } from '@/components/dashboard/trend';
import { CollectionChart } from '@/components/dashboard/CollectionChart';
import { AvatarStack, Badge, TrendChip } from '@/components/ui';
import { collectionRangeFrom, EXPIRING_WINDOW_DAYS } from '@/lib/dashboard/queries';
import { requireManagerRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

const dateFmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const shortDate = (date: Date) => dateFmt(date, { month: 'short', day: 'numeric' });
const fullDate = (date: Date) => dateFmt(date, { month: 'short', day: 'numeric', year: 'numeric' });

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireManagerRole();
  const now = new Date();
  const range = collectionRangeFrom((await searchParams).range);
  const dashboard = await loadDashboardView(
    session.organizationId,
    now,
    undefined,
    formatUsd,
    range,
  );
  const collectionPercent = dashboard.rentDueCents
    ? Math.min(100, Math.round((dashboard.rentCollectedCents / dashboard.rentDueCents) * 100))
    : 0;
  const collectedSeries = dashboard.collection.map((month) => month.collectedCents);
  const trend = trendOf(collectedSeries);
  const outstandingCents = Math.max(0, dashboard.rentDueCents - dashboard.rentCollectedCents);

  return (
    <section className={styles.dashboard} aria-label="Manager dashboard">
      <dl className={styles.pulse} aria-label="Portfolio at a glance">
        <div>
          <dt>Portfolio occupancy</dt>
          <dd>
            <strong>{dashboard.occupancyPercent}%</strong>
            <span>
              {dashboard.unitsOccupied} of {dashboard.unitsTotal} units occupied
            </span>
          </dd>
        </div>
        <div>
          <dt>Leases expiring soon</dt>
          <dd>
            <strong>{dashboard.expiringSoonCount}</strong>
            <span>within {EXPIRING_WINDOW_DAYS} days</span>
          </dd>
        </div>
        <div>
          <dt>Open repairs</dt>
          <dd>
            <strong>{dashboard.openMaintenanceRequests}</strong>
            <span>{dashboard.urgentMaintenanceRequests} urgent</span>
          </dd>
        </div>
      </dl>
      <section className={styles.collection} aria-label="Rent collection">
        <div className={styles.current}>
          <p className={styles.eyebrow}>{dashboard.monthLabel}</p>
          <h2>Rent collection this month</h2>
          <div className={styles.bigValue}>{formatUsd(dashboard.rentCollectedCents)}</div>
          <p className={styles.note}>
            of <strong>{formatUsd(dashboard.rentDueCents)}</strong> total due
          </p>
          <div
            className={styles.progress}
            role="meter"
            aria-label="Rent collected"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={collectionPercent}
            aria-valuetext={
              dashboard.rentDueCents
                ? `${formatUsd(dashboard.rentCollectedCents)} of ${formatUsd(dashboard.rentDueCents)} collected`
                : 'No rent due this month'
            }
          >
            <span style={{ width: `${collectionPercent}%` }} />
          </div>
          <div className={styles.collectionStatus}>
            <strong>{collectionPercent}% collected</strong>
            <span>Month to date</span>
          </div>
          <Link className={styles.outstanding} href="/payments">
            <span>
              <strong>{formatUsd(outstandingCents)}</strong> unpaid this month
            </span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
          {trend && (
            <p className={styles.note}>
              <TrendChip warm={trend.warm}>{trend.label}</TrendChip> compared with previous month
            </p>
          )}
        </div>
        <div className={styles.history}>
          <h2>Collection history</h2>
          <p className={styles.note}>Collected against rent due &middot; USD</p>
          <CollectionChart months={dashboard.collection} range={range} />
        </div>
      </section>
      <div className={styles.split}>
        <article className="card">
          <div className="card-header">
            <h2>Leases expiring soon</h2>
            <Link href="/leases?tab=expiring" aria-label="View all expiring leases">
              View all {dashboard.expiringSoonCount} →
            </Link>
          </div>
          {dashboard.expiringLeases.length ? (
            <ol className={styles.timeline}>
              {dashboard.expiringLeases.slice(0, 5).map((lease) => (
                <li key={lease.id} className={lease.daysUntil <= 30 ? styles.soon : undefined}>
                  <span className={styles.dot} aria-hidden="true">
                    {initialsOf(lease.tenantName)}
                  </span>
                  <div className={styles.timelineBody}>
                    <Link className={styles.tenantLink} href={`/leases/${lease.id}`}>
                      {lease.tenantName}
                    </Link>
                    <div className={styles.muted}>
                      <Link href={`/properties/${lease.propertyId}`}>{lease.propertyName}</Link> ·{' '}
                      <Link href={`/properties/${lease.propertyId}/units/${lease.unitId}`}>
                        {lease.unitLabel}
                      </Link>{' '}
                      · {formatUsd(lease.rentCents)}
                    </div>
                  </div>
                  <Link
                    className={styles.when}
                    href={`/leases/${lease.id}`}
                    aria-label={`${lease.tenantName}, lease ends ${fullDate(lease.endDate)}, in ${lease.daysUntil} days`}
                  >
                    <strong>{shortDate(lease.endDate)}</strong>
                    <small>{lease.daysUntil}d</small>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No active leases end in the next 90 days.</p>
          )}
        </article>
        <article className={`card ${styles.attention}`}>
          <div className="card-header">
            <h2>Needs attention</h2>
          </div>
          <div className={styles.attentionList}>
            {dashboard.overdueLeaseCount ? (
              <div className={`${styles.alert} ${styles.warningAlert}`}>
                <div>
                  <strong>
                    {dashboard.overdueLeaseCount}{' '}
                    {dashboard.overdueLeaseCount === 1 ? 'lease is' : 'leases are'} past due
                  </strong>
                  <p>{formatUsd(dashboard.overdueCents)} past grace</p>
                  <AvatarStack
                    initials={dashboard.pastDueTenants.map((tenant) => tenant.initials)}
                  />
                </div>
                <Link href="/payments?filter=late">Review balances</Link>
              </div>
            ) : (
              <div className={`${styles.alert} ${styles.successAlert}`}>
                No overdue rent balances.
              </div>
            )}
            <div className={styles.alert}>
              <div>
                <strong>
                  {dashboard.openApplications} open{' '}
                  {dashboard.openApplications === 1 ? 'application' : 'applications'}
                </strong>
                <p>Awaiting review or screening</p>
              </div>
              <Link href="/applications">Review</Link>
            </div>
            <div className={`${styles.alert} ${styles.maintenanceAlert}`}>
              <div>
                <strong>Open maintenance requests</strong>
                <p>
                  {dashboard.openMaintenanceRequests} open · {dashboard.urgentMaintenanceRequests}{' '}
                  urgent
                </p>
              </div>
              <Link href="/maintenance">Maintenance</Link>
            </div>
          </div>
        </article>
      </div>
      <div className={styles.bottom}>
        <section className="card" aria-label="Properties">
          <div className="card-header">
            <h2>Properties</h2>
            <Link href="/properties">All properties</Link>
          </div>
          {dashboard.properties.length ? (
            <ul className={styles.propertyList}>
              {dashboard.properties.map((property) => (
                <li key={property.id}>
                  <Link className={styles.propertyRow} href={`/properties/${property.id}`}>
                    {property.cover.coverPhotoId ? (
                      <MiniCover cover={property.cover} />
                    ) : (
                      <span className={styles.building} aria-hidden="true">
                        <Icon name="properties" />
                      </span>
                    )}
                    <span className={styles.propertyName}>
                      <strong>{property.name}</strong>
                      <small>{property.address}</small>
                    </span>
                    <span className={styles.propertyUnits}>
                      {property.occupied} of {property.unitCount} units
                    </span>
                    <span className={styles.bar} aria-hidden="true">
                      <span style={{ width: `${property.occupancyPercent}%` }} />
                    </span>
                    <span className={styles.pct}>{property.occupancyPercent}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              No properties yet. <Link href="/properties?add=1">Add your first property</Link>.
            </p>
          )}
        </section>
        <article className={styles.activityPanel}>
          <div className="card-header">
            <h2>Recent activity</h2>
            <Link href="/payments">View payments</Link>
          </div>
          {dashboard.activity.length ? (
            <ul className={styles.activity}>
              {dashboard.activity.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className={styles.activityRow}>
                  <span className={styles.smallAvatar} aria-hidden="true">
                    {/* Applications describe the person; payments start with the amount, so use the title's name. */}
                    {initialsOf(/^[A-Za-z]/.test(item.description) ? item.description : item.title)}
                  </span>
                  <div className={styles.activityBody}>
                    <span className={styles.eventTitle}>
                      {item.title}
                    </span>
                    <small>
                      {item.description} · {item.propertyName} · {item.unitLabel} · {shortDate(item.happenedAt)}
                    </small>
                  </div>
                  <Badge tone={item.tone === 'success' ? 'success' : 'info'}>
                    {item.status === 'Review' ? 'Needs review' : item.status}
                  </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>New payments and lease updates will appear here.</p>
          )}
        </article>
      </div>
    </section>
  );
}

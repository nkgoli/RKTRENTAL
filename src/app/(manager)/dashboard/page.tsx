import Link from 'next/link';
import { MiniCover } from '@/components/dashboard/MiniCover';
import { loadDashboardView, initialsOf } from '@/components/dashboard/assemble';
import { trendOf } from '@/components/dashboard/trend';
import { CollectionChart } from '@/components/dashboard/CollectionChart';
import { AvatarStack, OccupancyRing, TrendChip } from '@/components/ui';
import { collectionRangeFrom } from '@/lib/dashboard/queries';
import { requireManagerRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

const dateFmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const shortDate = (date: Date) => dateFmt(date, { month: 'short', day: 'numeric' });
const fullDate = (date: Date) => dateFmt(date, { month: 'short', day: 'numeric', year: 'numeric' });

function when(date: Date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireManagerRole();
  const now = new Date();
  const range = collectionRangeFrom((await searchParams).range);
  const dashboard = await loadDashboardView(session.organizationId, now, undefined, formatUsd, range);
  const collectionPercent = dashboard.rentDueCents
    ? Math.min(100, Math.round((dashboard.rentCollectedCents / dashboard.rentDueCents) * 100))
    : 0;
  const collectedSeries = dashboard.collection.map((month) => month.collectedCents);
  const trend = trendOf(collectedSeries);
  const outstandingCents = Math.max(0, dashboard.rentDueCents - dashboard.rentCollectedCents);

  return (
    <section className={styles.dashboard} aria-label="Manager dashboard">
      <section className={styles.split}>
        <article className={`card ${styles.numbers}`}>
          <div className="card-header">
            <div>
              <p className={styles.eyebrow}>{dashboard.monthLabel}</p>
              <h3>Rent collection this month</h3>
            </div>
            <Link href="/payments">Open payments</Link>
          </div>
          <div className={styles.numbersTop}>
            <div>
              <div className={styles.bigValue}>{formatUsd(dashboard.rentCollectedCents)}</div>
              <p className={styles.note}>
                of {formatUsd(dashboard.rentDueCents)} due ·{' '}
                {trend && <TrendChip warm={trend.warm}>{trend.label}</TrendChip>}
              </p>
            </div>
            <OccupancyRing value={collectionPercent} label={`${collectionPercent}% of rent collected`} />
          </div>
          <CollectionChart months={dashboard.collection} range={range} />
          <p className={styles.note} style={{ margin: '4px 0 14px' }}>
            {dashboard.collection[0]?.label}
            {dashboard.collection.length > 12 ? ` ${dashboard.collection[0]?.key.slice(0, 4)}` : ''}–
            {dashboard.collection.at(-1)?.label} collected against rent due
          </p>
          <dl className={styles.facts}>
            <div>
              <dt>Collected</dt>
              <dd>{formatUsd(dashboard.rentCollectedCents)}</dd>
            </div>
            <div>
              <dt>Unpaid this month</dt>
              <dd>{formatUsd(outstandingCents)}</dd>
            </div>
            <div>
              <dt>Past due</dt>
              <dd className={dashboard.overdueCents ? styles.bad : undefined}>
                {formatUsd(dashboard.overdueCents)}
              </dd>
            </div>
            <div>
              <dt>Occupancy</dt>
              <dd>{dashboard.occupancyPercent}%</dd>
            </div>
          </dl>
        </article>

        <article className="card">
          <div className="card-header">
            <h3>Leases expiring soon</h3>
            <Link href="/leases?tab=expiring">View all</Link>
          </div>
          {dashboard.expiringLeases.length ? (
            <ol className={styles.timeline}>
              {dashboard.expiringLeases.map((lease) => (
                <li key={lease.id} className={lease.daysUntil <= 60 ? styles.soon : undefined}>
                  <span className={styles.dot} aria-hidden="true" />
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
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-header">
            <h3>Needs attention</h3>
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
                  <AvatarStack initials={dashboard.pastDueTenants.map((tenant) => tenant.initials)} />
                </div>
                <Link href="/payments?filter=late">Review balances</Link>
              </div>
            ) : (
              <div className={`${styles.alert} ${styles.successAlert}`}>No overdue rent balances.</div>
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
                  {dashboard.openMaintenanceRequests} open · {dashboard.urgentMaintenanceRequests} urgent
                </p>
              </div>
              <Link href="/maintenance">Maintenance</Link>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <h3>Recent activity</h3>
            <Link href="/payments">All activity</Link>
          </div>
          {dashboard.activity.length ? (
            <ul className={styles.activity}>
              {dashboard.activity.map((item) => (
                <li key={item.id}>
                  <span className={styles.smallAvatar} aria-hidden="true">
                    {/* Applications describe the person; payments start with the amount, so use the title's name. */}
                    {initialsOf(/^[A-Za-z]/.test(item.description) ? item.description : item.title)}
                  </span>
                  <div className={styles.activityBody}>
                    <Link className={styles.eventTitle} href={item.href}>
                      {item.title}
                    </Link>
                    <small>
                      {item.description} · <Link href={item.propertyHref}>{item.propertyName}</Link> ·{' '}
                      <Link href={item.unitHref}>{item.unitLabel}</Link> · {when(item.happenedAt)}
                    </small>
                  </div>
                  <span className={`${styles.badge} ${styles[`${item.tone}Badge`]}`}>{item.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>New payments and lease updates will appear here.</p>
          )}
        </article>
      </section>

      <section className="card" aria-label="Properties">
        <div className="card-header">
          <h3>Properties</h3>
          <Link href="/properties">All properties</Link>
        </div>
        {dashboard.properties.length ? (
          <ul className={styles.propertyList}>
            {dashboard.properties.map((property) => (
              <li key={property.id}>
                <Link className={styles.propertyRow} href={`/properties/${property.id}`}>
                  <MiniCover cover={property.cover} />
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
    </section>
  );
}


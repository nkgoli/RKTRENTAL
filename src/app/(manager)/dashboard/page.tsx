import Link from 'next/link';
import { requireManagerRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger';
import { loadDashboardData } from '@/lib/dashboard/queries';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

function shortDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function fullDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function chartHeight(value: number, max: number) {
  return Math.max(3, Math.round((value / max) * 164));
}

function when(date: Date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export default async function DashboardPage() {
  const session = await requireManagerRole();
  const now = new Date();
  const dashboard = await loadDashboardData(session.organizationId, now);
  const maxRent = Math.max(1, ...dashboard.collection.flatMap((month) => [month.dueCents, month.collectedCents]));
  const givenName = session.name.trim().split(/\s+/)[0] || 'there';
  const collectionPercent = dashboard.rentDueCents
    ? Math.min(100, Math.round((dashboard.rentCollectedCents / dashboard.rentDueCents) * 100))
    : 0;

  return (
    <section className={styles.dashboard} aria-label="Manager dashboard">
      <section className={styles.hero} aria-label="Portfolio summary">
        <div>
          <p className={styles.eyebrow}>{dashboard.monthLabel}</p>
          <h2>Good morning, {givenName}</h2>
          <p>
            {dashboard.unitsOccupied} of {dashboard.unitsTotal} units occupied across{' '}
            {dashboard.propertyCount} {dashboard.propertyCount === 1 ? 'property' : 'properties'}.{' '}
            {formatUsd(dashboard.rentCollectedCents)} of {formatUsd(dashboard.rentDueCents)} rent
            collected so far this month.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.secondaryButton} href="/payments">
            Review payments
          </Link>
          <Link className={styles.primaryButton} href="/properties">
            + Add property
          </Link>
        </div>
      </section>

      <section className={styles.stats} aria-label="Portfolio metrics">
        <article className={styles.card}>
          <div className={styles.statLabel}>Rent collected</div>
          <div className={styles.statValue}>{formatUsd(dashboard.rentCollectedCents)}</div>
          <div className={styles.statNote}>
            {collectionPercent}% of {formatUsd(dashboard.rentDueCents)} due
          </div>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Rent collected this month"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={collectionPercent}
          >
            <span style={{ width: `${collectionPercent}%` }} />
          </div>
        </article>
        <article className={styles.card}>
          <div className={styles.statLabel}>Occupancy</div>
          <div className={styles.statValue}>{dashboard.occupancyPercent}%</div>
          <div className={styles.statNote}>
            {dashboard.unitsOccupied} of {dashboard.unitsTotal} units ·{' '}
            {dashboard.unitsTotal - dashboard.unitsOccupied} vacant
          </div>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Portfolio occupancy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={dashboard.occupancyPercent}
          >
            <span style={{ width: `${dashboard.occupancyPercent}%` }} />
          </div>
        </article>
        <article className={styles.card}>
          <div className={styles.statLabel}>Overdue</div>
          <div className={styles.statValue}>{formatUsd(dashboard.overdueCents)}</div>
          <div className={styles.statNote}>
            {dashboard.overdueLeaseCount} {dashboard.overdueLeaseCount === 1 ? 'lease' : 'leases'}
            {' past grace'}
          </div>
          <div className={`${styles.progress} ${styles.dangerProgress}`}>
            <span style={{ width: `${Math.min(100, Math.round((dashboard.overdueCents / Math.max(1, dashboard.rentDueCents)) * 100))}%` }} />
          </div>
        </article>
        <article className={styles.card}>
          <div className={styles.statLabel}>Open applications</div>
          <div className={styles.statValue}>{dashboard.openApplications}</div>
          <div className={styles.statNote}>Awaiting review or screening</div>
          <div className={styles.statLink}>
            <Link href="/applications">Review applicants <span aria-hidden="true">→</span></Link>
          </div>
        </article>
      </section>

      <section className={styles.split}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Rent collection</h3>
            <div className={styles.legend} aria-label="Chart legend">
              <span><i className={styles.dueDot} /> Due</span>
              <span><i className={styles.collectedDot} /> Collected</span>
            </div>
          </div>
          <svg
            className={styles.chart}
            viewBox="0 0 640 240"
            role="img"
            aria-label="Rent collected versus due for the last six months"
          >
            <g className={styles.gridLines}>
              {[20, 70, 120, 170, 210].map((y) => <line key={y} x1="42" y1={y} x2="630" y2={y} />)}
            </g>
            <g className={styles.axisLabels}>
              {[20, 70, 120, 170].map((y, index) => (
                <text key={y} x="0" y={y + 4}>
                  {formatUsd(Math.round((maxRent * (4 - index)) / 4)).replace(/\.00$/, '')}
                </text>
              ))}
            </g>
            {dashboard.collection.map((month, index) => {
              const x = 64 + index * 96;
              const dueHeight = chartHeight(month.dueCents, maxRent);
              const collectedHeight = chartHeight(month.collectedCents, maxRent);
              return (
                <g key={month.key}>
                  <rect
                    className={styles.dueBar}
                    x={x}
                    y={210 - dueHeight}
                    width="28"
                    height={dueHeight}
                    rx="3"
                  />
                  <rect
                    className={styles.collectedBar}
                    x={x + 32}
                    y={210 - collectedHeight}
                    width="28"
                    height={collectedHeight}
                    rx="3"
                  />
                  <text className={styles.monthLabel} x={x + 29} y="232" textAnchor="middle">
                    {month.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className={styles.chartFooter}>
            <span>Rent collected</span>
            <span>Due</span>
            <span className={styles.inProgress}>{dashboard.monthLabel}, in progress</span>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Leases expiring soon</h3>
            <Link href="/leases">View all</Link>
          </div>
          {dashboard.expiringLeases.length ? (
            <ul className={styles.expiringList}>
              {dashboard.expiringLeases.map((lease) => (
                <li key={lease.id}>
                  <span className={styles.avatar} aria-hidden="true">{initials(lease.tenantName)}</span>
                  <div className={styles.expiringDetails}>
                    <Link className={styles.tenantLink} href={`/leases/${lease.id}`}>
                      {lease.tenantName}
                    </Link>
                    <div className={styles.muted}>
                      <Link href={`/properties/${lease.propertyId}`}>{lease.propertyName}</Link> ·{' '}
                      <Link href={`/properties/${lease.propertyId}/units/${lease.unitId}`}>{lease.unitLabel}</Link> · {formatUsd(lease.rentCents)}
                    </div>
                  </div>
                  <Link
                    className={`${styles.badge} ${lease.daysUntil <= 60 ? styles.warningBadge : styles.infoBadge}`}
                    href={`/leases/${lease.id}`}
                    aria-label={`${lease.tenantName}, lease ends ${fullDate(lease.endDate)}, in ${lease.daysUntil} days`}
                  >
                    {shortDate(lease.endDate)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No active leases end in the next 90 days.</p>
          )}
        </article>
      </section>

      <section className={styles.split}>
        <article className={`${styles.card} ${styles.tableCard}`}>
          <div className={styles.cardHeader}>
            <h3>Recent activity</h3>
            <Link href="/payments">All activity</Link>
          </div>
          {dashboard.activity.length ? (
            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Event</th><th>Property / unit</th><th>When</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {dashboard.activity.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.eventCell}>
                          <span className={styles.smallAvatar} aria-hidden="true">{initials(item.description)}</span>
                          <div>
                            <Link className={styles.eventTitle} href={item.href}>{item.title}</Link>
                            <small>{item.description}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Link href={item.propertyHref}>{item.propertyName}</Link> ·{' '}
                        <Link href={item.unitHref}>{item.unitLabel}</Link>
                      </td>
                      <td>{when(item.happenedAt)}</td>
                      <td><span className={`${styles.badge} ${styles[`${item.tone}Badge`]}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>New payments and lease updates will appear here.</p>
          )}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}><h3>Needs attention</h3></div>
          <div className={styles.attentionList}>
            {dashboard.overdueLeaseCount ? (
              <div className={`${styles.alert} ${styles.warningAlert}`}>
                {dashboard.overdueLeaseCount} {dashboard.overdueLeaseCount === 1 ? 'lease is' : 'leases are'} past due.{' '}
                <Link href="/payments">Review balances</Link>
              </div>
            ) : (
              <div className={`${styles.alert} ${styles.successAlert}`}>No overdue rent balances.</div>
            )}
            <div className={styles.alert}>
              {dashboard.openApplications} open {dashboard.openApplications === 1 ? 'application' : 'applications'}.{' '}
              <Link href="/applications">Review</Link>
            </div>
            <div className={`${styles.alert} ${styles.placeholderAlert}`}>
              <div>
                <strong>Maintenance metrics</strong>
                <p>Open repair totals will appear when the maintenance dashboard is ready.</p>
              </div>
              <Link href="/maintenance">Maintenance</Link>
            </div>
            <Link className={styles.secondaryButton} href="/properties">Open portfolio</Link>
          </div>
        </article>
      </section>
    </section>
  );
}

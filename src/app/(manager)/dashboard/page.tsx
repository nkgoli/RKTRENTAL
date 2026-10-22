import Link from 'next/link';
import { Icon } from '@/components/shell/Icons';
import { loadDashboardView, initialsOf } from '@/components/dashboard/assemble';
import { CollectionChart } from '@/components/dashboard/CollectionChart';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { Avatar, Badge, type BadgeTone } from '@/components/ui';
import { SummaryBand } from '@/components/ui/SummaryBand';
import { collectionRangeFrom, EXPIRING_WINDOW_DAYS } from '@/lib/dashboard/queries';
import { requireManagerRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

const dateFmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const shortDate = (date: Date) => dateFmt(date, { month: 'short', day: 'numeric' });
const fullDate = (date: Date) => dateFmt(date, { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
const wholeUsd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  });

/** Application activity uses the Applications page's own status words. */
const activityStatus: Record<string, { label: string; tone: BadgeTone; title?: string }> = {
  Submitted: { label: 'Awaiting consent', tone: 'neutral' },
  Screening: { label: 'Screening', tone: 'warning', title: 'Application in screening' },
  Review: { label: 'Ready', tone: 'success', title: 'Ready for decision' },
  Approved: { label: 'Approved', tone: 'success' },
  Declined: { label: 'Declined', tone: 'danger' },
  Paid: { label: 'Paid', tone: 'success' },
  Signed: { label: 'Signed', tone: 'success' },
};

function listNames(names: string[]) {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

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
  const { rentRoll, applicationStatusCounts: apps, urgentRequest } = dashboard;
  const needsCount =
    (rentRoll.lateCount ? 1 : 0) + (dashboard.openApplications ? 1 : 0) + (urgentRequest ? 1 : 0);
  const vacant = Math.max(0, dashboard.unitsTotal - dashboard.unitsOccupied);
  const appBreakdown = [
    apps.SUBMITTED && `${apps.SUBMITTED} awaiting consent`,
    apps.SCREENING && `${apps.SCREENING} screening`,
    apps.REVIEW && `${apps.REVIEW} ready for decision`,
  ].filter(Boolean);
  const urgentPlace = urgentRequest
    ? [urgentRequest.propertyName, urgentRequest.unitLabel].filter(Boolean).join(' ')
    : '';

  return (
    <section className={styles.dashboard} aria-label="Manager dashboard">
      <HomeHeader
        firstName={(session.name ?? '').split(/\s+/)[0] ?? ''}
        propertyCount={dashboard.propertyCount}
        unitCount={dashboard.unitsTotal}
        needsCount={needsCount}
        actions={[
          { label: 'View reports', href: '/returns', icon: 'download' },
          { label: 'Add property', href: '/properties?add=1', primary: true, icon: 'plus' },
        ]}
      />
      <SummaryBand
        label="Rent collection"
        eyebrow={`${dashboard.monthLabel} · Rent collection`}
        value={wholeUsd(dashboard.rentCollectedCents)}
        detail={
          dashboard.rentDueCents
            ? `collected of ${wholeUsd(dashboard.rentDueCents)} due this month`
            : 'No rent is due this month'
        }
        progress={{
          label: `${collectionPercent}% collected · month to date`,
          value: collectionPercent,
          valueText: dashboard.rentDueCents
            ? `${formatUsd(dashboard.rentCollectedCents)} of ${formatUsd(dashboard.rentDueCents)} collected`
            : 'No rent due this month',
        }}
        footer={
          <>
            {rentRoll.openCount ? (
              <span className="danger">
                {wholeUsd(rentRoll.openCents)} open across {plural(rentRoll.openCount, 'lease')}
                {rentRoll.lateCount ? ` · ${rentRoll.lateCount} late past grace` : ''}
              </span>
            ) : (
              <span className="muted">No open rent balances</span>
            )}
            <Link className="btn btn-primary btn-sm" href="/payments">
              <Icon name="arrow-right" />
              Open rent roll
            </Link>
          </>
        }
        stats={[
          {
            label: 'Portfolio occupancy',
            value: `${dashboard.occupancyPercent}%`,
            detail: `${dashboard.unitsOccupied} of ${dashboard.unitsTotal} units occupied`,
            href: '/properties',
          },
          {
            label: `Leases ending within ${EXPIRING_WINDOW_DAYS} days`,
            value: dashboard.expiringSoonCount,
            detail: `${dashboard.endingWithin60Count} ${dashboard.endingWithin60Count === 1 ? 'ends' : 'end'} in the next 60 days`,
            href: '/leases?tab=expiring',
          },
          {
            label: 'Open repairs',
            value: dashboard.openMaintenanceRequests,
            detail: urgentRequest
              ? `${dashboard.urgentMaintenanceRequests} urgent · ${urgentRequest.title}`
              : `${dashboard.urgentMaintenanceRequests} urgent`,
            href: '/maintenance',
          },
        ]}
      />

      <div className={styles.mainRow}>
        <section className={`card ${styles.needs}`} aria-labelledby="needs-heading">
          <h2 id="needs-heading" className={styles.needsTitle}>
            <Icon name="bell" />
            Needs you today
          </h2>
          <div className={styles.needItem}>
            <p className={`eyebrow ${styles.danger}`}>Late · past grace</p>
            {rentRoll.lateCount ? (
              <>
                <h3>
                  {plural(rentRoll.lateCount, 'lease')} late · {wholeUsd(rentRoll.lateCents)}
                </h3>
                <p className={styles.small}>
                  {listNames(rentRoll.lateTenants)}. {wholeUsd(rentRoll.openCents)} is open across{' '}
                  {plural(rentRoll.openCount, 'lease')} in all, including scheduled autopay. Review
                  each ledger before any reminder goes out.
                </p>
                <Link className={styles.itemLink} href="/payments?filter=late">
                  Review late rent →
                </Link>
              </>
            ) : (
              <>
                <h3>No rent is late</h3>
                <p className={styles.small}>
                  {rentRoll.openCount
                    ? `${wholeUsd(rentRoll.openCents)} is open across ${plural(rentRoll.openCount, 'lease')}, none past grace.`
                    : 'Every lease is paid up for this month.'}
                </p>
                <Link className={styles.itemLink} href="/payments">
                  Open rent roll →
                </Link>
              </>
            )}
          </div>
          <div className={styles.needItem}>
            <p className={`eyebrow ${styles.accent}`}>Leasing</p>
            <h3>{plural(dashboard.openApplications, 'open application')}</h3>
            {appBreakdown.length > 0 && <p className={styles.small}>{appBreakdown.join(' · ')}</p>}
            <Link className={styles.itemLink} href="/applications">
              Review applicants →
            </Link>
          </div>
          <div className={styles.needItem}>
            <p className={`eyebrow ${urgentRequest ? styles.danger : ''}`}>
              {urgentRequest ? 'Urgent repair' : 'Repairs'}
            </p>
            {urgentRequest ? (
              <>
                <h3>
                  {urgentRequest.title} · {urgentPlace}
                </h3>
                <p className={styles.small}>
                  {urgentRequest.assigned ? 'Vendor assigned' : 'Unassigned'} since{' '}
                  {shortDate(urgentRequest.createdAt)}
                  {urgentRequest.photoCount
                    ? ` · ${plural(urgentRequest.photoCount, 'photo')} attached`
                    : ''}
                </p>
                <Link
                  className={styles.itemLink}
                  href={`/maintenance/${encodeURIComponent(urgentRequest.id)}/edit`}
                >
                  {urgentRequest.assigned ? 'Open request →' : 'Assign a vendor →'}
                </Link>
              </>
            ) : (
              <>
                <h3>No urgent repairs</h3>
                <p className={styles.small}>
                  {plural(dashboard.openMaintenanceRequests, 'open request')}
                </p>
                <Link className={styles.itemLink} href="/maintenance">
                  Open maintenance →
                </Link>
              </>
            )}
          </div>
        </section>

        <div className={styles.sideColumn}>
          <section className="card" aria-labelledby="history-heading">
            <div className={styles.cardHead}>
              <div>
                <h2 id="history-heading">Collection history</h2>
                <p className={styles.caption}>
                  Collected against rent due · USD ·{' '}
                  {dashboard.monthLabel.split(' ')[0]?.slice(0, 3)} is month to date
                </p>
              </div>
            </div>
            <CollectionChart months={dashboard.collection} range={range} />
          </section>

          <section className="card" aria-labelledby="occupancy-heading">
            <div className={styles.cardHead}>
              <h2 id="occupancy-heading">Occupancy by property</h2>
              <Link className="section-link" href="/properties">
                All properties →
              </Link>
            </div>
            {dashboard.properties.length ? (
              <ul className={styles.occupancy}>
                {dashboard.properties.map((property) => (
                  <li key={property.id}>
                    <Link href={`/properties/${property.id}`}>
                      <span>
                        {property.name} · {property.occupied} of {property.unitCount} ·{' '}
                        {property.occupancyPercent}%
                      </span>
                      <span
                        className={styles.bar}
                        role="meter"
                        aria-label={`${property.name} occupancy`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={property.occupancyPercent}
                      >
                        <span style={{ width: `${property.occupancyPercent}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                No properties yet. <Link href="/properties?add=1">Add your first property</Link>.
              </p>
            )}
            {dashboard.properties.length > 0 && (
              <p className={styles.caption}>
                {vacant
                  ? `${plural(vacant, 'vacant unit')} ready to list or turn over`
                  : 'Every unit is occupied'}
              </p>
            )}
          </section>
        </div>
      </div>

      <div className={styles.listRow}>
        <section className="card" aria-labelledby="renewals-heading">
          <div className={styles.cardHead}>
            <h2 id="renewals-heading">Renewals ahead</h2>
            <Link
              className="section-link"
              href="/leases?tab=expiring"
              aria-label={`View all ${dashboard.expiringSoonCount} leases ending within ${EXPIRING_WINDOW_DAYS} days`}
            >
              View all {dashboard.expiringSoonCount} →
            </Link>
          </div>
          {dashboard.expiringLeases.length ? (
            <ul className={styles.rows}>
              {dashboard.expiringLeases.slice(0, 4).map((lease) => (
                <li key={lease.id}>
                  <Avatar initials={initialsOf(lease.tenantName)} size="sm" />
                  <span className={styles.rowBody}>
                    <Link className={styles.rowTitle} href={`/leases/${lease.id}`}>
                      {lease.tenantName}
                    </Link>
                    <small>
                      <Link href={`/properties/${lease.propertyId}`}>{lease.propertyName}</Link> ·{' '}
                      <Link href={`/properties/${lease.propertyId}/units/${lease.unitId}`}>
                        {lease.unitLabel}
                      </Link>{' '}
                      · {formatUsd(lease.rentCents).replace(/\.00$/, '')}
                    </small>
                  </span>
                  <span
                    aria-label={`Lease ends ${fullDate(lease.endDate)}, in ${lease.daysUntil} days`}
                  >
                    <Badge tone={lease.daysUntil < 60 ? 'warning' : 'info'}>
                      {shortDate(lease.endDate)} · {lease.daysUntil} days
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              No active leases end in the next {EXPIRING_WINDOW_DAYS} days.
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="activity-heading">
          <div className={styles.cardHead}>
            <h2 id="activity-heading">Recent activity</h2>
            <Link className="section-link" href="/payments">
              View payments →
            </Link>
          </div>
          {dashboard.activity.length ? (
            <ul className={styles.rows}>
              {dashboard.activity.slice(0, 5).map((item) => {
                const status = activityStatus[item.status] ?? {
                  label: item.status,
                  tone: item.tone === 'success' ? 'success' : 'info',
                };
                return (
                  <li key={item.id}>
                    <Avatar
                      initials={initialsOf(
                        /^[A-Za-z]/.test(item.description) ? item.description : item.title,
                      )}
                      size="sm"
                    />
                    <span className={styles.rowBody}>
                      <Link className={styles.rowTitle} href={item.href}>
                        {status.title ?? item.title}
                      </Link>
                      <small>
                        {item.description} · {item.propertyName} {item.unitLabel} ·{' '}
                        {shortDate(item.happenedAt)}
                      </small>
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.empty}>New payments and lease updates will appear here.</p>
          )}
        </section>
      </div>
    </section>
  );
}

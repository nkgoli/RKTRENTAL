import Link from 'next/link';
import { Badge } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import type { SegmentKind, Timeline, TimelineRow, TimelineSegment } from '@/lib/workspace/timeline';
import { leaseStatusLabel, leaseTiming } from '@/lib/workspace/timeline';
import { formatDate } from '@/lib/properties/format';
import styles from './LeaseTimeline.module.css';

const statusTone: Record<SegmentKind, BadgeTone> = {
  current: 'success',
  next: 'info',
  draft: 'warning',
  past: 'neutral',
  vacant: 'neutral',
};

function leaseHref(segment: TimelineSegment, propertyId: string, unitId: string) {
  if (!segment.leaseId) return undefined;
  const params = new URLSearchParams({ propertyId, unitId });
  return `/leases/${segment.leaseId}?${params.toString()}`;
}

function LeaseDates({ segment }: { segment: TimelineSegment }) {
  return (
    <dl className={styles.dates}>
      <div><dt>Start</dt><dd>{formatDate(segment.start)}</dd></div>
      <div><dt>End</dt><dd>{formatDate(segment.end)}</dd></div>
    </dl>
  );
}

function LeaseSummary({ segment, today, propertyId, unitId, showTenant, showDates, showLink }: {
  segment: TimelineSegment;
  today: Date;
  propertyId: string;
  unitId: string;
  showTenant: boolean;
  showDates: boolean;
  showLink: boolean;
}) {
  const href = leaseHref(segment, propertyId, unitId);
  return (
    <div className={styles.lease}>
      <div className={styles.leaseTop}>
        <Badge tone={statusTone[segment.kind]}>{leaseStatusLabel(segment.kind)}</Badge>
        {showTenant && <span className={styles.tenant}>{segment.tenantName ?? 'No tenant'}</span>}
        <span className={styles.timing}>{leaseTiming(segment.kind, segment.start, segment.end, today)}</span>
        {showLink && href && <Link className={styles.viewLease} href={href}>View lease</Link>}
      </div>
      {showDates && <LeaseDates segment={segment} />}
    </div>
  );
}

function LeaseRow({ row, timeline, propertyId, linkUnits, compact }: {
  row: TimelineRow;
  timeline: Timeline;
  propertyId: string;
  linkUnits: boolean;
  compact: boolean;
}) {
  const leases = row.segments.filter((segment) => segment.kind !== 'vacant');
  const current = leases.find((segment) => segment.kind === 'current');
  const next = leases.find((segment) => segment.kind === 'next');
  const drafts = leases.filter((segment) => segment.kind === 'draft');
  const past = leases
    .filter((segment) => segment.kind === 'past')
    .sort((a, b) => b.end.getTime() - a.end.getTime());
  const primary = current ?? next ?? drafts[0] ?? null;
  const others = leases.filter((segment) => segment !== primary);
  const latestPast = past[0];
  const unitHref = `/properties/${propertyId}?unit=${encodeURIComponent(row.unitId)}`;
  const createHref = `/leases/new?unit=${encodeURIComponent(row.unitId)}`;
  const otherKinds = [...new Set(others.map((segment) => leaseStatusLabel(segment.kind)))];
  const historyLabel = others.every((segment) => segment.kind === 'past')
    ? `Lease history (${others.length})`
    : `Other leases (${others.length}) · ${otherKinds.join(', ')}`;

  return (
    <li className={styles.row} data-unit-row={row.unitId}>
      <div className={styles.rowHead}>
        <span className={styles.unitLabel}>
          {linkUnits ? <Link href={unitHref}>{row.label}</Link> : row.label}
        </span>
        {!primary && <Badge tone={statusTone.vacant}>Vacant</Badge>}
        <span className={styles.sr} data-testid="timeline-today" aria-hidden="true">As of {formatDate(timeline.today)}</span>
      </div>
      {primary ? (
        <LeaseSummary
          segment={primary}
          today={timeline.today}
          propertyId={propertyId}
          unitId={row.unitId}
          showTenant={!compact || primary.kind !== 'current'}
          showDates={!compact || primary.kind !== 'current'}
          showLink={!compact || primary.kind !== 'current'}
        />
      ) : (
        <div className={styles.vacant}>
          <strong>{latestPast ? 'No current lease' : 'No lease on file'}</strong>
          {latestPast && <span>{leaseTiming('past', latestPast.start, latestPast.end, timeline.today)}</span>}
          {!compact && <Link className={styles.createLease} href={createHref}>Create lease</Link>}
        </div>
      )}
      {others.length > 0 && (
        <details className={styles.history}>
          <summary>{historyLabel}</summary>
          <ul className={styles.historyList}>
            {others.map((segment, index) => (
              <li className={styles.historyItem} key={`${segment.kind}-${segment.leaseId ?? index}`}>
                <LeaseSummary
                  segment={segment}
                  today={timeline.today}
                  propertyId={propertyId}
                  unitId={row.unitId}
                  showTenant
                  showDates
                  showLink
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/**
 * Compact lease summary for property and unit overviews: one row per unit, with explicit status,
 * readable start/end dates, date-relative wording and scoped lease links. History and extra units
 * stay behind compact disclosures.
 */
export function LeaseTimeline({ timeline, propertyId, linkUnits = false, limit = 5 }: {
  timeline: Timeline;
  propertyId: string;
  /** Link each row's label to that unit (property view only). */
  linkUnits?: boolean;
  /** Rows shown before the rest collapse behind "Show all". */
  limit?: number;
}) {
  const renderRow = (row: TimelineRow) => (
    <LeaseRow
      key={row.unitId}
      row={row}
      timeline={timeline}
      propertyId={propertyId}
      linkUnits={linkUnits}
      compact={!linkUnits && row.label !== 'Whole property'}
    />
  );
  const visible = timeline.rows.slice(0, limit);
  const rest = timeline.rows.slice(limit);

  return (
    <div className={styles.timeline} data-testid="lease-timeline">
      <p className={styles.asOf}>As of {formatDate(timeline.today)}</p>
      {timeline.rows.length === 0 && <p className={styles.empty}>No units yet.</p>}
      <ul className={styles.rows}>{visible.map(renderRow)}</ul>
      {rest.length > 0 && (
        <details className={styles.more}>
          <summary>Show all {timeline.rows.length} units</summary>
          <ul className={styles.rows}>{rest.map(renderRow)}</ul>
        </details>
      )}
    </div>
  );
}

import Link from 'next/link';
import type { Timeline, TimelineSegment } from '@/lib/workspace/timeline';
import { formatDate, formatMoney } from '@/lib/properties/format';
import styles from './LeaseTimeline.module.css';

const kindLabel: Record<TimelineSegment['kind'], string> = {
  past: 'Past lease', current: 'Current lease', next: 'Next lease', draft: 'Draft lease', vacant: 'Vacant',
};

const monthYear = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function segmentTitle(segment: TimelineSegment) {
  const term = `${formatDate(segment.start)} – ${formatDate(segment.end)}`;
  if (segment.kind === 'vacant') return `Vacant · ${term}`;
  return `${kindLabel[segment.kind]} · ${segment.tenantName ?? 'No tenant'} · ${term} · ${formatMoney(segment.monthlyRent)}/mo`;
}

/** Leases and vacant gaps on one date axis with a today marker; one row per unit in scope. */
export function LeaseTimeline({ timeline, propertyId, linkUnits = false, limit = 5 }: {
  timeline: Timeline;
  propertyId: string;
  /** Link each row's label to that unit (property view only). */
  linkUnits?: boolean;
  /** Rows shown before the rest collapse behind "Show all". */
  limit?: number;
}) {
  const renderRow = (row: Timeline['rows'][number]) => <div className={styles.row} key={row.unitId} data-unit-row={row.unitId}>
        <div className={styles.rowLabel}>
          {linkUnits ? <Link href={`/properties/${propertyId}?unit=${encodeURIComponent(row.unitId)}`}>{row.label}</Link> : row.label}
        </div>
        <div className={styles.track}>
          {row.segments.map((segment, index) => {
            const href = segment.leaseId ? `/leases/${segment.leaseId}` : undefined;
            const style = { left: `${segment.left}%`, width: `${segment.width}%` };
            const body = <>
              <span className={styles.segmentText}>{segment.kind === 'vacant' ? 'Vacant' : segment.tenantName ?? kindLabel[segment.kind]}</span>
              <span className={styles.sr}>{segmentTitle(segment)}</span>
            </>;
            return href
              ? <Link key={`${segment.kind}-${index}`} href={href} className={styles.segment} data-kind={segment.kind} style={style} title={segmentTitle(segment)}>{body}</Link>
              : <span key={`${segment.kind}-${index}`} className={styles.segment} data-kind={segment.kind} style={style} title={segmentTitle(segment)}>{body}</span>;
          })}
          <span className={styles.today} style={{ left: `${timeline.todayPct}%` }} data-testid="timeline-today" aria-hidden="true" />
        </div>
      </div>;

  return <div className={styles.timeline} data-testid="lease-timeline">
    <ul className={styles.legend} aria-label="Timeline legend">
      <li data-kind="current">Current</li><li data-kind="next">Next</li><li data-kind="draft">Draft</li>
      <li data-kind="past">Past</li><li data-kind="vacant">Vacant</li>
    </ul>
    <div className={styles.rows}>
      {timeline.rows.length === 0 && <p className="muted">No units yet.</p>}
      {timeline.rows.slice(0, limit).map(renderRow)}
      {timeline.rows.length > limit && <details className={styles.more}>
        <summary>Show all {timeline.rows.length} units</summary>
        <div className={styles.rows}>{timeline.rows.slice(limit).map(renderRow)}</div>
      </details>}
    </div>
    <div className={styles.axis} aria-hidden="true">
      <span>{monthYear(timeline.start)}</span>
      <span className={styles.todayLabel} style={{ left: `${timeline.todayPct}%` }}>Today</span>
      <span>{monthYear(timeline.end)}</span>
    </div>
  </div>;
}

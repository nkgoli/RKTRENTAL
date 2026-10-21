/**
 * Pure rules for the Overview lease summary: each unit's leases as past / current / next / draft
 * entries, with date-relative wording derived from the supplied timeline date.
 */
export type TimelineLease = {
  id: string;
  unitId: string;
  status: 'DRAFT' | 'ACTIVE' | 'ENDED' | 'TERMINATED';
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  tenantName: string | null;
};

export type TimelineUnit = { id: string; label: string };

export type SegmentKind = 'past' | 'current' | 'next' | 'draft' | 'vacant';

export type TimelineSegment = {
  kind: SegmentKind;
  start: Date;
  end: Date;
  /** Left edge and width as percentages of the axis. */
  left: number;
  width: number;
  leaseId?: string;
  tenantName?: string | null;
  monthlyRent?: number;
};

export type TimelineRow = { unitId: string; label: string; segments: TimelineSegment[] };

export type Timeline = {
  start: Date;
  end: Date;
  /** The supplied "now" date, normalized to UTC midnight. */
  today: Date;
  /** Percentage position of today on the axis. */
  todayPct: number;
  rows: TimelineRow[];
};

const DAY = 86_400_000;
const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** Whole days from one calendar day to another, independent of the local time zone. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY);
}

export function leaseKind(lease: Pick<TimelineLease, 'status' | 'startDate' | 'endDate'>, today: number): SegmentKind {
  if (lease.status === 'DRAFT') return 'draft';
  if (lease.status === 'ENDED' || lease.status === 'TERMINATED') return 'past';
  if (lease.endDate.getTime() < today) return 'past';
  if (lease.startDate.getTime() > today) return 'next';
  return 'current';
}

const statusLabels: Record<SegmentKind, string> = {
  current: 'Current',
  next: 'Upcoming',
  draft: 'Draft',
  past: 'Past',
  vacant: 'Vacant',
};

/** Explicit, text-first status for a lease or unit. */
export function leaseStatusLabel(kind: SegmentKind): string {
  return statusLabels[kind];
}

function months(days: number): string {
  const count = Math.max(1, Math.round(days / 30.44));
  return `${count} month${count === 1 ? '' : 's'}`;
}

/**
 * Date-relative wording for a lease, always measured from the timeline's supplied date.
 * A lease that ends today stays current and reads "Ends today"; a lease that ended today
 * reads "Ended today".
 */
export function leaseTiming(kind: SegmentKind, start: Date, end: Date, today: Date): string {
  const startDays = daysBetween(today, start);
  const endDays = daysBetween(today, end);
  switch (kind) {
    case 'current':
      if (endDays <= 0) return 'Ends today';
      if (endDays === 1) return 'Ends tomorrow';
      if (endDays < 60) return `Ends in ${endDays} days`;
      return `${months(endDays)} remaining`;
    case 'next':
      if (startDays <= 0) return 'Starts today';
      if (startDays === 1) return 'Starts tomorrow';
      if (startDays < 60) return `Starts in ${startDays} days`;
      return `Starts in ${months(startDays)}`;
    case 'past':
      if (endDays === 0) return 'Ended today';
      if (endDays === -1) return 'Ended yesterday';
      if (endDays > -60) return `Ended ${Math.abs(endDays)} days ago`;
      return `Ended ${months(Math.abs(endDays))} ago`;
    case 'draft':
      if (startDays > 0) return `Starts in ${startDays < 60 ? `${startDays} days` : months(startDays)} · not signed`;
      return 'Not yet signed';
    case 'vacant':
      return 'No lease on file';
  }
}

/** The unit's present state: a current lease wins, then an upcoming one, then a draft. */
export function unitLeaseStatus(segments: TimelineSegment[]): SegmentKind {
  if (segments.some((segment) => segment.kind === 'current')) return 'current';
  if (segments.some((segment) => segment.kind === 'next')) return 'next';
  if (segments.some((segment) => segment.kind === 'draft')) return 'draft';
  return 'vacant';
}

export function buildTimeline(units: TimelineUnit[], leases: TimelineLease[], now: Date): Timeline {
  const today = utcDay(now);
  // Keep the axis readable when a lease runs for decades: clamp to a window around today.
  const clamp = (time: number) => Math.min(Math.max(time, today - 730 * DAY), today + 1095 * DAY);
  const times = leases.flatMap((l) => [clamp(l.startDate.getTime()), clamp(l.endDate.getTime())]);
  const axisStart = Math.min(today - 90 * DAY, ...times);
  const axisEnd = Math.max(today + 120 * DAY, ...times);
  const span = axisEnd - axisStart || DAY;
  const pct = (time: number) => ((time - axisStart) / span) * 100;
  const segment = (kind: SegmentKind, start: number, end: number, lease?: TimelineLease): TimelineSegment => ({
    kind,
    start: new Date(start),
    end: new Date(end),
    left: pct(clamp(start)),
    width: Math.max(pct(clamp(end)) - pct(clamp(start)), 0.8),
    ...(lease ? { leaseId: lease.id, tenantName: lease.tenantName, monthlyRent: lease.monthlyRent } : {}),
  });

  const rows = units.map((unit): TimelineRow => {
    const own = leases
      .filter((l) => l.unitId === unit.id)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const segments = own.map((lease) =>
      segment(leaseKind(lease, today), lease.startDate.getTime(), lease.endDate.getTime(), lease));
    // Vacant gaps are measured against signed leases only; a draft does not occupy the unit.
    const held = own.filter((l) => l.status !== 'DRAFT');
    let cursor = held.length && held[0].startDate.getTime() <= today ? held[0].startDate.getTime() : axisStart;
    if (!held.length) {
      segments.push(segment('vacant', axisStart, axisEnd));
    } else {
      for (const lease of held) {
        if (lease.startDate.getTime() > cursor + DAY) segments.push(segment('vacant', cursor, lease.startDate.getTime()));
        cursor = Math.max(cursor, lease.endDate.getTime());
      }
      if (cursor < today) segments.push(segment('vacant', cursor, today));
    }
    segments.sort((a, b) => a.start.getTime() - b.start.getTime() || (a.kind === 'vacant' ? -1 : 1));
    return { unitId: unit.id, label: unit.label, segments };
  });

  return { start: new Date(axisStart), end: new Date(axisEnd), today: new Date(today), todayPct: pct(today), rows };
}

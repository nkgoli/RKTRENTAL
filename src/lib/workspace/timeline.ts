/**
 * Pure rules for the Overview unit timeline: each unit's leases as past / current / next / draft bars
 * and the vacant gaps between them, positioned as percentages of one shared date axis.
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
  /** Percentage position of today on the axis. */
  todayPct: number;
  rows: TimelineRow[];
};

const DAY = 86_400_000;
const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export function leaseKind(lease: Pick<TimelineLease, 'status' | 'startDate' | 'endDate'>, today: number): SegmentKind {
  if (lease.status === 'DRAFT') return 'draft';
  if (lease.status === 'ENDED' || lease.status === 'TERMINATED') return 'past';
  if (lease.endDate.getTime() < today) return 'past';
  if (lease.startDate.getTime() > today) return 'next';
  return 'current';
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

  return { start: new Date(axisStart), end: new Date(axisEnd), todayPct: pct(today), rows };
}

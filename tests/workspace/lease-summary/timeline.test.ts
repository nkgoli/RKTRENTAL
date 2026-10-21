import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  daysBetween,
  leaseStatusLabel,
  leaseTiming,
  unitLeaseStatus,
  type TimelineLease,
} from '@/lib/workspace/timeline';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = day('2026-10-21');
const lease = (over: Partial<TimelineLease> & Pick<TimelineLease, 'id' | 'startDate' | 'endDate'>): TimelineLease => ({
  unitId: 'u1', status: 'ACTIVE', monthlyRent: 1650, tenantName: 'Chloe Fisher', ...over,
});

describe('lease summary wording', () => {
  it('counts whole calendar days across month and year boundaries', () => {
    expect(daysBetween(day('2026-10-21'), day('2026-10-21'))).toBe(0);
    expect(daysBetween(day('2026-10-21'), day('2026-10-22'))).toBe(1);
    expect(daysBetween(day('2026-10-21'), day('2026-12-31'))).toBe(71);
    expect(daysBetween(day('2026-10-21'), day('2027-01-01'))).toBe(72);
    expect(daysBetween(day('2026-10-21'), day('2026-10-20'))).toBe(-1);
  });

  it('uses explicit text status for every lease kind', () => {
    expect(leaseStatusLabel('current')).toBe('Current');
    expect(leaseStatusLabel('next')).toBe('Upcoming');
    expect(leaseStatusLabel('draft')).toBe('Draft');
    expect(leaseStatusLabel('past')).toBe('Past');
    expect(leaseStatusLabel('vacant')).toBe('Vacant');
  });

  it('describes a current lease, including the ends-today boundary', () => {
    expect(leaseTiming('current', day('2026-01-01'), day('2026-10-21'), today)).toBe('Ends today');
    expect(leaseTiming('current', day('2026-01-01'), day('2026-10-22'), today)).toBe('Ends tomorrow');
    expect(leaseTiming('current', day('2026-01-01'), day('2026-11-01'), today)).toBe('Ends in 11 days');
    expect(leaseTiming('current', day('2026-01-01'), day('2026-12-31'), today)).toBe('2 months remaining');
  });

  it('describes an upcoming lease with starts-in wording', () => {
    expect(leaseTiming('next', day('2026-10-22'), day('2027-10-21'), today)).toBe('Starts tomorrow');
    expect(leaseTiming('next', day('2026-11-01'), day('2027-10-31'), today)).toBe('Starts in 11 days');
    expect(leaseTiming('next', day('2027-01-01'), day('2027-12-31'), today)).toBe('Starts in 2 months');
  });

  it('describes a past lease with ended wording, including the ended-today boundary', () => {
    expect(leaseTiming('past', day('2025-01-01'), day('2026-10-21'), today)).toBe('Ended today');
    expect(leaseTiming('past', day('2025-01-01'), day('2026-10-20'), today)).toBe('Ended yesterday');
    expect(leaseTiming('past', day('2025-01-01'), day('2026-09-30'), today)).toBe('Ended 21 days ago');
    expect(leaseTiming('past', day('2025-01-01'), day('2026-06-30'), today)).toBe('Ended 4 months ago');
  });

  it('marks a draft as unsigned and still shows when it would start', () => {
    expect(leaseTiming('draft', day('2027-01-01'), day('2027-12-31'), today)).toBe('Starts in 2 months · not signed');
    expect(leaseTiming('draft', day('2026-01-01'), day('2026-12-31'), today)).toBe('Not yet signed');
  });

  it('describes a vacant unit without inventing a date range', () => {
    expect(leaseTiming('vacant', day('2026-01-01'), day('2026-12-31'), today)).toBe('No lease on file');
  });
});

describe('lease summary data', () => {
  it('keeps the supplied timeline date and the real lease dates, not the clamped axis bounds', () => {
    const timeline = buildTimeline([{ id: 'u1', label: 'Unit 1' }], [
      lease({ id: 'long', startDate: day('2018-01-01'), endDate: day('2032-12-31') }),
    ], today);

    expect(timeline.today.toISOString()).toBe('2026-10-21T00:00:00.000Z');
    const segment = timeline.rows[0].segments.find((entry) => entry.kind === 'current')!;
    expect(segment.start.toISOString()).toBe('2018-01-01T00:00:00.000Z');
    expect(segment.end.toISOString()).toBe('2032-12-31T00:00:00.000Z');
    // The axis is clamped for layout, but the summary reads the real dates above.
    expect(segment.left).toBeGreaterThanOrEqual(0);
    expect(segment.left + segment.width).toBeLessThanOrEqual(100);
  });

  it('classifies a unit by its present lease, then upcoming, then draft, then vacancy', () => {
    const current = buildTimeline([{ id: 'u1', label: 'Unit 1' }], [
      lease({ id: 'a', startDate: day('2026-01-01'), endDate: day('2026-12-31') }),
      lease({ id: 'b', startDate: day('2027-01-01'), endDate: day('2027-12-31') }),
    ], today);
    expect(unitLeaseStatus(current.rows[0].segments)).toBe('current');

    const upcoming = buildTimeline([{ id: 'u1', label: 'Unit 1' }], [
      lease({ id: 'b', startDate: day('2027-01-01'), endDate: day('2027-12-31') }),
    ], today);
    expect(unitLeaseStatus(upcoming.rows[0].segments)).toBe('next');

    const draft = buildTimeline([{ id: 'u1', label: 'Unit 1' }], [
      lease({ id: 'c', status: 'DRAFT', startDate: day('2027-01-01'), endDate: day('2027-12-31') }),
    ], today);
    expect(unitLeaseStatus(draft.rows[0].segments)).toBe('draft');

    const vacant = buildTimeline([{ id: 'u1', label: 'Unit 1' }], [], today);
    expect(unitLeaseStatus(vacant.rows[0].segments)).toBe('vacant');
  });
});

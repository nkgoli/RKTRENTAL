import { describe, expect, it } from 'vitest';
import { buildTimeline, leaseKind, type TimelineLease } from '@/lib/workspace/timeline';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const now = day('2026-10-15');
const lease = (over: Partial<TimelineLease> & Pick<TimelineLease, 'id' | 'startDate' | 'endDate'>): TimelineLease => ({
  unitId: 'u1', status: 'ACTIVE', monthlyRent: 2000, tenantName: 'Alex Rivera', ...over,
});

describe('lease timeline', () => {
  it('classifies leases as past, current, next and draft', () => {
    const today = now.getTime();
    expect(leaseKind({ status: 'ACTIVE', startDate: day('2026-01-01'), endDate: day('2026-12-31') }, today)).toBe('current');
    expect(leaseKind({ status: 'ACTIVE', startDate: day('2027-01-01'), endDate: day('2027-12-31') }, today)).toBe('next');
    expect(leaseKind({ status: 'DRAFT', startDate: day('2026-01-01'), endDate: day('2026-12-31') }, today)).toBe('draft');
    expect(leaseKind({ status: 'ENDED', startDate: day('2025-01-01'), endDate: day('2025-12-31') }, today)).toBe('past');
  });

  it('fills the gaps between leases with vacant segments and places today on the axis', () => {
    const timeline = buildTimeline([{ id: 'u1', label: 'Unit 4B' }], [
      lease({ id: 'a', status: 'ENDED', startDate: day('2024-01-01'), endDate: day('2024-12-31') }),
      lease({ id: 'b', startDate: day('2025-03-01'), endDate: day('2026-12-31') }),
      lease({ id: 'c', status: 'DRAFT', startDate: day('2027-01-01'), endDate: day('2027-12-31') }),
    ], now);
    const kinds = timeline.rows[0].segments.map((s) => s.kind);
    expect(kinds).toEqual(['past', 'vacant', 'current', 'draft']);
    expect(timeline.todayPct).toBeGreaterThan(0);
    expect(timeline.todayPct).toBeLessThan(100);
    const [past, vacant, current] = timeline.rows[0].segments;
    expect(vacant.left).toBeCloseTo(past.left + past.width, 0);
    expect(current.left).toBeLessThan(timeline.todayPct);
    expect(current.left + current.width).toBeGreaterThan(timeline.todayPct);
  });

  it('shows a vacant unit as one vacant bar and a lapsed lease as vacant until today', () => {
    const timeline = buildTimeline([{ id: 'u1', label: 'Unit 1' }, { id: 'u2', label: 'Unit 2' }], [
      lease({ id: 'x', unitId: 'u2', status: 'ENDED', startDate: day('2025-01-01'), endDate: day('2026-06-30') }),
    ], now);
    expect(timeline.rows.map((r) => r.label)).toEqual(['Unit 1', 'Unit 2']);
    expect(timeline.rows[0].segments.map((s) => s.kind)).toEqual(['vacant']);
    expect(timeline.rows[1].segments.map((s) => s.kind)).toEqual(['past', 'vacant']);
  });

  it('shows vacancy before a lease that has not started yet', () => {
    const timeline = buildTimeline([{ id: 'u1', label: 'Unit 1' }], [
      lease({ id: 'n', startDate: day('2026-12-01'), endDate: day('2027-11-30') }),
    ], now);
    expect(timeline.rows[0].segments.map((s) => s.kind)).toEqual(['vacant', 'next']);
  });
});

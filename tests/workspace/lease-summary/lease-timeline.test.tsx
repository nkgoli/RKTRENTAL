import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeaseTimeline } from '@/components/workspace/LeaseTimeline';
import { buildTimeline, type TimelineLease } from '@/lib/workspace/timeline';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const now = day('2026-10-21');
const lease = (over: Partial<TimelineLease> & Pick<TimelineLease, 'id' | 'startDate' | 'endDate'>): TimelineLease => ({
  unitId: 'u1', status: 'ACTIVE', monthlyRent: 1650, tenantName: 'Chloe Fisher', ...over,
});

const render = (leases: TimelineLease[], options: { linkUnits?: boolean; limit?: number; units?: { id: string; label: string }[] } = {}) => {
  const timeline = buildTimeline(options.units ?? [{ id: 'u1', label: 'Unit Townhome 1' }], leases, now);
  return renderToStaticMarkup(
    <LeaseTimeline timeline={timeline} propertyId="p1" linkUnits={options.linkUnits} limit={options.limit} />,
  );
};

describe('lease summary rendering', () => {
  it('shows a current lease with readable dates, time remaining and a scoped lease link', () => {
    const html = render([lease({ id: 'l1', startDate: day('2026-01-01'), endDate: day('2026-12-31') })], { linkUnits: true });

    expect(html).toContain('Unit Townhome 1');
    expect(html).toContain('Current');
    expect(html).toContain('Chloe Fisher');
    expect(html).toContain('Start');
    expect(html).toContain('Jan 1, 2026');
    expect(html).toContain('End');
    expect(html).toContain('Dec 31, 2026');
    expect(html).toContain('2 months remaining');
    expect(html).toContain('/leases/l1?propertyId=p1&amp;unitId=u1');
    expect(html).toContain('View lease');
    expect(html).toContain('As of Oct 21, 2026');
  });

  it('keeps the unit view compact so the existing footer owns the current lease detail', () => {
    const html = render([lease({ id: 'l1', startDate: day('2026-01-01'), endDate: day('2026-12-31') })]);

    expect(html).toContain('Current');
    expect(html).toContain('2 months remaining');
    // The footer already shows the tenant, dates, rent/deposit and View lease.
    expect(html).not.toContain('Chloe Fisher');
    expect(html).not.toContain('Jan 1, 2026');
    expect(html).not.toContain('View lease');
  });

  it('shows an upcoming renewal with starts-in wording and a lease link', () => {
    const html = render([lease({ id: 'l2', startDate: day('2027-01-01'), endDate: day('2027-12-31') })], { linkUnits: true });

    expect(html).toContain('Upcoming');
    expect(html).toContain('Starts in 2 months');
    expect(html).toContain('Jan 1, 2027');
    expect(html).toContain('View lease');
  });

  it('shows a draft as unsigned and still links to it', () => {
    const html = render([lease({ id: 'l3', status: 'DRAFT', startDate: day('2027-01-01'), endDate: day('2027-12-31') })], { linkUnits: true });

    expect(html).toContain('Draft');
    expect(html).toContain('Starts in 2 months · not signed');
    expect(html).toContain('View lease');
  });

  it('shows a past-only unit as vacant with its terminal history behind a disclosure', () => {
    const html = render([lease({ id: 'l4', status: 'ENDED', startDate: day('2025-01-01'), endDate: day('2026-06-30') })], { linkUnits: true });

    expect(html).toContain('Vacant');
    expect(html).toContain('No current lease');
    expect(html).toContain('Ended');
    expect(html).not.toContain('Ended 4 months ago');
    expect(html).toContain('Lease history (1)');
    expect(html).toContain('Scheduled end');
    expect(html).toContain('Jun 30, 2026');
    expect(html).toContain('View lease');
  });

  it('shows a terminated lease with a future scheduled end without inventing elapsed time', () => {
    const html = render([lease({ id: 'l5', status: 'TERMINATED', startDate: day('2026-01-01'), endDate: day('2026-12-31') })], { linkUnits: true });

    expect(html).toContain('Vacant');
    expect(html).toContain('No current lease');
    expect(html).toContain('Terminated early');
    expect(html).toContain('scheduled through Dec 31, 2026');
    expect(html).toContain('Scheduled end');
    expect(html).toContain('Dec 31, 2026');
    expect(html).toContain('Lease history (1)');
    expect(html).toContain('View lease');
    expect(html).not.toContain('Ended 71 days ago');
    expect(html).not.toContain('Terminated 71 days ago');
  });

  it('shows an ended lease with a future scheduled end without claiming elapsed time', () => {
    const html = render([lease({ id: 'l6', status: 'ENDED', startDate: day('2026-01-01'), endDate: day('2026-12-31') })], { linkUnits: true });

    expect(html).toContain('Ended early');
    expect(html).toContain('scheduled through Dec 31, 2026');
    expect(html).toContain('Scheduled end');
    expect(html).not.toContain('Ended 71 days ago');
  });

  it('keeps a terminal lease explicit in the expanded history beside a current lease', () => {
    const html = render([
      lease({ id: 'l1', startDate: day('2026-01-01'), endDate: day('2026-12-31') }),
      lease({ id: 'l2', status: 'TERMINATED', startDate: day('2025-01-01'), endDate: day('2025-06-30'), tenantName: 'Jordan Lee' }),
    ], { linkUnits: true });

    expect(html).toContain('Current');
    expect(html).toContain('Lease history (1)');
    expect(html).toContain('Terminated');
    expect(html).toContain('Scheduled end');
    expect(html).toContain('Jun 30, 2025');
    expect(html).toContain('Jordan Lee');
    expect(html).not.toContain('Terminated 1 year ago');
  });

  it('shows a truthful vacant state with a create-lease action', () => {
    const html = render([], { linkUnits: true });

    expect(html).toContain('Vacant');
    expect(html).toContain('No lease on file');
    expect(html).toContain('Create lease');
    expect(html).toContain('/leases/new?unit=u1');
  });

  it('keeps an upcoming renewal discoverable beside a current lease', () => {
    const html = render([
      lease({ id: 'l1', startDate: day('2026-01-01'), endDate: day('2026-12-31') }),
      lease({ id: 'l2', startDate: day('2027-01-01'), endDate: day('2027-12-31'), tenantName: 'Jordan Lee' }),
    ], { linkUnits: true });

    expect(html).toContain('Other leases (1) · Upcoming');
    expect(html).toContain('Jordan Lee');
    expect(html).toContain('Starts in 2 months');
  });

  it('shows the ends-today boundary as current', () => {
    const html = render([lease({ id: 'l1', startDate: day('2026-01-01'), endDate: day('2026-10-21') })], { linkUnits: true });

    expect(html).toContain('Current');
    expect(html).toContain('Ends today');
  });

  it('keeps full unit labels and scoped unit links', () => {
    const html = render([], { linkUnits: true, units: [{ id: 'u1', label: 'Unit Townhome 1' }] });

    expect(html).toContain('Unit Townhome 1');
    expect(html).toContain('/properties/p1?unit=u1');
  });

  it('collapses extra units behind a compact disclosure', () => {
    const units = Array.from({ length: 7 }, (_, index) => ({ id: `u${index + 1}`, label: `Unit ${index + 1}` }));
    const html = render([], { linkUnits: true, limit: 5, units });

    expect(html).toContain('Show all 7 units');
    expect(html.match(/data-unit-row=/g)).toHaveLength(7);
  });

  it('renders one today reference per unit row for the existing overview contract', () => {
    const units = [{ id: 'u1', label: 'Unit 1' }, { id: 'u2', label: 'Unit 2' }];
    const html = render([], { linkUnits: true, units });

    expect(html.match(/data-testid="timeline-today"/g)).toHaveLength(2);
  });

  it('shows an empty state when there are no units', () => {
    const html = render([], { units: [] });

    expect(html).toContain('No units yet.');
  });
});

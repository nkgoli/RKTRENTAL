/**
 * Pure wording rules for the property and unit overviews (Designs/redisgn "property"): the
 * payments band, inset stats, lease terms and the unit list order. Every figure comes from
 * live records; nothing here is sample data.
 */
import { formatDate, formatMoney } from '@/lib/properties/format';
import { daysBetween } from '@/lib/workspace/timeline';
import type { PaymentsMonth } from '@/lib/workspace/timeline-data';

/** Leases ending inside this many days read "Renewal due" in the units table. */
export const RENEWAL_DUE_DAYS = 60;
/** Same window the property's "expiring soon" count uses. */
export const EXPIRING_SOON_DAYS = 90;

export const dollars = (cents: number) => formatMoney(cents / 100);

export type OverviewUnit = {
  id: string;
  number: string;
  isImplicit: boolean;
  status: string;
  rent: number | null;
  listedRent: number | null;
  leaseStart?: Date | null;
  leaseEnd?: Date | null;
  tenant: { id: string; name: string } | null;
};

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "October 2026", in UTC like the rest of the ledger. */
export function monthLabel(today: Date) {
  return today.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function unitName(unit: Pick<OverviewUnit, 'number' | 'isImplicit'>) {
  return unit.isImplicit ? 'Whole property' : `Unit ${unit.number}`;
}

/** "Jan 1 – Dec 31, 2026" within one year, otherwise both years. */
export function leaseTerm(start: Date, end: Date) {
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${shortDate(start)} – ${formatDate(end)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Days under two months, otherwise rounded months; past ends say so. */
export function timeLeft(end: Date, today: Date) {
  const days = daysBetween(today, end);
  if (days < 0) return `Ended ${formatDate(end)}`;
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day';
  if (days < RENEWAL_DUE_DAYS) return `${days} days`;
  const months = Math.max(1, Math.round(days / 30.44));
  return `${months} month${months === 1 ? '' : 's'}`;
}

export type UnitStatusView = {
  label: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
};

/** Occupied units whose active lease ends inside the renewal window read "Renewal due". */
export function unitStatusView(unit: OverviewUnit, today: Date): UnitStatusView {
  if (unit.status === 'OCCUPIED') {
    if (unit.leaseEnd && daysBetween(today, unit.leaseEnd) < RENEWAL_DUE_DAYS) {
      return { label: 'Renewal due', tone: 'warning' };
    }
    return { label: 'Occupied', tone: 'success' };
  }
  if (unit.status === 'VACANT') return { label: 'Vacant', tone: 'warning' };
  if (unit.status === 'TURNOVER') return { label: 'Turnover', tone: 'info' };
  return { label: unit.status.charAt(0) + unit.status.slice(1).toLowerCase(), tone: 'neutral' };
}

export function activeUnits<T extends Pick<OverviewUnit, 'status'>>(units: T[]) {
  return units.filter((unit) => unit.status !== 'ARCHIVED');
}

/** "11 of 12 units · Unit 3A vacant", or "· 2 vacant" when more than one is open. */
export function occupancyDetail(units: OverviewUnit[], occupied: number) {
  const live = activeUnits(units);
  const open = live.filter((unit) => unit.status !== 'OCCUPIED');
  const base = `${occupied} of ${live.length} unit${live.length === 1 ? '' : 's'}`;
  if (open.length === 0) return `${base} · fully occupied`;
  if (open.length === 1) {
    const label = open[0].status === 'TURNOVER' ? 'in turnover' : 'vacant';
    return `${base} · ${unitName(open[0])} ${label}`;
  }
  return `${base} · ${open.length} not occupied`;
}

/** The occupied unit whose active lease ends first inside the expiring window. */
export function firstExpiring(units: OverviewUnit[], today: Date) {
  return (
    activeUnits(units)
      .filter(
        (unit): unit is OverviewUnit & { leaseEnd: Date } =>
          !!unit.leaseEnd && daysBetween(today, unit.leaseEnd) <= EXPIRING_SOON_DAYS,
      )
      .sort((a, b) => a.leaseEnd.getTime() - b.leaseEnd.getTime())[0] ?? null
  );
}

export function expiringDetail(unit: (OverviewUnit & { leaseEnd: Date }) | null) {
  return unit
    ? `First: ${unitName(unit)} · ${shortDate(unit.leaseEnd)}`
    : 'None in the next 90 days';
}

export type PaymentsView = {
  eyebrow: string;
  value: string;
  detail: string;
  percent: number;
  meter: string;
  overdueCents: number;
};

/** Lead figure, detail and meter wording for "Payments this month". */
export function paymentsView(payments: PaymentsMonth, today: Date): PaymentsView {
  const percent =
    payments.dueCents > 0
      ? Math.min(100, Math.round((payments.paidCents / payments.dueCents) * 100))
      : 0;
  const overdueCents = payments.overdue?.amountCents ?? 0;
  const detail = !payments.hasCharges
    ? 'No rent charges due this month'
    : payments.outstandingCents
      ? `collected of ${dollars(payments.dueCents)} due · ${dollars(payments.outstandingCents)} outstanding${payments.lateCount ? ` · ${payments.lateCount} late` : ''}`
      : `collected of ${dollars(payments.dueCents)} due · all paid`;
  const overdueText = overdueCents
    ? `${dollars(overdueCents)} overdue to date`
    : 'no overdue balance';
  return {
    eyebrow: `${monthLabel(today)} · Payments this month`,
    value: dollars(payments.paidCents),
    detail,
    percent,
    meter: payments.hasCharges
      ? `${percent}% collected · ${overdueText}`
      : `No charges · ${overdueText}`,
    overdueCents,
  };
}

/**
 * Phone order: units that need a decision (not occupied, or a lease ending inside the renewal
 * window) first, soonest ending first; the rest keep their unit order.
 */
export function splitUnitsForPhone(units: OverviewUnit[], today: Date) {
  const live = activeUnits(units);
  const urgency = (unit: OverviewUnit) => {
    if (unit.status !== 'OCCUPIED') return -1;
    if (unit.leaseEnd && daysBetween(today, unit.leaseEnd) < RENEWAL_DUE_DAYS) {
      return unit.leaseEnd.getTime();
    }
    return null;
  };
  const priority = live
    .filter((unit) => urgency(unit) != null)
    .sort((a, b) => urgency(a)! - urgency(b)!);
  const rest = live.filter((unit) => urgency(unit) == null);
  return { priority, rest };
}

/**
 * Pure reporting-period resolution for the returns screen. A period is always
 * a half-open UTC range [start, end) ending at the start of the month after
 * `now`, so the current (partial) month is included in full for MTD and the
 * trailing windows stay stable within a month. No clock is read here: callers
 * pass `now` in.
 */

export type PeriodKey = 'MTD' | 'QTD' | 'YTD' | '12M';

export const PERIOD_KEYS: PeriodKey[] = ['MTD', 'QTD', 'YTD', '12M'];

export type ResolvedPeriod = {
  key: PeriodKey;
  /** Inclusive start of the window (UTC). */
  start: Date;
  /** Exclusive end of the window (UTC): the 1st of next month. */
  end: Date;
  /** Whole months covered, used to prorate annual figures. */
  months: number;
  label: string;
};

export function periodKeyFrom(value: string | undefined | null): PeriodKey {
  return PERIOD_KEYS.includes(value as PeriodKey) ? (value as PeriodKey) : '12M';
}

const monthName = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function resolvePeriod(key: PeriodKey, now: Date): ResolvedPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const end = new Date(Date.UTC(year, month + 1, 1));
  let start: Date;
  let months: number;
  switch (key) {
    case 'MTD':
      start = new Date(Date.UTC(year, month, 1));
      months = 1;
      break;
    case 'QTD':
      start = new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
      months = month - Math.floor(month / 3) * 3 + 1;
      break;
    case 'YTD':
      start = new Date(Date.UTC(year, 0, 1));
      months = month + 1;
      break;
    case '12M':
      start = new Date(Date.UTC(year, month - 11, 1));
      months = 12;
      break;
  }
  const last = new Date(end.getTime() - 1);
  const label =
    months === 1 ? monthName(start) : `${monthName(start)} – ${monthName(last)}`;
  return { key, start, end, months, label };
}

/** The YYYY-MM bucket a date falls in (UTC), for monthly chart series. */
export function monthBucket(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Every YYYY-MM bucket in the period, oldest first. */
export function periodBuckets(period: ResolvedPeriod): string[] {
  const out: string[] = [];
  for (let i = 0; i < period.months; i++) {
    const d = new Date(
      Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() + i, 1),
    );
    out.push(monthBucket(d));
  }
  return out;
}

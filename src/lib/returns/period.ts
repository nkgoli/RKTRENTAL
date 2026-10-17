/**
 * Pure reporting-period resolution for the returns screen. A period is always
 * a half-open UTC range [start, end) of whole months. Rolling windows end at
 * the start of the month after `now`, so the current (partial) month is
 * included in full and the windows stay stable within a month. Custom ranges
 * are given as inclusive YYYY-MM months and clamped to the current month. No
 * clock is read here: callers pass `now` in.
 */

export type PeriodKey = 'MTD' | 'QTD' | 'YTD' | '12M' | '2Y' | '3Y' | '5Y' | 'ALL' | 'CUSTOM';

/** The preset range chips, in display order. CUSTOM is chosen with the from/to form. */
export const PERIOD_KEYS: PeriodKey[] = ['MTD', 'QTD', 'YTD', '12M', '2Y', '3Y', '5Y', 'ALL'];

const ALL_KEYS: PeriodKey[] = [...PERIOD_KEYS, 'CUSTOM'];

/** Ranges up to this many months chart by month; longer ones chart by quarter. */
export const MONTHLY_CHART_MAX_MONTHS = 24;

export type Granularity = 'month' | 'quarter';

export type ResolvedPeriod = {
  key: PeriodKey;
  /** Inclusive start of the window (UTC). */
  start: Date;
  /** Exclusive end of the window (UTC): the 1st of the month after the last one. */
  end: Date;
  /** Whole months covered, used to prorate annual figures. */
  months: number;
  /** Chart bucket size: months up to two years, quarters beyond that. */
  granularity: Granularity;
  label: string;
};

export type PeriodOptions = {
  /** Inclusive YYYY-MM, for the CUSTOM key. */
  from?: string | null;
  /** Inclusive YYYY-MM, for the CUSTOM key. */
  to?: string | null;
  /** Earliest recorded activity, for the ALL key. */
  earliest?: Date | null;
};

export function periodKeyFrom(value: string | undefined | null): PeriodKey {
  return ALL_KEYS.includes(value as PeriodKey) ? (value as PeriodKey) : '12M';
}

const monthName = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const monthIndex = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();

/** Parses YYYY-MM into a UTC month start; null when malformed. */
export function parseMonthInput(value: string | undefined | null): Date | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? '');
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
}

export function resolvePeriod(
  key: PeriodKey,
  now: Date,
  options: PeriodOptions = {},
): ResolvedPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  let end = new Date(Date.UTC(year, month + 1, 1));
  let months: number;
  let resolvedKey = key;
  switch (key) {
    case 'MTD':
      months = 1;
      break;
    case 'QTD':
      months = month - Math.floor(month / 3) * 3 + 1;
      break;
    case 'YTD':
      months = month + 1;
      break;
    case '2Y':
      months = 24;
      break;
    case '3Y':
      months = 36;
      break;
    case '5Y':
      months = 60;
      break;
    case 'ALL':
      months = options.earliest
        ? Math.max(1, monthIndex(end) - monthIndex(options.earliest))
        : 12;
      break;
    case 'CUSTOM': {
      const a = parseMonthInput(options.from);
      const b = parseMonthInput(options.to);
      if (!a || !b) {
        resolvedKey = '12M';
        months = 12;
        break;
      }
      const current = new Date(Date.UTC(year, month, 1));
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      const last = hi > current ? current : hi;
      const first = lo > last ? last : lo;
      end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1));
      months = monthIndex(end) - monthIndex(first);
      break;
    }
    case '12M':
    default:
      months = 12;
      break;
  }
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));
  const lastDay = new Date(end.getTime() - 1);
  const label = months === 1 ? monthName(start) : `${monthName(start)} – ${monthName(lastDay)}`;
  return {
    key: resolvedKey,
    start,
    end,
    months,
    granularity: months > MONTHLY_CHART_MAX_MONTHS ? 'quarter' : 'month',
    label,
  };
}

/** The YYYY-MM bucket a date falls in (UTC), for monthly chart series. */
export function monthBucket(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The chart bucket key (YYYY-MM or YYYY-Qn) for a YYYY-MM month. */
export function bucketOfMonth(month: string, granularity: Granularity): string {
  if (granularity === 'month') return month;
  return `${month.slice(0, 4)}-Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;
}

/** Every chart bucket key in the period, oldest first. */
export function periodBuckets(period: ResolvedPeriod): string[] {
  const out: string[] = [];
  for (let i = 0; i < period.months; i++) {
    const d = new Date(
      Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() + i, 1),
    );
    const key = bucketOfMonth(monthBucket(d), period.granularity);
    if (out[out.length - 1] !== key) out.push(key);
  }
  return out;
}

export type SeriesPoint = { month: string; incomeCents: number; expensesCents: number };

/**
 * Folds YYYY-MM totals into the period's chart buckets. `month` holds a
 * YYYY-MM key for monthly ranges and a YYYY-Qn key for quarterly ones.
 */
export function bucketSeries(
  period: ResolvedPeriod,
  income: ReadonlyMap<string, number>,
  expenses: ReadonlyMap<string, number>,
): SeriesPoint[] {
  const incomeBy = new Map<string, number>();
  const expensesBy = new Map<string, number>();
  const fold = (into: Map<string, number>, from: ReadonlyMap<string, number>) => {
    for (const [month, cents] of from) {
      const key = bucketOfMonth(month, period.granularity);
      into.set(key, (into.get(key) ?? 0) + cents);
    }
  };
  fold(incomeBy, income);
  fold(expensesBy, expenses);
  return periodBuckets(period).map((month) => ({
    month,
    incomeCents: incomeBy.get(month) ?? 0,
    expensesCents: expensesBy.get(month) ?? 0,
  }));
}

export type YearlyPoint = {
  year: number;
  incomeCents: number;
  expensesCents: number;
  noiCents: number;
  /** Months of this calendar year inside the selected range; a full year has 12. */
  months: number;
};

/**
 * Calendar-year totals (oldest first) for the year-over-year income statement. With `period`,
 * each year records how many of its months the range covers; without it, how many months have data.
 */
export function yearlyTotals(
  income: ReadonlyMap<string, number>,
  expenses: ReadonlyMap<string, number>,
  period?: Pick<ResolvedPeriod, 'start' | 'months'>,
): YearlyPoint[] {
  const years = new Map<number, YearlyPoint>();
  const row = (year: number) => {
    let point = years.get(year);
    if (!point)
      years.set(year, (point = { year, incomeCents: 0, expensesCents: 0, noiCents: 0, months: 0 }));
    return point;
  };
  if (period) {
    for (let i = 0; i < period.months; i++) {
      row(new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() + i, 1)).getUTCFullYear())
        .months++;
    }
  } else {
    const seen = new Set<string>([...income.keys(), ...expenses.keys()]);
    for (const month of seen) row(Number(month.slice(0, 4))).months++;
  }
  for (const [month, cents] of income) row(Number(month.slice(0, 4))).incomeCents += cents;
  for (const [month, cents] of expenses) row(Number(month.slice(0, 4))).expensesCents += cents;
  return [...years.values()]
    .map((p) => ({ ...p, noiCents: p.incomeCents - p.expensesCents }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Year-over-year NOI change, only between two comparable full calendar years (12 months each)
 * and a positive prior NOI. Otherwise null, shown as "—".
 */
export function yearOverYearChange(row: YearlyPoint, prev: YearlyPoint | undefined): number | null {
  if (!prev || row.months < 12 || prev.months < 12 || prev.noiCents <= 0) return null;
  return (row.noiCents - prev.noiCents) / prev.noiCents;
}

/** Axis label for a chart bucket: "Mar" or "Q2", with a short year when the chart spans several. */
export function bucketLabel(key: string, withYear: boolean): string {
  const year = key.slice(2, 4);
  const name = key.includes('Q')
    ? key.slice(5)
    : new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)).toLocaleDateString(
        'en-US',
        { month: 'short', timeZone: 'UTC' },
      );
  return withYear ? `${name} ’${year}` : name;
}

/** The URL params that reproduce a period: `period`, plus `from`/`to` months for a custom range. */
export function periodParams(period: ResolvedPeriod): Record<string, string> {
  if (period.key !== 'CUSTOM') return { period: period.key };
  return {
    period: 'CUSTOM',
    from: monthBucket(period.start),
    to: monthBucket(new Date(period.end.getTime() - 1)),
  };
}

/**
 * Presentation adapters for ROI charts. They only reshape existing calculation
 * outputs; missing values stay `null` so charts can show gaps instead of $0.
 */

export type ChartValue = number | null;

/** Readable axis: ~`count` ticks on 1/2/2.5/5 × 10^k steps that always include zero. */
export function niceScale(values: ChartValue[], count = 5) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  const lo = Math.min(0, ...finite);
  const hi = Math.max(0, ...finite);
  if (lo === hi) return { min: 0, max: 1, ticks: [0, 1] };
  const raw = (hi - lo) / Math.max(1, count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw)!;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t / step) * step);
  return { min, max, ticks };
}

/** Year labels that never crowd: every year when they fit, else round steps plus the last year. */
export function xTickIndexes(length: number, width: number, minGap = 44) {
  if (length <= 0) return [];
  const fit = Math.max(2, Math.floor(width / minGap));
  if (length <= fit) return Array.from({ length }, (_, i) => i);
  const step = [2, 5, 10, 20, 25, 50].find((s) => Math.ceil(length / s) + 1 <= fit) ?? 50;
  const picks = [0];
  for (let i = step - 1; i < length; i += step) picks.push(i);
  const last = length - 1;
  if (picks.at(-1) !== last) {
    // Replace a crowded neighbour so the final year always stays labelled.
    if (last - picks.at(-1)! < step / 2 && picks.length > 1) picks.pop();
    picks.push(last);
  }
  return picks;
}

/**
 * Reference year labels: every year up to 10, otherwise year 1 and every fifth
 * year, plus the last year. Returns indexes into `years`.
 */
export function referenceTickIndexes(years: (number | string)[]) {
  const n = years.length;
  if (n <= 10) return Array.from({ length: n }, (_, i) => i);
  const picks = years.flatMap((y, i) =>
    i === 0 || (typeof y === 'number' && y % 5 === 0) ? [i] : [],
  );
  if (picks.at(-1) !== n - 1) {
    if (n - 1 - picks.at(-1)! < 3 && picks.length > 1) picks.pop();
    picks.push(n - 1);
  }
  return picks;
}

/**
 * Horizon presets in the reference style: Y1/Y5/Y10/Y30 within the hold, and the
 * full hold as "All Ny" only when it is longer than 30 years. Custom covers the rest.
 */
export function horizonChoices(length: number) {
  const presets = [1, 5, 10, 30].filter((y) => y <= length);
  if (length > 30) presets.push(length);
  return presets.map((years) => ({
    years,
    label: years > 30 ? `All ${years}y` : `Y${years}`,
  }));
}

/** A chart's starting horizon: its reference default, clamped to the hold. */
export const defaultHorizon = (preferred: number, length: number) =>
  Math.max(1, Math.min(preferred, length));

/**
 * Reference axis labels (`$12k`, `$950k`, `$1400k`) with enough decimals that
 * every tick is exact: a $2,500 step reads `$2.5k`, never a rounded `$3k`, and
 * neighbouring ticks never read the same (the reference repeats `$-1k` at Y1).
 */
export function thousands(value: number, step: number) {
  const unit = Math.abs(step) / 1000;
  const digits =
    [0, 1, 2, 3].find((d) => Math.abs(unit * 10 ** d - Math.round(unit * 10 ** d)) < 1e-6) ?? 3;
  const k = Math.abs(value) / 1000;
  const fixed = k.toFixed(digits);
  // Trim trailing decimal zeros only ($1.50k -> $1.5k); 950 stays 950.
  const text = k === 0 ? '0' : fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  return `${value < 0 ? '-' : ''}$${text}k`;
}

/** Whole dollars for chart readouts; tables keep cents. */
export const wholeDollars = (value: ChartValue | undefined) =>
  value == null || !Number.isFinite(value)
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(Math.round(value) === 0 ? 0 : value);

/**
 * Monotone cubic path through points (the same curve as d3/Recharts
 * `monotone`): smooth, but never overshoots between two data points.
 */
export function monotonePath(points: [number, number][]) {
  const n = points.length;
  if (!n) return '';
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  if (n === 2) return `M${points[0][0]},${points[0][1]}L${points[1][0]},${points[1][1]}`;
  const h: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(points[i + 1][0] - points[i][0]);
    slope.push(h[i] ? (points[i + 1][1] - points[i][1]) / h[i] : 0);
  }
  // Interior tangents (Steffen / d3 monotoneX); ends use a one-sided estimate.
  const tangent = points.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    const s0 = slope[i - 1];
    const s1 = slope[i];
    const p = (s0 * h[i] + s1 * h[i - 1]) / (h[i - 1] + h[i] || 1);
    return (
      (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
    );
  });
  tangent[0] = (3 * slope[0] - tangent[1]) / 2;
  tangent[n - 1] = (3 * slope[n - 2] - tangent[n - 2]) / 2;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = (x1 - x0) / 3;
    d += `C${x0 + h},${y0 + h * tangent[i]} ${x1 - h},${y1 - h * tangent[i + 1]} ${x1},${y1}`;
  }
  return d;
}

/** Split a series into continuous runs; a null breaks the line instead of joining through it. */
export function segments(values: ChartValue[]) {
  const runs: { start: number; values: number[] }[] = [];
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) return;
    const run = runs.at(-1);
    if (run && run.start + run.values.length === index) run.values.push(value);
    else runs.push({ start: index, values: [value] });
  });
  return runs;
}

/** Stack positive parts up from zero and negative parts down, per index. */
export function stackExtents(stacks: ChartValue[][]) {
  const length = Math.max(0, ...stacks.map((s) => s.length));
  const top: number[] = [];
  const bottom: number[] = [];
  for (let i = 0; i < length; i++) {
    let up = 0;
    let down = 0;
    for (const s of stacks) {
      const v = s[i];
      if (v == null || !Number.isFinite(v)) continue;
      if (v >= 0) up += v;
      else down += v;
    }
    top.push(up);
    bottom.push(down);
  }
  return { top, bottom };
}

type CashYear = { year: number; cashFlow: number; cumulativeCashFlow: number };

/** Landmarks for the cash-flow chart, taken from the projected rows as calculated. */
export function cashFlowLandmarks(rows: CashYear[]) {
  let worst: CashYear | null = null;
  let best: CashYear | null = null;
  let turnsPositive: number | null = null;
  for (const [index, row] of rows.entries()) {
    if (!worst || row.cashFlow < worst.cashFlow) worst = row;
    if (!best || row.cashFlow > best.cashFlow) best = row;
    // Only a real crossing counts: cumulative was negative before this year.
    if (
      turnsPositive == null &&
      index > 0 &&
      row.cumulativeCashFlow > 0 &&
      rows[index - 1].cumulativeCashFlow <= 0
    )
      turnsPositive = row.year;
  }
  return { worst, best, turnsPositive, final: rows.at(-1) ?? null };
}

type ScenarioCase = {
  result: {
    annualCashflows: { cashFlow: number }[];
    equityTimeline: { month: number; equity: number }[];
  };
};

/**
 * Per-scenario series over the chart horizon. Years beyond a scenario's hold are
 * `null` (shown as "Unavailable" in the table), never zero.
 */
export function scenarioSeries(c: ScenarioCase, years: number, metric: 'equity' | 'cashFlow') {
  return Array.from({ length: years }, (_, j): ChartValue =>
    metric === 'equity'
      ? (c.result.equityTimeline.find((r) => r.month === (j + 1) * 12)?.equity ?? null)
      : (c.result.annualCashflows[j]?.cashFlow ?? null),
  );
}

type ResultLike = {
  summaryMetrics: { totalCashRequired: number; loanAmount: number; purchasePrice: number };
  annualCashflows: {
    year: number;
    grossRent: number;
    otherIncome: number;
    vacancyLoss: number;
    effectiveGrossIncome: number;
    operatingExpenses: number;
    noi: number;
    debtService: number;
    cashFlow: number;
    cumulativeCashFlow: number;
    propertyValue: number;
    loanBalance: number;
    equity: number;
  }[];
  equityTimeline: {
    month: number;
    year: number;
    propertyValue: number;
    loanBalance: number;
    equity: number;
    appreciationEquity: number;
    principalEquity: number;
    initialEquity: number;
  }[];
  monthlyCashflows?: { month: number; date?: Date }[];
};

/**
 * A balance reads "Paid off" only when it rounds to $0. The reference uses $100,
 * which would label a real $99 balance as repaid.
 */
export const PAID_OFF_BELOW = 0.5;

/** First year cumulative cash flow is above zero (the reference "Breakeven"). */
export function breakevenYear(rows: { year: number; cumulativeCashFlow: number }[]) {
  return rows.find((r) => r.cumulativeCashFlow > 0)?.year ?? null;
}

/** Index of the first non-negative value that follows a negative one (C1 "Positive Yn"). */
export function firstPositiveAfterNegative(values: number[]) {
  for (let i = 1; i < values.length; i++) if (values[i] >= 0 && values[i - 1] < 0) return i;
  return null;
}

/** Year-end equity rows; `equityGain` excludes purchase equity. */
export function equityYears(result: ResultLike) {
  return result.equityTimeline
    .filter((r) => r.month % 12 === 0)
    .map((r) => ({ ...r, equityGain: r.principalEquity + r.appreciationEquity }));
}
export type EquityYear = ReturnType<typeof equityYears>[number];

/**
 * C6 landmarks. A crossover is only reported when it is a real crossing of a
 * financed loan: equity (gain, or total with purchase equity) starts at or below
 * the balance and later exceeds it.
 */
export function equityLandmarks(rows: EquityYear[], financed: boolean, withPurchase: boolean) {
  const amount = (r: EquityYear) => (withPurchase ? r.equity : r.equityGain);
  const crossover =
    financed && rows.length && amount(rows[0]) <= rows[0].loanBalance
      ? (rows.find((r) => amount(r) > r.loanBalance) ?? null)
      : null;
  const paidOff = financed ? (rows.find((r) => r.loanBalance < PAID_OFF_BELOW) ?? null) : null;
  // Reference rule: compare the gain added in years 5-10 with years 1-5.
  let momentum: string | null = null;
  const [y1, y5, y10] = [1, 5, 10].map((y) => rows.find((r) => r.year === y));
  if (rows.length >= 10 && y1 && y5 && y10) {
    const first = y5.equityGain - y1.equityGain;
    const second = y10.equityGain - y5.equityGain;
    if (first > 0 && second > first * 1.5)
      momentum = 'Equity gain accelerates after Y5 as appreciation compounds';
    else if (first > 0 && second > first * 1.2)
      momentum = 'Growth picks up momentum in later years';
  }
  return { crossover, paidOff, momentum };
}

/** Index each series against its year-1 base (Y1 = 100); a zero base cannot be indexed. */
export function indexAgainst(values: number[], base: number): ChartValue[] {
  return values.map((v) => (base > 0 ? (v / base) * 100 : null));
}

/**
 * C2 wealth created by a year: operating cash flow received, principal repaid and
 * value change. Before sale and before tax; negative parts are kept for the total.
 */
export function wealthAt(result: ResultLike, year: number) {
  const equity = result.equityTimeline.find((r) => r.month === year * 12);
  const cash = result.annualCashflows.find((r) => r.year === year);
  if (!equity || !cash) return null;
  const parts = {
    cashFlow: cash.cumulativeCashFlow,
    principal: equity.principalEquity,
    appreciation: equity.appreciationEquity,
  };
  return { year, ...parts, total: parts.cashFlow + parts.principal + parts.appreciation };
}

/** Milestone years (1/5/10/20/30) within the hold, always ending on the final year. */
export function milestoneYears(length: number) {
  const picks = [1, 5, 10, 20, 30].filter((y) => y <= length);
  if (length > 0 && picks.at(-1) !== length) picks.push(length);
  return picks;
}

/** Calendar year a projection year ends in, when the engine dated its months. */
export function calendarYear(result: ResultLike, year: number) {
  const date = result.monthlyCashflows?.find((m) => m.month === year * 12)?.date;
  return date ? date.getUTCFullYear() : null;
}

/** C5 reference mini bar: |rate| × 500%, capped at the track. */
export const miniBarWidth = (rate: number | null) =>
  rate == null || !Number.isFinite(rate) ? 0 : Math.min(100, Math.abs(rate) * 500);

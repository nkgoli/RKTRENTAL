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

// Float noise from repeated division (0.25 / 0.05 = 5.000000000000001) must not move a ceil.
const clean = (v: number) => Math.round(v * 1e9) / 1e9;

/** recharts-scale `getFormatStep`: the rough step rounded up on 0.05 × 10^k (0.1 below 10). */
function formatStep(rough: number, correction: number) {
  if (!(rough > 0)) return 0;
  const digits = Math.floor(clean(Math.log10(rough))) + 1;
  const unit = 10 ** digits;
  const ratio = digits !== 1 ? 0.05 : 0.1;
  return clean((Math.ceil(clean(rough / unit / ratio)) + correction) * ratio * unit);
}

/** recharts-scale `calculateStep`: widen the step until `count` ticks cover the domain. */
function rechartsStep(min: number, max: number, count: number, correction = 0): number[] {
  const step = formatStep((max - min) / (count - 1), correction);
  if (!step) return [min, max];
  let middle = 0;
  if (!(min <= 0 && max >= 0)) {
    const mid = (min + max) / 2;
    middle = clean(mid - (mid % step));
  }
  let below = Math.ceil(clean((middle - min) / step));
  let up = Math.ceil(clean((max - middle) / step));
  const total = below + up + 1;
  if (total > count) return rechartsStep(min, max, count, correction + 1);
  if (total < count) {
    if (max > 0) up += count - total;
    else below += count - total;
  }
  return Array.from({ length: below + up + 1 }, (_, i) => clean(middle + (i - below) * step));
}

/**
 * The reference's value axis: Recharts' automatic `[0, auto]` domain with its
 * default five nice ticks (`$0k…$1400k` in `$350k` steps for Exit, `-$8.5k…$25.5k`
 * for Cash Flow Y10). Zero is always included, so an all-negative series keeps
 * distinct ticks (the reference collapses to `$-1k` ×5 there).
 */
export function referenceScale(values: ChartValue[], count = 5) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  const lo = Math.min(0, ...finite);
  const hi = Math.max(0, ...finite);
  if (lo === hi) return { min: 0, max: 1, ticks: [0, 1] };
  const ticks = rechartsStep(lo, hi, Math.max(2, count));
  return { min: ticks[0], max: ticks.at(-1)!, ticks };
}

/**
 * Recharts' ticks for an explicit `[min, max]` domain (`getTickValuesFixedDomain`):
 * steps from `min`, then `max` itself, e.g. `$0k $250k $500k $950k` for Equity
 * Composition's `[0, 950k]` and `$1.7k…$2.5k` for the rent curve.
 */
export function fixedDomainScale(min: number, max: number, count = 5) {
  if (!(max > min)) return { min, max: min + 1, ticks: [min, min + 1] };
  const step = formatStep((max - min) / (Math.max(2, count) - 1), 0);
  const ticks: number[] = [];
  for (let t = min; t < max - 0.99 * step; t = clean(t + step)) ticks.push(t);
  ticks.push(max);
  return { min, max, ticks };
}

/** Equity Composition's shared axis top: 10% over the larger of equity and debt, rounded up. */
export const equityAxisMax = (largest: number, indexed: boolean) =>
  Math.ceil((largest * 1.1) / (indexed ? 50 : 50000)) * (indexed ? 50 : 50000);

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

type Breakdown = {
  propertyTax: number;
  insurance: number;
  hoa: number;
  maintenance: number;
  capex: number;
  propertyManagement: number;
  utilities: number;
  leasing: number;
  other: number;
  total: number;
};

/**
 * C10 categories in the reference colours. RocketRental also has utilities and
 * leasing; capital reserves (CapEx) sit below NOI, so they are not operating costs.
 */
export const expenseCategories = [
  {
    key: 'propertyTax',
    name: 'Property Tax',
    color: '#ef4444',
    about: 'Annual property taxes paid to local government',
  },
  {
    key: 'propertyManagement',
    name: 'Management',
    color: '#f97316',
    about: 'Property management fees (a fixed amount, or a percentage of effective income)',
  },
  {
    key: 'insurance',
    name: 'Insurance',
    color: '#f59e0b',
    about: 'Landlord/hazard insurance premium',
  },
  {
    key: 'maintenance',
    name: 'Maintenance',
    color: '#10b981',
    about: 'Recurring repairs and upkeep (small/medium fixes)',
  },
  { key: 'hoa', name: 'HOA', color: '#3b82f6', about: 'Homeowners Association fees' },
  { key: 'utilities', name: 'Utilities', color: '#8b5cf6', about: 'Owner-paid utilities' },
  {
    key: 'leasing',
    name: 'Leasing',
    color: '#0ea5e9',
    about: 'Leasing and tenant-placement costs',
  },
  { key: 'other', name: 'Misc', color: '#94a3b8', about: 'Other operating costs you entered' },
] as const;
export const capexCategory = {
  key: 'capex',
  name: 'CapEx',
  color: '#14b8a6',
  about:
    'Savings for major replacements (roof, HVAC, appliances). Deducted below NOI, so not part of operating expenses.',
} as const;

type ExpenseRow = {
  year: number;
  operatingExpenses: number;
  reserves: number;
  effectiveGrossIncome: number;
};

/**
 * Operating categories for a projection year. Every operating cost grows by the
 * same expense-growth multiplier in the engine, so each category is its Year-1
 * amount times that year's operating total ÷ Year-1 inputs; the categories then
 * add up to the projection table's operating expenses exactly. Reserves come
 * straight from the projection row.
 */
export function expenseYear(breakdown: Breakdown, rows: ExpenseRow[], year: number) {
  const row = rows.find((r) => r.year === year);
  const first = rows[0];
  if (!row || !first) return null;
  const factor = (r: ExpenseRow) =>
    breakdown.total > 0 ? r.operatingExpenses / breakdown.total : 0;
  const total = row.operatingExpenses;
  const categories = expenseCategories
    .map((c) => {
      const value = breakdown[c.key] * factor(row);
      const year1Value = breakdown[c.key] * factor(first);
      return {
        ...c,
        value,
        year1Value,
        percent: total > 0 ? value / total : null,
        change: value - year1Value,
      };
    })
    .filter((c) => c.value > 0);
  return {
    year,
    total,
    year1Total: first.operatingExpenses,
    growth: year > 1 && first.operatingExpenses > 0 ? total / first.operatingExpenses - 1 : null,
    effectiveIncome: row.effectiveGrossIncome,
    reserves: row.reserves,
    reservesYear1: first.reserves,
    categories,
  };
}

export type ExpenseSort = 'amount' | 'percent' | 'change';
export function sortExpenses<T extends { value: number; percent: number | null; change: number }>(
  categories: T[],
  mode: ExpenseSort,
) {
  const sorted = [...categories];
  if (mode === 'percent') sorted.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  else if (mode === 'change') sorted.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  else sorted.sort((a, b) => b.value - a.value);
  return sorted;
}

type LoanYear = {
  year: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  cumulativePrincipal: number;
  cumulativeInterest: number;
};

/** C13 schedule rows: beginning balance and share of the original loan repaid. */
export function loanSummaries(rows: LoanYear[], loanAmount: number) {
  return rows.map((r, i) => ({
    ...r,
    beginning: i === 0 ? loanAmount : rows[i - 1].balance,
    paidOff: loanAmount > 0 ? (loanAmount - r.balance) / loanAmount : null,
  }));
}
export type LoanSummary = ReturnType<typeof loanSummaries>[number];

/** C13 milestones: first year 25/50/75% is repaid and annual principal first beats interest. */
export function loanMilestones(rows: LoanSummary[]) {
  const first = (test: (r: LoanSummary) => boolean) => rows.find(test)?.year ?? null;
  return {
    quarter: first((r) => (r.paidOff ?? 0) >= 0.25),
    half: first((r) => (r.paidOff ?? 0) >= 0.5),
    threeQuarter: first((r) => (r.paidOff ?? 0) >= 0.75),
    principalBeatsInterest: first((r) => r.principal > r.interest),
  };
}

type ExitResult = {
  year: number;
  result: {
    saleProceeds: {
      grossSalePrice: number;
      sellingCosts: number;
      loanPayoff: number;
      netProceeds: number;
    };
    summaryMetrics: {
      totalReturn: number;
      totalCashRequired: number;
      totalReturnPercent: number | null;
      irrLeveraged: number | null;
    };
    annualCashflows: { cumulativeCashFlow: number }[];
  };
};

/** C14 exit-year rows, each from its own engine run (true leveraged IRR). */
export function exitRows(rows: ExitResult[]) {
  return rows.map(({ year, result }) => {
    const sale = result.saleProceeds;
    const m = result.summaryMetrics;
    return {
      year,
      salePrice: sale.grossSalePrice,
      sellingCosts: sale.sellingCosts,
      loanPayoff: sale.loanPayoff,
      netProceeds: sale.netProceeds,
      cashFlow: result.annualCashflows.at(-1)?.cumulativeCashFlow ?? 0,
      totalCashBack: m.totalReturn + m.totalCashRequired,
      invested: m.totalCashRequired,
      profit: m.totalReturn,
      roi: m.totalReturnPercent,
      irr: m.irrLeveraged,
    };
  });
}
export type ExitRow = ReturnType<typeof exitRows>[number];

/** Best IRR (true IRR only), best profit, and the first exit year that is profitable. */
export function exitLandmarks(rows: ExitRow[]) {
  let bestIrr: ExitRow | null = null;
  let bestProfit: ExitRow | null = null;
  for (const r of rows) {
    if (r.irr != null && Number.isFinite(r.irr) && (!bestIrr || r.irr > bestIrr.irr!)) bestIrr = r;
    if (!bestProfit || r.profit > bestProfit.profit) bestProfit = r;
  }
  return { bestIrr, bestProfit, breakeven: rows.find((r) => r.profit > 0) ?? null };
}

export type HeatPalette = { low: string; mid: string; high: string };
/** Reference red → amber → green. */
export const heatPalette: HeatPalette = { low: '#ef4444', mid: '#fbbf24', high: '#22c55e' };
/**
 * Colour-blind-safe diverging palette (RdBu). The reference maps losses to blue
 * and the best returns to red; here losses stay on the red end so the meaning of
 * red matches the default palette.
 */
export const colorblindPalette: HeatPalette = { low: '#b2182b', mid: '#f7f7f7', high: '#2166ac' };

function mix(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Reference 3-stop scale over the grid's own min…max (midpoint = mid colour). */
export function heatColor(min: number, max: number, value: number, palette: HeatPalette) {
  if (max === min) return palette.mid;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t <= 0.5
    ? mix(palette.low, palette.mid, t * 2)
    : mix(palette.mid, palette.high, (t - 0.5) * 2);
}

/**
 * Break-even contour through a grid (`cells[row][column]`, rows bottom-to-top):
 * the interpolated column where each row crosses `level`. Rows without a crossing
 * break the line, so it never joins across a gap the data does not show.
 */
export function breakevenContour(cells: ChartValue[][], level = 0) {
  const runs: { row: number; column: number }[][] = [];
  let run: { row: number; column: number }[] = [];
  cells.forEach((row, r) => {
    let point: { row: number; column: number } | null = null;
    for (let c = 0; c < row.length - 1 && !point; c++) {
      const a = row[c];
      const b = row[c + 1];
      if (a == null || b == null || a === b) continue;
      if ((a <= level && b > level) || (a > level && b <= level))
        point = { row: r, column: c + (level - a) / (b - a) };
    }
    if (point) run.push(point);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);
  return runs;
}

/** Amortization x labels like the reference: Year 1, 3, 5, 7, 9, then every third year. */
export function amortizationTicks(years: number[]) {
  const picks = years.flatMap((y, i) => ((y <= 9 ? y % 2 === 1 : y % 3 === 0) ? [i] : []));
  const last = years.length - 1;
  if (last >= 0 && picks.at(-1) !== last) {
    if (picks.length && years[last] - years[picks.at(-1)!] < 2) picks.pop();
    picks.push(last);
  }
  return picks;
}

/**
 * One shared, temporary "What if" simulation for Returns & ROI. Overrides use the saved-case
 * format (`group.key` → typed text) and run through the same engine merge as saved cases, so a
 * temporary what-if and a saved case with the same overrides give identical results. Nothing
 * here writes to the saved baseline or to recorded rent, lease, payment, expense or market data.
 */
import {
  PayloadSchema,
  calculatePayload,
  issues,
  type AnalysisPayload,
  type ValidationIssue,
} from './contract';
import { applyScenarios, scenarioExamples, type ScenarioDraft } from './scenarios';
import { applyLever, leverSpec, type LeverKey } from './deal-insights';
import type { ProjectionResult } from './projections';

type Input = AnalysisPayload['input'];
export type WhatIfValues = Record<string, string>;

/**
 * The active what-if, owned by one property (`scope`). A state read for another scope is
 * discarded, so switching property or unit can never reuse another scope's overrides. It is
 * always temporary: starting from a saved case copies that case, which itself never changes.
 */
export type WhatIfState = {
  scope: string;
  values: WhatIfValues;
  /** Name for the temporary case, e.g. a preset or "Unit 3A at suggested rent". */
  name: string;
  /** Where this what-if came from, shown beside the scope (Rent analysis entry). */
  context?: string;
  /** The Start from choice: `preset:<name>` or `case:<id>`; absent for the baseline. */
  start?: string;
  /** A copied saved case's own calculation options; the baseline's otherwise. */
  options?: ScenarioDraft['options'];
};

export function emptyWhatIf(scope: string): WhatIfState {
  return { scope, values: {}, name: 'What if' };
}

/** The state only when it belongs to `scope`; anything else is another scope's and dropped. */
export function scopedWhatIf(state: WhatIfState | null, scope: string): WhatIfState | null {
  return state && scope && state.scope === scope ? state : null;
}

/** Non-blank overrides only; a blank field inherits the baseline. */
export function activeOverrides(values: WhatIfValues): WhatIfValues {
  return Object.fromEntries(Object.entries(values).filter(([, raw]) => raw.trim() !== ''));
}

/** The engine's scenario merge: each override group replaces only the fields it names. */
export function mergeOverrides(input: Input, values: WhatIfValues): Input {
  const [scenario] = applyScenarios({ scenarios: [] } as unknown as AnalysisPayload, [
    { id: 'what-if', name: 'What if', values },
  ]).scenarios;
  const merged: Record<string, unknown> = { ...input };
  for (const [group, fields] of Object.entries(scenario.overrides)) {
    const old = merged[group];
    merged[group] =
      old && typeof old === 'object'
        ? { ...(old as object), ...(fields as object) }
        : { ...(fields as object) };
  }
  return merged as Input;
}

export type Simulation =
  | { ok: true; payload: AnalysisPayload; result: ProjectionResult }
  | { ok: false; errors: ValidationIssue[] };

/**
 * Runs `values` over the calculated baseline payload. `options` are a saved case's own
 * calculation options; a temporary what-if inherits the baseline's. Errors name the override
 * path (`income.monthlyRent`) so the panel can mark the field; the baseline is never blamed.
 */
export function simulate(
  baseline: AnalysisPayload,
  values: WhatIfValues,
  options?: AnalysisPayload['options'],
): Simulation {
  const overrides = activeOverrides(values);
  // Typed text that is not a number is named plainly on its field, not passed to the engine.
  const notNumbers = Object.entries(overrides).filter(
    ([path, raw]) => !/\.(loanType|acquisitionDate)$/.test(path) && !Number.isFinite(Number(raw)),
  );
  if (notNumbers.length)
    return {
      ok: false,
      errors: notNumbers.map(([path]) => ({ path, message: 'Enter a number, such as 1200.' })),
    };
  const candidate = {
    ...baseline,
    input: mergeOverrides(baseline.input, overrides),
    options: options ?? baseline.options,
    scenarios: [],
  };
  try {
    const parsed = PayloadSchema.parse(candidate);
    return {
      ok: true,
      payload: { ...parsed, benchmarks: baseline.benchmarks },
      result: calculatePayload({ ...parsed, benchmarks: [] }).base,
    };
  } catch (error) {
    return {
      ok: false,
      errors: issues(error).map((issue) => {
        const path = issue.path.replace(/^input\./, '');
        if (path in overrides) return { ...issue, path };
        if (issue.message === 'Loan exceeds purchase price') {
          const owner = ['financing.loanAmount', 'purchase.purchasePrice'].find(
            (p) => p in overrides,
          );
          if (owner) return { ...issue, path: owner };
        }
        return { ...issue, path: '' };
      }),
    };
  }
}

// ------------------------------------------------------------------ metrics and deltas

export type MetricKind = 'money' | 'percent' | 'ratio' | 'multiple';
export type WhatIfMetricKey =
  | 'monthlyCashFlow'
  | 'annualCashFlow'
  | 'noi'
  | 'effectiveGrossIncome'
  | 'totalOperatingExpenses'
  | 'annualDebtService'
  | 'loanAmount'
  | 'cashOnCash'
  | 'capRate'
  | 'dscr'
  | 'irr'
  | 'equityMultiple'
  | 'totalCashRequired'
  | 'finalEquity'
  | 'cumulativeCashFlow';

type MetricSpec = {
  label: string;
  kind: MetricKind;
  read: (r: ProjectionResult) => number | null;
  /** Costs and debt: a fall is the favourable direction. */
  lowerIsBetter?: boolean;
};
export type DeltaTone = 'better' | 'worse' | 'neutral';
/** Whether a change helps returns; a change too small to show is neutral. */
export function deltaTone(
  kind: MetricKind,
  delta: number | null,
  lowerIsBetter = false,
): DeltaTone {
  if (delta == null || formatDelta(kind, delta) === 'No change') return 'neutral';
  return delta > 0 !== lowerIsBetter ? 'better' : 'worse';
}

const finite = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v);
const lastYear = (r: ProjectionResult) => r.annualCashflows.at(-1);

export const WHAT_IF_METRICS: Record<WhatIfMetricKey, MetricSpec> = {
  monthlyCashFlow: {
    label: 'Cash flow / month · Year 1',
    kind: 'money',
    read: (r) => finite(r.summaryMetrics.monthlyCashFlow),
  },
  annualCashFlow: {
    label: 'Cash flow · Year 1',
    kind: 'money',
    read: (r) => finite(r.summaryMetrics.annualCashFlow),
  },
  noi: { label: 'NOI · Year 1', kind: 'money', read: (r) => finite(r.summaryMetrics.noi) },
  effectiveGrossIncome: {
    label: 'Effective income · Year 1',
    kind: 'money',
    read: (r) => finite(r.summaryMetrics.effectiveGrossIncome),
  },
  totalOperatingExpenses: {
    label: 'Operating expenses · Year 1',
    kind: 'money',
    read: (r) => finite(r.summaryMetrics.totalOperatingExpenses),
    lowerIsBetter: true,
  },
  annualDebtService: {
    label: 'Debt service · Year 1',
    kind: 'money',
    read: (r) => finite(r.summaryMetrics.annualDebtService),
    lowerIsBetter: true,
  },
  loanAmount: {
    label: 'Loan amount',
    kind: 'money',
    read: (r) => finite(r.summaryMetrics.loanAmount),
    lowerIsBetter: true,
  },
  cashOnCash: {
    label: 'Cash-on-cash · Year 1',
    kind: 'percent',
    read: (r) => finite(r.summaryMetrics.cashOnCash),
  },
  capRate: {
    label: 'Cap rate · Year 1',
    kind: 'percent',
    read: (r) => finite(r.summaryMetrics.capRate),
  },
  dscr: {
    label: 'Debt service coverage',
    kind: 'ratio',
    read: (r) => (r.summaryMetrics.loanAmount > 0 ? finite(r.summaryMetrics.dscr) : null),
  },
  irr: {
    label: 'Leveraged IRR · full hold',
    kind: 'percent',
    read: (r) => finite(r.summaryMetrics.irrLeveraged),
  },
  equityMultiple: {
    label: 'Equity multiple · full hold',
    kind: 'multiple',
    read: (r) => finite(r.summaryMetrics.equityMultiple),
  },
  totalCashRequired: {
    label: 'Cash invested',
    kind: 'money',
    read: (r) => finite(r.summaryMetrics.totalCashRequired),
    lowerIsBetter: true,
  },
  finalEquity: {
    label: 'Equity · end of hold',
    kind: 'money',
    read: (r) => {
      const year = lastYear(r)?.year;
      return year == null
        ? null
        : finite(r.equityTimeline.find((e) => e.month === year * 12)?.equity ?? null);
    },
  },
  cumulativeCashFlow: {
    label: 'Cumulative cash flow · end of hold',
    kind: 'money',
    read: (r) => finite(lastYear(r)?.cumulativeCashFlow ?? null),
  },
};

export type MetricDelta = {
  key: WhatIfMetricKey;
  label: string;
  kind: MetricKind;
  baseline: number | null;
  simulated: number | null;
  /** Simulated minus baseline; null when either side is unavailable. */
  delta: number | null;
  changed: boolean;
  tone: DeltaTone;
};

/** Baseline, simulated value and signed change for each metric, from the same engine runs. */
export function metricDeltas(
  baseline: ProjectionResult,
  simulated: ProjectionResult,
  keys: WhatIfMetricKey[],
): MetricDelta[] {
  return keys.map((key) => {
    const spec = WHAT_IF_METRICS[key];
    const b = spec.read(baseline);
    const s = spec.read(simulated);
    const delta = b == null || s == null ? null : s - b;
    return {
      key,
      label: spec.label,
      kind: spec.kind,
      baseline: b,
      simulated: s,
      delta,
      changed: delta == null ? b !== s : Math.abs(delta) > 1e-9,
      tone: deltaTone(spec.kind, delta, spec.lowerIsBetter),
    };
  });
}

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);

export function formatMetric(kind: MetricKind, v: number | null) {
  if (v == null) return 'Unavailable';
  if (kind === 'money') return usd(v);
  if (kind === 'percent') return `${(v * 100).toFixed(2)}%`;
  return `${v.toFixed(2)}×`;
}

/** Signed change: "+$1,200", "−0.42 pp" (percentage points), "+0.05×"; "No change" at zero. */
export function formatDelta(kind: MetricKind, delta: number | null) {
  if (delta == null) return 'Unavailable';
  const size =
    kind === 'money'
      ? Math.round(Math.abs(delta))
      : kind === 'percent'
        ? Math.round(Math.abs(delta) * 10000) / 100
        : Math.round(Math.abs(delta) * 100) / 100;
  if (size === 0) return 'No change';
  const sign = delta > 0 ? '+' : '−';
  if (kind === 'money') return `${sign}${usd(size)}`;
  if (kind === 'percent') return `${sign}${size.toFixed(2)} pp`;
  return `${sign}${size.toFixed(2)}×`;
}

// ------------------------------------------------------------------ suggestions and presets

/** Override values that turn `input` into `next` (only fields that differ). */
function diffValues(input: Input, next: Input): WhatIfValues {
  const out: WhatIfValues = {};
  for (const [group, fields] of Object.entries(next)) {
    if (!fields || typeof fields !== 'object') continue;
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      const before = (input as Record<string, Record<string, unknown> | undefined>)[group]?.[key];
      if (typeof value === 'number' && value !== before)
        out[`${group}.${key}`] = String(Math.round(value * 10000) / 10000);
    }
  }
  return out;
}

/**
 * Adds one suggested change (Fix My Deal lever) on top of the current what-if. The lever's
 * effect is computed by the engine; the result is ordinary editable overrides.
 */
export function withLever(baseline: Input, values: WhatIfValues, key: LeverKey): WhatIfValues {
  const current = mergeOverrides(baseline, activeOverrides(values));
  if (!leverSpec(current, key)) return values;
  return { ...values, ...diffValues(current, applyLever(current, key)) };
}

/** A preset's overrides replace the temporary what-if; it is a starting point, not advice. */
export function presetValues(name: string): WhatIfValues | null {
  const preset = scenarioExamples.find((example) => example.name === name);
  return preset ? { ...preset.values } : null;
}

// ------------------------------------------------------------------ sliders

export type SliderUnit = 'usd' | 'usdMonth' | 'usdYear' | 'percent' | 'percentYear' | 'years';

/** One slider in Suggested changes, over the field the engine actually uses. */
export type Slider = {
  /** Override path the slider writes, e.g. `income.monthlyRent`. */
  path: string;
  label: string;
  unit: SliderUnit;
  /** What a percentage is taken of ("of gross rent"). */
  basis?: string;
  /** The baseline value exactly as saved; null when the baseline leaves it unset. */
  baseline: number | null;
  /** The value the simulation uses now (override, else baseline). */
  value: number;
  min: number;
  max: number;
  step: number;
  /** Plain note when another field takes precedence over a related one. */
  note?: string;
};
/** A field the baseline leaves unset: nothing is invented, so there is no slider. */
export type MissingSlider = { path: string; label: string; missing: string };

type Context = { annualRent: number; price: number };
type SliderDef = {
  path: string;
  label: string;
  unit: SliderUnit;
  basis?: string;
  /** Calculation domain (engine schema bounds). */
  domain: [number, number];
  /** A useful window around the anchor value, kept inside the domain. */
  window: (v: number, c: Context) => [number, number];
  step: (v: number, c: Context) => number;
};

/** 1, 2 or 5 × a power of ten near `x`, so steps read as round amounts. */
function niceStep(x: number) {
  if (!(x > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(x));
  const m = x / power;
  return Math.max(1, (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * power);
}
const growth = (v: number): [number, number] => [Math.min(-5, v - 5), Math.max(10, v + 5)];
const money = (path: string, label: string, unit: SliderUnit, size: (c: Context) => number) => ({
  path,
  label,
  unit,
  domain: [0, 1e12] as [number, number],
  window: (v: number, c: Context): [number, number] => [0, Math.max(2 * v, size(c), 1000)],
  step: (v: number, c: Context) => niceStep(Math.max(v, size(c), 1000) / 100),
});
const percent = (path: string, label: string, basis: string, top: number): SliderDef => ({
  path,
  label,
  unit: 'percent',
  basis,
  domain: [0, 100],
  window: (v) => [0, Math.max(top, v + 5)],
  step: () => 0.5,
});

const DEFS: Record<string, SliderDef> = {
  'income.monthlyRent': {
    path: 'income.monthlyRent',
    label: 'Monthly rent',
    unit: 'usdMonth',
    domain: [0, 1e12],
    window: (v) => (v > 0 ? [v * 0.5, v * 1.5] : [0, 5000]),
    step: (v) => (v > 0 ? niceStep(v / 100) : 50),
  },
  'income.vacancyRate': {
    path: 'income.vacancyRate',
    label: 'Vacancy',
    unit: 'percent',
    basis: 'of gross rent',
    domain: [0, 100],
    window: (v) => [0, Math.max(25, v + 10)],
    step: () => 0.5,
  },
  'income.annualRentGrowth': {
    path: 'income.annualRentGrowth',
    label: 'Rent growth',
    unit: 'percentYear',
    domain: [-50, 100],
    window: growth,
    step: () => 0.25,
  },
  'financing.interestRate': {
    path: 'financing.interestRate',
    label: 'Interest rate',
    unit: 'percentYear',
    domain: [0, 100],
    window: (v) => [0, Math.max(15, v + 5)],
    step: () => 0.125,
  },
  'financing.downPaymentPercent': {
    path: 'financing.downPaymentPercent',
    label: 'Down payment',
    unit: 'percent',
    basis: 'of purchase price',
    domain: [0, 100],
    window: () => [0, 100],
    step: () => 1,
  },
  'financing.loanAmount': {
    path: 'financing.loanAmount',
    label: 'Loan amount',
    unit: 'usd',
    domain: [0, 1e12],
    window: (_, c) => [0, c.price],
    step: (_, c) => niceStep(c.price / 200),
  },
  'purchase.purchasePrice': {
    path: 'purchase.purchasePrice',
    label: 'Purchase price',
    unit: 'usd',
    domain: [1, 1e12],
    window: (v) => [v * 0.5, v * 1.5],
    step: (v) => niceStep(v / 200),
  },
  'expenses.maintenancePercent': percent(
    'expenses.maintenancePercent',
    'Maintenance',
    'of gross rent',
    20,
  ),
  'expenses.maintenance': money(
    'expenses.maintenance',
    'Maintenance',
    'usdYear',
    (c) => c.annualRent * 0.15,
  ),
  'expenses.capexPercent': percent('expenses.capexPercent', 'Capital reserve', 'of gross rent', 20),
  'expenses.capex': money(
    'expenses.capex',
    'Capital reserve',
    'usdYear',
    (c) => c.annualRent * 0.15,
  ),
  'expenses.propertyManagementPercent': percent(
    'expenses.propertyManagementPercent',
    'Management',
    'of effective income',
    15,
  ),
  'expenses.propertyManagement': money(
    'expenses.propertyManagement',
    'Management',
    'usdYear',
    (c) => c.annualRent * 0.15,
  ),
  'expenses.annualExpenseGrowth': {
    path: 'expenses.annualExpenseGrowth',
    label: 'Expense growth',
    unit: 'percentYear',
    domain: [-50, 100],
    window: growth,
    step: () => 0.25,
  },
  'appreciationExit.annualAppreciation': {
    path: 'appreciationExit.annualAppreciation',
    label: 'Appreciation',
    unit: 'percentYear',
    domain: [-50, 100],
    window: growth,
    step: () => 0.25,
  },
  'appreciationExit.holdingPeriodYears': {
    path: 'appreciationExit.holdingPeriodYears',
    label: 'Hold period',
    unit: 'years',
    domain: [1, 50],
    window: () => [1, 50],
    step: () => 1,
  },
};

/** Fixed annual amounts take precedence over their percentage in the engine. */
const PAIRS = [
  ['expenses.maintenance', 'expenses.maintenancePercent', 'maintenance'],
  ['expenses.capex', 'expenses.capexPercent', 'capital reserve'],
  ['expenses.propertyManagement', 'expenses.propertyManagementPercent', 'management'],
] as const;

const decimals = (n: number) => {
  const text = String(n);
  return text.includes('e') ? 10 : (text.split('.')[1] ?? '').length;
};
const read = (input: Input, path: string): number | undefined => {
  const [group, key] = path.split('.');
  const v = (input as Record<string, Record<string, unknown> | undefined>)[group]?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};

/**
 * The sliders for Suggested changes, over the baseline plus the current overrides. Each range
 * is the field's calculation domain narrowed to a useful window and laid on a grid through the
 * baseline, so the baseline is always reachable exactly. A fixed amount replaces its
 * percentage slider when the engine uses it; an unset baseline field gets no slider.
 */
export function sliders(baseline: Input, values: WhatIfValues): (Slider | MissingSlider)[] {
  const current = mergeOverrides(baseline, activeOverrides(values));
  const c = {
    annualRent: (read(current, 'income.monthlyRent') ?? 0) * 12,
    price: read(current, 'purchase.purchasePrice') ?? 0,
  };
  const paths: string[] = [
    'income.monthlyRent',
    'income.vacancyRate',
    'income.annualRentGrowth',
    'financing.interestRate',
    read(current, 'financing.loanAmount') !== undefined
      ? 'financing.loanAmount'
      : 'financing.downPaymentPercent',
    'purchase.purchasePrice',
    ...PAIRS.map(([fixed, pct]) => (read(current, fixed) !== undefined ? fixed : pct)),
    'expenses.annualExpenseGrowth',
    'appreciationExit.annualAppreciation',
    'appreciationExit.holdingPeriodYears',
  ];
  return paths.map((path) => {
    const def = DEFS[path];
    const base = read(baseline, path) ?? null;
    const value = read(current, path);
    if (value === undefined)
      return {
        path,
        label: def.label,
        missing:
          path === 'financing.interestRate'
            ? 'Not set: the baseline has no loan.'
            : 'Not set in the baseline. Add it in Edit assumptions to try changes.',
      };
    // The grid runs through the baseline (or the current value when the baseline is unset).
    const anchor = base ?? value;
    const step = def.step(anchor, c);
    const [wLo, wHi] = def.window(anchor, c);
    const lo = Math.max(def.domain[0], Math.min(wLo, value, anchor));
    const hi = Math.min(def.domain[1], Math.max(wHi, value, anchor));
    let min = anchor - Math.ceil((anchor - lo) / step - 1e-9) * step;
    if (min < def.domain[0] - 1e-9) min += step;
    let max = anchor + Math.ceil((hi - anchor) / step - 1e-9) * step;
    if (max > def.domain[1] + 1e-9) max -= step;
    const places = Math.min(10, Math.max(decimals(step), decimals(anchor)));
    const fixed = PAIRS.find(([f]) => f === path);
    const loan = path === 'financing.loanAmount';
    return {
      path,
      label: def.label,
      unit: def.unit,
      ...(def.basis ? { basis: def.basis } : {}),
      baseline: base,
      value,
      min: Number(min.toFixed(places)),
      max: Number(Math.max(min, max).toFixed(places)),
      step,
      ...(fixed
        ? { note: `Fixed annual amount, which takes precedence over a ${fixed[2]} percentage.` }
        : loan
          ? { note: 'Fixed loan amount, which takes precedence over a down payment percentage.' }
          : {}),
    };
  });
}

/**
 * The overrides after moving one slider. A value equal to the baseline inherits it (the
 * override is dropped); other values keep the precision of the baseline and the step.
 */
export function withSlider(values: WhatIfValues, slider: Slider, next: number): WhatIfValues {
  const places = Math.min(
    10,
    Math.max(decimals(slider.step), slider.baseline == null ? 0 : decimals(slider.baseline)),
  );
  const exact = Number(next.toFixed(places));
  const rest = { ...values };
  delete rest[slider.path];
  return slider.baseline != null && Math.abs(exact - slider.baseline) < 1e-9
    ? rest
    : { ...rest, [slider.path]: String(exact) };
}

const sliderMoney = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    // Whole amounts read "$1,690"; cents are shown only when the value has them.
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);

/** A slider value with its unit: "$1,690/mo", "5.5%", "2.25%/yr", "10 years". */
export function formatSlider(unit: SliderUnit, v: number) {
  if (unit === 'usd') return sliderMoney(v);
  if (unit === 'usdMonth') return `${sliderMoney(v)}/mo`;
  if (unit === 'usdYear') return `${sliderMoney(v)}/yr`;
  if (unit === 'percent') return `${v}%`;
  if (unit === 'percentYear') return `${v}%/yr`;
  return `${v} ${v === 1 ? 'year' : 'years'}`;
}

export { rentWhatIfHref, whatIfEntryFrom, type WhatIfEntry } from './what-if-entry';

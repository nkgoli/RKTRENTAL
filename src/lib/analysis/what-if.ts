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
import { applyScenarios, scenarioExamples } from './scenarios';
import { applyLever, leverSpec, type LeverKey } from './deal-insights';
import type { ProjectionResult } from './projections';

type Input = AnalysisPayload['input'];
export type WhatIfValues = Record<string, string>;

/** Which case the simulation shows: the temporary what-if or a saved case by ID. */
export type WhatIfSource = { kind: 'temporary' } | { kind: 'saved'; id: string };

/**
 * The active what-if, owned by one property (`scope`). A state read for another scope is
 * discarded, so switching property or unit can never reuse another scope's overrides.
 */
export type WhatIfState = {
  scope: string;
  source: WhatIfSource;
  values: WhatIfValues;
  /** Name for the temporary case, e.g. a preset or "Unit 3A at suggested rent". */
  name: string;
  /** Where this what-if came from, shown beside the scope (Rent analysis entry). */
  context?: string;
};

export function emptyWhatIf(scope: string): WhatIfState {
  return { scope, source: { kind: 'temporary' }, values: {}, name: 'What if' };
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

export { rentWhatIfHref, whatIfEntryFrom, type WhatIfEntry } from './what-if-entry';

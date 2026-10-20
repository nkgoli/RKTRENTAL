import { calculatePayload, type AnalysisPayload } from './contract';
import type { ProjectionResult } from './projections';

/**
 * Deal Snapshot risk factors (RealROI `RiskMeter` weights and thresholds) on
 * RocketRental's own engine metrics. Score 0–100, lower is less risky. A factor
 * whose input is missing is `unavailable` and leaves the weighted average.
 */
export type RiskStatus = 'good' | 'warning' | 'danger';
export type RiskFactor = {
  name: string;
  weight: number;
  description: string;
  tooltip: string;
} & ({ score: number; status: RiskStatus } | { score: null; status: 'unavailable' });

function band(value: number, steps: [number, number, RiskStatus][], last: [number, RiskStatus]) {
  for (const [limit, score, status] of steps) if (value >= limit) return { score, status };
  return { score: last[0], status: last[1] };
}
const lower = (value: number, steps: [number, number, RiskStatus][], last: [number, RiskStatus]) =>
  band(
    -value,
    steps.map(([limit, s, st]) => [-limit, s, st] as [number, number, RiskStatus]),
    last,
  );

export function riskFactors(result: ProjectionResult, interestRate: number | undefined) {
  const m = result.summaryMetrics;
  const financed = m.loanAmount > 0;
  const factors: RiskFactor[] = [];
  const add = (
    name: string,
    weight: number,
    tooltip: string,
    value: number | null,
    describe: (v: number) => string,
    rate: (v: number) => { score: number; status: RiskStatus },
    missing = 'Unavailable',
  ) =>
    factors.push(
      value == null || !Number.isFinite(value)
        ? { name, weight, tooltip, description: missing, score: null, status: 'unavailable' }
        : { name, weight, tooltip, description: describe(value), ...rate(value) },
    );
  // DSCR. A deal without debt has no coverage risk, so it scores as the best band.
  if (!financed)
    factors.push({
      name: 'DSCR',
      weight: 25,
      tooltip: 'Debt Service Coverage Ratio. No loan is modeled, so there is no debt to cover.',
      description: 'No debt',
      score: 10,
      status: 'good',
    });
  else
    add(
      'DSCR',
      25,
      'Debt Service Coverage Ratio: how many times NOI covers debt payments. Above 1.25x is healthy.',
      m.dscr,
      (v) => `${v.toFixed(2)}x`,
      (v) =>
        band(
          v,
          [
            [1.5, 10, 'good'],
            [1.25, 25, 'good'],
            [1.0, 50, 'warning'],
            [0.8, 75, 'danger'],
          ],
          [95, 'danger'],
        ),
    );
  add(
    'Cash-on-Cash',
    20,
    'Year-1 cash flow as a percentage of total cash invested. 8–12% is excellent.',
    m.cashOnCash == null ? null : m.cashOnCash * 100,
    (v) => `${v.toFixed(1)}%`,
    (v) =>
      band(
        v,
        [
          [10, 10, 'good'],
          [6, 25, 'good'],
          [2, 45, 'warning'],
          [0, 65, 'warning'],
        ],
        [90, 'danger'],
      ),
  );
  add(
    'Break-even',
    20,
    'Occupancy needed to cover operating costs and debt. Below 75% leaves a good cushion.',
    m.breakEvenOccupancy == null ? null : m.breakEvenOccupancy * 100,
    (v) => `${v.toFixed(0)}%`,
    (v) =>
      lower(
        v,
        [
          [65, 10, 'good'],
          [75, 25, 'good'],
          [85, 50, 'warning'],
          [95, 75, 'danger'],
        ],
        [95, 'danger'],
      ),
  );
  add(
    'Cap Spread',
    15,
    'Cap rate minus loan interest rate. A positive spread means the property yields more than the debt costs.',
    financed && interestRate != null ? m.capRate * 100 - interestRate : null,
    (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    (v) =>
      band(
        v,
        [
          [2, 15, 'good'],
          [0.5, 35, 'good'],
          [-0.5, 55, 'warning'],
          [-2, 75, 'danger'],
        ],
        [90, 'danger'],
      ),
    financed ? 'Unavailable' : 'No loan',
  );
  add(
    'LTV',
    10,
    'Loan-to-value: loan amount ÷ purchase price. Lower leverage leaves more equity cushion.',
    m.purchasePrice > 0 ? (m.loanAmount / m.purchasePrice) * 100 : null,
    (v) => `${v.toFixed(0)}%`,
    (v) =>
      lower(
        v,
        [
          [60, 15, 'good'],
          [75, 30, 'good'],
          [85, 55, 'warning'],
          [95, 75, 'danger'],
        ],
        [90, 'danger'],
      ),
  );
  add(
    'OER',
    10,
    'Operating expense ratio: operating costs ÷ effective income (reserves are below NOI). Under 45% is efficient.',
    m.oer == null ? null : m.oer * 100,
    (v) => `${v.toFixed(0)}%`,
    (v) =>
      lower(
        v,
        [
          [35, 15, 'good'],
          [45, 30, 'good'],
          [55, 50, 'warning'],
          [65, 70, 'danger'],
        ],
        [85, 'danger'],
      ),
  );
  return factors;
}

/** Weighted risk score over the available factors; null when none is available. */
export function riskScore(factors: RiskFactor[]) {
  const scored = factors.filter((f) => f.score != null);
  const weight = scored.reduce((a, f) => a + f.weight, 0);
  return weight ? scored.reduce((a, f) => a + (f.score as number) * f.weight, 0) / weight : null;
}

export function riskLevel(score: number) {
  if (score <= 30) return { level: 'Low Risk', color: '#14b8a6', tone: 'teal' } as const;
  if (score <= 50) return { level: 'Moderate', color: '#65a30d', tone: 'lime' } as const;
  if (score <= 70) return { level: 'Elevated', color: '#ca8a04', tone: 'amber' } as const;
  if (score <= 85) return { level: 'High Risk', color: '#ea580c', tone: 'orange' } as const;
  return { level: 'Very High', color: '#dc2626', tone: 'red' } as const;
}

/** Worst first, by weighted score; unavailable factors last. */
export function sortFactors(factors: RiskFactor[]) {
  return [...factors].sort((a, b) =>
    a.score == null ? 1 : b.score == null ? -1 : b.score * b.weight - a.score * a.weight,
  );
}

/** Pill colour on the five-segment bar (position 0 worst … 100 best). */
export function segmentColor(position: number) {
  return position >= 80
    ? '#10b981'
    : position >= 60
      ? '#84cc16'
      : position >= 40
        ? '#eab308'
        : position >= 20
          ? '#f97316'
          : '#ef4444';
}

// ---------------------------------------------------------------- what-ifs

export type LeverKey = 'rent' | 'vacancy' | 'interestRate' | 'maintenance' | 'capex' | 'propMgmt';
type Input = AnalysisPayload['input'];

const clone = (input: Input): Input => JSON.parse(JSON.stringify(input));

/** Run the engine on a modified copy of the base input; null when it rejects it. */
export function runInput(payload: AnalysisPayload, input: Input): ProjectionResult | null {
  try {
    return calculatePayload({ ...payload, input, scenarios: [], benchmarks: [] }).base;
  } catch {
    return null;
  }
}

type LeverSpec = { key: LeverKey; name: string; change: string; category: string };

/**
 * The six reference levers applied to the input. Fixed annual amounts take
 * precedence over percentages in the engine, so a fixed cost is cut by 1% of
 * annual gross rent instead of a percentage point.
 */
export function leverSpec(input: Input, key: LeverKey): LeverSpec | null {
  const pct = (fixed: number | undefined, percent: number | undefined, name: string) =>
    fixed !== undefined
      ? fixed > 0
        ? { name, change: '−1% of rent' }
        : null
      : percent !== undefined && percent > 0
        ? { name, change: '−1%' }
        : null;
  const e = input.expenses ?? {};
  const spec =
    key === 'rent'
      ? { name: 'Rent', change: '+$100/mo' }
      : key === 'vacancy'
        ? (input.income?.vacancyRate ?? 0) > 0
          ? { name: 'Vacancy', change: '−1%' }
          : null
        : key === 'interestRate'
          ? (input.financing?.interestRate ?? 0) > 0 &&
            (input.financing?.loanAmount ?? 1) > 0 &&
            (input.financing?.downPaymentPercent ?? 0) < 100
            ? { name: 'Interest Rate', change: '−1%' }
            : null
          : key === 'maintenance'
            ? pct(e.maintenance, e.maintenancePercent, 'Maintenance')
            : key === 'capex'
              ? pct(e.capex, e.capexPercent, 'CapEx Reserve')
              : pct(e.propertyManagement, e.propertyManagementPercent, 'Property Mgmt');
  return spec
    ? {
        key,
        ...spec,
        category:
          key === 'interestRate'
            ? 'financing'
            : key === 'rent' || key === 'vacancy'
              ? 'income'
              : 'expense',
      }
    : null;
}

export function applyLever(input: Input, key: LeverKey): Input {
  const next = clone(input);
  const rentCut = (next.income?.monthlyRent ?? 0) * 12 * 0.01;
  const cut = (fixed: 'maintenance' | 'capex' | 'propertyManagement') => {
    const e = (next.expenses ??= {});
    const percent = `${fixed === 'propertyManagement' ? 'propertyManagement' : fixed}Percent` as
      'maintenancePercent' | 'capexPercent' | 'propertyManagementPercent';
    if (e[fixed] !== undefined) e[fixed] = Math.max(0, (e[fixed] as number) - rentCut);
    else if (e[percent] !== undefined) e[percent] = Math.max(0, (e[percent] as number) - 1);
  };
  if (key === 'rent')
    next.income = { ...next.income, monthlyRent: (next.income?.monthlyRent ?? 0) + 100 };
  if (key === 'vacancy')
    next.income = { ...next.income, vacancyRate: Math.max(0, (next.income?.vacancyRate ?? 0) - 1) };
  if (key === 'interestRate')
    next.financing = {
      ...next.financing,
      interestRate: Math.max(0, (next.financing?.interestRate ?? 0) - 1),
    };
  if (key === 'maintenance') cut('maintenance');
  if (key === 'capex') cut('capex');
  if (key === 'propMgmt') cut('propertyManagement');
  return next;
}

export const LEVER_KEYS: LeverKey[] = [
  'rent',
  'vacancy',
  'interestRate',
  'maintenance',
  'capex',
  'propMgmt',
];

export type Lever = LeverSpec & { value: number | null; share: number };

/** Each lever's Year-1 cash-flow change, recomputed by the engine (not a rule of thumb). */
export function levers(payload: AnalysisPayload, base: ProjectionResult): Lever[] {
  const baseCf = base.summaryMetrics.annualCashFlow;
  const rows = LEVER_KEYS.flatMap((key) => {
    const spec = leverSpec(payload.input, key);
    if (!spec) return [];
    const r = runInput(payload, applyLever(payload.input, key));
    return [{ ...spec, value: r ? r.summaryMetrics.annualCashFlow - baseCf : null }];
  });
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0));
  return rows.map((r) => ({
    ...r,
    share: max > 0 && r.value != null ? Math.max(0, r.value) / max : 0,
  }));
}

export function applyLevers(input: Input, keys: LeverKey[]) {
  return keys.reduce((acc, key) => applyLever(acc, key), input);
}

/** Smallest value in [lo, hi] meeting `ok` (monotone), by bisection on engine runs. */
function solve(lo: number, hi: number, ok: (v: number) => boolean | null, increasing: boolean) {
  const okHi = ok(increasing ? hi : lo);
  if (!okHi) return null;
  let a = lo;
  let b = hi;
  for (let i = 0; i < 22; i++) {
    const mid = (a + b) / 2;
    const pass = ok(mid);
    if (pass == null) return null;
    if (increasing === pass) b = mid;
    else a = mid;
  }
  return increasing ? b : a;
}

export type TargetFix = {
  lever: 'Rent' | 'Rate';
  current: number;
  target: number;
  outcome: string;
  apply: (input: Input) => Input;
};

/** Reference "Targets to Hit", solved exactly with the engine. */
export function targetFixes(payload: AnalysisPayload, base: ProjectionResult): TargetFix[] {
  const m = base.summaryMetrics;
  const fixes: TargetFix[] = [];
  const rent = payload.input.income?.monthlyRent ?? 0;
  const rate = payload.input.financing?.interestRate;
  const withRent = (v: number) => (input: Input) => {
    const next = clone(input);
    next.income = { ...next.income, monthlyRent: v };
    return next;
  };
  const withRate = (v: number) => (input: Input) => {
    const next = clone(input);
    next.financing = { ...next.financing, interestRate: v };
    return next;
  };
  if (m.loanAmount > 0 && m.dscr != null && m.dscr < 1.25 && rent > 0) {
    const goal = m.dscr < 1 ? 1 : 1.25;
    const limit = rent * (goal === 1 ? 1.5 : 1.3);
    const found = solve(
      rent,
      limit,
      (v) => {
        const r = runInput(payload, withRent(v)(payload.input));
        return r?.summaryMetrics.dscr == null ? null : r.summaryMetrics.dscr >= goal;
      },
      true,
    );
    if (found != null) {
      const target = Math.ceil(found);
      fixes.push({
        lever: 'Rent',
        current: rent,
        target,
        outcome: `DSCR ≥ ${goal === 1 ? '1.0' : '1.25'}`,
        apply: withRent(target),
      });
    }
  }
  if (m.loanAmount > 0 && m.annualCashFlow < 0 && rate != null && rate > 0) {
    const found = solve(
      Math.max(0, rate - 3),
      rate,
      (v) => {
        const r = runInput(payload, withRate(v)(payload.input));
        return r ? r.summaryMetrics.annualCashFlow >= 0 : null;
      },
      false,
    );
    if (found != null) {
      const target = Math.floor(found * 100) / 100;
      fixes.push({
        lever: 'Rate',
        current: rate,
        target,
        outcome: 'Cash Flow ≥ $0',
        apply: withRate(target),
      });
    }
  }
  return fixes;
}

/** "How to Improve": rent, price and down payment that reach DSCR 1.25x (engine-solved). */
export function improvements(payload: AnalysisPayload, base: ProjectionResult) {
  const m = base.summaryMetrics;
  if (!(m.loanAmount > 0) || m.dscr == null || m.dscr >= 1.25) return [];
  const out: { action: string; result: string }[] = [];
  const dscrAt = (input: Input) => runInput(payload, input)?.summaryMetrics.dscr ?? null;
  const rent = payload.input.income?.monthlyRent ?? 0;
  if (rent > 0) {
    const v = solve(
      rent,
      rent * 1.3,
      (x) => {
        const next = clone(payload.input);
        next.income = { ...next.income, monthlyRent: x };
        const d = dscrAt(next);
        return d == null ? null : d >= 1.25;
      },
      true,
    );
    if (v != null)
      out.push({
        action: `Increase rent to $${Math.ceil(v).toLocaleString('en-US')}/mo`,
        result: 'DSCR → 1.25x',
      });
  }
  const down = payload.input.financing?.downPaymentPercent;
  if (down != null && payload.input.financing?.loanAmount === undefined && down < 100) {
    const v = solve(
      down,
      Math.min(100, down + 15),
      (x) => {
        const next = clone(payload.input);
        next.financing = { ...next.financing, downPaymentPercent: x };
        const d = dscrAt(next);
        return d == null ? null : d >= 1.25;
      },
      true,
    );
    if (v != null)
      out.push({ action: `Increase down payment to ${Math.ceil(v)}%`, result: 'DSCR → 1.25x' });
  }
  return out;
}

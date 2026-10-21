import { calculatePayload, type AnalysisPayload } from './contract';
import { compareWithBenchmarks } from '../roi';

/** Comparison failures must not suppress a valid base analysis or prevent draft saves. */
export function benchmarkComparison(snapshot: AnalysisPayload | null) {
  if (!snapshot)
    return {
      comparison: null,
      error: 'Complete the assumptions to compare; results update automatically.',
    };
  if (!snapshot.benchmarks.length)
    return { comparison: null, error: 'Choose at least one reference asset to compare.' };
  try {
    const base = calculatePayload({ ...snapshot, benchmarks: [] }).base;
    return { comparison: compareWithBenchmarks(base, snapshot.benchmarks), error: '' };
  } catch (error) {
    return {
      comparison: null,
      error: error instanceof Error ? error.message : 'Comparison unavailable',
    };
  }
}

/** The three market references the RealROI Benchmarks tab always shows. */
export const MARKET_TYPES = ['sp500', 'nasdaq100', 'bonds'] as const;

/**
 * Property against the fixed market set, read-only (never saved). The engine
 * compares at most two references at once, so the set runs in two passes on the
 * same capital and horizon.
 */
export function marketComparison(
  snapshot: AnalysisPayload | null,
  markets: AnalysisPayload['benchmarks'],
) {
  if (!snapshot) return null;
  try {
    const base = calculatePayload({ ...snapshot, scenarios: [], benchmarks: [] }).base;
    const parts = [markets.slice(0, 2), markets.slice(2)].filter((p) => p.length);
    const runs = parts.map((p) => compareWithBenchmarks(base, p));
    const [first] = runs;
    if (!first) return null;
    return { ...first, assets: [first.assets[0], ...runs.flatMap((r) => r.assets.slice(1))], base };
  } catch {
    return null;
  }
}

export type ComparedAsset = {
  id: string;
  name: string;
  color: string;
  annualizedReturn: number | null;
  /** Benchmark yield, or the property's Year-1 cash-on-cash (both in %). */
  yield: number | null;
  /** Reference volatility; null for the property (not measured). */
  volatility: number | null;
};

const RISK_FREE = 4;
/** Sharpe-like reference ratio; unavailable without a volatility. */
export const riskAdjusted = (a: ComparedAsset) =>
  a.volatility == null || a.annualizedReturn == null
    ? null
    : a.volatility === 0
      ? a.annualizedReturn
      : (a.annualizedReturn - RISK_FREE) / a.volatility;

/**
 * Multi-dimensional scores (0–100), normalised to the best selected asset like
 * the reference. Property Stability and Risk-Adj stay null: its volatility is
 * not measured, and RocketRental does not invent one.
 */
export function radarScores(assets: ComparedAsset[]) {
  const norm = (values: (number | null)[]) => {
    const max = Math.max(0, ...values.map((v) => v ?? 0));
    return values.map((v) => (v == null ? null : max > 0 ? Math.max(0, (v / max) * 100) : 0));
  };
  const maxVol = Math.max(0, ...assets.map((a) => a.volatility ?? 0));
  const axes = [
    { metric: 'Return', values: norm(assets.map((a) => a.annualizedReturn)) },
    { metric: 'Yield', values: norm(assets.map((a) => a.yield)) },
    {
      metric: 'Stability',
      values: assets.map((a) =>
        a.volatility == null ? null : maxVol > 0 ? 100 - (a.volatility / maxVol) * 100 : 100,
      ),
    },
    { metric: 'Risk-Adj', values: norm(assets.map(riskAdjusted)) },
  ];
  return axes;
}

export const customFields = [
  'name',
  'historicalCAGR',
  'averageYield',
  'volatility',
  'source',
] as const;
export type CustomBenchmarkDraft = Record<(typeof customFields)[number], string>;
export function customDraft(selected: AnalysisPayload['benchmarks']): CustomBenchmarkDraft {
  const b = selected.find((b) => b.type === 'custom');
  return {
    name: b?.name ?? '',
    historicalCAGR: b ? String(b.historicalCAGR) : '',
    averageYield: b ? String(b.averageYield) : '',
    volatility: b ? String(b.volatility) : '',
    source: b?.source ?? '',
  };
}
export function applyCustomBenchmarks(
  selected: AnalysisPayload['benchmarks'],
  draft: CustomBenchmarkDraft,
) {
  return selected.map((b) =>
    b.type !== 'custom'
      ? b
      : {
          ...b,
          ...draft,
          historicalCAGR: draft.historicalCAGR.trim() === '' ? NaN : Number(draft.historicalCAGR),
          averageYield: draft.averageYield.trim() === '' ? NaN : Number(draft.averageYield),
          volatility: draft.volatility.trim() === '' ? NaN : Number(draft.volatility),
        },
  );
}

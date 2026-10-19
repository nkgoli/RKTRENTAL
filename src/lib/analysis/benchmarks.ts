import { calculatePayload, type AnalysisPayload } from './contract';
import { compareWithBenchmarks } from '../roi';

/** Comparison failures must not suppress a valid base analysis or prevent draft saves. */
export function benchmarkComparison(snapshot: AnalysisPayload | null) {
  if (!snapshot) return { comparison: null, error: 'Complete assumptions and recalculate.' };
  if (!snapshot.benchmarks.length)
    return { comparison: null, error: 'Choose at least one reference asset and recalculate.' };
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

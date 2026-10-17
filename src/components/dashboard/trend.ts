export type Trend = { label: string; warm: boolean };

/** Month-over-month change of the last two points; null when it cannot be computed. */
export function trendOf(values: readonly number[], goodWhenUp = true): Trend | null {
  if (values.length < 2) return null;
  const prev = values[values.length - 2]!;
  const last = values[values.length - 1]!;
  if (prev === 0) return null;
  const pct = Math.round(((last - prev) / Math.abs(prev)) * 100);
  if (pct === 0) return null;
  return {
    label: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`,
    warm: goodWhenUp ? pct < 0 : pct > 0,
  };
}

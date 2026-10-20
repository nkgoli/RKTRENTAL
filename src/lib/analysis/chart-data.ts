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

/** Horizon presets in the reference style (Y1/Y5/Y10/Y30) plus the full hold. */
export function horizonChoices(length: number) {
  const presets = [5, 10, 30].filter((y) => y < length);
  return [...presets, length].map((years) => ({
    years,
    label: years === length && length > 1 ? `All ${length}y` : `Y${years}`,
  }));
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

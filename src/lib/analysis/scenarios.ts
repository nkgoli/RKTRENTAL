import type { AnalysisPayload } from './contract';
export type ScenarioDraft = {
  id: string;
  name: string;
  values: Record<string, string>;
  options?: AnalysisPayload['scenarios'][number]['options'];
};

/** Explicit examples from Designs/rocketrental-analysis, revision 36. */
export const scenarioExamples: Pick<ScenarioDraft, 'name' | 'values'>[] = [
  {
    name: 'Optimistic',
    values: {
      'income.vacancyRate': '3',
      'income.annualRentGrowth': '4',
      'appreciationExit.annualAppreciation': '4',
      'expenses.annualExpenseGrowth': '2',
    },
  },
  {
    name: 'Conservative',
    values: {
      'income.vacancyRate': '8',
      'income.annualRentGrowth': '2',
      'appreciationExit.annualAppreciation': '2',
      'expenses.annualExpenseGrowth': '2',
    },
  },
  {
    name: 'Best Case',
    values: {
      'income.vacancyRate': '2',
      'income.annualRentGrowth': '5',
      'appreciationExit.annualAppreciation': '5',
      'expenses.maintenancePercent': '3',
    },
  },
  {
    name: 'Worst Case',
    values: {
      'income.vacancyRate': '15',
      'income.annualRentGrowth': '0',
      'appreciationExit.annualAppreciation': '0',
      'expenses.maintenancePercent': '10',
    },
  },
];

/**
 * Preset colours by case name from the app palette (primary, accent, danger and their
 * companions); other cases cycle through distinct hues. Each carries white chip text.
 */
const presetColors: Record<string, string> = {
  'Base Case': '#3159d9',
  Optimistic: '#087c91',
  Conservative: '#b04a1c',
  'Best Case': '#4f7a2b',
  'Worst Case': '#b4233e',
};
const extraColors = ['#9d174d', '#0b2545', '#946200', '#58687e', '#203fa8', '#06606f'];
export function scenarioColors(names: string[]) {
  let next = 0;
  const used = new Set<string>();
  return names.map((name) => {
    const preset = presetColors[name];
    if (preset && !used.has(preset)) {
      used.add(preset);
      return preset;
    }
    let color = extraColors[next++ % extraColors.length];
    while (used.has(color) && next < extraColors.length * 2)
      color = extraColors[next++ % extraColors.length];
    used.add(color);
    return color;
  });
}

/** Fields where a higher value is favourable (for "Key Differences vs Base" pill tones). */
const higherIsBetter: Record<string, boolean> = {
  'income.monthlyRent': true,
  'income.otherMonthlyIncome': true,
  'income.annualRentGrowth': true,
  'appreciationExit.annualAppreciation': true,
  'purchase.afterRepairValue': true,
  'appreciationExit.salePriceOverride': true,
  'financing.downPaymentPercent': true,
};
const lowerIsBetter =
  /^(expenses\.|income\.vacancyRate|financing\.interestRate|purchase\.(purchasePrice|closingCosts|rehabCosts|furnishingCosts)|financing\.(pointsPaid|lenderFees|loanAmount)|appreciationExit\.sellingCostsPercent)/;

/** Overrides of a draft against the base, with whether each change helps returns. */
export function scenarioDifferences(
  draft: ScenarioDraft,
  base: AnalysisPayload['input'],
  label: (path: string) => string,
) {
  return Object.entries(draft.values).flatMap(([path, raw]) => {
    if (!raw.trim()) return [];
    const [group, key] = path.split('.');
    const baseValue = (base as Record<string, Record<string, unknown> | undefined>)[group]?.[key];
    const value = Number(raw);
    const delta =
      typeof baseValue === 'number' && Number.isFinite(value) ? value - baseValue : null;
    const direction = higherIsBetter[path] ? 1 : lowerIsBetter.test(path) ? -1 : 0;
    const tone = !delta || !direction ? 'neutral' : delta * direction > 0 ? 'good' : 'bad';
    return [{ path, label: label(path), raw, delta, tone } as const];
  });
}

export function scenarioDrafts(payload: AnalysisPayload): ScenarioDraft[] {
  return payload.scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    options: s.options,
    values: Object.fromEntries(
      Object.entries(s.overrides).flatMap(([group, fields]) =>
        Object.entries(fields ?? {}).map(([key, value]) => [`${group}.${key}`, String(value)]),
      ),
    ),
  }));
}
export function applyScenarios(payload: AnalysisPayload, drafts: ScenarioDraft[]): AnalysisPayload {
  return {
    ...payload,
    scenarios: drafts.map((s) => {
      const overrides: Record<string, Record<string, unknown>> = {};
      for (const [path, raw] of Object.entries(s.values)) {
        if (!raw.trim()) continue;
        const [group, key] = path.split('.');
        overrides[group] ??= {};
        overrides[group][key] = key === 'loanType' || key === 'acquisitionDate' ? raw : Number(raw);
      }
      return {
        id: s.id,
        name: s.name,
        overrides,
        ...(s.options ? { options: s.options } : {}),
      } as AnalysisPayload['scenarios'][number];
    }),
  };
}

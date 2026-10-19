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

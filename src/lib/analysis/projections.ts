import { calculatePayload, PayloadSchema, type AnalysisPayload } from './contract';

export type ProjectionResult = ReturnType<typeof calculatePayload>['base'];
export const dollars = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Object.is(value, -0) ? 0 : value);
export const rate = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? 'Unavailable' : `${(value * 100).toFixed(4)}%`;

// Presentation reconciliation only. The public schedule already deducts reserves
// below NOI, but does not expose them as a separate annual column.
export function projectionRows(result: ProjectionResult) {
  return result.annualCashflows.map((row) => ({
    ...row,
    reserves: Math.round((row.noi - row.debtService - row.cashFlow) * 100) / 100,
  }));
}

export function loanYears(result: ProjectionResult) {
  const rows = new Map<
    number,
    {
      year: number;
      payment: number;
      principal: number;
      interest: number;
      balance: number;
      cumulativePrincipal: number;
      cumulativeInterest: number;
    }
  >();
  for (const month of result.amortizationSchedule) {
    const row = rows.get(month.year) ?? {
      year: month.year,
      payment: 0,
      principal: 0,
      interest: 0,
      balance: 0,
      cumulativePrincipal: 0,
      cumulativeInterest: 0,
    };
    row.payment += month.payment;
    row.principal += month.principal;
    row.interest += month.interest;
    row.balance = month.balance;
    row.cumulativePrincipal = month.cumulativePrincipal;
    row.cumulativeInterest = month.cumulativeInterest;
    rows.set(month.year, row);
  }
  return [...rows.values()];
}

/** Recalculate only the temporary base; saved scenarios/evidence remain untouched. */
function probe(payload: AnalysisPayload, input: AnalysisPayload['input']) {
  return calculatePayload(
    PayloadSchema.parse({
      ...payload,
      input,
      scenarios: [],
      benchmarks: [],
    }),
  ).base;
}

function numeric(raw: string, label: string, min: number, max: number, integer = false) {
  const value = raw.trim() === '' ? NaN : Number(raw);
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(
      `${label}: enter ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`,
    );
  return value;
}

export type ExitControls = { years: string; sellingCosts: string; salePrice: string };
export function exitControls(payload: AnalysisPayload): ExitControls {
  const exit = payload.input.appreciationExit;
  return {
    years: String(exit?.holdingPeriodYears ?? ''),
    sellingCosts: String(exit?.sellingCostsPercent ?? ''),
    salePrice: String(exit?.salePriceOverride ?? ''),
  };
}
export function calculateExits(payload: AnalysisPayload, controls: ExitControls) {
  const years = numeric(controls.years, 'Exit year', 1, 50, true);
  const sellingCostsPercent = numeric(controls.sellingCosts, 'Selling costs', 0, 30);
  const salePriceOverride =
    controls.salePrice.trim() === ''
      ? undefined
      : numeric(controls.salePrice, 'Sale price override', 0.01, 1e10);
  const horizons = [
    ...new Set([...[5, 10, 15, 20, 25, 30, 40, 50].filter((y) => y < years), years]),
  ];
  return horizons.map((year) => {
    const result = probe(payload, {
      ...payload.input,
      appreciationExit: {
        ...payload.input.appreciationExit,
        holdingPeriodYears: year,
        sellingCostsPercent,
        salePriceOverride,
      },
    });
    return { year, result };
  });
}

export type SensitivityControls = {
  rentMin: string;
  rentMax: string;
  rentSteps: string;
  vacancyMin: string;
  vacancyMax: string;
  vacancySteps: string;
};
export function sensitivityControls(payload: AnalysisPayload): SensitivityControls {
  const rent = payload.input.income?.monthlyRent;
  const vacancy = payload.input.income?.vacancyRate;
  return {
    rentMin: rent == null ? '' : String(Math.round(rent * 0.9 * 100) / 100),
    rentMax: rent == null ? '' : String(Math.min(1e10, Math.round(rent * 1.1 * 100) / 100)),
    rentSteps: rent === 0 ? '1' : '3',
    vacancyMin: vacancy == null ? '' : String(Math.max(0, vacancy - 2)),
    vacancyMax: vacancy == null ? '' : String(Math.min(100, vacancy + 2)),
    vacancySteps: '3',
  };
}
function range(minRaw: string, maxRaw: string, stepsRaw: string, label: string, bound: number) {
  const min = numeric(minRaw, `Minimum ${label}`, 0, bound);
  const max = numeric(maxRaw, `Maximum ${label}`, 0, bound);
  const steps = numeric(stepsRaw, `${label} steps`, 1, 7, true);
  if (min > max) throw new Error(`Minimum ${label} must not exceed maximum ${label}.`);
  if (steps === 1 && min !== max) throw new Error(`Use equal ${label} limits for one step.`);
  if (steps > 1 && min === max) throw new Error(`Use one step for equal ${label} limits.`);
  return Array.from({ length: steps }, (_, i) =>
    steps === 1 ? min : min + ((max - min) * i) / (steps - 1),
  );
}
export function calculateSensitivity(payload: AnalysisPayload, controls: SensitivityControls) {
  const rents = range(controls.rentMin, controls.rentMax, controls.rentSteps, 'rent', 1e10);
  const vacancies = range(
    controls.vacancyMin,
    controls.vacancyMax,
    controls.vacancySteps,
    'vacancy',
    100,
  );
  return {
    rents,
    vacancies,
    cells: rents.map((monthlyRent) =>
      vacancies.map((vacancyRate) => {
        try {
          const result = probe(payload, {
            ...payload.input,
            income: { ...payload.input.income, monthlyRent, vacancyRate },
          });
          return {
            cashOnCash: result.summaryMetrics.cashOnCash,
            irr: result.summaryMetrics.irrLeveraged,
            reason: result.unavailable.cashOnCash,
            irrReason: result.unavailable.irrLeveraged,
          };
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Calculation unavailable';
          return { cashOnCash: null, irr: null, reason, irrReason: reason };
        }
      }),
    ),
  };
}

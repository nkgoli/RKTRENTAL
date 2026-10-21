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
export const rate = (value: number | null | undefined, digits = 4) => {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  const text = (value * 100).toFixed(digits);
  // Display only: a tiny negative that rounds to zero reads as 0.0%, not -0.0%.
  return `${Number(text) === 0 ? (0).toFixed(digits) : text}%`;
};

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
/**
 * Reference default ranges: rent ×0.7–×1.3 in 5 steps and vacancy 0–15% in 6
 * steps. The base rent and vacancy are then inserted into each axis.
 */
export function sensitivityControls(payload: AnalysisPayload): SensitivityControls {
  const rent = payload.input.income?.monthlyRent;
  const vacancy = payload.input.income?.vacancyRate;
  return {
    rentMin: rent == null ? '' : String(Math.round(rent * 0.7)),
    rentMax: rent == null ? '' : String(Math.min(1e10, Math.round(rent * 1.3))),
    rentSteps: rent === 0 ? '1' : '5',
    vacancyMin: vacancy == null ? '' : '0',
    vacancyMax: vacancy == null ? '' : String(Math.min(100, Math.max(15, Math.ceil(vacancy)))),
    vacancySteps: '6',
  };
}
/** Rows/columns are capped so one update runs at most this many engine calculations. */
export const SENSITIVITY_MAX_CELLS = 100;
function range(minRaw: string, maxRaw: string, stepsRaw: string, label: string, bound: number) {
  const min = numeric(minRaw, `Minimum ${label}`, 0, bound);
  const max = numeric(maxRaw, `Maximum ${label}`, 0, bound);
  const steps = numeric(stepsRaw, `${label} steps`, 1, 9, true);
  if (min > max) throw new Error(`Minimum ${label} must not exceed maximum ${label}.`);
  if (steps === 1 && min !== max) throw new Error(`Use equal ${label} limits for one step.`);
  if (steps > 1 && min === max) throw new Error(`Use one step for equal ${label} limits.`);
  return Array.from({ length: steps }, (_, i) =>
    steps === 1 ? min : Math.round((min + ((max - min) * i) / (steps - 1)) * 100) / 100,
  );
}
/** The base value joins the axis when it lies inside the range (reference behaviour). */
function insertBase(values: number[], base: number | undefined) {
  if (
    base == null ||
    base < values[0] ||
    base > values[values.length - 1] ||
    values.some((v) => Math.abs(v - base) < 1e-6)
  )
    return values;
  return [...values, base].sort((a, b) => a - b);
}
/** Year-N cash-on-cash from the probe's own projection row (Year 1 is the engine metric). */
function cashOnCashAt(result: ProjectionResult, year: number) {
  if (year === 1)
    return { value: result.summaryMetrics.cashOnCash, reason: result.unavailable.cashOnCash };
  if (result.summaryMetrics.cashOnCash == null)
    return { value: null, reason: result.unavailable.cashOnCash };
  const row = result.annualCashflows[year - 1];
  const invested = result.summaryMetrics.totalCashRequired;
  if (!row) return { value: null, reason: `The holding period ends before year ${year}.` };
  return { value: row.cashFlow / invested, reason: undefined };
}
export function calculateSensitivity(payload: AnalysisPayload, controls: SensitivityControls) {
  const rents = insertBase(
    range(controls.rentMin, controls.rentMax, controls.rentSteps, 'rent', 1e10),
    payload.input.income?.monthlyRent,
  );
  const vacancies = insertBase(
    range(controls.vacancyMin, controls.vacancyMax, controls.vacancySteps, 'vacancy', 100),
    payload.input.income?.vacancyRate,
  );
  if (rents.length * vacancies.length > SENSITIVITY_MAX_CELLS)
    throw new Error(
      `Use fewer steps: at most ${SENSITIVITY_MAX_CELLS} calculations, including the base values.`,
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
          const y3 = cashOnCashAt(result, 3);
          const y5 = cashOnCashAt(result, 5);
          return {
            cashOnCash: result.summaryMetrics.cashOnCash,
            stabilized: y3.value,
            year5: y5.value,
            irr: result.summaryMetrics.irrLeveraged,
            reason: result.unavailable.cashOnCash,
            stabilizedReason: y3.reason,
            year5Reason: y5.reason,
            irrReason: result.unavailable.irrLeveraged,
          };
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Calculation unavailable';
          return {
            cashOnCash: null,
            stabilized: null,
            year5: null,
            irr: null,
            reason,
            stabilizedReason: reason,
            year5Reason: reason,
            irrReason: reason,
          };
        }
      }),
    ),
  };
}
export type SensitivityGrid = ReturnType<typeof calculateSensitivity>;

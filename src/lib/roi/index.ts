/** RocketRental's supported public API. Adapted RealROI internals are not a persistence API. */
import { z } from 'zod';
import {
  DealInputSchema as SourceSchema,
  type DealInput,
} from './core/domain/schemas/deal-input.schema';
import { analyze as sourceAnalyze } from './core/pipeline/analysis-pipeline';
import type { AnalysisResult } from './core/domain/schemas/analysis-result.schema';
import {
  calculateDepreciation,
  getDepreciationForYear,
} from './core/calculations/tax/depreciation';
import { calculateSaleProceeds } from './core/calculations/projections/equity';
import { calculateLoanAmount } from './core/calculations/metrics/returns';
import { projectBenchmarkGrowth } from './benchmarks/calculations/projections';
import type { BenchmarkData } from './benchmarks/types';

export const SOURCE_COMMIT = '0b12c76fea3958b98f4a722f5acf3336f1fd7d45';
export type { DealInput, BenchmarkData };

// Remove financial sample defaults. A caller must consciously supply every assumption.
function explicit<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(
      Object.fromEntries(
        Object.entries(shape).map(([key, schema]) => [
          key,
          schema instanceof z.ZodDefault ? schema.removeDefault() : schema,
        ]),
      ),
    )
    .strict();
}
export const DealInputSchema = SourceSchema.extend({
  purchase: explicit(SourceSchema.shape.purchase.shape),
  financing: explicit(SourceSchema.shape.financing.shape),
  income: explicit(SourceSchema.shape.income.shape),
  expenses: explicit(SourceSchema.shape.expenses.shape),
  appreciationExit: explicit(SourceSchema.shape.appreciationExit.shape),
}).strict();

const OptionsSchema = z
  .object({
    discountRate: z.number().finite().min(-0.99).max(10),
    startDate: z.date().refine((d) => d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2100),
    tax: z
      .object({
        marginalTaxRate: z.number().min(0).max(100),
        stateTaxRate: z.number().min(0).max(100),
        capitalGainsTaxRate: z.number().min(0).max(100),
        recaptureTaxRate: z.number().min(0).max(100),
        depreciationEnabled: z.boolean(),
        depreciationYears: z.number().min(1).max(50),
        landValuePercent: z.number().min(0).max(100),
        allowImmediateLossBenefit: z.boolean(),
      })
      .strict()
      .refine((t) => t.marginalTaxRate + t.stateTaxRate <= 100)
      .optional(),
  })
  .strict();
export type AnalysisOptions = z.infer<typeof OptionsSchema>;
export type ScenarioOverrides = {
  [K in keyof DealInput]?: DealInput[K] extends object ? Partial<DealInput[K]> : DealInput[K];
};
type NullableMetrics =
  | 'oer'
  | 'cashOnCash'
  | 'grm'
  | 'dscr'
  | 'equityMultiple'
  | 'totalReturnPercent'
  | 'averageAnnualReturn'
  | 'breakEvenOccupancy'
  | 'profitabilityIndex'
  | 'afterTaxCashOnCash'
  | 'afterTaxIrr';
export type RoiAnalysis = Omit<AnalysisResult, 'summaryMetrics'> & {
  summaryMetrics: Omit<AnalysisResult['summaryMetrics'], NullableMetrics> & {
    [K in NullableMetrics]: number | null;
  };
  saleProceeds: ReturnType<typeof calculateSaleProceeds>;
  cashflows: number[];
  afterTaxCashflows: number[] | null;
  assumptions: AnalysisOptions;
  unavailable: Partial<Record<keyof AnalysisResult['summaryMetrics'], string>>;
};

/** End-of-period NPV; index zero is acquisition. Rates are fractions. */
export function calculateNPV(cashflows: number[], rate: number): number | null {
  if (
    cashflows.length < 2 ||
    cashflows.length > 601 ||
    !cashflows.every(Number.isFinite) ||
    !Number.isFinite(rate) ||
    rate <= -1
  )
    return null;
  const value = cashflows.reduce((sum, cf, t) => sum + cf / (1 + rate) ** t, 0);
  return Number.isFinite(value) ? value : null;
}

/** Conservative IRR: multiple sign changes are ambiguous, even if a solver finds one root. */
export function calculateIRR(cashflows: number[]): number | null {
  if (cashflows.length < 2 || cashflows.length > 601 || !cashflows.every(Number.isFinite))
    return null;
  const signs = cashflows.filter((v) => v !== 0).map(Math.sign);
  const changes = signs.slice(1).filter((v, i) => v !== signs[i]).length;
  if (changes !== 1) return null;
  let low = -0.999999;
  let high = 10;
  // Scale by (1+r)^n below zero to preserve sign without overflowing near -100%.
  const evaluate = (r: number) =>
    r < 0
      ? cashflows.reduce((sum, cf, t) => sum + cf * (1 + r) ** (cashflows.length - 1 - t), 0)
      : calculateNPV(cashflows, r);
  let a = evaluate(low);
  const b = evaluate(high);
  if (a === 0) return low;
  if (b === 0) return high;
  if (a === null || b === null || Math.sign(a) === Math.sign(b)) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const value = evaluate(mid);
    if (value === null) return null;
    if (value === 0 || high - low < 1e-12) return mid;
    if (Math.sign(value) === Math.sign(a)) {
      low = mid;
      a = value;
    } else high = mid;
  }
  return null;
}

function checkBounds(value: unknown, path = 'input'): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e10)) {
    throw new RangeError(`${path}: finite number within +/-10 billion required`);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [key, child] of Object.entries(value)) checkBounds(child, `${path}.${key}`);
  }
}

/** Every nested result, including comparison series and ratios, must remain safe. */
function assertSafeOutput(value: unknown, context: string): void {
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100)
  ) {
    throw new RangeError(`${context} output outside safe monetary precision`);
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) assertSafeOutput(child, context);
  }
}

/** Missing assumptions throw a ZodError; undefined ratios and IRRs return null with reasons. */
export function analyze(input: unknown, suppliedOptions: AnalysisOptions): RoiAnalysis {
  checkBounds(input);
  const parsed = DealInputSchema.parse(input) as DealInput;
  const options = OptionsSchema.parse(suppliedOptions);
  if (parsed.taxes)
    throw new Error('Supply explicit tax assumptions in options.tax, not legacy input.taxes');
  const loan = calculateLoanAmount(parsed);
  if (loan > parsed.purchase.purchasePrice) throw new RangeError('Loan exceeds purchase price');
  if (parsed.financing.loanTermYears > 50 || (parsed.financing.amortizationYears ?? 0) > 50) {
    throw new RangeError('Loan and amortization terms must not exceed 50 years');
  }
  const raw = sourceAnalyze(parsed, {
    discountRate: options.discountRate,
    startDate: options.startDate,
    includeTaxAnalysis: false,
  });
  const last = raw.annualCashflows.at(-1)!;
  const saleProceeds = calculateSaleProceeds(parsed, last.propertyValue, last.loanBalance);
  const s = raw.summaryMetrics;
  const invested = s.totalCashRequired;
  const cashflows = [-invested, ...raw.annualCashflows.map((y) => y.cashFlow)];
  cashflows[cashflows.length - 1] += saleProceeds.netProceeds;
  const unlevered = [
    -parsed.purchase.purchasePrice -
      parsed.purchase.closingCosts -
      parsed.purchase.rehabCosts -
      parsed.purchase.furnishingCosts,
    ...raw.annualCashflows.map((y) => y.cashFlow + y.debtService),
  ];
  unlevered[unlevered.length - 1] += saleProceeds.netSaleProceeds;
  const unavailable: RoiAnalysis['unavailable'] = {};
  const ratio = (key: keyof typeof s, numerator: number, denominator: number) => {
    if (denominator <= 0) {
      unavailable[key] = 'No positive denominator';
      return null;
    }
    return numerator / denominator;
  };
  const irrLeveraged = calculateIRR(cashflows);
  const irrUnleveraged = calculateIRR(unlevered);
  if (irrLeveraged === null)
    unavailable.irrLeveraged = 'No unique computable IRR in (-100%, 1000%]';
  if (irrUnleveraged === null)
    unavailable.irrUnleveraged = 'No unique computable IRR in (-100%, 1000%]';
  if (s.paybackPeriodYears === null)
    unavailable.paybackPeriodYears = 'Not recovered from cash flow within modeled hold';
  const totalReturnPercent = ratio('totalReturnPercent', s.totalReturn, invested);
  if (totalReturnPercent === null)
    unavailable.averageAnnualReturn = 'No positive initial investment';
  let afterTaxCashflows: number[] | null = null;
  let afterTaxCashOnCash: number | null = null;
  let afterTaxIrr: number | null = null;
  if (options.tax) {
    const t = options.tax;
    const depreciation = calculateDepreciation({ ...parsed.purchase, ...t });
    let accumulated = 0;
    afterTaxCashflows = [
      -invested,
      ...raw.annualCashflows.map((y) => {
        const dep = t.depreciationEnabled ? getDepreciationForYear(depreciation, y.year) : 0;
        accumulated += dep;
        const taxable = y.noi - y.interestPaid - dep;
        const liability =
          ((t.allowImmediateLossBenefit ? taxable : Math.max(0, taxable)) *
            (t.marginalTaxRate + t.stateTaxRate)) /
          100;
        return y.cashFlow - liability;
      }),
    ];
    afterTaxCashOnCash = ratio('afterTaxCashOnCash', afterTaxCashflows[1], invested);
    // Tax gain is independent of financing: net sale price minus adjusted asset cost basis.
    const basis =
      parsed.purchase.purchasePrice + parsed.purchase.closingCosts + parsed.purchase.rehabCosts;
    const gain = Math.max(0, saleProceeds.netSaleProceeds - basis + accumulated);
    const recapture = Math.min(accumulated, gain);
    const saleTax =
      (recapture * t.recaptureTaxRate) / 100 + ((gain - recapture) * t.capitalGainsTaxRate) / 100;
    afterTaxCashflows[afterTaxCashflows.length - 1] += saleProceeds.netProceeds - saleTax;
    afterTaxIrr = calculateIRR(afterTaxCashflows);
    if (afterTaxIrr === null) unavailable.afterTaxIrr = 'No unique computable after-tax IRR';
  } else {
    unavailable.afterTaxCashOnCash = unavailable.afterTaxIrr = 'Tax assumptions not supplied';
  }
  const npv = calculateNPV(cashflows, options.discountRate);
  if (npv === null) throw new RangeError('NPV outside numeric range');
  const result: RoiAnalysis = {
    ...raw,
    saleProceeds,
    cashflows,
    afterTaxCashflows,
    assumptions: options,
    unavailable,
    summaryMetrics: {
      ...s,
      irrLeveraged,
      irrUnleveraged,
      npv,
      oer: ratio('oer', s.totalOperatingExpenses, s.effectiveGrossIncome),
      cashOnCash: ratio('cashOnCash', s.annualCashFlow, invested),
      grm: ratio('grm', s.purchasePrice, s.grossPotentialIncome),
      dscr: ratio('dscr', s.noi, s.annualDebtService),
      equityMultiple: ratio('equityMultiple', s.totalReturn + invested, invested),
      totalReturnPercent,
      averageAnnualReturn:
        totalReturnPercent === null
          ? null
          : totalReturnPercent / parsed.appreciationExit.holdingPeriodYears,
      breakEvenOccupancy: ratio(
        'breakEvenOccupancy',
        s.totalOperatingExpenses + s.annualDebtService + raw.expenseBreakdown.capex,
        s.grossPotentialIncome,
      ),
      profitabilityIndex: ratio('profitabilityIndex', npv + invested, invested),
      afterTaxCashOnCash,
      afterTaxIrr,
    },
  };
  // Fail closed on overflow in any nested projected amount, rather than serializing Infinity as null.
  assertSafeOutput(result, 'Analysis');
  return result;
}

export function analyzeWithScenario(
  base: DealInput,
  overrides: ScenarioOverrides,
  options: AnalysisOptions,
): RoiAnalysis {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new Error('Invalid override key');
    const old = merged[key];
    merged[key] =
      value &&
      typeof value === 'object' &&
      old &&
      typeof old === 'object' &&
      !(value instanceof Date)
        ? { ...old, ...value }
        : value;
  }
  return analyze(merged, options);
}

export function compareScenarios(
  base: DealInput,
  scenarios: Array<{ id: string; overrides: ScenarioOverrides }>,
  options: AnalysisOptions,
) {
  if (scenarios.length > 20 || new Set(scenarios.map((s) => s.id)).size !== scenarios.length) {
    throw new RangeError('At most 20 scenarios with unique IDs');
  }
  const baseline = analyze(base, options);
  return {
    baseline,
    scenarios: scenarios.map((s) => ({
      id: s.id,
      result: analyzeWithScenario(base, s.overrides, options),
    })),
  };
}

/** An editable one-variable sensitivity sweep; each point is revalidated. */
export function calculateSensitivityRange(
  base: DealInput,
  section: 'purchase' | 'financing' | 'income' | 'expenses' | 'appreciationExit',
  field: string,
  values: number[],
  options: AnalysisOptions,
) {
  if (
    values.length > 100 ||
    !Object.hasOwn(base[section], field) ||
    typeof (base[section] as Record<string, unknown>)[field] !== 'number'
  ) {
    throw new RangeError('Choose an existing numeric assumption and at most 100 points');
  }
  return values.map((value) => ({
    value,
    result: analyzeWithScenario(
      base,
      {
        [section]: { [field]: value },
      },
      options,
    ),
  }));
}

/** Same-capital, same-horizon comparison. Benchmark CAGR already includes reinvested distributions. */
export function compareWithBenchmarks(result: RoiAnalysis, benchmarks: BenchmarkData[]) {
  if (benchmarks.length < 1 || benchmarks.length > 2)
    throw new RangeError('Choose one or two benchmarks');
  const initial = result.summaryMetrics.totalCashRequired;
  if (initial <= 0) throw new RangeError('Comparison requires positive initial capital');
  const years = result.annualCashflows.length;
  const propertyValue = initial + result.summaryMetrics.totalReturn;
  const assets = [
    {
      id: 'property',
      finalValue: propertyValue,
      totalReturn: (propertyValue / initial - 1) * 100,
      annualizedReturn:
        propertyValue < 0 ? null : ((propertyValue / initial) ** (1 / years) - 1) * 100,
      source: 'Projected net liquidation proceeds plus undiscounted cash flows',
      projections: result.annualCashflows.map((y) => ({
        year: y.year,
        value: y.equity + y.cumulativeCashFlow,
      })),
    },
    ...benchmarks.map((b) => {
      if (
        !Number.isFinite(b.historicalCAGR) ||
        b.historicalCAGR < -100 ||
        b.historicalCAGR > 100 ||
        !b.source.trim()
      ) {
        throw new RangeError('Benchmark needs a dated source and CAGR within [-100, 100]');
      }
      const projections = projectBenchmarkGrowth(b, initial, years);
      const finalValue = projections.at(-1)!.value;
      return {
        id: b.type,
        finalValue,
        totalReturn: (finalValue / initial - 1) * 100,
        annualizedReturn: b.historicalCAGR,
        source: b.source,
        projections,
      };
    }),
  ];
  assets[0].projections[years - 1].value = propertyValue;
  const comparison = {
    initialInvestment: initial,
    holdingPeriodYears: years,
    assets,
    ranking: [...assets].sort((a, b) => b.finalValue - a.finalValue).map((a) => a.id),
    assumptions:
      'Pre-tax; property cash flows held without reinvestment; benchmark total return reinvested; no added yield or invented volatility.',
  };
  assertSafeOutput(comparison, 'Comparison');
  return comparison;
}

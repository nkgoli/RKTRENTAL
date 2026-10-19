import type {
  BenchmarkData,
  BenchmarkComparison,
  InvestmentProjection,
  PropertyInvestmentSummary,
  ComparisonResult,
  BenchmarkType,
} from '../types';

/**
 * Project investment growth for a benchmark over time
 */
export function projectBenchmarkGrowth(
  benchmark: BenchmarkData,
  initialInvestment: number,
  years: number,
): InvestmentProjection[] {
  const projections: InvestmentProjection[] = [];
  const annualRate = benchmark.historicalCAGR / 100;

  for (let year = 1; year <= years; year++) {
    const value = initialInvestment * Math.pow(1 + annualRate, year);
    const growth = value - initialInvestment;
    const annualizedReturn = (Math.pow(value / initialInvestment, 1 / year) - 1) * 100;

    projections.push({
      year,
      value: Math.round(value),
      contributions: initialInvestment,
      growth: Math.round(growth),
      annualizedReturn,
    });
  }

  return projections;
}

/**
 * Calculate benchmark comparison
 */
export function calculateBenchmarkComparison(
  benchmark: BenchmarkData,
  initialInvestment: number,
  holdingPeriodYears: number,
): BenchmarkComparison {
  const projections = projectBenchmarkGrowth(benchmark, initialInvestment, holdingPeriodYears);

  const finalProjection = projections[projections.length - 1];
  const finalValue = finalProjection?.value ?? initialInvestment;
  const totalGrowth = finalValue - initialInvestment;
  const totalReturn = (totalGrowth / initialInvestment) * 100;
  const annualizedReturn = benchmark.historicalCAGR;

  return {
    benchmark,
    initialInvestment,
    holdingPeriodYears,
    projections,
    finalValue,
    totalReturn,
    annualizedReturn,
    totalGrowth,
  };
}

/**
 * Create property investment summary from analysis result
 */
export function createPropertySummary(
  initialInvestment: number,
  holdingPeriodYears: number,
  annualCashflows: Array<{
    year: number;
    cashFlow: number;
    equity: number;
    propertyValue: number;
  }>,
  irr?: number,
): PropertyInvestmentSummary {
  let cumulativeCashFlow = 0;

  const projections: InvestmentProjection[] = annualCashflows.map((cf) => {
    cumulativeCashFlow += cf.cashFlow;
    // Total value = equity in property + cumulative cash flow received
    const value = cf.equity + cumulativeCashFlow;
    const growth = value - initialInvestment;
    const annualizedReturn =
      cf.year > 0 ? (Math.pow(value / initialInvestment, 1 / cf.year) - 1) * 100 : 0;

    return {
      year: cf.year,
      value: Math.round(value),
      contributions: initialInvestment,
      growth: Math.round(growth),
      annualizedReturn,
    };
  });

  const finalProjection = projections[projections.length - 1];
  const finalValue = finalProjection?.value ?? initialInvestment;
  const totalGrowth = finalValue - initialInvestment;
  const totalReturn = (totalGrowth / initialInvestment) * 100;
  const annualizedReturn =
    holdingPeriodYears > 0
      ? (Math.pow(finalValue / initialInvestment, 1 / holdingPeriodYears) - 1) * 100
      : 0;

  return {
    initialInvestment,
    holdingPeriodYears,
    projections,
    finalValue,
    totalReturn,
    annualizedReturn,
    totalGrowth,
    irr,
  };
}

/**
 * Compare property investment against multiple benchmarks
 */
export function compareWithBenchmarks(
  property: PropertyInvestmentSummary,
  benchmarks: BenchmarkData[],
): ComparisonResult {
  const benchmarkComparisons = benchmarks.map((b) =>
    calculateBenchmarkComparison(b, property.initialInvestment, property.holdingPeriodYears),
  );

  // Find best performer
  const allReturns: Array<{ type: 'property' | BenchmarkType; return: number }> = [
    { type: 'property', return: property.totalReturn },
    ...benchmarkComparisons.map((bc) => ({
      type: bc.benchmark.type,
      return: bc.totalReturn,
    })),
  ];

  const sorted = allReturns.sort((a, b) => b.return - a.return);
  const bestPerformer = sorted[0].type;

  // Calculate outperformance (property vs best benchmark)
  const bestBenchmarkReturn = Math.max(...benchmarkComparisons.map((bc) => bc.totalReturn));
  const outperformance = property.totalReturn - bestBenchmarkReturn;

  return {
    property,
    benchmarks: benchmarkComparisons,
    bestPerformer,
    outperformance,
  };
}

/**
 * Calculate the equivalent annual return needed to match a target
 */
export function calculateRequiredReturn(
  initialInvestment: number,
  targetValue: number,
  years: number,
): number {
  if (years <= 0 || initialInvestment <= 0) return 0;
  return (Math.pow(targetValue / initialInvestment, 1 / years) - 1) * 100;
}

/**
 * Calculate future value with compound growth
 */
export function calculateFutureValue(
  presentValue: number,
  annualRate: number,
  years: number,
): number {
  return presentValue * Math.pow(1 + annualRate / 100, years);
}

/**
 * Calculate the break-even year where property outperforms benchmark
 */
export function findBreakevenYear(
  property: PropertyInvestmentSummary,
  benchmark: BenchmarkComparison,
): number | null {
  for (let i = 0; i < property.projections.length; i++) {
    const propValue = property.projections[i].value;
    const benchValue = benchmark.projections[i]?.value ?? 0;

    if (propValue >= benchValue) {
      return property.projections[i].year;
    }
  }

  return null; // Property never outperforms
}

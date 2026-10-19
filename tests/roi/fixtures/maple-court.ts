import {
  analyze,
  analyzeWithScenario,
  compareWithBenchmarks,
  type AnalysisOptions,
  type BenchmarkData,
  type DealInput,
  type ScenarioOverrides,
} from '../../../src/lib/roi';

// Seed-derived identity, price, loan and rent mix; the CUID is a synthetic test ID.
// Every other financial value below is a deliberate illustrative assumption.
export const mapleCourt: DealInput = {
  schemaVersion: 1,
  propertyId: 'cm7a2nx9b0000u8hc4cj87t3p',
  propertyInfo: {
    name: 'Maple Court',
    address: '214 Maple Ave',
    city: 'Austin',
    state: 'TX',
    zipCode: '78704',
  },
  purchase: { purchasePrice: 2830000, closingCosts: 56600, rehabCosts: 0, furnishingCosts: 0 },
  financing: {
    downPaymentPercent: (850000 / 2830000) * 100,
    loanAmount: 1980000,
    interestRate: 6.5,
    loanTermYears: 30,
    amortizationYears: 30,
    loanType: 'conventional',
    pointsPaid: 0,
    lenderFees: 0,
  },
  income: { monthlyRent: 23000, otherMonthlyIncome: 0, vacancyRate: 5, annualRentGrowth: 2 },
  expenses: {
    propertyTax: 30000,
    insurance: 9600,
    hoaMonthly: 0,
    maintenancePercent: 5,
    capexPercent: 5,
    propertyManagementPercent: 8,
    utilitiesMonthly: 0,
    leasingCosts: 0,
    otherExpenses: 0,
    annualExpenseGrowth: 2,
  },
  appreciationExit: { annualAppreciation: 3, holdingPeriodYears: 10, sellingCostsPercent: 6 },
};

export const mapleOptions: AnalysisOptions = {
  discountRate: 0.08, // Explicit sample choice, not an engine or product default.
  startDate: new Date('2026-10-19T00:00:00Z'),
};
export const mapleScenarios: Record<string, ScenarioOverrides> = {
  optimistic: {
    income: { vacancyRate: 3, annualRentGrowth: 4 },
    appreciationExit: { annualAppreciation: 4 },
  },
  conservative: {
    income: { vacancyRate: 8, annualRentGrowth: 2 },
    appreciationExit: { annualAppreciation: 2 },
  },
};
// Bundled reference assumptions through 2024, not independently verified live data.
export const mapleBenchmarks: BenchmarkData[] = [
  {
    type: 'sp500',
    name: 'S&P 500',
    historicalCAGR: 10.5,
    volatility: 15.5,
    source: 'RealROI reference, 1926–2024',
  },
  {
    type: 'nasdaq100',
    name: 'Nasdaq 100',
    historicalCAGR: 12.5,
    volatility: 22,
    source: 'RealROI reference, 1985–2024',
  },
  {
    type: 'bonds',
    name: 'US Bonds',
    historicalCAGR: 5,
    volatility: 5.5,
    source: 'RealROI reference, 1976–2024',
  },
  {
    type: 'reits',
    name: 'REITs',
    historicalCAGR: 9.5,
    volatility: 18,
    source: 'RealROI reference, 1972–2024',
  },
  {
    type: 'savings',
    name: 'Savings',
    historicalCAGR: 4.5,
    volatility: 0.5,
    source: 'RealROI reference, 2020–2024',
  },
].map((b) => ({
  ...b,
  type: b.type as BenchmarkData['type'],
  description: 'Illustrative reference assumption',
  averageYield: 0,
  color: '#1e3a8a',
}));

/** Reproducible values consumed by the companion design; always use the public API. */
export function mapleOutputs() {
  const base = analyze(mapleCourt, mapleOptions);
  const comparison = compareWithBenchmarks(base, [mapleBenchmarks[0], mapleBenchmarks[2]]);
  return {
    base,
    scenarios: Object.fromEntries(
      Object.entries(mapleScenarios).map(([id, overrides]) => [
        id,
        analyzeWithScenario(mapleCourt, overrides, mapleOptions),
      ]),
    ),
    comparison,
    benchmarks: mapleBenchmarks.map((b) => compareWithBenchmarks(base, [b]).assets[1]),
    exit5: analyzeWithScenario(
      mapleCourt,
      { appreciationExit: { holdingPeriodYears: 5 } },
      mapleOptions,
    ),
    sensitivity: [21000, 23000, 25000].map((monthlyRent) =>
      [3, 5, 8].map(
        (vacancyRate) =>
          analyzeWithScenario(mapleCourt, { income: { monthlyRent, vacancyRate } }, mapleOptions)
            .summaryMetrics.cashOnCash,
      ),
    ),
  };
}

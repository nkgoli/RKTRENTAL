/**
 * Benchmark asset types
 */
export type BenchmarkType =
  | 'sp500' // S&P 500 Index
  | 'nasdaq100' // Nasdaq 100 Index
  | 'bonds' // US Aggregate Bonds
  | 'reits' // Real Estate Investment Trusts
  | 'savings' // High-yield savings account
  | 'custom'; // Custom benchmark

/**
 * Historical return data for a benchmark
 */
export interface BenchmarkData {
  type: BenchmarkType;
  name: string;
  description: string;
  /** Historical compound annual growth rate */
  historicalCAGR: number;
  /** Average annual dividend/yield */
  averageYield: number;
  /** Standard deviation of annual returns (volatility) */
  volatility: number;
  /** Data source and date range */
  source: string;
  /** Color for charts */
  color: string;
}

/**
 * Projected investment value at a point in time
 */
export interface InvestmentProjection {
  year: number;
  /** Total value of the investment */
  value: number;
  /** Cumulative contributions */
  contributions: number;
  /** Cumulative growth (value - contributions) */
  growth: number;
  /** Annualized return to this point */
  annualizedReturn: number;
}

/**
 * Comparison result between property and benchmark
 */
export interface BenchmarkComparison {
  benchmark: BenchmarkData;
  /** Initial investment amount (same as property) */
  initialInvestment: number;
  /** Holding period in years */
  holdingPeriodYears: number;
  /** Year-by-year projection */
  projections: InvestmentProjection[];
  /** Final value at end of holding period */
  finalValue: number;
  /** Total return percentage */
  totalReturn: number;
  /** Annualized return (CAGR) */
  annualizedReturn: number;
  /** Total growth (final - initial) */
  totalGrowth: number;
}

/**
 * Property investment summary for comparison
 */
export interface PropertyInvestmentSummary {
  initialInvestment: number;
  holdingPeriodYears: number;
  /** Year-by-year equity + cumulative cash flow */
  projections: InvestmentProjection[];
  finalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  totalGrowth: number;
  /** IRR if available */
  irr?: number;
}

/**
 * Full comparison result
 */
export interface ComparisonResult {
  property: PropertyInvestmentSummary;
  benchmarks: BenchmarkComparison[];
  /** Winner by total return */
  bestPerformer: 'property' | BenchmarkType;
  /** Difference between property and best benchmark */
  outperformance: number;
}

// ============================================
// Asset Comparison Types (Phase 6)
// ============================================

/**
 * Asset type for comparison - includes property and all benchmark types
 */
export type AssetType = 'property' | BenchmarkType;

/**
 * Unified asset representation for comparison
 */
export interface ComparableAsset {
  id: string;
  type: AssetType;
  name: string;
  description: string;
  color: string;
  /** Initial investment amount */
  initialInvestment: number;
  /** Holding period in years */
  holdingPeriodYears: number;
  /** Year-by-year projections */
  projections: InvestmentProjection[];
  /** Final value at end of period */
  finalValue: number;
  /** Total return as percentage */
  totalReturn: number;
  /** Annualized return (CAGR) */
  annualizedReturn: number;
  /** Total growth in dollars */
  totalGrowth: number;
  /** Volatility (standard deviation) - for benchmarks */
  volatility?: number;
  /** Dividend/cash flow yield */
  yield?: number;
  /** IRR if available (for property) */
  irr?: number;
}

/**
 * Comparison configuration options
 */
export interface ComparisonConfig {
  /** Normalize all investments to this amount */
  initialInvestment: number;
  /** Compare over this holding period */
  holdingPeriodYears: number;
  /** Include dividends/cash flow in returns */
  includeDividends: boolean;
  /** Reinvest dividends/cash flow */
  reinvestDividends: boolean;
}

/**
 * Multi-asset comparison result
 */
export interface AssetComparisonResult {
  /** Configuration used for comparison */
  config: ComparisonConfig;
  /** Assets being compared (2-3) */
  assets: ComparableAsset[];
  /** Asset with highest total return */
  bestByTotalReturn: AssetType;
  /** Asset with highest annualized return */
  bestByAnnualizedReturn: AssetType;
  /** Asset with lowest volatility */
  lowestVolatility: AssetType;
  /** Rankings by different metrics */
  rankings: {
    byTotalReturn: AssetType[];
    byAnnualizedReturn: AssetType[];
    byVolatility: AssetType[];
    byFinalValue: AssetType[];
  };
}

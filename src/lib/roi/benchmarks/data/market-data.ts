import type { BenchmarkData, BenchmarkType } from '../types.js';

/**
 * Historical market benchmark data
 *
 * Data sources:
 * - S&P 500: Historical average from 1926-2024 (with dividends reinvested)
 * - Nasdaq 100: Historical average from 1985-2024
 * - Bonds: Bloomberg US Aggregate Bond Index historical average
 * - REITs: FTSE Nareit All Equity REITs Index historical average
 * - Savings: Average high-yield savings account rate (2020-2024)
 */

export const BENCHMARK_DATA: Record<BenchmarkType, BenchmarkData> = {
  sp500: {
    type: 'sp500',
    name: 'S&P 500',
    description: 'Large-cap US stocks index tracking 500 leading companies',
    historicalCAGR: 10.5, // ~10.5% long-term average with dividends
    averageYield: 1.8, // Current dividend yield ~1.8%
    volatility: 15.5, // Standard deviation of annual returns
    source: 'S&P Dow Jones Indices (1926-2024)',
    color: '#3b82f6', // Blue
  },

  nasdaq100: {
    type: 'nasdaq100',
    name: 'Nasdaq 100',
    description: 'Technology-heavy index of 100 largest non-financial Nasdaq companies',
    historicalCAGR: 12.5, // Higher growth, more volatile
    averageYield: 0.8, // Lower dividend yield
    volatility: 22.0, // More volatile than S&P 500
    source: 'Nasdaq (1985-2024)',
    color: '#8b5cf6', // Purple
  },

  bonds: {
    type: 'bonds',
    name: 'US Bonds',
    description: 'US Aggregate Bond Index - investment-grade bonds',
    historicalCAGR: 5.0, // Lower returns but more stable
    averageYield: 4.5, // Current yield
    volatility: 5.5, // Much lower volatility
    source: 'Bloomberg US Aggregate Bond Index (1976-2024)',
    color: '#22c55e', // Green
  },

  reits: {
    type: 'reits',
    name: 'REITs',
    description: 'Real Estate Investment Trusts - publicly traded real estate',
    historicalCAGR: 9.5, // Similar to stocks long-term
    averageYield: 4.2, // Higher dividend yield
    volatility: 18.0, // Moderate volatility
    source: 'FTSE Nareit All Equity REITs Index (1972-2024)',
    color: '#f97316', // Orange
  },

  savings: {
    type: 'savings',
    name: 'High-Yield Savings',
    description: 'FDIC-insured high-yield savings account',
    historicalCAGR: 4.5, // Current high-yield rates
    averageYield: 4.5, // All return is yield
    volatility: 0.5, // Essentially no volatility
    source: 'Average HYSA rates (2020-2024)',
    color: '#64748b', // Gray
  },

  custom: {
    type: 'custom',
    name: 'Custom',
    description: 'User-defined benchmark',
    historicalCAGR: 8.0,
    averageYield: 2.0,
    volatility: 12.0,
    source: 'User defined',
    color: '#ec4899', // Pink
  },
};

/**
 * Get benchmark data by type
 */
export function getBenchmark(type: BenchmarkType): BenchmarkData {
  return BENCHMARK_DATA[type];
}

/**
 * Get all available benchmarks
 */
export function getAllBenchmarks(): BenchmarkData[] {
  return Object.values(BENCHMARK_DATA).filter((b) => b.type !== 'custom');
}

/**
 * Get default benchmarks for comparison
 */
export function getDefaultBenchmarks(): BenchmarkData[] {
  return [BENCHMARK_DATA.sp500, BENCHMARK_DATA.nasdaq100, BENCHMARK_DATA.bonds];
}

/**
 * Create a custom benchmark
 */
export function createCustomBenchmark(
  name: string,
  cagr: number,
  yield_: number = 0,
  volatility: number = 10,
): BenchmarkData {
  return {
    type: 'custom',
    name,
    description: `Custom benchmark: ${name}`,
    historicalCAGR: cagr,
    averageYield: yield_,
    volatility,
    source: 'User defined',
    color: '#ec4899',
  };
}

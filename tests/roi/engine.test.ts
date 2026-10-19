import { describe, expect, it } from 'vitest';
import {
  analyze,
  analyzeWithScenario,
  calculateIRR,
  calculateNPV,
  compareWithBenchmarks,
  compareScenarios,
  calculateSensitivityRange,
  type DealInput,
  type AnalysisOptions,
  type BenchmarkData,
  DealInputSchema,
} from '../../src/lib/roi';

// Deliberately independent fixture: no source sample/default constructor.
function deal(): DealInput {
  return {
    schemaVersion: 1,
    propertyInfo: { name: '', address: '', city: '', state: '', zipCode: '' },
    purchase: { purchasePrice: 100000, closingCosts: 0, rehabCosts: 0, furnishingCosts: 0 },
    financing: {
      downPaymentPercent: 100,
      interestRate: 0,
      loanTermYears: 30,
      loanType: 'conventional',
      pointsPaid: 0,
      lenderFees: 0,
    },
    income: { monthlyRent: 1000, otherMonthlyIncome: 0, vacancyRate: 0, annualRentGrowth: 0 },
    expenses: {
      propertyTax: 1200,
      insurance: 0,
      hoaMonthly: 0,
      maintenancePercent: 0,
      capexPercent: 0,
      propertyManagementPercent: 0,
      utilitiesMonthly: 0,
      leasingCosts: 0,
      otherExpenses: 0,
      annualExpenseGrowth: 0,
    },
    appreciationExit: { annualAppreciation: 0, holdingPeriodYears: 1, sellingCostsPercent: 0 },
  };
}
const options: AnalysisOptions = {
  discountRate: 0.08,
  startDate: new Date('2026-01-31T00:00:00Z'),
};
const tax: NonNullable<AnalysisOptions['tax']> = {
  marginalTaxRate: 20,
  stateTaxRate: 0,
  capitalGainsTaxRate: 15,
  recaptureTaxRate: 25,
  depreciationEnabled: false,
  depreciationYears: 27.5,
  landValuePercent: 20,
  allowImmediateLossBenefit: false,
};
const benchmark: BenchmarkData = {
  type: 'custom',
  name: 'Test',
  description: 'Test assumption',
  historicalCAGR: 10,
  averageYield: 2,
  volatility: 5,
  source: 'Test assumption, 2026-01-01',
  color: '#000',
};

describe('independent cash and return references', () => {
  it('preserves an accepted zero ARV through value, equity, sale and summary', () => {
    const d = deal();
    d.purchase.afterRepairValue = 0;
    d.financing.loanAmount = 60000;
    d.appreciationExit.annualAppreciation = 10;
    const r = analyze(d, options);
    expect(r.annualCashflows[0].propertyValue).toBe(0);
    expect(r.annualCashflows[0].equity).toBe(-57999.96);
    expect(r.equityTimeline.every((p) => p.propertyValue === 0)).toBe(true);
    expect(r.equityTimeline.at(-1)!.equity).toBe(-57999.96);
    expect(r.saleProceeds).toEqual({
      grossSalePrice: 0,
      sellingCosts: 0,
      netSaleProceeds: 0,
      loanPayoff: 57999.96,
      netProceeds: -57999.96,
    });
    expect(r.summaryMetrics.totalReturn).toBe(-89200);
    expect(r.cashflows).toEqual([-40000, -49200]);
    expect(r.summaryMetrics.npv).toBeCloseTo(-40000 - 49200 / 1.08, 8);
    expect(compareWithBenchmarks(r, [benchmark]).assets[0].finalValue).toBe(-49200);
    const missing = deal();
    expect(analyze(missing, options).saleProceeds.grossSalePrice).toBe(100000);
    d.appreciationExit.salePriceOverride = 50000;
    expect(analyze(d, options).saleProceeds.grossSalePrice).toBe(50000);
  });
  it('keeps capital reserves out of NOI while reducing spendable cash flow and IRR', () => {
    const d = deal();
    d.expenses.capex = 1200;
    const r = analyze(d, options);
    expect(r.summaryMetrics.noi).toBe(10800);
    expect(r.summaryMetrics.annualCashFlow).toBe(9600);
    expect(r.annualCashflows[0].cashFlow).toBe(9600);
    expect(r.summaryMetrics.irrUnleveraged).toBeCloseTo(0.096, 9);
    const taxed = analyze(d, { ...options, tax });
    expect(taxed.afterTaxCashflows![1]).toBe(107440);
  });
  it('clamps month-end dates consistently in UTC, with payment at month end', () => {
    const d = deal();
    d.financing.downPaymentPercent = 20;
    const r = analyze(d, options);
    expect(r.monthlyCashflows[0].date!.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(r.monthlyCashflows[1].date!.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(r.amortizationSchedule[0].date!.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });
  it('cash purchase: 12,000 rent less 1,200 costs, unchanged 100,000 sale', () => {
    const r = analyze(deal(), options);
    expect(r.summaryMetrics.noi).toBe(10800);
    expect(r.summaryMetrics.capRate).toBe(0.108);
    expect(r.summaryMetrics.cashOnCash).toBeCloseTo(0.108, 10);
    expect(r.summaryMetrics.irrLeveraged).toBeCloseTo(0.108, 9);
    expect(r.summaryMetrics.irrUnleveraged).toBeCloseTo(0.108, 9);
    expect(r.summaryMetrics.npv).toBeCloseTo(-100000 + 110800 / 1.08, 8);
    expect(r.summaryMetrics.dscr).toBeNull();
    expect(r.unavailable.dscr).toBeTruthy();
    expect(r.saleProceeds.netProceeds).toBe(100000);
  });
  it('uses explicit debt amount to compute actual acquisition equity', () => {
    const d = deal();
    d.financing.loanAmount = 60000;
    const r = analyze(d, options);
    expect(r.summaryMetrics.totalCashRequired).toBe(40000);
    expect(r.summaryMetrics.annualDebtService).toBe(2000.04);
    expect(r.saleProceeds.loanPayoff).toBe(57999.96);
  });
  it('known mortgage PMT, interest, principal and sale payoff', () => {
    const d = deal();
    d.financing = { ...d.financing, downPaymentPercent: 20, interestRate: 6 };
    const r = analyze(d, options);
    const monthly = (80000 * 0.005) / (1 - 1.005 ** -360);
    expect(r.summaryMetrics.monthlyDebtService).toBeCloseTo(monthly, 2);
    expect(r.amortizationSchedule[0].interest).toBe(400);
    expect(r.amortizationSchedule[0].principal).toBe(79.64);
    const balance = 80000 * 1.005 ** 12 - (monthly * (1.005 ** 12 - 1)) / 0.005;
    expect(r.saleProceeds.loanPayoff).toBeCloseTo(balance, 1);
  });
  it('zero-rate loan finishes at contractual term and stops charging', () => {
    const d = deal();
    d.financing = { ...d.financing, downPaymentPercent: 40, loanTermYears: 1 };
    d.appreciationExit.holdingPeriodYears = 2;
    const r = analyze(d, options);
    expect(r.amortizationSchedule).toHaveLength(12);
    expect(r.amortizationSchedule[11].balance).toBe(0);
    expect(r.annualCashflows[0].debtService).toBe(60000);
    expect(r.annualCashflows[1].debtService).toBe(0);
    expect(r.summaryMetrics.annualCashFlow).toBe(-49200);
  });
  it('balloon is a real cash outflow at maturity, never forgiven', () => {
    const d = deal();
    d.financing = {
      ...d.financing,
      downPaymentPercent: 40,
      loanTermYears: 1,
      amortizationYears: 30,
    };
    d.appreciationExit.holdingPeriodYears = 2;
    const r = analyze(d, options);
    expect(r.amortizationSchedule[11].payment).toBe(58166.63);
    expect(r.annualCashflows[0].principalPaid).toBe(60000);
    expect(r.annualCashflows[0].debtService).toBe(60000);
    expect(r.annualCashflows[1].loanBalance).toBe(0);
    expect(r.summaryMetrics.totalReturn).toBe(21600);
  });
  it('includes all acquisition costs in both IRRs', () => {
    const d = deal();
    d.purchase.closingCosts = 1000;
    d.purchase.rehabCosts = 2000;
    d.purchase.furnishingCosts = 500;
    const r = analyze(d, options);
    expect(r.summaryMetrics.totalCashRequired).toBe(103500);
    expect(r.summaryMetrics.irrLeveraged).toBeCloseTo(110800 / 103500 - 1, 9);
    expect(r.summaryMetrics.irrUnleveraged).toBeCloseTo(r.summaryMetrics.irrLeveraged!, 9);
    expect(r.equityTimeline[0].equity).toBe(100000);
    expect(r.equityTimeline[0].initialEquity).toBe(100000);
  });
  it('ARV appreciation, sale override, selling costs and debt are separate', () => {
    const d = deal();
    d.purchase.afterRepairValue = 120000;
    d.appreciationExit = {
      annualAppreciation: 10,
      holdingPeriodYears: 2,
      sellingCostsPercent: 5,
      salePriceOverride: 150000,
    };
    const r = analyze(d, options);
    expect(r.annualCashflows[1].propertyValue).toBe(145200);
    expect(r.saleProceeds.netProceeds).toBe(142500);
    expect(r.summaryMetrics.totalReturn).toBe(64100);
  });
  it('applies income and expense growth only beginning in year two', () => {
    const d = deal();
    d.income.annualRentGrowth = 10;
    d.expenses.annualExpenseGrowth = 20;
    d.appreciationExit.holdingPeriodYears = 2;
    const r = analyze(d, options);
    expect(r.annualCashflows[1].grossRent).toBe(13200);
    expect(r.annualCashflows[1].operatingExpenses).toBe(1440);
  });
  it('retains loss-making cash flows and occupancy greater than 100%', () => {
    const d = deal();
    d.expenses.propertyTax = 24000;
    const r = analyze(d, options);
    expect(r.summaryMetrics.annualCashFlow).toBe(-12000);
    expect(r.summaryMetrics.breakEvenOccupancy).toBe(2);
    expect(r.summaryMetrics.irrLeveraged).toBeCloseTo(-0.12, 9);
    expect(r.warnings.some((w) => w.code === 'NEGATIVE_CASH_FLOW')).toBe(true);
  });
});

describe('missing, invalid and uncomputable values', () => {
  it('requires financial assumptions rather than silently supplying sample defaults', () => {
    const d = deal();
    const { vacancyRate: omitted, ...income } = d.income;
    expect(omitted).toBe(0);
    expect(() => analyze({ ...d, income }, options)).toThrow();
    expect(() => analyze({}, options)).toThrow();
    expect(() => analyze(d, { startDate: options.startDate } as AnalysisOptions)).toThrow();
  });
  it.each([NaN, Infinity, -1, 1e11])('rejects invalid purchase price %s', (price) => {
    const d = deal();
    d.purchase.purchasePrice = price;
    expect(() => analyze(d, options)).toThrow();
  });
  it('rejects leverage exceeding price, huge terms, wrong percentages and missing options', () => {
    const d = deal();
    d.financing.loanAmount = 100001;
    expect(() => analyze(d, options)).toThrow();
    delete d.financing.loanAmount;
    d.financing.loanTermYears = 51;
    expect(() => analyze(d, options)).toThrow();
    d.financing.loanTermYears = 30;
    d.income.vacancyRate = 101;
    expect(() => analyze(d, options)).toThrow();
    expect(() => analyze(deal(), { ...options, discountRate: -1 })).toThrow();
    expect(() => analyze(deal(), { ...options, startDate: new Date('invalid') })).toThrow();
  });
  it('zero income and zero equity give null ratios with reasons', () => {
    const d = deal();
    d.income.monthlyRent = 0;
    d.financing.downPaymentPercent = 0;
    const r = analyze(d, options);
    expect(r.summaryMetrics.cashOnCash).toBeNull();
    expect(r.summaryMetrics.equityMultiple).toBeNull();
    expect(r.summaryMetrics.grm).toBeNull();
    expect(r.summaryMetrics.oer).toBeNull();
    expect(r.summaryMetrics.breakEvenOccupancy).toBeNull();
  });
  it('rejects numeric overflow rather than returning misleading finite metrics', () => {
    const d = deal();
    d.appreciationExit.annualAppreciation = 100;
    d.appreciationExit.holdingPeriodYears = 50;
    expect(() => analyze(d, { ...options, discountRate: -0.99 })).toThrow();
  });
  it('IRR and NPV match hand-computed references and reject ambiguous roots', () => {
    expect(calculateNPV([-100, 121], 0.1)).toBeCloseTo(10, 10);
    expect(calculateIRR([-100, 121])).toBeCloseTo(0.21, 10);
    expect(calculateIRR([-100, 0, 121])).toBeCloseTo(0.1, 10);
    expect(calculateIRR([-100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100])).toBeCloseTo(0, 10);
    expect(calculateIRR([-100, 230, -132])).toBeNull(); // roots 10% and 20%
    expect(calculateIRR([100, 120])).toBeNull();
    expect(calculateIRR([-100, -1])).toBeNull();
    expect(calculateIRR([-1, Infinity])).toBeNull();
    expect(calculateNPV([-100, 100], -1)).toBeNull();
    expect(calculateIRR([-100, ...Array(49).fill(0), 110])).toBeCloseTo(1.1 ** (1 / 50) - 1, 10);
  });
});

describe('tax, scenarios and comparisons', () => {
  it('accepts property IDs through every public analysis path without omitting the ID', () => {
    const d = { ...deal(), propertyId: 'cm7a2nx9b0000u8hc4cj87t3p' };
    const original = structuredClone(d);
    expect(DealInputSchema.parse(d).propertyId).toBe(d.propertyId);
    expect(analyze(d, options).summaryMetrics.noi).toBe(10800);
    expect(
      analyzeWithScenario(d, { income: { monthlyRent: 2000 } }, options).summaryMetrics.noi,
    ).toBe(22800);
    const scenarios = compareScenarios(
      d,
      [{ id: 'rent', overrides: { income: { monthlyRent: 2000 } } }],
      options,
    );
    expect(scenarios.baseline.summaryMetrics.noi).toBe(10800);
    expect(scenarios.scenarios[0].result.summaryMetrics.noi).toBe(22800);
    expect(
      calculateSensitivityRange(d, 'income', 'monthlyRent', [0, 2000], options).map(
        (p) => p.result.summaryMetrics.noi,
      ),
    ).toEqual([-1200, 22800]);
    expect(d).toEqual(original);
    expect(() => analyze({ ...d, propertyId: '' }, options)).toThrow();
    expect(() => analyze({ ...d, propertyId: 'x'.repeat(201) }, options)).toThrow();
    expect(
      analyze({ ...d, propertyId: '550e8400-e29b-41d4-a716-446655440000' }, options).summaryMetrics
        .noi,
    ).toBe(10800);
  });
  it('rejects a 100%-CAGR benchmark for a safe low-growth 50-year property', () => {
    const d = deal();
    d.appreciationExit.holdingPeriodYears = 50;
    const r = analyze(d, options);
    expect(r.saleProceeds.grossSalePrice).toBe(100000);
    expect(() => compareWithBenchmarks(r, [{ ...benchmark, historicalCAGR: 100 }])).toThrow(
      /Comparison output outside safe monetary precision/,
    );
  });
  it('enforces the comparison boundary on both sides using independent powers of two', () => {
    const d = deal();
    d.appreciationExit.holdingPeriodYears = 29;
    const safe = compareWithBenchmarks(analyze(d, options), [
      { ...benchmark, historicalCAGR: 100 },
    ]);
    expect(safe.assets[1].finalValue).toBe(100000 * 2 ** 29);
    expect(safe.assets[1].finalValue).toBeLessThan(Number.MAX_SAFE_INTEGER / 100);
    d.appreciationExit.holdingPeriodYears = 30;
    expect(100000 * 2 ** 30).toBeGreaterThan(Number.MAX_SAFE_INTEGER / 100);
    expect(() =>
      compareWithBenchmarks(analyze(d, options), [{ ...benchmark, historicalCAGR: 100 }]),
    ).toThrow(RangeError);
  });
  it('checks intermediate comparison points and ratios, not only final wealth', () => {
    const d = deal();
    d.appreciationExit.holdingPeriodYears = 2;
    const r = analyze(d, options);
    r.annualCashflows[0].equity = Number.MAX_SAFE_INTEGER / 100 + 1;
    expect(() => compareWithBenchmarks(r, [benchmark])).toThrow(RangeError);
    const tiny = analyze(deal(), options);
    tiny.summaryMetrics.totalCashRequired = 1e-20;
    expect(() => compareWithBenchmarks(tiny, [benchmark])).toThrow(RangeError);
  });
  it('scenario tables and sensitivity points use the validated engine', () => {
    const d = deal();
    const comparison = compareScenarios(
      d,
      [{ id: 'rent-up', overrides: { income: { monthlyRent: 2000 } } }],
      options,
    );
    expect(comparison.baseline.summaryMetrics.noi).toBe(10800);
    expect(comparison.scenarios[0].result.summaryMetrics.noi).toBe(22800);
    const sensitivity = calculateSensitivityRange(
      d,
      'income',
      'monthlyRent',
      [0, 1000, 2000],
      options,
    );
    expect(sensitivity.map((p) => p.result.summaryMetrics.noi)).toEqual([-1200, 10800, 22800]);
    expect(() => calculateSensitivityRange(d, 'income', 'missing', [1], options)).toThrow();
    expect(() =>
      compareScenarios(
        d,
        [
          { id: 'x', overrides: {} },
          { id: 'x', overrides: {} },
        ],
        options,
      ),
    ).toThrow();
  });
  it('tax without depreciation is still applied and legacy implicit settings are refused', () => {
    const r = analyze(deal(), { ...options, tax });
    expect(r.afterTaxCashflows).toEqual([-100000, 108640]);
    expect(r.summaryMetrics.afterTaxIrr).toBeCloseTo(0.0864, 9);
    expect(analyze(deal(), options).summaryMetrics.afterTaxIrr).toBeNull();
    expect(() => analyze({ ...deal(), taxes: {} }, options)).toThrow();
  });
  it('sale tax uses asset basis, independent of loan and equity financing', () => {
    const d = deal();
    d.appreciationExit.salePriceOverride = 120000;
    const cash = analyze(d, { ...options, tax });
    d.financing.downPaymentPercent = 20;
    const debt = analyze(d, { ...options, tax });
    // 20,000 asset gain * 15% = 3,000 sale tax regardless of debt.
    expect(cash.afterTaxCashflows![1]).toBe(125640);
    const last = debt.annualCashflows[0];
    expect(debt.afterTaxCashflows![1]).toBeCloseTo(
      last.cashFlow - last.noi * 0.2 + debt.saleProceeds.netProceeds - 3000,
      8,
    );
  });
  it('depreciation is capped through a 30-year hold, with editable recapture and loss policy', () => {
    const d = deal();
    d.appreciationExit.holdingPeriodYears = 30;
    const r = analyze(d, { ...options, tax: { ...tax, depreciationEnabled: true } });
    // 80,000 depreciation total; 25% recapture = 20,000, even after year 28.
    expect(r.afterTaxCashflows!.at(-1)).toBeCloseTo(8640 + 100000 - 20000, 1);
    d.expenses.propertyTax = 24000;
    const noBenefit = analyze(d, { ...options, tax });
    const benefit = analyze(d, { ...options, tax: { ...tax, allowImmediateLossBenefit: true } });
    expect(benefit.afterTaxCashflows![1] - noBenefit.afterTaxCashflows![1]).toBe(2400);
  });
  it('partial scenario overrides preserve base inputs and deterministic results', () => {
    const d = deal();
    const original = structuredClone(d);
    const r = analyzeWithScenario(d, { income: { monthlyRent: 2000 } }, options);
    expect(r.summaryMetrics.noi).toBe(22800);
    expect(d).toEqual(original);
    expect(analyze(d, options)).toEqual(analyze(d, options));
  });
  it('compares same capital/horizon, includes exit costs, and does not double count yield', () => {
    const d = deal();
    d.appreciationExit.sellingCostsPercent = 5;
    const r = analyze(d, options);
    const comparison = compareWithBenchmarks(r, [benchmark]);
    expect(comparison.assets[0].finalValue).toBe(105800);
    expect(comparison.assets[1].finalValue).toBe(110000);
    expect(comparison.ranking).toEqual(['custom', 'property']);
    expect(() => compareWithBenchmarks(r, [])).toThrow();
    expect(() => compareWithBenchmarks(r, [{ ...benchmark, historicalCAGR: NaN }])).toThrow();
  });
});

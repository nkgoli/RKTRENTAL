import { describe, expect, it } from 'vitest';
import { calculatePayload } from '@/lib/analysis/contract';
import {
  calculateExits,
  calculateSensitivity,
  dollars,
  exitControls,
  loanYears,
  projectionRows,
  rate,
  sensitivityControls,
} from '@/lib/analysis/projections';
import { payload } from './fixture';

describe('projection adapters and public model reconciliation', () => {
  it('keeps reserves below NOI, includes every year and retains negative and zero cash flow', () => {
    const p = payload();
    p.input.appreciationExit!.holdingPeriodYears = 5;
    p.input.expenses!.capex = 12000;
    p.input.expenses!.annualExpenseGrowth = 3;
    const result = calculatePayload(p).base;
    const rows = projectionRows(result);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ noi: 10800, reserves: 12000, cashFlow: -1200 });
    for (const row of rows) {
      expect(row.effectiveGrossIncome - row.operatingExpenses).toBeCloseTo(row.noi, 2);
      expect(row.noi - row.debtService - row.reserves).toBeCloseTo(row.cashFlow, 2);
    }
    p.input.expenses!.capex = 10800;
    expect(projectionRows(calculatePayload(p).base)[0].cashFlow).toBe(0);
    expect(dollars(0)).toBe('$0.00');
    expect(dollars(-1200.21)).toBe('-$1,200.21');
    expect(rate(null)).toBe('Unavailable');
    expect(rate(-0.093871)).toBe('-9.3871%');
    // Sensitivity display rounds to one place; whole percentages keep their .0.
    expect(rate(-0.093871, 1)).toBe('-9.4%');
    expect(rate(-0.118086, 1)).toBe('-11.8%');
    expect(rate(0.05, 1)).toBe('5.0%');
    expect(rate(-0.0004, 1)).toBe('0.0%');
  });

  it('uses engine all-cash and balloon schedules, including the maturity outflow', () => {
    const p = payload();
    const cash = calculatePayload(p).base;
    expect(loanYears(cash)).toEqual([]);
    expect(cash.summaryMetrics.dscr).toBeNull();
    p.input.financing!.downPaymentPercent = 25;
    p.input.financing!.interestRate = 6;
    p.input.financing!.loanTermYears = 2;
    p.input.financing!.amortizationYears = 30;
    p.input.appreciationExit!.holdingPeriodYears = 3;
    const result = calculatePayload(p).base;
    const years = loanYears(result);
    expect(result.amortizationSchedule).toHaveLength(24);
    expect(years).toHaveLength(2);
    expect(years[1].balance).toBe(0);
    expect(years[1].payment).toBeGreaterThan(70000);
    for (const row of years) {
      const projection = result.annualCashflows[row.year - 1];
      expect(row.payment).toBeCloseTo(projection.debtService, 2);
      expect(row.principal).toBeCloseTo(projection.principalPaid, 2);
      expect(row.interest).toBeCloseTo(projection.interestPaid, 2);
    }
    expect(result.annualCashflows[1].cashFlow).toBeLessThan(0);
    expect(result.annualCashflows[2].debtService).toBe(0);
  });

  it('recalculates exit horizons and sale overrides, separating wealth and profit without mutating base', () => {
    const p = payload();
    p.input.purchase!.closingCosts = 2000;
    p.input.purchase!.afterRepairValue = 120000;
    p.input.appreciationExit!.holdingPeriodYears = 10;
    p.input.appreciationExit!.annualAppreciation = 3;
    const before = structuredClone(p);
    const exits = calculateExits(p, { years: '5', sellingCosts: '6', salePrice: '90000' });
    const result = exits[0].result;
    const direct = structuredClone(p);
    Object.assign(direct.input.appreciationExit!, {
      holdingPeriodYears: 5,
      sellingCostsPercent: 6,
      salePriceOverride: 90000,
    });
    expect(result.summaryMetrics).toEqual(calculatePayload(direct).base.summaryMetrics);
    expect(result.saleProceeds.netProceeds).toBe(84600);
    expect(result.annualCashflows.at(-1)!.equity).not.toBe(result.saleProceeds.netProceeds);
    expect(result.summaryMetrics.totalReturn).toBeCloseTo(84600 + 10800 * 5 - 102000, 2);
    expect(p).toEqual(before);
    expect(exitControls(p)).toEqual({ years: '10', sellingCosts: '0', salePrice: '' });
  });

  it('reconciles each sensitivity cell, preserves zero overrides and nullable returns', () => {
    const p = payload();
    p.benchmarks = [];
    p.input.financing!.downPaymentPercent = 0;
    p.input.expenses!.maintenance = 0;
    p.input.expenses!.maintenancePercent = 5;
    const before = structuredClone(p);
    const grid = calculateSensitivity(p, {
      rentMin: '0',
      rentMax: '1000',
      rentSteps: '3',
      vacancyMin: '0',
      vacancyMax: '100',
      vacancySteps: '3',
    });
    expect(grid.rents).toEqual([0, 500, 1000]);
    expect(grid.vacancies).toEqual([0, 50, 100]);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const direct = structuredClone(p);
        Object.assign(direct.input.income!, {
          monthlyRent: grid.rents[r],
          vacancyRate: grid.vacancies[c],
        });
        const expected = calculatePayload(direct).base;
        expect(grid.cells[r][c].cashOnCash).toBe(expected.summaryMetrics.cashOnCash);
        expect(grid.cells[r][c].irr).toBe(expected.summaryMetrics.irrLeveraged);
        expect(grid.cells[r][c].cashOnCash).toBeNull();
        expect(grid.cells[r][c].reason).toBeTruthy();
      }
    expect(p).toEqual(before);
  });

  it.each([
    { rentMin: '' },
    { rentMin: 'bad' },
    { rentMin: '-1' },
    { rentMin: '3000', rentMax: '1000' },
    { rentSteps: '10' },
    { rentSteps: '1.5' },
    { vacancyMax: '101' },
    { rentSteps: '1' },
    { rentMin: '1000', rentMax: '1000', rentSteps: '3' },
  ])('rejects invalid or unbounded sensitivity ranges %j', (overrides) => {
    const p = payload();
    expect(() => calculateSensitivity(p, { ...sensitivityControls(p), ...overrides })).toThrow();
  });

  it.each([
    { years: '' },
    { years: '51' },
    { years: '2.5' },
    { sellingCosts: '-1' },
    { sellingCosts: '31' },
    { salePrice: '0' },
    { salePrice: 'Infinity' },
  ])('rejects invalid exit controls %j', (overrides) => {
    const p = payload();
    expect(() => calculateExits(p, { ...exitControls(p), ...overrides })).toThrow();
  });

  it('keeps overflow cells unavailable and recovers with a bounded calculation', () => {
    const p = payload();
    p.input.income!.annualRentGrowth = 100;
    p.input.appreciationExit!.holdingPeriodYears = 50;
    const controls = {
      rentMin: '10000000000',
      rentMax: '10000000000',
      rentSteps: '1',
      vacancyMin: '0',
      vacancyMax: '0',
      vacancySteps: '1',
    };
    const failed = calculateSensitivity(p, controls);
    expect(failed.cells[0][0].cashOnCash).toBeNull();
    expect(failed.cells[0][0].reason).toMatch(/safe monetary precision/);
    p.input.appreciationExit!.holdingPeriodYears = 1;
    expect(calculateSensitivity(p, controls).cells[0][0].cashOnCash).not.toBeNull();
  });
});

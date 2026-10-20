import { describe, expect, it } from 'vitest';
import { DealInputSchema, analyze } from '@/lib/roi';
import { DealInputSchema as PipelineSchema } from '@/lib/roi/core/domain/schemas/deal-input.schema';
import {
  calculatePayload,
  missingData,
  PayloadSchema,
  rehydrateInput,
} from '@/lib/analysis/contract';
import { parseRoiInputs } from '@/lib/properties/roi-inputs';
import { cashPayload } from './cash-fixture';

describe('applicable financing and expense assumptions', () => {
  it('calculates an explicit cash purchase without fabricating loan terms or expense percentages', () => {
    const p = cashPayload();
    const original = structuredClone(p);
    const parsed = PayloadSchema.parse(p);
    expect(missingData(parsed)).toEqual([]);
    const input = DealInputSchema.parse(rehydrateInput(parsed.input));
    expect(input.financing).toEqual({ loanAmount: 0 });
    expect(PipelineSchema.parse(input).financing).toEqual({ loanAmount: 0 });
    for (const section of [input, PipelineSchema.parse(input)]) {
      expect(section.expenses.maintenancePercent).toBeUndefined();
      expect(section.expenses.capexPercent).toBeUndefined();
      expect(section.expenses.propertyManagementPercent).toBeUndefined();
    }
    const r = calculatePayload(parsed).base;
    // $12,000 rent - $1,200 tax; $100,000 cash acquisition and unchanged sale value.
    expect(r.summaryMetrics.totalCashRequired).toBe(100000);
    expect(r.summaryMetrics.annualCashFlow).toBe(10800);
    expect(r.summaryMetrics.annualDebtService).toBe(0);
    expect(r.amortizationSchedule).toEqual([]);
    expect(r.summaryMetrics.dscr).toBeNull();
    expect(r.cashflows).toEqual([-100000, 110800]);
    expect(r.summaryMetrics.npv).toBeCloseTo(-100000 + 110800 / 1.08, 8);
    expect(p).toEqual(original);
    const property = { version: 1, input: { ...p.input }, options: p.options };
    delete property.input.propertyId;
    delete property.input.schemaVersion;
    delete property.input.propertyInfo;
    expect(parseRoiInputs(property)).toMatchObject({ success: true, data: property });
  });

  it('treats an explicit 100% down payment as no debt without adding a loan amount', () => {
    const p = cashPayload();
    p.input.financing = { downPaymentPercent: 100 };
    expect(missingData(p)).toEqual([]);
    expect(calculatePayload(p).base.summaryMetrics.totalCashRequired).toBe(100000);
    expect(p.input.financing).toEqual({ downPaymentPercent: 100 });
  });

  it('preserves saved loan inputs but applies no lender costs or loan warnings to a cash purchase', () => {
    const p = cashPayload();
    p.input.financing = {
      loanAmount: 0,
      downPaymentPercent: 5,
      interestRate: 15,
      loanTermYears: 30,
      loanType: 'conventional',
      pointsPaid: 2,
      lenderFees: 3000,
    };
    const before = structuredClone(p);
    const r = calculatePayload(p).base;
    expect(r.summaryMetrics.totalCashRequired).toBe(100000);
    expect(r.summaryMetrics.annualDebtService).toBe(0);
    expect(
      r.warnings.some((w) => ['HIGH_INTEREST_RATE', 'LOW_DOWN_PAYMENT'].includes(w.code)),
    ).toBe(false);
    expect(p).toEqual(before);
  });

  it('keeps unknown debt and unrelated assumptions missing and permits partial property persistence', () => {
    const p = cashPayload();
    p.input.financing = {};
    delete p.input.income!.vacancyRate;
    expect(() => calculatePayload(p)).toThrow();
    p.input.income!.vacancyRate = 0;
    expect(missingData(p).map((i) => i.path)).toContain('input.financing.loanAmount');
    expect(parseRoiInputs({ version: 1, input: { financing: {} }, options: {} }).success).toBe(
      true,
    );
    p.input.financing = { loanAmount: 50000 };
    expect(missingData(p).map((i) => i.path)).toEqual(
      expect.arrayContaining([
        'input.financing.interestRate',
        'input.financing.loanTermYears',
        'input.financing.loanType',
        'input.financing.pointsPaid',
        'input.financing.lenderFees',
      ]),
    );
    expect(missingData(p).map((i) => i.path)).not.toContain('input.financing.downPaymentPercent');
  });

  it('supports a financed purchase with an explicit loan amount and no redundant down-payment percentage', () => {
    const p = cashPayload();
    p.input.financing = {
      loanAmount: 60000,
      interestRate: 0,
      loanTermYears: 1,
      loanType: 'conventional',
      pointsPaid: 0,
      lenderFees: 0,
    };
    const r = calculatePayload(p).base;
    expect(r.summaryMetrics.totalCashRequired).toBe(40000);
    expect(r.summaryMetrics.annualDebtService).toBe(60000);
    expect(r.summaryMetrics.annualCashFlow).toBe(-49200);
    expect(r.amortizationSchedule.at(-1)?.balance).toBe(0);
    expect(p.input.financing.downPaymentPercent).toBeUndefined();
  });

  it.each([
    ['maintenance', 'maintenancePercent', 10400, 10400],
    ['capex', 'capexPercent', 10800, 10400],
    ['propertyManagement', 'propertyManagementPercent', 10400, 10400],
  ] as const)(
    'requires either basis for %s, applies fixed zero/nonzero, and keeps the unused percentage',
    (fixed, percent, noi, cash) => {
      const p = cashPayload();
      delete p.input.expenses![fixed];
      expect(missingData(p).map((i) => i.path)).toContain(`input.expenses.${percent}`);
      p.input.expenses![percent] = 10;
      expect(calculatePayload(p).base.summaryMetrics.annualCashFlow).toBe(9600);
      p.input.expenses![fixed] = 0;
      expect(calculatePayload(p).base.summaryMetrics.annualCashFlow).toBe(10800);
      p.input.expenses![fixed] = 400;
      const r = calculatePayload(p).base;
      expect(r.summaryMetrics.noi).toBe(noi);
      expect(r.summaryMetrics.annualCashFlow).toBe(cash);
      expect(p.input.expenses![percent]).toBe(10);
      delete p.input.expenses![percent];
      expect(calculatePayload(p).base.summaryMetrics.annualCashFlow).toBe(cash);
    },
  );

  it('checks loan requirements again when a scenario changes cash into a financed purchase', () => {
    const p = cashPayload();
    p.scenarios = [
      { id: 'borrow', name: 'Borrow', overrides: { financing: { loanAmount: 50000 } } },
    ];
    expect(() => calculatePayload(p)).toThrow(/financed purchase/);
    expect(() =>
      analyze(rehydrateInput(p.input), {
        startDate: new Date(p.options.startDate!),
        discountRate: p.options.discountRate!,
      }),
    ).not.toThrow();
  });
});

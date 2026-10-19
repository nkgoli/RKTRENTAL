import { describe, expect, it } from 'vitest';
import { applyScenarios, scenarioDrafts, scenarioExamples } from '@/lib/analysis/scenarios';
import { calculatePayload, PayloadSchema, issues } from '@/lib/analysis';
import { payload } from './fixture';
describe('scenario editing boundary', () => {
  it.each(scenarioExamples)(
    'applies $name explicitly with inherited fixed dollars and unchanged base',
    (example) => {
      const p = payload();
      p.input.expenses!.maintenance = 0;
      p.input.financing!.loanAmount = 0;
      p.input.appreciationExit!.holdingPeriodYears = 10;
      p.scenarios = [];
      const original = structuredClone(p);
      const draft = { ...example, id: example.name };
      const edited = PayloadSchema.parse(applyScenarios(p, [draft]));
      const result = calculatePayload(edited);
      expect(result.base).toEqual(calculatePayload(p).base);
      expect(edited.input).toEqual(original.input);
      expect(edited.options).toEqual(original.options);
      expect(p).toEqual(original);
      expect(scenarioDrafts(edited)[0].values).toEqual(example.values);
      const expected = structuredClone(p);
      expected.scenarios = [];
      expected.input = {
        ...p.input,
        income: { ...p.input.income, ...edited.scenarios[0].overrides.income },
        expenses: { ...p.input.expenses, ...edited.scenarios[0].overrides.expenses },
        appreciationExit: {
          ...p.input.appreciationExit,
          ...edited.scenarios[0].overrides.appreciationExit,
        },
      };
      expect(result.scenarios[0].result).toEqual(calculatePayload(expected).base);
      expect(result.scenarios[0].result.annualCashflows[0].cashFlow).toBe(
        result.scenarios[0].result.annualCashflows[0].noi,
      );
    },
  );
  it.each([
    {
      overrides: { financing: { loanAmount: 100001 } },
      target: '.overrides.financing.loanAmount',
      message: 'Loan exceeds purchase price',
    },
    {
      overrides: { purchase: { purchasePrice: 1 }, financing: { loanAmount: 2 } },
      target: '.overrides.financing.loanAmount',
      message: 'Loan exceeds purchase price',
    },
    {
      overrides: {
        income: { annualRentGrowth: 100 },
        appreciationExit: { holdingPeriodYears: 50 },
      },
      target: '',
      message: 'safe monetary precision',
    },
  ])('retains scenario identity for merged errors: $message', ({ overrides, target, message }) => {
    const p = payload();
    p.scenarios = [{ id: 'broken-case', name: 'Stress case', overrides }];
    expect(() => calculatePayload({ ...p, scenarios: [] })).not.toThrow();
    try {
      calculatePayload(p);
      expect.fail('Expected merged scenario failure');
    } catch (error) {
      expect(issues(error)).toEqual([
        {
          path: `scenarios.0${target}`,
          scenarioId: 'broken-case',
          message: expect.stringContaining(`Stress case:`),
        },
      ]);
      expect(issues(error)[0].message).toContain(message);
    }
  });
  it('targets a price override when the oversized loan is inherited', () => {
    const p = payload();
    p.input.financing!.loanAmount = 50000;
    p.scenarios = [
      { id: 'low-price', name: 'Lower price', overrides: { purchase: { purchasePrice: 40000 } } },
    ];
    try {
      calculatePayload(p);
      expect.fail('Expected loan failure');
    } catch (error) {
      expect(issues(error)[0].path).toBe('scenarios.0.overrides.purchase.purchasePrice');
    }
  });
  it('round trips explicit options and fixed zero overrides without touching base', () => {
    const p = payload();
    p.input.expenses!.maintenance = 120;
    p.scenarios[0].overrides.expenses = { maintenance: 0, maintenancePercent: 99 };
    const original = structuredClone(p);
    const drafts = scenarioDrafts(p);
    const result = applyScenarios(p, drafts);
    expect(result).toEqual(p);
    expect(p).toEqual(original);
    expect(calculatePayload(result)).toEqual(calculatePayload(original));
  });
  it('inherits cleared fields and retains invalid strings for schema errors', () => {
    const p = payload();
    const drafts = scenarioDrafts(p);
    drafts[0].values['income.monthlyRent'] = '';
    expect(applyScenarios(p, drafts).scenarios[0].overrides).toEqual({});
    drafts[0].values['income.monthlyRent'] = 'bad';
    expect(PayloadSchema.safeParse(applyScenarios(p, drafts)).success).toBe(false);
    expect(drafts[0].values['income.monthlyRent']).toBe('bad');
    drafts[0].name = ' ';
    expect(PayloadSchema.safeParse(applyScenarios(p, drafts)).success).toBe(false);
  });
  it('rejects limits and duplicate identity while names remain editable', () => {
    const p = payload();
    const d = scenarioDrafts(p)[0];
    expect(
      PayloadSchema.safeParse(
        applyScenarios(
          p,
          Array.from({ length: 21 }, (_, i) => ({ ...d, id: String(i) })),
        ),
      ).success,
    ).toBe(false);
    expect(PayloadSchema.safeParse(applyScenarios(p, [d, d])).success).toBe(false);
    expect(applyScenarios(p, [{ ...d, name: 'My custom case' }]).scenarios[0].name).toBe(
      'My custom case',
    );
  });
});

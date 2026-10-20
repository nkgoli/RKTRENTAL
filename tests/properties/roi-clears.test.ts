import { describe, expect, it } from 'vitest';
import {
  mergeRoiInputs,
  parseRoiInputs,
  roiStorage,
  type PropertyRoiInputs,
} from '@/lib/properties/roi-inputs';
import { propertyRoiPatch, valuesFrom } from '@/components/analysis/fields';

const saved: PropertyRoiInputs = {
  version: 1,
  input: {
    purchase: { purchasePrice: 200000 },
    financing: { loanAmount: 0 },
    income: { monthlyRent: 1200, otherMonthlyIncome: 0 },
    expenses: { insurance: 500 },
  },
  options: { discountRate: 0 },
};
describe('explicit property financial clears', () => {
  it('distinguishes omission, clear and explicit zero; preserves sibling patches', () => {
    const original = valuesFrom(saved);
    const patch = propertyRoiPatch(
      {
        ...original,
        'input.purchase.purchasePrice': '',
        'input.income.monthlyRent': '0',
        'options.discountRate': '',
      },
      original,
    );
    const latest = mergeRoiInputs(saved, {
      version: 1,
      input: { expenses: { insurance: 650 } },
      options: {},
    });
    const merged = mergeRoiInputs(latest, patch);
    expect(merged.input.purchase?.purchasePrice).toBeUndefined();
    expect(merged.input.financing?.loanAmount).toBe(0);
    expect(merged.input.income?.monthlyRent).toBe(0);
    expect(merged.input.expenses?.insurance).toBe(650);
    expect(merged.options.discountRate).toBeUndefined();
    expect(merged.cleared).toEqual(['input.purchase.purchasePrice', 'options.discountRate']);
    expect(roiStorage(saved, patch)).toHaveProperty('purchasePrice', null);
    expect(
      roiStorage(saved, {
        version: 1,
        input: {},
        options: {},
        cleared: ['input.financing.loanAmount'],
      }),
    ).toHaveProperty('loanAmount', null);
    expect(roiStorage(saved, { version: 1, input: {}, options: {} })).not.toHaveProperty(
      'loanAmount',
    );
  });
  it('allows re-entering a cleared value and rejects ambiguous or unsafe clear paths', () => {
    const unknown = mergeRoiInputs(saved, {
      version: 1,
      input: {},
      options: {},
      cleared: ['input.income.monthlyRent'],
    });
    const restored = mergeRoiInputs(unknown, {
      version: 1,
      input: { income: { monthlyRent: 0 } },
      options: {},
    });
    expect(restored.cleared).toBeUndefined();
    expect(restored.input.income?.monthlyRent).toBe(0);
    expect(parseRoiInputs({ ...saved, cleared: ['input.income.monthlyRent'] }).success).toBe(false);
    for (const path of [
      '__proto__.polluted',
      'input.income',
      'input.propertyId',
      'options.invented',
    ]) {
      expect(parseRoiInputs({ version: 1, input: {}, options: {}, cleared: [path] }).success).toBe(
        false,
      );
    }
  });
});

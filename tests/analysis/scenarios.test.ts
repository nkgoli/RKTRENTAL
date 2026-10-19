import { describe, expect, it } from 'vitest';
import { applyScenarios, scenarioDrafts } from '@/lib/analysis/scenarios';
import { calculatePayload, PayloadSchema } from '@/lib/analysis';
import { payload } from './fixture';
describe('scenario editing boundary', () => {
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

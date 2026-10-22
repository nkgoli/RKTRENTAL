import { describe, expect, it } from 'vitest';
import { calculatePayload } from '@/lib/analysis';
import {
  deltaTone,
  emptyWhatIf,
  formatDelta,
  mergeOverrides,
  metricDeltas,
  presetValues,
  rentWhatIfHref,
  scopedWhatIf,
  simulate,
  whatIfEntryFrom,
  withLever,
} from '@/lib/analysis/what-if';
import { roiReturnPath, roiViewFrom } from '@/lib/analysis/return-path';
import { realRoiSample } from './realroi-sample';

const sample = realRoiSample();
const baseline = calculatePayload({ ...sample, scenarios: [], benchmarks: [] }).base;

describe('shared What if simulation', () => {
  it('matches a saved case with the same overrides, using the engine merge', () => {
    const values = { 'income.monthlyRent': '3100', 'income.vacancyRate': '4' };
    const sim = simulate(sample, values);
    if (!sim.ok) throw Error('expected a simulation');
    const saved = calculatePayload({
      ...sample,
      benchmarks: [],
      scenarios: [
        { id: 's', name: 'Saved', overrides: { income: { monthlyRent: 3100, vacancyRate: 4 } } },
      ],
    }).scenarios[0].result;
    expect(sim.result.summaryMetrics).toEqual(saved.summaryMetrics);
    expect(sim.result.annualCashflows).toEqual(saved.annualCashflows);
    // Only the named fields change; the rest of the group is inherited.
    expect(sim.payload.input.income).toEqual({
      ...sample.input.income,
      monthlyRent: 3100,
      vacancyRate: 4,
    });
  });

  it('never writes to the baseline payload and equals the baseline with no overrides', () => {
    const before = JSON.stringify(sample);
    const sim = simulate(sample, { 'income.monthlyRent': '9999', 'expenses.insurance': '' });
    expect(JSON.stringify(sample)).toBe(before);
    const none = simulate(sample, { 'income.monthlyRent': '  ' });
    if (!none.ok || !sim.ok) throw Error('expected simulations');
    expect(none.result.summaryMetrics).toEqual(baseline.summaryMetrics);
    expect(mergeOverrides(sample.input, {})).toEqual(sample.input);
  });

  it('reports invalid and incomplete input on the overridden field, never as $0', () => {
    const bad = simulate(sample, { 'income.monthlyRent': 'abc' });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors[0]).toEqual({
      path: 'income.monthlyRent',
      message: 'Enter a number, such as 1200.',
    });
    const loan = simulate(sample, { 'financing.loanAmount': '99999999' });
    expect(loan.ok).toBe(false);
    if (!loan.ok) expect(loan.errors.some((e) => e.path === 'financing.loanAmount')).toBe(true);
  });

  it('applies a saved case’s own calculation options', () => {
    const options = { ...sample.options, discountRate: 0.2 };
    const sim = simulate(sample, {}, options);
    if (!sim.ok) throw Error('expected a simulation');
    expect(sim.result.assumptions.discountRate).toBe(0.2);
    expect(sim.result.summaryMetrics.npv).not.toBe(baseline.summaryMetrics.npv);
  });
});

describe('baseline, simulated value and signed change', () => {
  it('computes each delta from the same runs and labels its direction', () => {
    const sim = simulate(sample, {
      'income.monthlyRent': String(sample.input.income!.monthlyRent! + 100),
    });
    if (!sim.ok) throw Error('expected a simulation');
    const rows = metricDeltas(baseline, sim.result, [
      'annualCashFlow',
      'cashOnCash',
      'totalOperatingExpenses',
      'loanAmount',
    ]);
    const cash = rows[0];
    expect(cash.baseline).toBe(baseline.summaryMetrics.annualCashFlow);
    expect(cash.simulated).toBe(sim.result.summaryMetrics.annualCashFlow);
    expect(cash.delta).toBeCloseTo(cash.simulated! - cash.baseline!, 9);
    expect(cash.tone).toBe('better');
    expect(rows[1].tone).toBe('better');
    // Rent-based expenses rise with rent; for costs an increase reads as unfavourable.
    expect(rows[2].delta).toBeGreaterThan(0);
    expect(rows[2].tone).toBe('worse');
    expect(rows[3]).toMatchObject({ changed: false, tone: 'neutral' });
  });

  it('formats signed deltas with units and keeps unavailable values honest', () => {
    expect(formatDelta('money', 1234.4)).toBe('+$1,234');
    expect(formatDelta('money', -50)).toBe('−$50');
    expect(formatDelta('percent', 0.0042)).toBe('+0.42 pp');
    expect(formatDelta('ratio', -0.051)).toBe('−0.05×');
    expect(formatDelta('money', 0.2)).toBe('No change');
    expect(formatDelta('money', null)).toBe('Unavailable');
    expect(deltaTone('money', 100, true)).toBe('worse');
    const cash = structuredClone(sample);
    cash.input.financing = { ...cash.input.financing!, downPaymentPercent: 100 };
    const r = calculatePayload(cash).base;
    // No loan: DSCR is unavailable on both sides, never 0.
    expect(metricDeltas(r, r, ['dscr'])[0]).toMatchObject({ baseline: null, delta: null });
  });
});

describe('scope isolation, presets and suggestions', () => {
  it('drops a what-if read for any other property', () => {
    const state = { ...emptyWhatIf('a'), values: { 'income.monthlyRent': '1' } };
    expect(scopedWhatIf(state, 'a')).toBe(state);
    expect(scopedWhatIf(state, 'b')).toBeNull();
    expect(scopedWhatIf(state, '')).toBeNull();
  });

  it('stacks engine levers onto the current overrides as editable values', () => {
    const rent = sample.input.income!.monthlyRent!;
    const once = withLever(sample.input, {}, 'rent');
    expect(once).toEqual({ 'income.monthlyRent': String(rent + 100) });
    const twice = withLever(sample.input, { ...once, 'income.vacancyRate': '2' }, 'rent');
    expect(twice).toEqual({ 'income.monthlyRent': String(rent + 200), 'income.vacancyRate': '2' });
    expect(presetValues('Optimistic')).toMatchObject({ 'income.vacancyRate': '3' });
    expect(presetValues('Unknown')).toBeNull();
  });
});

describe('entry links and the retired Scenarios address', () => {
  it('round-trips a Rent analysis unit entry and ignores malformed amounts', () => {
    const href = new URL(rentWhatIfHref('p1', 'u3a', 240.4), 'http://local.test');
    expect(href.pathname).toBe('/roi-analysis');
    expect(whatIfEntryFrom(href.searchParams)).toEqual({
      open: true,
      unitId: 'u3a',
      rentChange: 240,
    });
    expect(whatIfEntryFrom(new URLSearchParams('whatif=rent&unit=u1&rentChange=1e9'))).toEqual({
      open: true,
      unitId: 'u1',
      rentChange: null,
    });
    expect(whatIfEntryFrom(new URLSearchParams('whatif=rent&unit=%3Cx%3E'))?.unitId).toBeNull();
    expect(whatIfEntryFrom(new URLSearchParams('property=p1'))).toBeNull();
    expect(
      new URL(rentWhatIfHref('p1', 'u1', null), 'http://x').searchParams.has('rentChange'),
    ).toBe(false);
  });

  it('sends view=scenarios to Compare in the workspace and in return addresses', () => {
    expect(roiViewFrom(new URLSearchParams('view=scenarios'))).toBe('compare');
    expect(roiReturnPath('/roi-analysis?property=p1&view=scenarios', 'p1')).toBe(
      '/roi-analysis?property=p1&view=compare',
    );
  });
});

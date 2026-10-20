// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { calculatePayload } from '@/lib/analysis/contract';
import {
  applyLever,
  levers,
  riskFactors,
  riskScore,
  runInput,
  targetFixes,
} from '@/lib/analysis/deal-insights';
import { marketComparison, MARKET_TYPES, radarScores } from '@/lib/analysis/benchmarks';
import { scenarioColors, scenarioDifferences } from '@/lib/analysis/scenarios';
import { getAllBenchmarks } from '@/lib/roi';
import { DealSnapshot, FixMyDeal } from '@/components/analysis/RoiDealPanels';
import { ScenarioCharts } from '@/components/analysis/RoiScenarioCharts';
import { realRoiSample } from './realroi-sample';

const sample = realRoiSample();
const base = calculatePayload(sample).base;
afterEach(cleanup);
const markets = MARKET_TYPES.map((t) => getAllBenchmarks().find((b) => b.type === t)!);

describe('Deal Snapshot risk factors (C3)', () => {
  it('scores the six reference factors from engine metrics', () => {
    const factors = riskFactors(base, 7.25);
    expect(factors.map((f) => f.name)).toEqual([
      'DSCR',
      'Cash-on-Cash',
      'Break-even',
      'Cap Spread',
      'LTV',
      'OER',
    ]);
    const ltv = factors.find((f) => f.name === 'LTV')!;
    expect(ltv.description).toBe('75%');
    expect(ltv.score).toBe(30);
    const score = riskScore(factors)!;
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
  it('treats a cash purchase as no debt and leaves the spread unscored', () => {
    const cash = structuredClone(sample);
    cash.input.financing = { ...cash.input.financing!, downPaymentPercent: 100 };
    const r = calculatePayload(cash).base;
    const factors = riskFactors(r, 7.25);
    expect(factors[0]).toMatchObject({ name: 'DSCR', description: 'No debt', status: 'good' });
    expect(factors.find((f) => f.name === 'Cap Spread')).toMatchObject({
      score: null,
      description: 'No loan',
    });
  });
});

describe('Fix My Deal levers (C4)', () => {
  it('recomputes each lever with the engine and never mutates the input', () => {
    const before = JSON.stringify(sample.input);
    const rows = levers(sample, base);
    expect(rows.map((r) => r.key)).toEqual([
      'rent',
      'vacancy',
      'interestRate',
      'maintenance',
      'capex',
      'propMgmt',
    ]);
    const rent = rows.find((r) => r.key === 'rent')!;
    const direct = runInput(sample, applyLever(sample.input, 'rent'))!;
    expect(rent.value).toBeCloseTo(
      direct.summaryMetrics.annualCashFlow - base.summaryMetrics.annualCashFlow,
      6,
    );
    expect(rows.every((r) => (r.value ?? 0) > 0)).toBe(true);
    expect(Math.max(...rows.map((r) => r.share))).toBe(1);
    expect(JSON.stringify(sample.input)).toBe(before);
  });
  it('cuts a fixed annual cost by 1% of gross rent', () => {
    const fixed = structuredClone(sample);
    fixed.input.expenses = { ...fixed.input.expenses!, maintenance: 2000 };
    const next = applyLever(fixed.input, 'maintenance');
    expect(next.expenses?.maintenance).toBeCloseTo(2000 - 2800 * 12 * 0.01, 6);
  });
  it('solves targets exactly: the target rate reaches cash flow ≥ $0', () => {
    const targets = targetFixes(sample, base);
    const rate = targets.find((t) => t.lever === 'Rate');
    if (base.summaryMetrics.annualCashFlow < 0) {
      expect(rate).toBeTruthy();
      const r = runInput(sample, rate!.apply(sample.input))!;
      expect(r.summaryMetrics.annualCashFlow).toBeGreaterThanOrEqual(0);
    }
  });
  it('renders the what-if card and resets without saving', () => {
    render(<FixMyDeal result={base} payload={sample} />);
    fireEvent.click(screen.getByRole('button', { name: /Best Fix/ }));
    expect(screen.getByText('Applied adjustments')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Reset/ })[0]);
    expect(screen.queryByText('Applied adjustments')).toBeNull();
  });
  it('renders the snapshot with one risk score on ring and gauge', () => {
    render(<DealSnapshot result={base} payload={sample} />);
    const band = screen.getByRole('region', { name: 'Deal Snapshot' });
    const ring = within(band).getByText('Risk score').parentElement!.textContent!;
    fireEvent.click(within(band).getByRole('button', { expanded: false, name: /Risk/ }));
    expect(within(band).getByText(/\/ 100 risk/).parentElement!.textContent).toContain(
      ring.replace('Risk score', '').trim(),
    );
  });
});

describe('Scenario and comparison data (C18–C23)', () => {
  it('uses the reference preset colours and tones differences', () => {
    expect(scenarioColors(['Base Case', 'Optimistic', 'Conservative', 'Rent case'])).toEqual([
      '#3b82f6',
      '#22c55e',
      '#f97316',
      '#8b5cf6',
    ]);
    const diffs = scenarioDifferences(
      {
        id: 'x',
        name: 'Optimistic',
        values: { 'income.vacancyRate': '3', 'income.annualRentGrowth': '4' },
      },
      sample.input,
      (p) => p,
    );
    expect(diffs.map((d) => [d.delta, d.tone])).toEqual([
      [-2, 'good'],
      [1, 'good'],
    ]);
  });
  it('compares the property with the three market references', () => {
    const m = marketComparison(sample, markets)!;
    expect(m.assets.map((a) => a.id)).toEqual(['property', 'sp500', 'nasdaq100', 'bonds']);
  });
  it('never invents property stability or risk-adjusted scores', () => {
    const axes = radarScores([
      { id: 'property', name: 'P', color: '#000', annualizedReturn: 9, yield: 2, volatility: null },
      {
        id: 'sp500',
        name: 'S',
        color: '#000',
        annualizedReturn: 10.5,
        yield: 1.5,
        volatility: 15.5,
      },
    ]);
    expect(axes.map((a) => a.metric)).toEqual(['Return', 'Yield', 'Stability', 'Risk-Adj']);
    expect(axes[2].values[0]).toBeNull();
    expect(axes[3].values[0]).toBeNull();
    expect(axes[0].values[1]).toBe(100);
  });
  it('hides a scenario from the charts with its chip and keeps Base fixed', () => {
    const p = structuredClone(sample);
    p.scenarios = [
      { id: 's1', name: 'Optimistic', overrides: { income: { vacancyRate: 3 } } },
    ] as typeof p.scenarios;
    const calc = calculatePayload(p);
    render(
      <ScenarioCharts
        cases={[
          { id: 'base', name: 'Base Case', result: calc.base },
          { id: 's1', name: 'Optimistic', result: calc.scenarios[0].result },
        ]}
        drafts={[{ id: 's1', name: 'Optimistic', values: { 'income.vacancyRate': '3' } }]}
        baseInput={p.input}
        label={(x) => x}
        onAddExample={() => {}}
        disabled={false}
      />,
    );
    const chips = within(screen.getByRole('list', { name: 'Scenarios shown' }));
    expect((chips.getByRole('button', { name: /Base Case/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const table = () => screen.getByRole('region', { name: 'Key metrics comparison' });
    expect(table().textContent).toContain('Optimistic');
    fireEvent.click(chips.getByRole('button', { name: /^Optimistic/ }));
    expect(table().textContent).not.toContain('Optimistic');
  });
});

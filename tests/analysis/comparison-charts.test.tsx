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
import {
  customDraft,
  marketComparison,
  MARKET_TYPES,
  radarScores,
} from '@/lib/analysis/benchmarks';
import { RoiBenchmarks } from '@/components/analysis/RoiBenchmarks';
import { RentDistribution } from '@/components/rent-comps/RentDistribution';
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
    const initial = screen.getByRole('status').textContent;
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('status').textContent).toBe(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected' }));
    expect(screen.getByRole('status').textContent).not.toBe(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('status').textContent).toBe(initial);
  });
  it('renders the snapshot with one risk score on ring and gauge', () => {
    render(<DealSnapshot result={base} payload={sample} />);
    const band = screen.getByRole('region', { name: 'Deal Snapshot' });
    const risk = within(band)
      .getByText(/^Risk [0-9]+/)
      .closest('details')!;
    expect(risk.open).toBe(false);
    fireEvent.click(risk.querySelector('summary')!);
    expect(risk.open).toBe(true);
    expect(within(risk).getAllByRole('progressbar')).toHaveLength(6);
    expect(within(band).getAllByRole('button', { expanded: false })).toHaveLength(4);
  });
});

describe('Scenario and comparison data (C18–C23)', () => {
  it('uses the app preset colours and tones differences', () => {
    expect(scenarioColors(['Base Case', 'Optimistic', 'Conservative', 'Rent case'])).toEqual([
      '#3e4fe5',
      '#007f7a',
      '#b04a1c',
      '#9d174d',
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

describe('Benchmarks and Compare presentation (C19–C24)', () => {
  const view = (props: Partial<Parameters<typeof RoiBenchmarks>[0]> = {}) =>
    render(
      <RoiBenchmarks
        selected={[]}
        custom={customDraft([])}
        onCustomChange={() => {}}
        errors={[]}
        onChange={() => {}}
        snapshot={{ ...sample, benchmarks: [] }}
        stale={false}
        saving={false}
        compare
        propertyName="Maple Court"
        {...props}
      />,
    );
  it('labels the data basis and keeps the method one click away', () => {
    view({ compare: false });
    const tags = screen.getAllByRole('list', { name: 'Data basis' });
    expect(tags[0].textContent).toContain('Projected property');
    expect(tags[0].textContent).toContain('Hypothetical markets');
    // Hypothetical figures are tinted apart from the property's own projected figures.
    expect(within(tags[0]).getByText('Hypothetical markets').dataset.kind).toBe('hypothetical');
    expect(within(tags[0]).getByText('Projected property').dataset.kind).toBe('projected');
    expect(screen.getByText(/not live or verified data/)).toBeTruthy();
    const method = screen.getByText(/Where the market figures come from/).closest('details')!;
    expect(method.open).toBe(false);
    expect(within(method).getByRole('region', { name: 'Benchmark provenance' })).toBeTruthy();
    // Every market card states its volatility; none reads "null%".
    expect(document.body.textContent).not.toMatch(/null%|undefined%/);
  });
  it('explains an empty selection and a missing projection in a card', () => {
    view();
    expect(screen.getByText('No reference selected')).toBeTruthy();
    expect(screen.getByText(/Choose at least one reference asset/)).toBeTruthy();
    cleanup();
    view({ snapshot: null, stale: true, selected: [markets[0]] });
    expect(screen.getByText('No projection to compare')).toBeTruthy();
    expect(screen.getByText(/Complete the missing assumptions/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Side-by-side comparison' })).toBeNull();
  });
  it('selects, limits and removes references through the chips', () => {
    const changes: string[][] = [];
    view({
      selected: [markets[0], markets[1]],
      snapshot: { ...sample, benchmarks: [markets[0], markets[1]] },
      onChange: (next) => changes.push(next.map((b) => b.type)),
    });
    expect(screen.getByText('2 of 2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'US Bonds' }));
    expect(screen.getByText(/Selection limit/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nasdaq 100' }));
    expect(changes).toEqual([['sp500']]);
  });
  it('shows percentage differences in percentage points in the vs Property view', () => {
    view({
      selected: [markets[0]],
      snapshot: { ...sample, benchmarks: [markets[0]] },
    });
    // The annualized-return bars are percentages, and their chart title says so.
    const titles = [...document.querySelectorAll('svg title')].map((t) => t.textContent);
    expect(titles).toContain('Annualized return by asset (percent)');
    fireEvent.click(screen.getByRole('button', { name: 'vs Property' }));
    const table = screen.getByRole('region', { name: 'Side-by-side comparison' });
    expect(table.textContent).toMatch(/\d pp/);
    expect(table.textContent).not.toMatch(/[+−]\d+\.\d%/);
    expect(screen.getByRole('region', { name: 'Same-capital asset comparison' })).toBeTruthy();
    const radar = screen.getByRole('group', { name: /Normalized comparison scores/ });
    const ticks = [...radar.querySelectorAll('svg > text')].map((t) => t.textContent);
    expect(ticks).toEqual(expect.arrayContaining(['20', '40', '60', '80', '100']));
    expect(ticks).not.toContain('25');
  });
});

describe('Rental Distribution (C25) presentation', () => {
  it('states the basis, the gap to the average and the suggested range', () => {
    render(
      <RentDistribution
        rents={[1700, 1800, 1900, 2000]}
        subjectRent={1600}
        subjectLabel="unit (listed rent)"
        rangeLow={1750}
        rangeHigh={1950}
      />,
    );
    const card = screen.getByRole('region', { name: 'Rental Distribution' });
    expect(within(card).getByRole('list', { name: 'Data basis' }).textContent).toContain(
      'USD per month',
    );
    expect(within(card).getByText('Yours vs average').nextSibling!.textContent).toBe('−$250');
    expect(card.textContent).toContain('Suggested range $1,750–$1,950');
    expect(card.textContent).toContain('standard deviation ($112)');
  });
  it('shows a truthful empty state and flags an assumed spread', () => {
    render(<RentDistribution rents={[]} subjectRent={1600} subjectLabel="unit" />);
    expect(screen.getByRole('status').textContent).toMatch(/No comparable rents are included/);
    cleanup();
    render(<RentDistribution rents={[1800]} subjectRent={null} subjectLabel="unit" />);
    expect(screen.getByText(/assumed ±10% spread/)).toBeTruthy();
    expect(screen.queryByText('Yours vs average')).toBeNull();
  });
});

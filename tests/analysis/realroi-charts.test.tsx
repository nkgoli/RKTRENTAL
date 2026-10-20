// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  breakevenYear,
  equityLandmarks,
  equityYears,
  firstPositiveAfterNegative,
  indexAgainst,
  milestoneYears,
  miniBarWidth,
  monotonePath,
  niceScale,
  referenceTickIndexes,
  thousands,
  wealthAt,
  wholeDollars,
} from '@/lib/analysis/chart-data';
import { calculatePayload } from '@/lib/analysis/contract';
import { dollars, projectionRows } from '@/lib/analysis/projections';
import { RoiProjections } from '@/components/analysis/RoiProjections';
import {
  NetCashFlowCard,
  OutcomeCard,
  ProjectionMilestones,
} from '@/components/analysis/RoiSummaryCharts';
import { payload } from './fixture';
import { realRoiSample } from './realroi-sample';

afterEach(cleanup);

const sample = () => calculatePayload(realRoiSample()).base;
const live = (plot: HTMLElement) => plot.parentElement!.querySelector('[aria-live]')!.textContent!;
function charts(p = realRoiSample()) {
  return render(
    <RoiProjections
      result={calculatePayload(p).base}
      calculatedPayload={p}
      calculationVersion={1}
      stale={false}
      saving={false}
      onEdit={() => {}}
    />,
  );
}

describe('RealROI chart adapters', () => {
  it('labels axes like the reference without repeating a tick', () => {
    expect(thousands(950000, 50000)).toBe('$950k');
    expect(thousands(0, 50000)).toBe('$0k');
    expect(thousands(-9000, 9000)).toBe('-$9k');
    // A $2,500 step stays exact instead of rounding to $3k / $8k.
    expect([-2500, 2500, 5000, 7500].map((v) => thousands(v, 2500))).toEqual([
      '-$2.5k',
      '$2.5k',
      '$5k',
      '$7.5k',
    ]);
    expect(thousands(250, 250)).toBe('$0.25k');
    // The reference prints "$-1k" five times at Y1; small steps keep decimals.
    const ticks = niceScale([-1133.28]).ticks;
    const labels = ticks.map((t) => thousands(t, ticks[1] - ticks[0]));
    expect(new Set(labels).size).toBe(labels.length);
    expect(wholeDollars(-1133.28)).toBe('-$1,133');
    expect(wholeDollars(-0.2)).toBe('$0');
    expect(wholeDollars(null)).toBe('Unavailable');
  });

  it('uses the reference year ticks and a non-overshooting monotone curve', () => {
    expect(referenceTickIndexes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toHaveLength(10);
    const thirty = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(referenceTickIndexes(thirty).map((i) => thirty[i])).toEqual([1, 5, 10, 15, 20, 25, 30]);
    const withStart = [0, ...thirty];
    expect(referenceTickIndexes(withStart).map((i) => withStart[i])).toEqual([
      0, 5, 10, 15, 20, 25, 30,
    ]);
    const d = monotonePath([
      [0, 10],
      [10, 10],
      [20, 0],
      [30, 0],
    ]);
    expect(d.startsWith('M0,10')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(3);
    // Flat runs stay flat: no control point leaves the data range.
    const ys = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10);
  });

  it('finds breakeven, the C1 positive turn and C6 landmarks from engine rows', () => {
    const r = sample();
    const rows = projectionRows(r);
    expect(breakevenYear(rows)).toBe(5);
    expect(firstPositiveAfterNegative(rows.slice(0, 5).map((x) => x.cashFlow))).toBe(2);
    expect(firstPositiveAfterNegative([5, 6])).toBe(null);
    const eq = equityYears(r);
    const gain = equityLandmarks(eq, true, false);
    // Equity gain overtakes the loan only after a real crossing.
    expect(gain.crossover!.equityGain).toBeGreaterThan(gain.crossover!.loanBalance);
    const before = eq[gain.crossover!.year - 2];
    expect(before.equityGain).toBeLessThanOrEqual(before.loanBalance);
    expect(gain.paidOff?.year).toBe(30);
    expect(gain.momentum).toBe('Growth picks up momentum in later years');
    const total = equityLandmarks(eq, true, true);
    expect(total.crossover!.year).toBeLessThan(gain.crossover!.year);
    // All-cash: no debt, so no crossover or payoff is claimed.
    const cash = equityLandmarks(equityYears(calculatePayload(payload()).base), false, false);
    expect(cash.crossover).toBe(null);
    expect(cash.paidOff).toBe(null);
  });

  it('builds wealth, milestones, indexes and mini bars truthfully', () => {
    const r = sample();
    const w = wealthAt(r, 1)!;
    expect(w.cashFlow).toBeCloseTo(-1133.28, 2);
    expect(w.total).toBeCloseTo(w.cashFlow + w.principal + w.appreciation, 6);
    expect(wealthAt(r, 31)).toBe(null);
    expect(milestoneYears(30)).toEqual([1, 5, 10, 20, 30]);
    expect(milestoneYears(12)).toEqual([1, 5, 10, 12]);
    expect(indexAgainst([50, 100, 150], 50)).toEqual([100, 200, 300]);
    expect(indexAgainst([1, 2], 0)).toEqual([null, null]);
    expect(miniBarWidth(-0.0111)).toBeCloseTo(5.55, 2);
    expect(miniBarWidth(0.5)).toBe(100);
    expect(miniBarWidth(null)).toBe(0);
  });
});

describe('RealROI cash-flow and equity charts', () => {
  it('opens Charts on Equity with the reference Y30 composition, chips and equation tooltip', () => {
    const r = sample();
    charts();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual([
      'Equity',
      'Cash Flow',
      'Expenses',
      'Amortization',
      'Exit Analysis',
      'Sensitivity',
    ]);
    const horizon = screen.getByRole('group', { name: 'Equity chart horizon' });
    expect(within(horizon).getByRole('button', { name: 'Y30' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByText('Mortgage paid off — 100% equity')).toBeTruthy();
    expect(screen.getAllByText('Paid off').length).toBeGreaterThan(0);
    const eq = equityYears(r);
    const crossover = equityLandmarks(eq, true, false).crossover!;
    expect(screen.getByText(`Equity gain exceeds debt in Year ${crossover.year}`)).toBeTruthy();
    expect(screen.getByText('Mortgage paid off in Year 30')).toBeTruthy();
    const plot = screen.getByRole('group', { name: /Equity composition and loan balance/ });
    expect(plot.textContent).toContain('Gain > Debt');
    fireEvent.keyDown(plot, { key: 'Home' });
    const y1 = eq[0];
    expect(live(plot)).toBe(
      `Year 1: Property Value ${dollars(y1.propertyValue)}; − Mortgage Balance ${dollars(y1.loanBalance)}; = Equity ${dollars(y1.equity)}; Principal paid ${dollars(y1.principalEquity)}; Appreciation ${dollars(y1.appreciationEquity)}`,
    );
    // Whole dollars in the visual tooltip; the down payment row only when included.
    expect(plot.textContent).toContain(wholeDollars(y1.equity));
    expect(plot.textContent).not.toContain('Down payment');
    fireEvent.click(screen.getByLabelText('Include down payment'));
    expect(screen.getByText(/Total equity exceeds debt in Year/)).toBeTruthy();
    fireEvent.keyDown(plot, { key: 'Home' });
    expect(live(plot)).toContain(`Down payment ${dollars(y1.initialEquity)}`);
    expect(plot.textContent).toContain('Equity > Debt');
  });

  it('indexes the composition to Y1 = 100 and keeps dollar figures in the readout', () => {
    charts();
    fireEvent.click(screen.getByRole('button', { name: 'Indexed' }));
    expect(screen.getByText(/Indexed view \(Y1 = 100\)/)).toBeTruthy();
    const plot = screen.getByRole('group', { name: /Equity composition and loan balance/ });
    fireEvent.keyDown(plot, { key: 'Home' });
    expect(live(plot)).toContain('Index (Y1 = 100): bars 100.0 · mortgage 100.0');
    expect(live(plot)).toContain(
      `Property Value ${dollars(equityYears(sample())[0].propertyValue)}`,
    );
    // Crossover shading and marker are dollar-only, as in the reference.
    expect(plot.textContent).not.toContain('Gain > Debt');
  });

  it('draws value vs mortgage from a Start point with a shaded equity band', () => {
    const p = realRoiSample();
    const { container } = charts(p);
    const plot = screen.getByRole('group', { name: /Property value and mortgage balance/ });
    expect(plot.querySelector('linearGradient')).toBeTruthy();
    fireEvent.keyDown(plot, { key: 'Home' });
    const loan = calculatePayload(p).base.summaryMetrics.loanAmount;
    expect(live(plot)).toBe(
      `Start: Property Value ${dollars(380000)}; − Mortgage Balance ${dollars(loan)}; = Equity ${dollars(380000 - loan)}; Equity is ${(((380000 - loan) / 380000) * 100).toFixed(0)}% of property value`,
    );
    fireEvent.keyDown(plot, { key: 'End' });
    expect(live(plot)).toContain('End of Year 30');
    expect(live(plot)).toContain('Mortgage paid off — 100% equity');
    expect(container.textContent).toMatch(/Equity grew \+\$\d/);
  });

  it('defaults cash flow to Y10 with breakeven shading, chips and the reference insight', () => {
    const r = sample();
    const rows = projectionRows(r);
    charts();
    fireEvent.click(screen.getByRole('tab', { name: 'Cash Flow' }));
    expect(screen.getByText('Breakeven: Year 5')).toBeTruthy();
    expect(screen.getByText(`Worst: ${wholeDollars(rows[0].cashFlow)} (Year 1)`)).toBeTruthy();
    expect(screen.getByText(`Best: ${wholeDollars(rows[9].cashFlow)} (Year 10)`)).toBeTruthy();
    expect(
      screen.getByText(`Cumulative at Year 10: ${wholeDollars(rows[9].cumulativeCashFlow)}`),
    ).toBeTruthy();
    const plot = screen.getByRole('group', { name: /Annual and cumulative operating cash flow/ });
    expect(plot.textContent).toContain('Breakeven');
    // Pre- and post-breakeven bands.
    expect(plot.querySelectorAll('svg > rect')).toHaveLength(2);
    expect(screen.getByText('24.5%')).toBeTruthy();
    // Custom horizon down to Y4: never breaks even, so the whole range is pre-breakeven.
    const horizon = screen.getByRole('group', { name: 'Cash flow chart horizon' });
    fireEvent.click(within(horizon).getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Cash flow chart horizon: custom years'), {
      target: { value: '4' },
    });
    expect(screen.getByText('No breakeven by Year 4')).toBeTruthy();
    expect(plot.querySelectorAll('svg > rect')).toHaveLength(1);
    expect(screen.getByText(/none of your initial investment/)).toBeTruthy();
  });

  it('reconciles the income bridge to cash flow, including reserves below NOI', () => {
    const rows = projectionRows(sample());
    charts();
    fireEvent.click(screen.getByRole('tab', { name: 'Cash Flow' }));
    const plot = screen.getByRole('group', { name: /Income, NOI, debt service and cash flow/ });
    fireEvent.keyDown(plot, { key: 'End' });
    const r = rows[9];
    expect(live(plot)).toContain(
      `Year 10: Gross Operating Income ${dollars(r.effectiveGrossIncome)}; − Operating Expenses ${dollars(r.operatingExpenses)}; = NOI ${dollars(r.noi)}; − Debt Service ${dollars(r.debtService)}; − Capital Reserves ${dollars(r.reserves)}; = Cash Flow ${dollars(r.cashFlow)}`,
    );
    expect(r.noi - r.debtService - r.reserves).toBeCloseTo(r.cashFlow, 2);
    expect(screen.getByText('GOI (Y1)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'About OpEx Ratio' })).toBeTruthy();
    expect(screen.getByText(/NOI exceeds Debt Service by/)).toBeTruthy();
  });
});

describe('RealROI Summary charts', () => {
  it('shows net cash flow by year at Y5 with Y labels, the positive marker and a reconciled tooltip', () => {
    const r = sample();
    const rows = projectionRows(r);
    render(<NetCashFlowCard result={r} />);
    const horizon = screen.getByRole('group', { name: 'Net cash flow horizon' });
    expect(within(horizon).getByRole('button', { name: 'Y5' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const plot = screen.getByRole('group', { name: /Net cash flow, years 1 to 5/ });
    expect(plot.textContent).toContain('Y1');
    expect(plot.textContent).toContain('Positive Y3');
    expect(screen.getByText('Positive Cash Flow')).toBeTruthy();
    expect(screen.getByText('Negative Cash Flow')).toBeTruthy();
    fireEvent.keyDown(plot, { key: 'Home' });
    const y = rows[0];
    expect(live(plot)).toBe(
      `Year 1: Effective income ${dollars(y.effectiveGrossIncome)}; − Operating costs ${dollars(y.operatingExpenses)}; = NOI ${dollars(y.noi)}; − Debt service ${dollars(y.debtService)}; − Capital reserves ${dollars(y.reserves)}; = Cash Flow ${dollars(y.cashFlow)}`,
    );
    fireEvent.click(within(horizon).getByRole('button', { name: 'Y30' }));
    expect(screen.getByRole('group', { name: /years 1 to 30/ })).toBeTruthy();
  });

  it('shows the Outcome total, deal quality and a negative part as text', () => {
    const r = sample();
    const { container } = render(<OutcomeCard result={r} />);
    const w = wealthAt(r, 1)!;
    expect(screen.getByText(wholeDollars(w.total))).toBeTruthy();
    expect(screen.getByText('Wealth Created (Year 1)', { exact: false })).toBeTruthy();
    expect(screen.getByText(/Cash Flow -\$1,133 reduces the total/)).toBeTruthy();
    // Negative cash flow is not a slice: two segments are drawn.
    expect(container.querySelectorAll('svg[role="img"] path')).toHaveLength(2);
    const quality = screen.getByLabelText('Deal quality');
    expect(within(quality).getByText('1.03')).toBeTruthy();
    expect(within(quality).getByText('0.80%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Y30' }));
    expect(screen.getByText('Wealth Created (Year 30)', { exact: false })).toBeTruthy();
    expect(container.querySelectorAll('svg[role="img"] path')).toHaveLength(3);
  });

  it('shows milestone rows with mini bars and expands every section in Full Table', () => {
    const r = sample();
    const rows = projectionRows(r);
    render(<ProjectionMilestones result={r} />);
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    // Each milestone header is "Year N" with its calendar year underneath.
    expect(headers.slice(1, 6).map((h) => h.firstChild?.textContent)).toEqual([
      'Year 1',
      'Year 5',
      'Year 10',
      'Year 20',
      'Year 30',
    ]);
    expect(headers[1].querySelector('small')?.textContent).toMatch(/^20\d\d$/);
    expect(within(table).getByText(wholeDollars(rows[0].cashFlow))).toBeTruthy();
    expect(within(table).getByText('-1.11%')).toBeTruthy();
    expect(within(table).queryByText('Scheduled rent')).toBeNull();
    expect(
      screen.getByRole('button', { name: /Income Analysis/ }).getAttribute('aria-expanded'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Full Table' }));
    expect(within(table).getByText('Scheduled rent')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cash Flow' }));
    expect(within(table).queryByText('Annual Cash Flow')).toBeNull();
  });
});

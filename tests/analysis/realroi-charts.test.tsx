// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  amortizationTicks,
  breakevenContour,
  breakevenYear,
  equityAxisMax,
  equityLandmarks,
  equityYears,
  exitLandmarks,
  exitRows,
  expenseYear,
  firstPositiveAfterNegative,
  fixedDomainScale,
  heatColor,
  heatPalette,
  loanMilestones,
  loanSummaries,
  indexAgainst,
  milestoneYears,
  miniBarWidth,
  monotonePath,
  niceScale,
  referenceScale,
  referenceTickIndexes,
  thousands,
  wealthAt,
  wholeDollars,
} from '@/lib/analysis/chart-data';
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

  it('reproduces the reference Recharts domains and ticks', () => {
    // Exit Analysis: [0, auto] with five nice ticks reads $0k…$1400k in $350k steps.
    expect(referenceScale([0, 278478, 1279793]).ticks).toEqual([
      0, 350000, 700000, 1050000, 1400000,
    ]);
    // Cash Flow & Cumulative Y10: the step widens until five ticks cover both signs.
    expect(referenceScale([-1133, 6464, 24997]).ticks).toEqual([-8500, 0, 8500, 17000, 25500]);
    // All-negative Y1 keeps zero and distinct ticks instead of "$-1k" five times.
    const y1 = referenceScale([-1133.28]).ticks;
    expect(y1).toEqual([-1200, -900, -600, -300, 0]);
    expect(new Set(y1.map((t) => thousands(t, 300))).size).toBe(5);
    // Equity Composition: explicit [0, ceil(max × 1.1 / 50k) × 50k], Recharts' fixed-domain ticks.
    expect(equityAxisMax(834860, false)).toBe(950000);
    expect(fixedDomainScale(0, 950000).ticks).toEqual([0, 250000, 500000, 950000]);
    expect(equityAxisMax(2100, true)).toBe(2350);
    expect(fixedDomainScale(0, 2350).ticks).toEqual([0, 600, 1200, 2350]);
    // Rent curve: [dataMin, dataMax] steps from the minimum, then the maximum.
    expect(fixedDomainScale(1500, 2500).ticks).toEqual([1500, 1750, 2000, 2250, 2500]);
  });

  it('draws Equity Composition on the reference $950k domain', () => {
    charts();
    const plot = screen.getByRole('img', { name: /Equity composition and loan balance/i });
    const labels = [...plot.querySelectorAll('text')].map((t) => t.textContent);
    for (const tick of ['$0k', '$250k', '$500k', '$950k']) expect(labels).toContain(tick);
    expect(labels).not.toContain('$1000k');
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

  it('builds expense, loan, exit and heatmap adapters without inventing values', () => {
    const r = sample();
    const rows = projectionRows(r);
    const y1 = expenseYear(r.expenseBreakdown, rows, 1)!;
    expect(y1.categories.reduce((s, c) => s + c.value, 0)).toBeCloseTo(
      rows[0].operatingExpenses,
      6,
    );
    // Zero categories (HOA, utilities) are left out, as in the reference.
    expect(y1.categories.map((c) => c.key)).not.toContain('hoa');
    expect(expenseYear(r.expenseBreakdown, rows, 31)).toBe(null);
    const years = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(amortizationTicks(years).map((i) => years[i])).toEqual([
      1, 3, 5, 7, 9, 12, 15, 18, 21, 24, 27, 30,
    ]);
    const loan = loanSummaries(loanYears(r), r.summaryMetrics.loanAmount);
    expect(loan[0].beginning).toBe(r.summaryMetrics.loanAmount);
    expect(loan[1].beginning).toBe(loan[0].balance);
    expect(loanMilestones(loan).principalBeatsInterest).toBe(
      loan.find((y) => y.principal > y.interest)!.year,
    );
    // Exits: a missing IRR is never "best".
    const fake = (year: number, irr: number | null, totalReturn: number) => ({
      year,
      result: {
        saleProceeds: { grossSalePrice: 1, sellingCosts: 0, loanPayoff: 0, netProceeds: 1 },
        summaryMetrics: {
          totalReturn,
          totalCashRequired: 10,
          totalReturnPercent: 0,
          irrLeveraged: irr,
        },
        annualCashflows: [{ cumulativeCashFlow: 0 }],
      },
    });
    const marks = exitLandmarks(
      exitRows([fake(5, null, -5), fake(10, 0.05, 3), fake(15, 0.04, 9)]),
    );
    expect(marks.bestIrr?.year).toBe(10);
    expect(marks.bestProfit?.year).toBe(15);
    expect(marks.breakeven?.year).toBe(10);
    expect(exitLandmarks(exitRows([fake(5, null, 1)])).bestIrr).toBe(null);
    // Heat scale and contour.
    expect(heatColor(-1, 1, -1, heatPalette)).toBe(heatPalette.low);
    expect(heatColor(-1, 1, 0, heatPalette)).toBe(heatPalette.mid);
    expect(heatColor(-1, 1, 1, heatPalette)).toBe(heatPalette.high);
    expect(
      breakevenContour([
        [-2, -1, 1],
        [-1, 1, 2],
        [1, 2, 3],
        [-1, 1, 2],
      ]),
    ).toEqual([
      [
        { row: 0, column: 1.5 },
        { row: 1, column: 0.5 },
      ],
      [{ row: 3, column: 0.5 }],
    ]);
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
    const { container } = charts();
    fireEvent.click(screen.getByRole('tab', { name: 'Cash Flow' }));
    const panel = within(container.querySelector<HTMLElement>('#roi-chart-panel-cash-flow')!);
    expect(panel.getByText('Breakeven: Year 5')).toBeTruthy();
    expect(panel.getByText(`Worst: ${wholeDollars(rows[0].cashFlow)} (Year 1)`)).toBeTruthy();
    expect(panel.getByText(`Best: ${wholeDollars(rows[9].cashFlow)} (Year 10)`)).toBeTruthy();
    expect(
      panel.getByText(`Cumulative at Year 10: ${wholeDollars(rows[9].cumulativeCashFlow)}`),
    ).toBeTruthy();
    const plot = screen.getByRole('group', { name: /Annual and cumulative operating cash flow/ });
    expect(plot.textContent).toContain('Breakeven');
    // Pre- and post-breakeven bands.
    expect(plot.querySelectorAll('svg > rect')).toHaveLength(2);
    expect(panel.getByText('24.5%')).toBeTruthy();
    // Custom horizon down to Y4: never breaks even, so the whole range is pre-breakeven.
    const horizon = screen.getByRole('group', { name: 'Cash flow chart horizon' });
    fireEvent.click(within(horizon).getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Cash flow chart horizon: custom years'), {
      target: { value: '4' },
    });
    expect(panel.getByText('No breakeven by Year 4')).toBeTruthy();
    expect(plot.querySelectorAll('svg > rect')).toHaveLength(1);
    expect(panel.getByText(/none of your initial investment/)).toBeTruthy();
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

describe('RealROI expense, amortization, exit and sensitivity charts', () => {
  const panel = (container: HTMLElement, id: string) =>
    within(container.querySelector<HTMLElement>(`#roi-chart-panel-${id}`)!);

  it('ranks Year-1 operating expenses, scales categories by year and simulates tax without saving', () => {
    const r = sample();
    const rows = projectionRows(r);
    const { container } = charts();
    fireEvent.click(screen.getByRole('tab', { name: 'Expenses' }));
    const p = panel(container, 'expenses');
    const horizon = p.getByRole('group', { name: 'Operating expenses year' });
    expect(within(horizon).getByRole('button', { name: 'Y1' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const e = r.expenseBreakdown;
    const names = within(p.getByRole('region', { name: 'Expense Breakdown' }))
      .getAllByRole('button', { name: /^About / })
      .map((b) => b.getAttribute('aria-label')!.replace('About ', ''));
    // Reference order by amount; CapEx is listed last, below NOI.
    expect(names.slice(0, 3)).toEqual(['Property Tax', 'Management', 'Insurance']);
    expect(names.at(-1)).toBe('CapEx');
    expect(p.getByText(wholeDollars(rows[0].operatingExpenses))).toBeTruthy();
    expect(p.getByText('Below NOI')).toBeTruthy();
    // Exact category table: categories add up to the projection's operating expenses.
    const table = p.getByRole('table', { name: /Expense categories · year 1/ });
    expect(within(table).getByText(dollars(rows[0].operatingExpenses))).toBeTruthy();
    expect(within(table).getByText(dollars(rows[0].reserves))).toBeTruthy();
    // Y10 scales every category by the engine's own operating-expense growth.
    fireEvent.click(within(horizon).getByRole('button', { name: 'Y10' }));
    const growth = rows[9].operatingExpenses / rows[0].operatingExpenses;
    const y10 = p.getByRole('table', { name: /Expense categories · year 10/ });
    expect(
      within(y10).getByText(dollars(e.propertyTax * (rows[9].operatingExpenses / e.total))),
    ).toBeTruthy();
    expect(p.getByText(`(+${((growth - 1) * 100).toFixed(0)}% vs Y1)`)).toBeTruthy();
    // Sort menu: Biggest Δ shows change chips.
    fireEvent.click(p.getByRole('button', { name: /Sort: Amount/ }));
    fireEvent.click(p.getByRole('menuitemradio', { name: 'Biggest Δ vs Y1' }));
    expect(p.getByRole('button', { name: /Sort: Biggest Δ/ })).toBeTruthy();
    const taxChange =
      e.propertyTax * (rows[9].operatingExpenses / e.total - rows[0].operatingExpenses / e.total);
    expect(p.getAllByText(`+${wholeDollars(taxChange)}`).length).toBeGreaterThan(0);
    // What-if: −10% tax lowers the total in the tile only.
    fireEvent.click(within(horizon).getByRole('button', { name: 'Y1' }));
    fireEvent.click(p.getByRole('button', { name: 'Simulate −10% Tax' }));
    const cut = e.propertyTax * (rows[0].operatingExpenses / e.total) * 0.1;
    expect(p.getByText(wholeDollars(rows[0].operatingExpenses - cut))).toBeTruthy();
    expect(p.getByText(/Simulating 10% tax reduction/)).toBeTruthy();
    expect(p.getByText(/saved assumptions are unchanged/)).toBeTruthy();
    fireEvent.click(p.getByRole('button', { name: 'Reset' }));
    expect(p.queryByText(/Simulating 10% tax reduction/)).toBeNull();
  });

  it('draws principal vs interest areas and the schedule visuals from the loan schedule', () => {
    const r = sample();
    const loan = r.summaryMetrics.loanAmount;
    const { container } = charts();
    fireEvent.click(screen.getByRole('tab', { name: 'Amortization' }));
    const p = panel(container, 'amortization');
    const plot = p.getByRole('group', { name: /Loan balance and cumulative principal/ });
    expect(plot.querySelectorAll('path[fill-opacity="0.6"]')).toHaveLength(3);
    expect(plot.textContent).toContain('Year 1');
    expect(plot.textContent).toContain('Year 3');
    const years = loanYears(r);
    fireEvent.keyDown(plot, { key: 'Home' });
    for (let i = 0; i < 8; i++) fireEvent.keyDown(plot, { key: 'ArrowRight' });
    const y9 = years[8];
    expect(live(plot)).toBe(
      `Year 9: Remaining Balance: ${dollars(y9.balance)}; Principal Paid: ${dollars(y9.cumulativePrincipal)}; Interest Paid: ${dollars(y9.cumulativeInterest)}`,
    );
    const total = years.at(-1)!.cumulativeInterest;
    expect(loan).toBe(262500);
    expect(p.getByText(`${((total / loan) * 100).toFixed(0)}% of principal`)).toBeTruthy();
    const principalShare = ((loan / (loan + total)) * 100).toFixed(0);
    expect(
      p.getByText(
        `Principal: ${principalShare}% | Interest: ${(100 - Number(principalShare)).toFixed(0)}%`,
        { exact: false },
      ),
    ).toBeTruthy();
    const marks = loanMilestones(loanSummaries(years, loan));
    expect(p.getByText(`50% paid off by Y${marks.half}`)).toBeTruthy();
    expect(p.getByText(`Principal > Interest from Y${marks.principalBeatsInterest}`)).toBeTruthy();
    // Detailed view expands monthly rows.
    const schedule = p.getByRole('region', { name: 'Loan schedule by year' });
    expect(within(schedule).queryByText('Month 1')).toBeNull();
    fireEvent.click(p.getByRole('button', { name: 'Detailed' }));
    fireEvent.click(p.getByRole('button', { name: 'Year 1 monthly payments' }));
    expect(within(schedule).getByText('Month 1')).toBeTruthy();
    expect(within(schedule).getByText('Month 12')).toBeTruthy();
    fireEvent.click(p.getByRole('button', { name: 'Collapse All' }));
    expect(within(schedule).queryByText('Month 1')).toBeNull();
    // Insight cards follow their selects.
    const first5 = years.slice(0, 5).reduce((s, y) => s + y.interest, 0);
    expect(p.getByText(wholeDollars(first5))).toBeTruthy();
    fireEvent.change(p.getByLabelText('Interest period'), { target: { value: '10' } });
    expect(p.getByText('Interest (First 10y)')).toBeTruthy();
    fireEvent.change(p.getByLabelText('Balance year'), { target: { value: '20' } });
    const card = within(p.getByText('Balance at Y20').closest('div')!);
    expect(card.getByText(wholeDollars(years[19].balance))).toBeTruthy();
    expect(card.getByText(wholeDollars(total - years[19].cumulativeInterest))).toBeTruthy();
    // Exact schedule stays.
    expect(p.getByRole('table', { name: /Annual loan payments/ })).toBeTruthy();
  });

  it('compares exits with Year 10 selected, a reconciled waterfall and true IRR', () => {
    const p0 = realRoiSample();
    const { container } = charts(p0);
    fireEvent.click(screen.getByRole('tab', { name: 'Exit Analysis' }));
    const p = panel(container, 'exit');
    const rows = exitRows(calculateExits(p0, exitControls(p0)));
    expect(rows.map((r) => r.year)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(p.getByText('Year 10 Exit Summary')).toBeTruthy();
    const marks = exitLandmarks(rows);
    const best = p.getByRole('button', { name: /^Best IRR: Year/ });
    expect(best.textContent).toContain(`${((marks.bestIrr!.irr ?? 0) * 100).toFixed(2)}%`);
    const y10 = rows[1];
    // IRR is the engine's leveraged IRR for that exit year.
    expect(y10.irr).toBe(
      calculateExits(p0, { ...exitControls(p0), years: '10' }).at(-1)!.result.summaryMetrics
        .irrLeveraged,
    );
    expect(y10.netProceeds + y10.cashFlow).toBeCloseTo(y10.totalCashBack, 0);
    const plot = p.getByRole('group', { name: /Total cash back by exit year/ });
    expect(plot.textContent).toContain(`Initial: ${wholeDollars(y10.invested)}`);
    // Hover/keyboard tooltip still works while a year is selected (reference defect fixed).
    fireEvent.keyDown(plot, { key: 'End' });
    const y30 = rows.at(-1)!;
    expect(live(plot)).toContain(`Year 30 Exit: Sale Price ${dollars(y30.salePrice)}`);
    expect(live(plot)).toContain(`= Net Proceeds ${dollars(y30.netProceeds)}`);
    expect(live(plot)).toContain(`= Profit ${dollars(y30.profit)}`);
    fireEvent.keyDown(plot, { key: 'Enter' });
    expect(p.getByText('Year 30 Exit Summary')).toBeTruthy();
    fireEvent.click(p.getByRole('button', { name: 'Clear' }));
    expect(p.queryByText(/Exit Summary/)).toBeNull();
    fireEvent.click(p.getByRole('button', { name: '15y' }));
    expect(p.getByText('Year 15 Exit Summary')).toBeTruthy();
    fireEvent.click(p.getByRole('button', { name: 'Total Cash Back' }));
    expect(p.getAllByText(wholeDollars(rows[2].totalCashBack)).length).toBeGreaterThan(1);
    // Exact horizon table keeps cents.
    expect(p.getByRole('table', { name: /Exit horizon comparison/ })).toBeTruthy();
  });

  it('builds the sensitivity heatmap from engine cells with the base inserted', () => {
    const p0 = realRoiSample();
    const { container } = charts(p0);
    fireEvent.click(screen.getByRole('tab', { name: 'Sensitivity' }));
    const p = panel(container, 'sensitivity');
    const grid = calculateSensitivity(p0, sensitivityControls(p0));
    expect(grid.rents).toEqual([1960, 2380, 2800, 3220, 3640]);
    expect(grid.vacancies).toEqual([0, 3, 5, 6, 9, 12, 15]);
    const base = grid.cells[2][2];
    const engine = calculatePayload(p0).base;
    expect(base.cashOnCash).toBe(engine.summaryMetrics.cashOnCash);
    expect(base.stabilized).toBeCloseTo(
      engine.annualCashflows[2].cashFlow / engine.summaryMetrics.totalCashRequired,
      10,
    );
    const map = p.getByRole('group', { name: /Cash-on-Cash by monthly rent and vacancy/ });
    const cells = map.querySelectorAll('rect');
    expect(cells).toHaveLength(35);
    expect(map.querySelector('polygon')).toBeTruthy();
    expect(map.querySelector('polyline')).toBeTruthy();
    // Keyboard starts on the base cell.
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    const spoken = map.parentElement!.querySelector('[aria-live]')!.textContent!;
    expect(spoken).toBe(
      `Monthly rent ${dollars(2800)}, vacancy 5%: Cash-on-Cash ${rate(base.cashOnCash)} (your assumptions)`,
    );
    expect(p.getByText('0% Break-even')).toBeTruthy();
    const before = cells[0].getAttribute('fill');
    fireEvent.click(p.getByLabelText('Colorblind-safe'));
    expect(map.querySelectorAll('rect')[0].getAttribute('fill')).not.toBe(before);
    expect(map.textContent).not.toContain('%-');
    fireEvent.click(p.getByLabelText('Show values'));
    expect(map.textContent).toContain(`${((base.cashOnCash ?? 0) * 100).toFixed(1)}%`);
    fireEvent.click(p.getByRole('button', { name: 'Year 5' }));
    expect(p.getByRole('table', { name: /Year 5 cash-on-cash/ })).toBeTruthy();
    fireEvent.change(p.getByLabelText('Sensitivity metric'), { target: { value: 'irr' } });
    expect(p.getByRole('button', { name: 'Year 1' }).hasAttribute('disabled')).toBe(true);
    expect(p.getByRole('table', { name: /Hold-period leveraged IRR/ })).toBeTruthy();
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

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cashFlowLandmarks,
  horizonChoices,
  niceScale,
  scenarioSeries,
  segments,
  stackExtents,
  xTickIndexes,
} from '@/lib/analysis/chart-data';
import { calculatePayload } from '@/lib/analysis/contract';
import { dollars, projectionRows } from '@/lib/analysis/projections';
import { ComboChart } from '@/components/analysis/RoiChart';
import { RoiProjections } from '@/components/analysis/RoiProjections';
import { payload } from './fixture';

afterEach(cleanup);

function financed(years = 12) {
  const p = payload();
  p.input.financing!.downPaymentPercent = 25;
  p.input.financing!.interestRate = 6.5;
  p.input.appreciationExit!.holdingPeriodYears = years;
  return p;
}

describe('chart data adapters', () => {
  it('builds readable zero-anchored axes for negative, zero and large values', () => {
    expect(niceScale([-2555.4, 85584.12]).ticks).toEqual([-25000, 0, 25000, 50000, 75000, 100000]);
    expect(niceScale([0, 0]).ticks).toEqual([0, 1]);
    expect(niceScale([null, -10, null]).ticks).toContain(0);
    const big = niceScale([3_803_283.35]);
    expect(big.min).toBe(0);
    expect(big.max).toBeGreaterThanOrEqual(3_803_283.35);
  });

  it('keeps year labels uncrowded on long horizons and always labels the last year', () => {
    expect(xTickIndexes(10, 600)).toHaveLength(10);
    const thirty = xTickIndexes(30, 280, 40);
    expect(thirty[0]).toBe(0);
    expect(thirty.at(-1)).toBe(29);
    expect(thirty.length).toBeLessThanOrEqual(7);
    expect(xTickIndexes(50, 300, 40).at(-1)).toBe(49);
  });

  it('offers reference-style horizons bounded by the hold', () => {
    expect(horizonChoices(1)).toEqual([{ years: 1, label: 'Y1' }]);
    expect(horizonChoices(10).map((h) => h.label)).toEqual(['Y5', 'All 10y']);
    expect(horizonChoices(30).map((h) => h.years)).toEqual([5, 10, 30]);
    expect(horizonChoices(50).map((h) => h.years)).toEqual([5, 10, 30, 50]);
  });

  it('splits lines at missing values and stacks signed parts separately', () => {
    expect(segments([1, 2, null, 4, 5, null])).toEqual([
      { start: 0, values: [1, 2] },
      { start: 3, values: [4, 5] },
    ]);
    expect(
      stackExtents([
        [10, -5],
        [3, 2],
        [null, -1],
      ]),
    ).toEqual({
      top: [13, 2],
      bottom: [0, -6],
    });
  });

  it('keeps scenario years beyond a shorter hold unavailable instead of zero', () => {
    const short = calculatePayload(financed(3)).base;
    const series = scenarioSeries({ result: short }, 5, 'cashFlow');
    expect(series.slice(0, 3)).toEqual(short.annualCashflows.map((y) => y.cashFlow));
    expect(series.slice(3)).toEqual([null, null]);
    expect(scenarioSeries({ result: short }, 5, 'equity').slice(3)).toEqual([null, null]);
  });

  it('reports landmarks from the calculated rows only', () => {
    const rows = [
      { year: 1, cashFlow: -100, cumulativeCashFlow: -100 },
      { year: 2, cashFlow: 50, cumulativeCashFlow: -50 },
      { year: 3, cashFlow: 80, cumulativeCashFlow: 30 },
    ];
    const marks = cashFlowLandmarks(rows);
    expect(marks.turnsPositive).toBe(3);
    expect(marks.worst?.year).toBe(1);
    expect(marks.best?.year).toBe(3);
    // Positive from the start is not a crossing.
    expect(cashFlowLandmarks([{ year: 1, cashFlow: 5, cumulativeCashFlow: 5 }]).turnsPositive).toBe(
      null,
    );
  });
});

describe('ROI combo chart', () => {
  it('reads exact values by keyboard and shows gaps as unavailable', () => {
    const { container } = render(
      <ComboChart
        label="Test cash"
        years={[1, 2, 3]}
        series={[{ label: 'Cash', values: [-1250.5, null, 0], color: '#0d9488' }]}
      />,
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(screen.getByText(/Gap = unavailable, not \$0/)).toBeTruthy();
    const plot = screen.getByRole('group', { name: /Test cash/ });
    fireEvent.keyDown(plot, { key: 'Home' });
    expect(container.textContent).toContain('Year 1: Cash -$1,250.50');
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    expect(container.textContent).toContain('Year 2: Cash Unavailable');
    fireEvent.keyDown(plot, { key: 'End' });
    expect(container.textContent).toContain('Year 3: Cash $0.00');
    fireEvent.keyDown(plot, { key: 'Escape' });
    expect(container.querySelector('[aria-live]')?.textContent).toBe('');
  });

  it('drops a selected last point when the data shrinks or empties instead of reading past it', () => {
    const data = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ year: i + 1, cumulativeCashFlow: -100 * (i + 1) }));
    // Mirrors the Summary and Equity callbacks, which index their own rows directly.
    const chart = (rows: ReturnType<typeof data>) => (
      <ComboChart
        label="Shrinking cash"
        years={rows.map((r) => r.year)}
        series={[
          { label: 'Cash', kind: 'bar', values: rows.map((r) => r.cumulativeCashFlow), color: '#0d9488' },
        ]}
        details={(i) => [['Cumulative', dollars(rows[i].cumulativeCashFlow)]]}
      />
    );
    const { container, rerender } = render(chart(data(10)));
    const live = () => container.querySelector('[aria-live]')!.textContent;
    const plot = screen.getByRole('group', { name: /Shrinking cash/ });
    const svg = container.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 660, height: 280, right: 660, bottom: 280 }) as DOMRect;

    // Keyboard: last of ten, then five years.
    fireEvent.keyDown(plot, { key: 'End' });
    expect(live()).toContain('Year 10: Cash -$1,000.00; Cumulative -$1,000.00');
    rerender(chart(data(5)));
    expect(live()).toBe('');
    expect(container.textContent).not.toContain('undefined');
    // Five bars and no highlight band.
    expect(container.querySelectorAll('svg rect')).toHaveLength(5);
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(live()).toContain('Year 5: Cash -$500.00');

    // Touch on the far right, then the data empties and comes back shorter.
    fireEvent.pointerDown(svg, { clientX: 655, pointerType: 'touch' });
    expect(live()).toContain('Year 5:');
    rerender(chart([]));
    expect(live()).toBe('');
    expect(container.querySelectorAll('circle, svg rect')).toHaveLength(0);
    rerender(chart(data(3)));
    expect(live()).toBe('');
    expect(container.textContent).not.toContain('undefined');

    // Mouse hover on the last of three, then two remain.
    fireEvent.pointerMove(svg, { clientX: 655, pointerType: 'mouse' });
    expect(live()).toContain('Year 3: Cash -$300.00');
    rerender(chart(data(2)));
    expect(live()).toBe('');
    fireEvent.keyDown(plot, { key: 'End' });
    expect(live()).toContain('Year 2: Cash -$200.00; Cumulative -$200.00');
  });

  it('clears a selected final year when the horizon, property or hold gets shorter', () => {
    const long = financed(12);
    const short = financed(4);
    const props = (p: ReturnType<typeof financed>) => ({
      result: calculatePayload(p).base,
      calculatedPayload: p,
      calculationVersion: 1,
      stale: false,
      saving: false,
      onEdit: () => {},
    });
    const { container, rerender } = render(<RoiProjections {...props(long)} />);
    const cash = screen.getByRole('group', { name: /Annual and cumulative operating cash flow/ });
    const liveOf = (plot: HTMLElement) => plot.parentElement!.querySelector('[aria-live]')!.textContent;

    // Horizon: year 12 selected, then Y5.
    fireEvent.keyDown(cash, { key: 'End' });
    expect(liveOf(cash)).toContain('Year 12:');
    const horizon = screen.getByRole('group', { name: 'Cash flow chart horizon' });
    fireEvent.click(within(horizon).getByRole('button', { name: 'Y5' }));
    expect(liveOf(cash)).toBe('');

    // Property/scenario change: equity year 12 selected, then a four-year hold.
    fireEvent.click(screen.getByRole('tab', { name: /Equity/ }));
    const equity = screen.getByRole('group', { name: /Equity composition and loan balance/ });
    fireEvent.keyDown(equity, { key: 'End' });
    expect(liveOf(equity)).toContain('Year 12:');
    rerender(<RoiProjections {...props(short)} />);
    expect(liveOf(equity)).toBe('');
    expect(container.textContent).not.toMatch(/Year undefined|NaN/);
    fireEvent.keyDown(equity, { key: 'End' });
    const rows = projectionRows(calculatePayload(short).base);
    expect(liveOf(equity)).toContain(`Year 4:`);
    expect(liveOf(equity)).toContain(`Property value ${dollars(rows[3].propertyValue)}`);
  });

  it('matches the exact projection table for the final year and follows the horizon', () => {
    const p = financed(12);
    const result = calculatePayload(p).base;
    const rows = projectionRows(result);
    render(
      <RoiProjections
        result={result}
        calculatedPayload={p}
        calculationVersion={1}
        stale={false}
        saving={false}
        onEdit={() => {}}
      />,
    );
    const plot = screen.getByRole('group', { name: /Annual and cumulative operating cash flow/ });
    fireEvent.keyDown(plot, { key: 'End' });
    const last = rows.at(-1)!;
    const live = plot.parentElement!.querySelector('[aria-live]')!.textContent!;
    expect(live).toContain(`Year ${last.year}: Annual cash flow ${dollars(last.cashFlow)}`);
    expect(live).toContain(`Cumulative cash flow ${dollars(last.cumulativeCashFlow)}`);
    const table = screen.getByRole('table', { name: /Projection amounts/ });
    expect(within(table).getAllByText(dollars(last.cumulativeCashFlow)).length).toBeGreaterThan(0);

    const horizon = screen.getByRole('group', { name: 'Cash flow chart horizon' });
    fireEvent.click(within(horizon).getByRole('button', { name: 'Y5' }));
    expect(within(horizon).getByRole('button', { name: 'Y5' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.keyDown(plot, { key: 'End' });
    expect(plot.parentElement!.querySelector('[aria-live]')!.textContent).toContain(
      `Year 5: Annual cash flow ${dollars(rows[4].cashFlow)}`,
    );
    expect(screen.getByText(`Cumulative cash flow · year 5`)).toBeTruthy();
    // The exact table keeps every projected year regardless of the chart horizon.
    expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1);
  });
});

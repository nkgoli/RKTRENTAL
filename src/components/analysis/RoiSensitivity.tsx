'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import {
  calculateSensitivity,
  dollars,
  rate,
  sensitivityControls,
  type SensitivityControls,
  type SensitivityGrid,
} from '@/lib/analysis/projections';
import {
  breakevenContour,
  colorblindPalette,
  heatColor,
  heatPalette,
  type ChartValue,
} from '@/lib/analysis/chart-data';
import { ChartCard, chartColors, Check, Icon } from './RoiChart';
import styles from './analysis.module.css';
import chartStyles from './projections.module.css';
import d from './detail-charts.module.css';

type Timeframe = 'year1' | 'stabilized' | 'year5';
type Metric = 'cashOnCash' | 'irr';
type Cell = SensitivityGrid['cells'][number][number];

const timeframes: { id: Timeframe; label: string; year: number }[] = [
  { id: 'year1', label: 'Year 1', year: 1 },
  { id: 'stabilized', label: 'Stabilized', year: 3 },
  { id: 'year5', label: 'Year 5', year: 5 },
];
const describe: Record<Timeframe, string> = {
  year1: 'Showing first-year cash-on-cash returns based on initial assumptions.',
  stabilized: 'Showing stabilized returns (Year 3) after initial lease-up period.',
  year5: 'Showing Year 5 returns accounting for rent growth and expense increases.',
};
const short = (v: number) => `${(v * 100).toFixed(1)}%`;
const cellText = (v: number) => {
  const p = v * 100;
  return `${Math.abs(p) >= 10 ? p.toFixed(0) : p.toFixed(1)}%`;
};
const rentTick = (v: number) => `$${(v / 1000).toFixed(1)}k`;
const vacancyTick = (v: number) => `${Number(v.toFixed(2))}%`;

/** White or slate-900 text, whichever contrasts more with the cell. */
function ink(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? chartColors.ink : '#ffffff';
}

/**
 * C15 · visx-style heatmap: rent across, vacancy up, a continuous 3-stop scale,
 * the base cell outlined with a ★ corner and a dashed break-even contour. Cells
 * come from the engine; unavailable cells stay grey and say why.
 */
function Heatmap({
  grid,
  value,
  reason,
  baseRent,
  baseVacancy,
  palette,
  showValues,
  valueLabel,
}: {
  grid: SensitivityGrid;
  value: (cell: Cell) => ChartValue;
  reason: (cell: Cell) => string | undefined;
  baseRent: number | undefined;
  baseVacancy: number | undefined;
  palette: typeof heatPalette;
  showValues: boolean;
  valueLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(650);
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const id = useId();
  useEffect(() => {
    if (!wrap.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  const w = Math.min(650, width);
  const narrow = w < 480;
  const h = narrow ? 340 : 420;
  const m = narrow
    ? { top: 16, right: 8, bottom: 56, left: 54 }
    : { top: 24, right: 24, bottom: 72, left: 80 };
  const cols = grid.rents.length;
  const rowsN = grid.vacancies.length;
  // matrix[row][col]: rows are vacancy (bottom = lowest), columns are rent.
  const matrix = grid.vacancies.map((_, v) => grid.rents.map((_, r) => value(grid.cells[r][v])));
  const finite = matrix.flat().filter((v): v is number => v != null && Number.isFinite(v));
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const innerW = Math.max(1, w - m.left - m.right);
  const innerH = h - m.top - m.bottom;
  const stepX = innerW / cols;
  const stepY = innerH / rowsN;
  const cellW = stepX * 0.95;
  const cellH = stepY * 0.95;
  const x = (col: number) => col * stepX + stepX * 0.025;
  const y = (row: number) => innerH - (row + 1) * stepY + stepY * 0.025;
  const cxAt = (col: number) => col * stepX + stepX / 2;
  const cyAt = (row: number) => innerH - row * stepY - stepY / 2;
  const near = (a: number, b: number | undefined) => b != null && Math.abs(a - b) < 1e-6;
  const baseCol = grid.rents.findIndex((r) => near(r, baseRent));
  const baseRow = grid.vacancies.findIndex((v) => near(v, baseVacancy));
  const contour = breakevenContour(matrix);
  const hasContour = contour.some((run) => run.length > 1);
  const current =
    active == null
      ? null
      : {
          rent: grid.rents[active.col],
          vacancy: grid.vacancies[active.row],
          value: matrix[active.row][active.col],
          reason: reason(grid.cells[active.col][active.row]),
        };
  const zeroAt = min < 0 && max > 0 ? ((0 - min) / (max - min)) * 100 : null;
  return (
    <div className={d.heat}>
      <div
        ref={wrap}
        className={d.heatPlot}
        role="group"
        tabIndex={0}
        aria-label={`${valueLabel} by monthly rent and vacancy rate. Use arrow keys to move between cells; exact values are also in the table.`}
        onKeyDown={(event) => {
          const at = active ?? { row: Math.max(0, baseRow), col: Math.max(0, baseCol) };
          const moves: Record<string, () => { row: number; col: number } | null> = {
            ArrowRight: () => ({ ...at, col: Math.min(cols - 1, at.col + (active ? 1 : 0)) }),
            ArrowLeft: () => ({ ...at, col: Math.max(0, at.col - (active ? 1 : 0)) }),
            ArrowUp: () => ({ ...at, row: Math.min(rowsN - 1, at.row + (active ? 1 : 0)) }),
            ArrowDown: () => ({ ...at, row: Math.max(0, at.row - (active ? 1 : 0)) }),
            Home: () => ({ ...at, col: 0 }),
            End: () => ({ ...at, col: cols - 1 }),
            Escape: () => null,
          };
          if (!moves[event.key]) return;
          event.preventDefault();
          setActive(moves[event.key]());
        }}
        onBlur={() => setActive(null)}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setActive(null);
        }}
      >
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-labelledby={`${id}-t`}>
          <title id={`${id}-t`}>{`${valueLabel} heatmap`}</title>
          <g transform={`translate(${m.left} ${m.top})`}>
            {matrix.map((row, r) =>
              row.map((v, c) => {
                const fill =
                  v == null || !Number.isFinite(v) ? '#f1f5f9' : heatColor(min, max, v, palette);
                const base = r === baseRow && c === baseCol;
                const isActive = active?.row === r && active.col === c;
                return (
                  <g
                    key={`${r}-${c}`}
                    onPointerEnter={() => setActive({ row: r, col: c })}
                    onPointerDown={() => setActive({ row: r, col: c })}
                  >
                    <rect
                      x={x(c)}
                      y={y(r)}
                      width={cellW}
                      height={cellH}
                      rx={2}
                      fill={fill}
                      stroke={base ? chartColors.primary : isActive ? chartColors.ink : '#ffffff'}
                      strokeWidth={base ? 3 : isActive ? 2 : 1}
                      className={d.cell}
                    />
                    {base && (
                      <g aria-hidden="true">
                        <polygon
                          points={`${x(c)},${y(r)} ${x(c) + 12},${y(r)} ${x(c)},${y(r) + 12}`}
                          fill={chartColors.primary}
                        />
                        <text x={x(c) + 1.5} y={y(r) + 7.5} className={d.star}>
                          ★
                        </text>
                      </g>
                    )}
                    {(showValues || v == null) && (
                      <text
                        x={x(c) + cellW / 2}
                        y={y(r) + cellH / 2}
                        className={d.cellValue}
                        fill={v == null ? chartColors.muted : ink(fill)}
                        fontSize={cellW > 60 ? 11 : 9}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        pointerEvents="none"
                      >
                        {v == null ? '—' : cellText(v)}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
            {contour
              .filter((run) => run.length > 1)
              .map((run, k) => (
                <polyline
                  key={k}
                  className={d.contour}
                  points={run
                    .map((p) => {
                      const c0 = Math.floor(p.column);
                      const t = p.column - c0;
                      const px = cxAt(c0) + t * stepX;
                      return `${px},${cyAt(p.row)}`;
                    })
                    .join(' ')}
                />
              ))}
            <line className={d.axis} x1={0} x2={innerW} y1={innerH} y2={innerH} />
            <line className={d.axis} x1={0} x2={0} y1={0} y2={innerH} />
            {grid.rents.map((rent, c) => (
              <g key={`x-${c}`}>
                <line className={d.axis} x1={cxAt(c)} x2={cxAt(c)} y1={innerH} y2={innerH + 6} />
                <text className={d.tick} x={cxAt(c)} y={innerH + 20} textAnchor="middle">
                  {rentTick(rent)}
                </text>
              </g>
            ))}
            {grid.vacancies.map((v, r) => (
              <g key={`y-${r}`}>
                <line className={d.axis} x1={-6} x2={0} y1={cyAt(r)} y2={cyAt(r)} />
                <text className={d.tick} x={-9} y={cyAt(r) + 3.5} textAnchor="end">
                  {vacancyTick(v)}
                </text>
              </g>
            ))}
            <text
              className={d.axisTitle}
              x={innerW / 2}
              y={innerH + (narrow ? 44 : 50)}
              textAnchor="middle"
            >
              Monthly Rent
            </text>
            <text
              className={d.axisTitle}
              transform={`translate(${narrow ? -42 : -60} ${innerH / 2}) rotate(-90)`}
              textAnchor="middle"
            >
              Vacancy Rate
            </text>
          </g>
        </svg>
      </div>
      <p className={d.srOnly} aria-live="polite">
        {current
          ? `Monthly rent ${dollars(current.rent)}, vacancy ${current.vacancy}%: ${valueLabel} ${rate(current.value)}${current.value == null && current.reason ? `. ${current.reason}` : ''}${active?.row === baseRow && active?.col === baseCol ? ' (your assumptions)' : ''}`
          : ''}
      </p>
      <div className={d.scale}>
        <p>{valueLabel}</p>
        {finite.length ? (
          <>
            <div className={d.gradient}>
              <b data-tone="red">{short(min)}</b>
              <span
                style={{
                  background: `linear-gradient(to right, ${palette.low}, ${palette.mid}, ${palette.high})`,
                }}
              >
                {zeroAt != null && (
                  <i style={{ left: `${zeroAt}%` }}>
                    <em>0% Break-even</em>
                  </i>
                )}
              </span>
              <b data-tone="green">{short(max)}</b>
            </div>
            <small>
              Range: {short(min)} to {short(max)}
            </small>
          </>
        ) : (
          <small>No cell has a value for this metric.</small>
        )}
      </div>
      <ul className={d.markers}>
        {baseRow >= 0 && baseCol >= 0 && (
          <li>
            <i data-kind="base" aria-hidden="true">
              ★
            </i>
            Your assumptions
          </li>
        )}
        {hasContour && (
          <li>
            <i data-kind="contour" aria-hidden="true" />
            Break-even line
          </li>
        )}
      </ul>
      <div className={d.readout} aria-hidden="true">
        {current ? (
          <>
            <span>
              <small>Monthly Rent:</small> <b>{rentTick(current.rent)}</b>
            </span>
            <span>
              <small>Vacancy Rate:</small> <b>{vacancyTick(current.vacancy)}</b>
            </span>
            <span data-result>
              <small>{valueLabel}:</small>{' '}
              {current.value == null ? (
                <b data-tone="muted">Unavailable</b>
              ) : (
                <>
                  <b data-tone={current.value >= 0 ? 'green' : 'red'}>{short(current.value)}</b>
                  {current.value < 0 && <em>(negative)</em>}
                </>
              )}
            </span>
            {current.value == null && current.reason && <small>{current.reason}</small>}
          </>
        ) : (
          <em className={d.hint}>Hover over a cell to see details</em>
        )}
      </div>
    </div>
  );
}

export function Sensitivity({
  payload,
  stale,
  saving,
}: {
  payload: AnalysisPayload;
  stale: boolean;
  saving: boolean;
}) {
  const [controls, setControls] = useState(() => sensitivityControls(payload));
  const initial = useMemo(() => {
    try {
      return { grid: calculateSensitivity(payload, sensitivityControls(payload)), error: '' };
    } catch (error) {
      return {
        grid: null,
        error: error instanceof Error ? error.message : 'Calculation unavailable',
      };
    }
  }, [payload]);
  const [calculation, setCalculation] = useState(initial);
  const [changed, setChanged] = useState(false);
  const [metric, setMetric] = useState<Metric>('cashOnCash');
  const [timeframe, setTimeframe] = useState<Timeframe>('year1');
  const [showValues, setShowValues] = useState(false);
  const [colorblind, setColorblind] = useState(false);
  const [ranges, setRanges] = useState(false);
  const rangesId = useId();
  const grid = stale || changed ? null : calculation.grid;
  const hold = payload.input.appreciationExit?.holdingPeriodYears ?? 0;
  const tf = metric === 'irr' ? null : timeframes.find((t) => t.id === timeframe)!;
  const label =
    metric === 'irr'
      ? 'Hold-period leveraged IRR'
      : tf!.id === 'year1'
        ? 'Year 1 cash-on-cash'
        : tf!.id === 'stabilized'
          ? 'Year 3 (stabilized) cash-on-cash'
          : 'Year 5 cash-on-cash';
  const value = (cell: Cell) =>
    metric === 'irr'
      ? cell.irr
      : timeframe === 'year1'
        ? cell.cashOnCash
        : timeframe === 'stabilized'
          ? cell.stabilized
          : cell.year5;
  const reason = (cell: Cell) =>
    metric === 'irr'
      ? cell.irrReason
      : timeframe === 'year1'
        ? cell.reason
        : timeframe === 'stabilized'
          ? cell.stabilizedReason
          : cell.year5Reason;
  const run = (next: SensitivityControls) => {
    try {
      setCalculation({ grid: calculateSensitivity(payload, next), error: '' });
      setChanged(false);
    } catch (error) {
      setCalculation({
        grid: null,
        error: error instanceof Error ? error.message : 'Calculation unavailable',
      });
    }
  };
  const open = ranges || !!calculation.error;
  const rent = payload.input.income?.monthlyRent;
  const field = (key: keyof SensitivityControls, name: string, text: string, unit: '$' | '%') => (
    <label className={d.rangeField}>
      <span>{text}</span>
      <span data-unit={unit}>
        <input
          aria-label={name}
          inputMode="decimal"
          value={controls[key]}
          onChange={(e) => {
            setControls({ ...controls, [key]: e.target.value });
            setChanged(true);
          }}
        />
      </span>
    </label>
  );
  const steps = (key: 'rentSteps' | 'vacancySteps', name: string) => (
    <label className={d.rangeField}>
      <span>Steps: {controls[key]}</span>
      <input
        type="range"
        min={1}
        max={9}
        aria-label={name}
        value={Number(controls[key]) || 1}
        onChange={(e) => {
          setControls({ ...controls, [key]: e.target.value });
          setChanged(true);
        }}
      />
    </label>
  );
  return (
    <ChartCard
      title={`Sensitivity Analysis: ${metric === 'irr' ? 'Leveraged IRR' : 'Cash-on-Cash Return'}`}
      subtitle={`How ${metric === 'irr' ? 'IRR' : 'CoC'} changes with rent & vacancy · Hover cells for details · projected · ${
        metric === 'irr' ? `${hold}-year hold` : tf!.label
      }. Temporary probes leave saved base assumptions unchanged.`}
    >
      <div className={d.heatControls}>
        <div className={d.toggle} role="group" aria-label="Sensitivity timeframe">
          {timeframes.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={metric !== 'irr' && timeframe === t.id}
              disabled={metric === 'irr' || hold < t.year}
              title={hold < t.year ? `The holding period is ${hold} years` : undefined}
              onClick={() => setTimeframe(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={d.heatOptions}>
          <label className={d.metric}>
            <span>Sensitivity metric</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              <option value="cashOnCash">Cash-on-cash</option>
              <option value="irr">Hold-period leveraged IRR</option>
            </select>
          </label>
          <Check label="Show values" checked={showValues} onChange={setShowValues} />
          <Check label="Colorblind-safe" checked={colorblind} onChange={setColorblind} />
          <button
            type="button"
            className={d.customize}
            aria-expanded={open}
            aria-controls={rangesId}
            data-active={open || undefined}
            onClick={() => setRanges(!ranges)}
          >
            <Icon name="settings" size={14} />
            Customize Ranges
          </button>
        </div>
      </div>
      <div id={rangesId} className={d.ranges} hidden={!open}>
        <header>
          <h3>Analysis Parameters</h3>
          <button
            type="button"
            disabled={stale || saving}
            onClick={() => {
              const defaults = sensitivityControls(payload);
              setControls(defaults);
              run(defaults);
            }}
          >
            <Icon name="reset" size={12} />
            Reset
          </button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (stale || saving) return;
            run(controls);
          }}
        >
          <fieldset disabled={stale || saving}>
            <div className={d.rangeGrid}>
              <div>
                <h4>Monthly Rent Range</h4>
                <div className={d.pair}>
                  {field('rentMin', 'Minimum rent ($ / month)', 'Min', '$')}
                  {field('rentMax', 'Maximum rent ($ / month)', 'Max', '$')}
                </div>
                {steps('rentSteps', 'Rent steps')}
                <small>
                  Your assumption:{' '}
                  {rent == null ? 'Unavailable' : `$${rent.toLocaleString('en-US')}/mo`}
                </small>
              </div>
              <div>
                <h4>Vacancy Rate Range</h4>
                <div className={d.pair}>
                  {field('vacancyMin', 'Minimum vacancy (%)', 'Min', '%')}
                  {field('vacancyMax', 'Maximum vacancy (%)', 'Max', '%')}
                </div>
                {steps('vacancySteps', 'Vacancy steps')}
                <small>
                  Your assumption: {payload.input.income?.vacancyRate ?? 'Unavailable'}%
                </small>
              </div>
            </div>
            <p>
              Rent: $0–$10 billion / month. Vacancy: 0–100%. 1–9 steps per axis; your rent and
              vacancy are added when they fall inside the range, up to 100 calculations. For one
              step, enter equal limits.
            </p>
            <button type="submit">Update sensitivity</button>
          </fieldset>
        </form>
        {calculation.error && (
          <p role="alert" className={styles.error}>
            {calculation.error} Correct the ranges and try again.
          </p>
        )}
      </div>
      <p className={d.describe}>
        {metric === 'irr'
          ? `Showing the hold-period leveraged IRR over the ${hold}-year hold, including the sale.`
          : describe[timeframe]}
      </p>
      {grid ? (
        <>
          <Heatmap
            grid={grid}
            value={value}
            reason={reason}
            baseRent={payload.input.income?.monthlyRent}
            baseVacancy={payload.input.income?.vacancyRate}
            palette={colorblind ? colorblindPalette : heatPalette}
            showValues={showValues}
            valueLabel={metric === 'irr' ? 'Leveraged IRR' : 'Cash-on-Cash'}
          />
          <div
            className={`${styles.table} ${chartStyles.exact} ${chartStyles.heat}`}
            role="region"
            tabIndex={0}
            aria-label="Sensitivity grid"
          >
            <table>
              <caption>{label} · percentages · exact</caption>
              <thead>
                <tr>
                  <th scope="col">Monthly rent (USD)</th>
                  {grid.vacancies.map((v) => (
                    <th key={v} scope="col">
                      {v.toFixed(4)}% vacancy
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rents.map((r, ri) => (
                  <tr key={r}>
                    <th scope="row">{dollars(r)}</th>
                    {grid.cells[ri].map((cell, c) => {
                      const v = value(cell);
                      const base =
                        Math.abs(r - (payload.input.income?.monthlyRent ?? NaN)) < 1e-6 &&
                        Math.abs(grid.vacancies[c] - (payload.input.income?.vacancyRate ?? NaN)) <
                          1e-6;
                      return (
                        <td
                          key={c}
                          data-negative={v != null && v < 0}
                          className={base ? chartStyles.base : undefined}
                        >
                          {rate(v)}
                          {base && <small>Base</small>}
                          {v === null && <small>{reason(cell)}</small>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>
          {stale
            ? 'Recalculate base assumptions before running sensitivity.'
            : 'Update sensitivity to see results for these ranges.'}
        </p>
      )}
      <p className={styles.notice}>
        Sensitivity is a model. It does not establish market rent. Review comparable rentals before
        changing a rent assumption.
      </p>
    </ChartCard>
  );
}

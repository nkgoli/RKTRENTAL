'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  axisDollars,
  horizonChoices,
  miniBarWidth,
  monotonePath,
  niceScale,
  referenceTickIndexes,
  segments,
  stackExtents,
  wholeDollars,
  xTickIndexes,
  type ChartValue,
} from '@/lib/analysis/chart-data';
import { dollars } from '@/lib/analysis/projections';
import styles from './analysis.module.css';
import chartStyles from './projections.module.css';
import c from './roi-chart.module.css';

/** Exact table beside every chart: USD to the cent, readable without hover. */
export function ExactTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div
      className={`${styles.table} ${chartStyles.exact}`}
      role="region"
      tabIndex={0}
      aria-label={caption}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th scope="col" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) =>
                column === 0 ? (
                  <th scope="row" key={column}>
                    {cell}
                  </th>
                ) : (
                  <td key={column}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Statement({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.statement}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Colours from `src/styles/globals.css`. SVG attributes cannot read CSS variables, so the
 * values are repeated here. Charts use the `--chart-*` palette in its fixed order; the app
 * tokens below it stay for other panels.
 */
export const chartColors = {
  indigo: '#3e4fe5', // --chart-1
  teal: '#0e9384', // --chart-2
  orange: '#d9732f', // --chart-3
  violet: '#a855c7', // --chart-4
  negative: '#b4233f', // --chart-negative
  grid: '#eceff4', // --chart-grid
  axis: '#6b778a', // --chart-axis
  primary: '#3e4fe5', // --design-primary
  primaryDark: '#2c39b3', // --rr-primary-active
  primaryMid: '#6383e6',
  primaryLight: '#a7b9f0',
  primaryPale: '#dbe4ff',
  navy: '#17233a', // --rr-navy
  accent: '#007f7a', // --design-accent, --rr-ok
  accentDark: '#06606f',
  ink: '#17233a', // --design-text
  muted: '#58677d', // --design-muted
  mutedMid: '#7e8b9e', // --rr-border-strong
  mutedLight: '#a3aebf',
  border: '#dce3ed', // --rr-border
  bad: '#b4233f', // --design-danger, --rr-bad
  warn: '#8a4b09', // --rr-warn
  warm: '#cf8a68', // --rr-warm
  plum: '#9d174d',
} as const;
/** The categorical order for series that have no entity colour of their own. */
export const seriesPalette = [
  chartColors.indigo,
  chartColors.teal,
  chartColors.orange,
  chartColors.violet,
];

/**
 * One colour per entity across every ROI chart: cash flow is always indigo, principal teal,
 * interest orange, appreciation violet; loan balances are a neutral context line, and running
 * totals a dark neutral line so they never pass for another series.
 */
export const entityColors = {
  cashFlow: chartColors.indigo,
  cumulative: chartColors.ink,
  principal: chartColors.teal,
  interest: chartColors.orange,
  appreciation: chartColors.violet,
  balance: chartColors.mutedMid,
  purchaseEquity: '#cdd3dd',
  propertyValue: chartColors.indigo,
  income: chartColors.violet,
  noi: chartColors.teal,
  debtService: chartColors.orange,
  netProceeds: chartColors.teal,
  expenses: chartColors.indigo,
  reserves: chartColors.teal,
  negative: chartColors.negative,
} as const;

export type ChartSeries = {
  label: string;
  values: ChartValue[];
  color: string;
  kind?: 'bar' | 'line';
  /** Bars with `stack` share one column: positive parts up, negative parts down. */
  stack?: boolean;
  /** Bar colour for negative values; the legend then names negative years. */
  negativeColor?: string;
  opacity?: number;
  /** Line width (default 2) and dot radius (default 0: dots only on the active year). */
  width?: number;
  dot?: number;
  /** Leave the series out of the legend (a custom legend names it). */
  hideLegend?: boolean;
  /** Per-index bar fills (one bar per asset, coloured by asset). */
  colors?: string[];
};

export type ChartMarker = {
  index: number;
  label: string;
  /** Fill of the reference dot. */
  color?: string;
  /** Draw a reference dot at this value on the marker line. */
  dot?: number;
  /** `end` puts the label left of the line; `center` above it. */
  align?: 'start' | 'end' | 'center';
};
/** Fill between two series: a soft gradient, or a flat fill at `opacity`. */
export type ChartArea = {
  upper: ChartValue[];
  lower: ChartValue[];
  color: string;
  opacity?: number;
};
/** Dashed horizontal reference line (e.g. "Initial: $102,000"), labelled at the right end. */
export type ChartRefLine = { value: number; label: string; color?: string };
export type LegendItem = {
  label: string;
  kind: 'bar' | 'line' | 'area' | 'dashed';
  color: string;
};
type Sign = '−' | '+' | '=';
export type TipRow =
  | {
      label: string;
      value?: ChartValue;
      /** Text shown instead of a formatted value (e.g. "Paid off"). */
      text?: string;
      op?: Sign;
      /** A dollar amount on an indexed chart. */
      money?: boolean;
      /** `auto` and `red` colour negative values; `muted` dims a deducted line. */
      tone?: 'auto' | 'red' | 'muted';
      total?: boolean;
      swatch?: { color: string; kind?: 'bar' | 'line' };
    }
  | { section: string }
  | { note: string };
export type ChartTip = { title: string; rows: TipRow[] };

/**
 * App card for a chart: a sentence-case title, an optional short subtitle and one quiet tag,
 * with the controls on the right.
 */
export function ChartCard({
  title,
  subtitle,
  tag,
  controls,
  children,
  className,
  label,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** One quiet marker beside the title, such as "Hypothetical" or "Custom ranges". */
  tag?: string;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Accessible name for the card region when the title alone is ambiguous. */
  label?: string;
}) {
  return (
    <section className={`${styles.card} ${c.card} ${className ?? ''}`} aria-label={label}>
      <header className={c.head}>
        <div>
          <div className={c.title}>
            <h2>{title}</h2>
            {tag && <span className={c.tag}>{tag}</span>}
          </div>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {controls && <div className={c.controls}>{controls}</div>}
      </header>
      <div className={c.body}>{children}</div>
    </section>
  );
}

/**
 * Data-basis tags ("Projected", "USD per year", "Before tax"). Tags starting with
 * "Recorded"/"Actual" or "Projected" take the actual and projected tints everywhere,
 * so the two kinds of figure never look alike. "Hypothetical…" and "Temporary…" figures
 * (reference markets, probes) take a caution tint so they never pass for the property's own.
 */
export function Basis({ items }: { items: string[] }) {
  return (
    <ul className={c.basis} aria-label="Data basis">
      {items.map((item) => (
        <li
          key={item}
          data-kind={
            /^(recorded|actual)/i.test(item)
              ? 'actual'
              : /^projected/i.test(item)
                ? 'projected'
                : /^(hypothetical|temporary)/i.test(item)
                  ? 'hypothetical'
                  : undefined
          }
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Exact figures or method notes kept one click away, below a chart or summary. */
export function MoreDetail({
  summary,
  children,
  open,
}: {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className={c.more} open={open}>
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}

/** Compact segmented control; each option is a toggle button. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={c.segmented} data-size={size ?? 'sm'} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** ⓘ with a hover/focus explanation that screen readers get as a description. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className={c.info}>
      <button type="button" aria-label={`About ${label}`} aria-describedby={id}>
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 16v-4M12 8h.01"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span role="tooltip" id={id}>
        {children}
      </span>
    </span>
  );
}

/** A row of figures above a chart: muted label over the value, no boxes. */
export function Tiles({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    note?: ReactNode;
    info?: ReactNode;
    /** A loss or shortfall: the value turns red. */
    negative?: boolean;
  }[];
}) {
  return (
    <dl className={c.tiles}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>
            {item.label}
            {item.info && <InfoTip label={item.label}>{item.info}</InfoTip>}
          </dt>
          <dd>
            <strong data-negative={item.negative || undefined}>{item.value}</strong>
            {item.note && <small>{item.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Header checkbox ("Include down payment"). */
export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={c.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** The key number inside a takeaway sentence; red for a loss. */
export function Figure({ children, tone }: { children: ReactNode; tone?: 'red' }) {
  return (
    <b className={c.figure} data-tone={tone}>
      {children}
    </b>
  );
}

/** One quiet sentence under a chart: the takeaway, or the landmark that matters. */
export function Insight({ children }: { children: ReactNode }) {
  return <p className={c.insight}>{children}</p>;
}

type HorizonValue = number | 'custom';

/**
 * Horizon state and its Y1/Y5/Y10/Y30/Custom control. `preferred` is the chart's
 * reference default; a shorter hold clamps it and shows as a custom range.
 */
export function useHorizon(length: number, label: string, preferred = 30) {
  const [mode, setMode] = useState<HorizonValue>(preferred);
  const [custom, setCustom] = useState(7);
  const presets = horizonChoices(length);
  const clamp = (v: number) => Math.max(1, Math.min(length, v));
  let shown = mode === 'custom' ? clamp(custom) : clamp(mode);
  // A preset the hold cannot reach reads as the custom range it actually shows.
  const pressed: HorizonValue =
    mode !== 'custom' && presets.some((p) => p.years === shown) ? shown : 'custom';
  if (length < 1) shown = 0;
  const canCustom = length >= 2;
  const control =
    length > 1 ? (
      <div className={c.horizon}>
        <Segmented<HorizonValue>
          label={label}
          options={[
            ...presets.map((h) => ({ value: h.years as HorizonValue, label: h.label })),
            ...(canCustom ? [{ value: 'custom' as HorizonValue, label: 'Custom' }] : []),
          ]}
          value={pressed}
          onChange={(value) => {
            if (value === 'custom') setCustom((v) => Math.max(2, Math.min(length, v)));
            setMode(value);
          }}
        />
        {pressed === 'custom' && canCustom && (
          <label className={c.slider}>
            <span className={c.srOnly}>{label}: custom years</span>
            <input
              type="range"
              min={2}
              max={length}
              value={Math.max(2, shown)}
              onChange={(event) => {
                setCustom(Number(event.target.value));
                setMode('custom');
              }}
            />
            <output aria-hidden="true">Y{shown}</output>
          </label>
        )}
      </div>
    ) : null;
  return [shown, control] as const;
}

/** Lucide icon outlines used on the chart cards. */
const iconPaths = {
  down: (
    <>
      <path d="M22 17 13.5 8.5 8.5 13.5 2 7" />
      <path d="M16 17h6v-6" />
    </>
  ),
  up: (
    <>
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  settings: (
    <>
      <path d="M20 7h-9M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
};
export type IconName = keyof typeof iconPaths;

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={c.icon}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {iconPaths[name]}
      </g>
    </svg>
  );
}

/** 48 px bar for a rate cell: |rate| × 500%, primary or bad when negative. */
export function MiniBar({ value }: { value: number | null }) {
  return (
    <span className={c.mini} aria-hidden="true">
      <i
        style={{
          width: `${miniBarWidth(value)}%`,
          background: value != null && value < 0 ? chartColors.bad : chartColors.primary,
        }}
      />
    </span>
  );
}

function arc(r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${r * Math.sin(a)},${-r * Math.cos(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

/**
 * Donut with 2° padding between segments. Negative parts cannot be drawn as a
 * slice, so they are left out of the ring and must be stated next to it.
 */
export function Donut({
  label,
  parts,
  size = 112,
  inner = 30,
  outer = 50,
}: {
  label: string;
  parts: { label: string; value: number; color: string }[];
  size?: number;
  inner?: number;
  outer?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const drawn = parts.map((p) => Math.max(0, Number.isFinite(p.value) ? p.value : 0));
  const total = drawn.reduce((a, b) => a + b, 0);
  const count = drawn.filter((v) => v > 0).length;
  const pad = count > 1 ? (2 * Math.PI) / 180 : 0;
  const free = 2 * Math.PI - pad * count;
  let angle = 0;
  const shapes = drawn.map((v, i) => {
    if (v <= 0 || total <= 0) return null;
    const a0 = angle + pad / 2;
    const a1 = a0 + (v / total) * free;
    angle = a1 + pad / 2;
    return { i, d: count === 1 ? null : arc(inner, outer, a0, a1) };
  });
  return (
    <div className={c.donut} style={{ width: size, height: size }}>
      <svg
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        width={size}
        height={size}
        role="img"
      >
        <title>{`${label}: ${parts.map((p) => `${p.label} ${wholeDollars(p.value)}`).join(', ')}`}</title>
        {total <= 0 && (
          <circle
            r={(inner + outer) / 2}
            fill="none"
            stroke={chartColors.border}
            strokeWidth={outer - inner}
          />
        )}
        {shapes.map((s) =>
          s == null ? null : s.d == null ? (
            <circle
              key={s.i}
              r={(inner + outer) / 2}
              fill="none"
              stroke={parts[s.i].color}
              strokeWidth={outer - inner}
              onPointerEnter={() => setHover(s.i)}
              onPointerLeave={() => setHover(null)}
            />
          ) : (
            <path
              key={s.i}
              d={s.d}
              fill={parts[s.i].color}
              className={c.slice}
              onPointerEnter={() => setHover(s.i)}
              onPointerLeave={() => setHover(null)}
            />
          ),
        )}
      </svg>
      {hover != null && (
        <div className={c.donutTip} aria-hidden="true">
          {parts[hover].label}: <b>{wholeDollars(parts[hover].value)}</b>
        </div>
      )}
    </div>
  );
}

/** A bar from `base` to `end`: the data end is rounded, the baseline end stays square. */
function barPath(x: number, w: number, base: number, end: number, r: number) {
  const top = Math.min(base, end);
  const bottom = Math.max(top + 1, Math.max(base, end));
  const rr = Math.max(0, Math.min(r, w / 2, bottom - top));
  const upward = end <= base;
  const t = upward ? rr : 0;
  const b = upward ? 0 : rr;
  return (
    `M${x},${top + t}Q${x},${top} ${x + t},${top}H${x + w - t}Q${x + w},${top} ${x + w},${top + t}` +
    `V${bottom - b}Q${x + w},${bottom} ${x + w - b},${bottom}H${x + b}Q${x},${bottom} ${x},${bottom - b}Z`
  );
}

/** Surface gap between touching bars and stacked segments, in px. */
const GAP = 2;
/** Widest bar, in px. */
const BAR_MAX = 28;

/**
 * Bars and lines on one zero baseline in the shared chart style: thin bars with rounded data
 * ends, 2 px lines, a hairline grid with rounded ticks and a hover card. Hover, touch or arrow
 * keys read a year; the live region reads exact values, and `null` values leave a gap that
 * reads "Unavailable".
 */
export function ComboChart({
  label,
  years,
  series,
  unit = 'USD',
  height,
  markers = [],
  areas = [],
  details,
  tooltip,
  legend,
  xLabel = 'Year',
  xFormat = String,
  format,
  refLines = [],
  emphasis = null,
  emphasizeHover = false,
  onSelect,
  xTicks,
  tickFormat,
}: {
  label: string;
  years: (number | string)[];
  series: ChartSeries[];
  /** Percent values are already in percent (10.5 means 10.5%). */
  unit?: 'USD' | 'Index' | 'Percent';
  height?: number;
  markers?: ChartMarker[];
  /** Soft fill between two series (e.g. value over loan = equity). */
  areas?: ChartArea[];
  /** Extra tooltip rows for the active index, such as an equity equation. */
  details?: (index: number) => [string, string][];
  /** Full tooltip for an index; replaces the series rows. */
  tooltip?: (index: number) => ChartTip;
  /** Legend override; an empty list leaves the naming to a legend outside the chart. */
  legend?: LegendItem[];
  xLabel?: string;
  xFormat?: (year: number | string) => string;
  /** Exact formatter matching the adjacent table; defaults to cents or 4-dp index. */
  format?: (value: number) => string;
  refLines?: ChartRefLine[];
  /** Index whose bars are emphasised; the other bars fade. */
  emphasis?: number | null;
  /** Emphasise the hovered index too when nothing is selected. */
  emphasizeHover?: boolean;
  /** Click, tap, Enter or Space on an index selects it. */
  onSelect?: (index: number) => void;
  /** Year-label indexes when the chart has its own tick set. */
  xTicks?: number[];
  /** Y tick text override (e.g. `10.5%`); defaults to compact dollars or the index. */
  tickFormat?: (value: number, step: number) => string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(660);
  const [selected, setActive] = useState<number | null>(null);
  const [pointerY, setPointerY] = useState<number | null>(null);
  const id = useId();
  const n = years.length;
  // A selection from a longer horizon, property or scenario never reaches the
  // readout, `details` or the plot: it is cleared once the data no longer has it.
  const active = selected != null && selected >= 0 && selected < n ? selected : null;
  useEffect(() => {
    if (selected != null && active == null) setActive(null);
  }, [selected, active]);
  useEffect(() => {
    if (!wrap.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);

  const narrow = width < 480;
  const h = height ?? (narrow ? 220 : 260);
  const stacked = series.filter((s) => s.kind === 'bar' && s.stack);
  const loose = series.filter((s) => s.kind === 'bar' && !s.stack);
  const lines = series.filter((s) => s.kind !== 'bar');
  const extents = stackExtents(stacked.map((s) => s.values));
  const plotted = [
    ...lines.flatMap((s) => s.values),
    ...loose.flatMap((s) => s.values),
    ...areas.flatMap((a) => [...a.upper, ...a.lower]),
    ...extents.top,
    ...extents.bottom,
    ...refLines.map((r) => r.value),
  ].filter((v): v is number => v != null && Number.isFinite(v));
  // Rounded steps (1, 2, 2.5 or 5 × 10^k) that always include zero, as in the shared ColumnChart.
  const scale = niceScale(plotted, 5);
  const step = scale.ticks.length > 1 ? scale.ticks[1] - scale.ticks[0] : 1;
  const compact = Math.max(...scale.ticks.map((t) => Math.abs(t))) >= 10000;
  const axis = (v: number) =>
    tickFormat
      ? tickFormat(v, step)
      : unit === 'USD'
        ? axisDollars(v, step, compact)
        : unit === 'Percent'
          ? `${v.toFixed(step < 1 ? 1 : 0)}%`
          : v.toFixed(step < 1 ? 1 : 0);
  const labelW = Math.max(...scale.ticks.map((t) => axis(t).length)) * (narrow ? 6.4 : 7);
  const m = { top: 18, right: narrow ? 4 : 8, bottom: 28, left: Math.ceil(labelW) + 10 };
  const innerW = Math.max(1, width - m.left - m.right);
  const innerH = h - m.top - m.bottom;
  const band = innerW / Math.max(1, n);
  const cx = (i: number) => m.left + band * (i + 0.5);
  const y = (v: number) => m.top + innerH - ((v - scale.min) / (scale.max - scale.min)) * innerH;
  const groups = (stacked.length ? 1 : 0) + loose.length;
  const slot = band * (groups > 1 ? 0.7 : 0.56);
  const barW = Math.max(
    2,
    Math.min(BAR_MAX, (slot - GAP * (groups - 1)) / Math.max(1, groups)),
  );
  const groupW = barW * groups + GAP * Math.max(0, groups - 1);
  const groupX = (i: number, g: number) => cx(i) - groupW / 2 + g * (barW + GAP);
  const exact = (v: ChartValue | undefined) =>
    v == null || !Number.isFinite(v)
      ? 'Unavailable'
      : format
        ? format(v)
        : unit === 'USD'
          ? dollars(v)
          : unit === 'Percent'
            ? `${v.toFixed(2)}%`
            : v.toFixed(4);
  const shown = (v: ChartValue | undefined, money?: boolean) =>
    unit === 'USD' || money
      ? wholeDollars(v)
      : v == null || !Number.isFinite(v)
        ? 'Unavailable'
        : `${v.toFixed(1)}${unit === 'Percent' ? '%' : ''}`;
  const spokenValue = (r: Extract<TipRow, { label: string }>) => {
    if (r.value === undefined) return r.text ?? '';
    const value = r.money && unit !== 'USD' ? dollars(r.value) : exact(r.value);
    // A row that shows words ("No loan", "Paid off") is read as shown, then exactly.
    return r.text ? `${r.text} (${value})` : value;
  };
  const reference = xTicks ?? referenceTickIndexes(years);
  const longest = Math.max(1, ...reference.map((i) => xFormat(years[i] ?? '').length));
  const fit = xTickIndexes(n, innerW, Math.max(narrow ? 34 : 40, longest * 7 + 8));
  const ticks = reference.length <= fit.length ? reference : fit;
  const emphasised = emphasis ?? (emphasizeHover ? active : null);
  const fade = (i: number) => (emphasised != null && i !== emphasised ? 0.35 : 1);
  const hasGap = series.some((s) => s.values.slice(0, n).some((v) => v == null));
  const hasNegativeBar = series.some(
    (s) => s.kind === 'bar' && s.negativeColor && s.values.some((v) => v != null && v < 0),
  );
  // Columns whose bars reach above a value: a reference label never sits on them.
  const tallAt = (value: number) =>
    years.flatMap((_, i) => {
      const top = Math.max(
        extents.top[i] ?? 0,
        ...loose.map((s) => (Number.isFinite(s.values[i]) ? (s.values[i] as number) : 0)),
      );
      return groups && top > value ? [[groupX(i, 0) - 6, groupX(i, 0) + groupW + 6]] : [];
    });
  const refRight = (r: ChartRefLine) => {
    const w = r.label.length * 6.6;
    let right = width - m.right - 2;
    for (const [from, to] of [...tallAt(r.value)].reverse())
      if (right - w < to && right > from) right = from;
    return Math.max(m.left + w, right);
  };

  function pick(clientX: number, clientY: number) {
    const box = wrap.current?.querySelector('svg')?.getBoundingClientRect();
    if (!box || !box.width || !n) return;
    const x = ((clientX - box.left) / box.width) * width;
    setPointerY(clientY - box.top);
    setActive(Math.min(n - 1, Math.max(0, Math.floor((x - m.left) / band))));
  }

  const tip: ChartTip | null =
    active == null
      ? null
      : tooltip
        ? tooltip(active)
        : {
            title: `${xLabel} ${years[active]}`,
            rows: [
              ...series.map((s): TipRow => ({
                label: s.label,
                value: s.values[active] ?? null,
                swatch: { color: s.color, kind: s.kind === 'bar' ? 'bar' : 'line' },
              })),
              ...(details?.(active) ?? []).map(([k, v]): TipRow => ({ label: k, text: v })),
            ],
          };
  const spoken =
    tip == null
      ? ''
      : `${tip.title}: ${tip.rows
          .flatMap((r) =>
            'section' in r
              ? []
              : 'note' in r
                ? [r.note]
                : [`${r.op ? `${r.op} ` : ''}${r.label} ${spokenValue(r)}`],
          )
          .join('; ')}`;
  const tipLeft = active != null && cx(active) > m.left + innerW / 2;
  const tipY = Math.max(4, Math.min((pointerY ?? m.top) - 24, h * 0.35));
  const legendItems: LegendItem[] = legend ?? [
    ...series
      .filter((s) => !s.hideLegend)
      .map(
        (s): LegendItem => ({
          label: s.label,
          kind: s.kind === 'bar' ? 'bar' : 'line',
          color: s.color,
        }),
      ),
    ...(hasNegativeBar
      ? [{ label: 'Negative year', kind: 'bar' as const, color: chartColors.negative }]
      : []),
  ];
  // A legend names two or more things; a single series is named by the card title.
  const showLegend = legendItems.length + (hasGap ? 1 : 0) >= 2;

  return (
    <div className={c.chart}>
      {showLegend && (
        <ul className={c.legend} aria-label={`${label} legend`}>
          {legendItems.map((item) => (
            <li key={item.label}>
              <i data-kind={item.kind} style={{ color: item.color }} />
              {item.label}
            </li>
          ))}
          {hasGap && (
            <li>
              <i data-kind="gap" />
              Gap = unavailable, not {unit === 'USD' ? '$0' : 'zero'}
            </li>
          )}
        </ul>
      )}
      <div
        ref={wrap}
        className={c.plot}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use left and right arrow keys to read each ${xLabel.toLowerCase()}${onSelect ? '; press Enter to select it' : ''}; exact values are also in the table.`}
        onKeyDown={(event) => {
          if (!n) return;
          if (onSelect && active != null && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onSelect(active);
            return;
          }
          const last = n - 1;
          const next =
            event.key === 'ArrowRight'
              ? Math.min(last, (active ?? -1) + 1)
              : event.key === 'ArrowLeft'
                ? Math.max(0, (active ?? n) - 1)
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? last
                    : event.key === 'Escape'
                      ? null
                      : undefined;
          if (next === undefined) return;
          event.preventDefault();
          setPointerY(null);
          setActive(next);
        }}
        onBlur={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${h}`}
          width="100%"
          height={h}
          role="img"
          aria-labelledby={`${id}-title`}
          onPointerMove={(event) => pick(event.clientX, event.clientY)}
          onPointerDown={(event) => pick(event.clientX, event.clientY)}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setActive(null);
          }}
          onClick={
            onSelect
              ? (event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - box.left) / (box.width || 1)) * width;
                  const i = Math.floor((x - m.left) / band);
                  if (i >= 0 && i < n) onSelect(i);
                }
              : undefined
          }
          style={onSelect ? { cursor: 'pointer' } : undefined}
        >
          <title
            id={`${id}-title`}
          >{`${label} (${unit === 'USD' ? 'USD' : unit === 'Percent' ? 'percent' : 'index'})`}</title>
          <defs>
            {areas.map((a, k) => (
              <linearGradient key={k} id={`${id}-area-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={a.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={a.color} stopOpacity={0.04} />
              </linearGradient>
            ))}
          </defs>
          {active != null && (
            <rect
              className={c.hover}
              x={cx(active) - band / 2 + 1}
              y={m.top}
              width={Math.max(0, band - 2)}
              height={innerH}
              rx={6}
            />
          )}
          {scale.ticks.map((tick) => (
            <g key={tick} className={c.grid}>
              <line
                x1={m.left}
                x2={width - m.right}
                y1={y(tick)}
                y2={y(tick)}
                data-zero={tick === 0 || undefined}
              />
              <text x={m.left - 8} y={y(tick) + 4} textAnchor="end">
                {axis(tick)}
              </text>
            </g>
          ))}
          {ticks.map((i) => {
            const text = xFormat(years[i]);
            // Long edge labels ("Year 30") are anchored inside the chart, never clipped.
            const half = text.length * (narrow ? 3.1 : 3.4);
            const anchor = cx(i) + half > width ? 'end' : cx(i) - half < 0 ? 'start' : 'middle';
            return (
              <text
                key={i}
                className={c.xtick}
                x={anchor === 'end' ? width - 1 : anchor === 'start' ? 1 : cx(i)}
                y={h - 8}
                textAnchor={anchor}
              >
                {text}
              </text>
            );
          })}
          <g className={c.reveal} key={`series-${n}-${scale.min}-${scale.max}`}>
            {areas.map((a, k) =>
              segments(
                a.upper.slice(0, n).map((v, i) => (v == null || a.lower[i] == null ? null : v)),
              ).map((run) => {
                const top = run.values.map((v, j): [number, number] => [cx(run.start + j), y(v)]);
                const bottom = run.values
                  .map((_, j): [number, number] => [
                    cx(run.start + j),
                    y(a.lower[run.start + j] as number),
                  ])
                  .reverse();
                const back = monotonePath(bottom).replace(/^M/, 'L');
                return (
                  <path
                    key={`${k}-${run.start}`}
                    d={`${monotonePath(top)}${back}Z`}
                    fill={a.opacity == null ? `url(#${id}-area-${k})` : a.color}
                    fillOpacity={a.opacity}
                  />
                );
              }),
            )}
            {stacked.length > 0 &&
              years.map((_, i) => {
                let up = 0;
                let down = 0;
                // Pixel edge of the last part drawn on each side of zero.
                let upEdge: number | null = null;
                let downEdge: number | null = null;
                const parts = stacked.map((s) => s.values[i]);
                const lastUp = parts.findLastIndex((v) => v != null && Number.isFinite(v) && v > 0);
                const lastDown = parts.findLastIndex(
                  (v) => v != null && Number.isFinite(v) && v < 0,
                );
                return stacked.map((s, k) => {
                  const v = s.values[i];
                  if (v == null || !Number.isFinite(v) || v === 0) return null;
                  const from = v > 0 ? up : down;
                  const to = from + v;
                  const edge = v > 0 ? upEdge : downEdge;
                  // Touching parts are separated by the surface gap, never by an outline.
                  const base = edge == null ? y(from) : v > 0 ? edge - GAP : edge + GAP;
                  const end = y(to);
                  if (v > 0) {
                    up = to;
                    upEdge = end;
                  } else {
                    down = to;
                    downEdge = end;
                  }
                  if (v > 0 ? end >= base : end <= base) return null;
                  const fill = v < 0 && s.negativeColor ? s.negativeColor : s.color;
                  return (
                    <path
                      key={`${s.label}-${i}`}
                      className={c.bar}
                      d={barPath(
                        groupX(i, 0),
                        barW,
                        base,
                        end,
                        k === (v > 0 ? lastUp : lastDown) ? 4 : 0,
                      )}
                      fill={fill}
                      fillOpacity={(s.opacity ?? 1) * fade(i)}
                    />
                  );
                });
              })}
            {loose.map((s, g) =>
              s.values.slice(0, n).map((v, i) => {
                if (v == null || !Number.isFinite(v)) return null;
                const fill =
                  v < 0 && s.negativeColor ? s.negativeColor : (s.colors?.[i] ?? s.color);
                return (
                  <path
                    key={`${s.label}-${i}`}
                    className={c.bar}
                    d={barPath(groupX(i, g + (stacked.length ? 1 : 0)), barW, y(0), y(v), 4)}
                    fill={fill}
                    fillOpacity={(s.opacity ?? 1) * fade(i)}
                  />
                );
              }),
            )}
            {lines.map((s) => {
              const has = (i: number) => {
                const v = s.values[i];
                return i >= 0 && i < n && v != null && Number.isFinite(v);
              };
              return (
                <g key={s.label} opacity={s.opacity} className={c.series}>
                  {segments(s.values.slice(0, n)).map((run) => (
                    <path
                      key={run.start}
                      d={monotonePath(
                        run.values.map((v, k): [number, number] => [cx(run.start + k), y(v)]),
                      )}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.width ?? 2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                  {s.values.slice(0, n).map((v, i) => {
                    if (!has(i)) return null;
                    // The active year, and a year with no neighbour to join, get a ringed dot.
                    const r =
                      active === i ? 4.5 : s.dot ? s.dot : !has(i - 1) && !has(i + 1) ? 4 : 0;
                    return r ? (
                      <circle
                        key={i}
                        cx={cx(i)}
                        cy={y(v as number)}
                        r={r}
                        fill={s.color}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ) : null;
                  })}
                </g>
              );
            })}
          </g>
          {refLines.map((r) => (
            <g
              key={`ref-${r.label}`}
              className={c.refLine}
              style={r.color ? { color: r.color } : undefined}
            >
              <line x1={m.left} x2={width - m.right} y1={y(r.value)} y2={y(r.value)} />
              <text x={refRight(r)} y={y(r.value) - 6} textAnchor="end">
                {r.label}
              </text>
            </g>
          ))}
          {markers
            .filter((marker) => marker.index >= 0 && marker.index < n)
            .map((marker) => {
              const x = cx(marker.index);
              const flip = marker.align === 'end' ? x - m.left > 90 : x > width - m.right - 90;
              return (
                <g key={`${marker.index}-${marker.label}`} className={c.marker}>
                  {/* A label over its column needs no line through the bar. */}
                  {marker.align !== 'center' && (
                    <line x1={x} x2={x} y1={m.top} y2={m.top + innerH} />
                  )}
                  {marker.label && (
                    <text
                      x={marker.align === 'center' ? x : x + (flip ? -6 : 6)}
                      y={marker.align === 'center' ? m.top - 6 : m.top + 10}
                      textAnchor={marker.align === 'center' ? 'middle' : flip ? 'end' : 'start'}
                    >
                      {marker.label}
                    </text>
                  )}
                  {marker.dot != null && Number.isFinite(marker.dot) && (
                    <circle
                      cx={x}
                      cy={y(marker.dot)}
                      r={4.5}
                      fill={marker.color ?? chartColors.ink}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}
        </svg>
        {tip && (
          <div
            className={c.tooltip}
            aria-hidden="true"
            data-static={narrow || undefined}
            style={
              narrow
                ? undefined
                : {
                    transform: tipLeft
                      ? `translate(calc(${cx(active!) - 16}px - 100%), ${tipY}px)`
                      : `translate(${cx(active!) + 16}px, ${tipY}px)`,
                  }
            }
          >
            <strong>{tip.title}</strong>
            {tip.rows.map((row, index) =>
              'section' in row ? (
                <em key={index} className={c.tipSection}>
                  {row.section}
                </em>
              ) : 'note' in row ? (
                <small key={index}>{row.note}</small>
              ) : (
                <span key={index} data-total={row.total || undefined}>
                  {row.swatch ? (
                    <i data-kind={row.swatch.kind ?? 'bar'} style={{ color: row.swatch.color }} />
                  ) : null}
                  <em>
                    {row.op ? `${row.op} ` : ''}
                    {row.label}
                  </em>
                  <b
                    data-tone={
                      row.tone === 'muted'
                        ? 'muted'
                        : row.tone === 'red' ||
                            (row.tone === 'auto' && row.value != null && row.value < 0)
                          ? 'red'
                          : undefined
                    }
                  >
                    {row.text ?? shown(row.value, row.money)}
                  </b>
                </span>
              ),
            )}
          </div>
        )}
      </div>
      <p className={c.srOnly} aria-live="polite">
        {spoken}
      </p>
    </div>
  );
}

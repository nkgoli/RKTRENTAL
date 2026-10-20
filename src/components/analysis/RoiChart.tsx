'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  horizonChoices,
  miniBarWidth,
  monotonePath,
  niceScale,
  referenceTickIndexes,
  segments,
  stackExtents,
  thousands,
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

/** RealROI palette (Tailwind teal/slate/red). Bars get a darker outline for 3:1 edges. */
export const chartColors = {
  teal: '#14b8a6',
  tealDark: '#0d9488',
  tealDeep: '#0f766e',
  tealMid: '#2dd4bf',
  tealLight: '#5eead4',
  tealPale: '#99f6e4',
  slate: '#475569',
  slateMid: '#64748b',
  slateDark: '#334155',
  slateLight: '#94a3b8',
  slatePale: '#e2e8f0',
  red: '#ef4444',
  green: '#16a34a',
  emerald: '#10b981',
  sky: '#0284c7',
  amber: '#b45309',
  violet: '#7c3aed',
  violetMid: '#8b5cf6',
  orange: '#f97316',
  amberMid: '#f59e0b',
  amberBright: '#fbbf24',
  green500: '#22c55e',
  blue: '#3b82f6',
  sky500: '#0ea5e9',
  sky600: '#0284c7',
  emeraldDark: '#059669',
} as const;
/** Line colours for multi-series charts; each passes 3:1 against white. */
export const seriesPalette = [
  chartColors.tealDark,
  chartColors.slate,
  chartColors.amber,
  chartColors.violet,
];

const outline: Record<string, string> = {
  [chartColors.teal]: chartColors.tealDark,
  [chartColors.red]: '#dc2626',
  [chartColors.tealLight]: chartColors.tealMid,
  [chartColors.slatePale]: '#cbd5e1',
};

export type ChartSeries = {
  label: string;
  values: ChartValue[];
  color: string;
  kind?: 'bar' | 'line';
  dashed?: boolean;
  /** Bars with `stack` share one column: positive parts up, negative parts down. */
  stack?: boolean;
  /** Bar colour for negative values; the legend then names negative years. */
  negativeColor?: string;
  /** Bar outline; defaults to a darker shade of known palette colours. */
  stroke?: string;
  opacity?: number;
  /** Line width (default 2.5) and dot radius (default 2.5; 0 hides dots). */
  width?: number;
  dot?: number;
  dash?: string;
  /** Leave the series out of the legend (a custom legend names it). */
  hideLegend?: boolean;
  /** Fill and outline of the emphasised (selected) bar. */
  activeColor?: string;
  activeStroke?: string;
  /** Per-index bar fills (one bar per asset, coloured by asset). */
  colors?: string[];
};

export type ChartMarker = {
  index: number;
  label: string;
  color?: string;
  /** Draw a 6 px reference dot at this value on the marker line. */
  dot?: number;
  /** `end` puts the label left of the line (Recharts `insideTopRight`); `center` above it. */
  align?: 'start' | 'end' | 'center';
};
export type ChartBand = { from: number; to: number; color: string; opacity?: number };
/** Fill between two series: the 0.4 → 0.1 gradient, or a flat fill at `opacity`. */
export type ChartArea = {
  upper: ChartValue[];
  lower: ChartValue[];
  color: string;
  opacity?: number;
};
/** Horizontal reference line (e.g. "Initial: $102,000"), labelled at the right end. */
export type ChartRefLine = { value: number; label: string; color: string; dash?: string };
export type LegendItem = {
  label: string;
  kind: 'bar' | 'line' | 'dashed' | 'band' | 'area' | 'dotLine';
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
      tone?: 'auto' | 'teal' | 'red' | 'muted';
      /** Explicit value colour (e.g. the amortization series colours). */
      color?: string;
      total?: boolean;
      swatch?: { color: string; kind?: 'bar' | 'line' };
    }
  | { section: string }
  | { note: string };
export type ChartTip = { title: string; rows: TipRow[] };

/** Card with the reference header strip: title, 10 px basis line and right-aligned controls. */
export function ChartCard({
  title,
  subtitle,
  controls,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${c.card} ${className ?? ''}`}>
      <header className={c.head}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {controls && <div className={c.controls}>{controls}</div>}
      </header>
      <div className={c.body}>{children}</div>
    </section>
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

type Tone = 'teal' | 'tealSoft' | 'slate' | 'red' | 'amber' | 'blue' | 'muted' | 'card';

/** Pale metric tiles; values use the mono numeric face like the reference. */
export function Tiles({
  items,
  size = 'lg',
}: {
  items: {
    label: string;
    value: ReactNode;
    note?: ReactNode;
    /** `card` is the bordered white KPI card of the amortization schedule. */
    tone?: Tone;
    info?: ReactNode;
    /** Value colour when it differs from the tone (e.g. a red loss on a teal tile). */
    valueTone?: 'teal' | 'red' | 'slate' | 'green' | 'amber';
    /** Small icon chip before the label (reference KPI cards). */
    icon?: { name: IconName; tone?: 'slate' | 'teal' | 'amber' };
  }[];
  size?: 'lg' | 'sm';
}) {
  return (
    <dl className={c.tiles} data-size={size}>
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone ?? 'teal'}>
          <dt>
            {item.icon && (
              <span className={c.iconChip} data-tone={item.icon.tone ?? 'slate'} aria-hidden="true">
                <Icon name={item.icon.name} size={12} />
              </span>
            )}
            {item.label}
            {item.info && <InfoTip label={item.label}>{item.info}</InfoTip>}
          </dt>
          <dd>
            <strong data-tone={item.valueTone}>{item.value}</strong>
            {item.note && <small>{item.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Reference header checkbox ("Include down payment"). */
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

/** Mono figure inside prose (Insight rows), teal or red like the reference. */
export function Figure({
  children,
  tone = 'teal',
}: {
  children: ReactNode;
  tone?: 'teal' | 'red';
}) {
  return (
    <b className={c.figure} data-tone={tone}>
      {children}
    </b>
  );
}

/** Plain-language reading of the chart, led by "Insight:". */
export function Insight({ children }: { children: ReactNode }) {
  return (
    <p className={c.insight}>
      <strong>Insight:</strong> {children}
    </p>
  );
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

/** Lucide icon outlines used by the reference cards. */
const iconPaths = {
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
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
  zap: (
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  ),
  dollar: (
    <>
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  piggy: (
    <>
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1" />
      <path d="M16 11h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sparkles: (
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
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
  pie: (
    <>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
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

/**
 * Landmark chips summarising the chart in words, with a lucide-style icon or a dot.
 * Chips with `onClick` are toggle buttons (the Exit "Best IRR" chips).
 */
export function Chips({
  items,
  size,
  label,
}: {
  items: {
    text: ReactNode;
    tone?: Tone;
    icon?: IconName;
    info?: ReactNode;
    infoLabel?: string;
    onClick?: () => void;
    pressed?: boolean;
  }[];
  /** `sm` is the 10 px bordered chip of the amortization milestones. */
  size?: 'sm';
  label?: string;
}) {
  if (!items.length) return null;
  return (
    <ul className={c.chips} data-size={size} aria-label={label}>
      {items.map((item, index) => {
        const body = (
          <>
            {item.icon && <Icon name={item.icon} size={size === 'sm' ? 12 : 14} />}
            {item.text}
          </>
        );
        return (
          <li
            key={index}
            data-tone={item.tone ?? 'slate'}
            data-icon={item.icon ? true : undefined}
            data-button={item.onClick ? true : undefined}
          >
            {item.onClick ? (
              <button type="button" aria-pressed={!!item.pressed} onClick={item.onClick}>
                {body}
              </button>
            ) : (
              body
            )}
            {item.info && <InfoTip label={item.infoLabel ?? 'this landmark'}>{item.info}</InfoTip>}
          </li>
        );
      })}
    </ul>
  );
}

/** 48 px reference bar for a rate cell: |rate| × 500%, teal or red. */
export function MiniBar({ value }: { value: number | null }) {
  return (
    <span className={c.mini} aria-hidden="true">
      <i
        style={{
          width: `${miniBarWidth(value)}%`,
          background: value != null && value < 0 ? chartColors.red : chartColors.teal,
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
            stroke={chartColors.slatePale}
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

/** A bar from `base` to `end` with the far end rounded (both ends with `both`). */
function barPath(x: number, w: number, base: number, end: number, r: number, both: boolean) {
  const top = Math.min(base, end);
  const bottom = Math.max(top + 1, Math.max(base, end));
  const rr = Math.max(0, Math.min(r, w / 2, (bottom - top) / (both ? 2 : 1)));
  const upward = end <= base;
  const t = upward || both ? rr : 0;
  const b = !upward || both ? rr : 0;
  return (
    `M${x},${top + t}Q${x},${top} ${x + t},${top}H${x + w - t}Q${x + w},${top} ${x + w},${top + t}` +
    `V${bottom - b}Q${x + w},${bottom} ${x + w - b},${bottom}H${x + b}Q${x},${bottom} ${x},${bottom - b}Z`
  );
}

const kindOf = (s: ChartSeries): LegendItem['kind'] =>
  s.kind === 'bar' ? 'bar' : s.dashed ? 'dashed' : 'line';

/**
 * Bars, lines, bands and areas on one shared zero baseline, drawn in the
 * reference style (dashed grid both ways, monotone lines, rounded bar ends,
 * equation tooltips). Hover, touch or arrow keys read a year; the live region
 * reads exact values, and `null` values leave a gap that reads "Unavailable".
 */
export function ComboChart({
  label,
  years,
  series,
  unit = 'USD',
  height,
  markers = [],
  bands = [],
  areas = [],
  details,
  tooltip,
  legend,
  xLabel = 'Year',
  axisTitle,
  axes,
  xFormat = String,
  barRadius = 'top',
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
  unit?: 'USD' | 'Index';
  height?: number;
  markers?: ChartMarker[];
  /** Shaded x ranges (inclusive indexes), such as pre- and post-breakeven. */
  bands?: ChartBand[];
  /** Gradient fill between two series (e.g. value over loan = equity). */
  areas?: ChartArea[];
  /** Extra tooltip rows for the active index, such as an equity equation. */
  details?: (index: number) => [string, string][];
  /** Full reference-style tooltip for an index; replaces the series rows. */
  tooltip?: (index: number) => ChartTip;
  /** Legend override in the reference order. */
  legend?: LegendItem[];
  xLabel?: string;
  /** Optional x-axis title beside the year labels (the reference has none). */
  axisTitle?: string;
  /** Rotated y-axis titles; `right` mirrors the shared domain on a right axis. */
  axes?: { left?: string; right?: string; leftColor?: string; rightColor?: string };
  xFormat?: (year: number | string) => string;
  barRadius?: 'top' | 'all';
  /** Exact formatter matching the adjacent table; defaults to cents or 4-dp index. */
  format?: (value: number) => string;
  refLines?: ChartRefLine[];
  /** Index whose bars are emphasised; the other bars drop to half opacity. */
  emphasis?: number | null;
  /** Emphasise the hovered index too when nothing is selected. */
  emphasizeHover?: boolean;
  /** Click, tap, Enter or Space on an index selects it. */
  onSelect?: (index: number) => void;
  /** Year-label indexes when the chart has its own tick set. */
  xTicks?: number[];
  /** Y tick text override (e.g. `10.5%`); defaults to `$Nk` or the index. */
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
  const h = height ?? (narrow ? 240 : 320);
  const stacked = series.filter((s) => s.kind === 'bar' && s.stack);
  const loose = series.filter((s) => s.kind === 'bar' && !s.stack);
  const lines = series.filter((s) => s.kind !== 'bar');
  const extents = stackExtents(stacked.map((s) => s.values));
  const scale = niceScale(
    [
      ...lines.flatMap((s) => s.values),
      ...loose.flatMap((s) => s.values),
      ...areas.flatMap((a) => [...a.upper, ...a.lower]),
      ...extents.top,
      ...extents.bottom,
      ...refLines.map((r) => r.value),
    ],
    narrow ? 4 : 5,
  );
  const step = scale.ticks.length > 1 ? scale.ticks[1] - scale.ticks[0] : 1;
  const axis = (v: number) =>
    tickFormat ? tickFormat(v, step) : unit === 'USD' ? thousands(v, step) : v.toFixed(0);
  // Margins fit the widest tick label so rotated axis titles never overlap it.
  const labelW = Math.max(...scale.ticks.map((t) => axis(t).length)) * (narrow ? 6 : 6.6) + 10;
  const m = {
    top: 20,
    right: axes?.right ? labelW + 22 : narrow ? 8 : 16,
    bottom: 26,
    left: labelW + (axes?.left ? 18 : 0),
  };
  const innerW = Math.max(1, width - m.left - m.right);
  const innerH = h - m.top - m.bottom;
  const band = innerW / Math.max(1, n);
  const cx = (i: number) => m.left + band * (i + 0.5);
  const y = (v: number) => m.top + innerH - ((v - scale.min) / (scale.max - scale.min)) * innerH;
  const groups = (stacked.length ? 1 : 0) + loose.length;
  const barW = Math.max(
    2,
    Math.min(n <= 5 ? 110 : 48, (band * (n <= 5 ? 0.8 : 0.78)) / Math.max(1, groups)),
  );
  const groupX = (i: number, g: number) => cx(i) - (barW * groups) / 2 + g * barW;
  const exact = (v: ChartValue | undefined) =>
    v == null || !Number.isFinite(v)
      ? 'Unavailable'
      : format
        ? format(v)
        : unit === 'USD'
          ? dollars(v)
          : v.toFixed(4);
  const shown = (v: ChartValue | undefined, money?: boolean) =>
    unit === 'USD' || money
      ? wholeDollars(v)
      : v == null || !Number.isFinite(v)
        ? 'Unavailable'
        : v.toFixed(1);
  const spokenValue = (r: Extract<TipRow, { label: string }>) =>
    r.value === undefined
      ? (r.text ?? '')
      : r.money && unit !== 'USD'
        ? dollars(r.value)
        : exact(r.value);
  const reference = xTicks ?? referenceTickIndexes(years);
  const longest = Math.max(1, ...reference.map((i) => xFormat(years[i] ?? '').length));
  const fit = xTickIndexes(n, innerW, Math.max(narrow ? 34 : 40, longest * 7 + 8));
  const ticks = reference.length <= fit.length ? reference : fit;
  const emphasised = emphasis ?? (emphasizeHover ? active : null);
  // Bar paint for one index: the emphasised bar darkens, the others fade.
  const paint = (s: ChartSeries, i: number, fill: string) =>
    emphasised == null
      ? { fill, fillOpacity: s.opacity, stroke: s.stroke ?? outline[fill], style: undefined }
      : i === emphasised
        ? {
            fill: s.activeColor ?? fill,
            fillOpacity: s.opacity,
            stroke: s.activeStroke ?? s.stroke ?? outline[fill],
            style: { strokeWidth: 2 },
          }
        : {
            fill,
            fillOpacity: (s.opacity ?? 1) * 0.5,
            stroke: s.stroke ?? outline[fill],
            style: { strokeOpacity: 0.5 },
          };
  const hasGap = series.some((s) => s.values.slice(0, n).some((v) => v == null));
  const hasNegativeBar = series.some(
    (s) => s.kind === 'bar' && s.negativeColor && s.values.some((v) => v != null && v < 0),
  );

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
      .map((s) => ({
        label: s.label + (s.dashed ? ' (dashed)' : ''),
        kind: kindOf(s),
        color: s.color,
      })),
    ...(hasNegativeBar
      ? [{ label: 'Negative year', kind: 'bar' as const, color: chartColors.red }]
      : []),
  ];
  const leftColor = axes?.leftColor ?? chartColors.slateLight;
  const rightColor = axes?.rightColor ?? chartColors.slateLight;

  return (
    <div className={c.chart}>
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
          <title id={`${id}-title`}>{`${label} (${unit === 'USD' ? 'USD' : 'index'})`}</title>
          <defs>
            {areas.map((a, k) => (
              <linearGradient key={k} id={`${id}-area-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={a.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={a.color} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          {bands.map((b, k) => {
            const from = Math.max(0, b.from);
            const to = Math.min(n - 1, b.to);
            if (to < from) return null;
            return (
              <rect
                key={`band-${k}`}
                x={m.left + band * from}
                width={band * (to - from + 1)}
                y={m.top}
                height={innerH}
                fill={b.color}
                opacity={b.opacity ?? 0.06}
              />
            );
          })}
          {active != null && (
            <rect
              className={c.hover}
              x={cx(active) - band / 2}
              y={m.top}
              width={band}
              height={innerH}
            />
          )}
          {ticks.map((i) => (
            <line
              key={`v-${i}`}
              className={c.vgrid}
              x1={cx(i)}
              x2={cx(i)}
              y1={m.top}
              y2={m.top + innerH}
            />
          ))}
          {scale.ticks.map((tick) => (
            <g key={tick} className={c.grid}>
              <line
                x1={m.left}
                x2={width - m.right}
                y1={y(tick)}
                y2={y(tick)}
                strokeDasharray={tick === 0 ? undefined : '3 3'}
                data-zero={tick === 0 || undefined}
              />
              <text
                x={m.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                style={{ fill: axes?.leftColor }}
              >
                {axis(tick)}
              </text>
              {axes?.right && (
                <text
                  x={width - m.right + 8}
                  y={y(tick) + 4}
                  textAnchor="start"
                  style={{ fill: rightColor }}
                >
                  {axis(tick)}
                </text>
              )}
            </g>
          ))}
          <line
            className={c.axis}
            x1={m.left}
            x2={m.left}
            y1={m.top}
            y2={m.top + innerH}
            style={{ stroke: leftColor }}
          />
          {axes?.right && (
            <line
              className={c.axis}
              x1={width - m.right}
              x2={width - m.right}
              y1={m.top}
              y2={m.top + innerH}
              style={{ stroke: rightColor }}
            />
          )}
          <line
            className={c.axis}
            x1={m.left}
            x2={width - m.right}
            y1={m.top + innerH}
            y2={m.top + innerH}
          />
          {axes?.left && (
            <text
              className={c.ytitle}
              transform={`translate(12 ${m.top + innerH / 2}) rotate(-90)`}
              textAnchor="middle"
              style={{ fill: leftColor }}
            >
              {axes.left}
            </text>
          )}
          {axes?.right && (
            <text
              className={c.ytitle}
              transform={`translate(${width - 12} ${m.top + innerH / 2}) rotate(90)`}
              textAnchor="middle"
              style={{ fill: rightColor }}
            >
              {axes.right}
            </text>
          )}
          {axisTitle && (
            <text className={c.xtitle} x={m.left - 8} y={h - 6} textAnchor="end">
              {axisTitle}
            </text>
          )}
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
                y={h - 6}
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
                const parts = stacked.map((s) => s.values[i]);
                const lastUp = parts.findLastIndex((v) => v != null && Number.isFinite(v) && v > 0);
                const lastDown = parts.findLastIndex(
                  (v) => v != null && Number.isFinite(v) && v < 0,
                );
                return stacked.map((s, k) => {
                  const v = s.values[i];
                  if (v == null || !Number.isFinite(v) || v === 0) return null;
                  const from = v >= 0 ? up : down;
                  const to = from + v;
                  if (v >= 0) up = to;
                  else down = to;
                  const fill = v < 0 && s.negativeColor ? s.negativeColor : s.color;
                  return (
                    <path
                      key={`${s.label}-${i}`}
                      className={c.bar}
                      d={barPath(
                        groupX(i, 0),
                        barW,
                        y(from),
                        y(to),
                        k === (v > 0 ? lastUp : lastDown) ? 4 : 0,
                        false,
                      )}
                      {...paint(s, i, fill)}
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
                    d={barPath(
                      groupX(i, g + (stacked.length ? 1 : 0)),
                      barW,
                      y(0),
                      y(v),
                      4,
                      barRadius === 'all',
                    )}
                    {...paint(s, i, fill)}
                  />
                );
              }),
            )}
            {lines.map((s) => (
              <g key={s.label} opacity={s.opacity} className={c.series}>
                {segments(s.values.slice(0, n)).map((run) => (
                  <path
                    key={run.start}
                    d={monotonePath(
                      run.values.map((v, k): [number, number] => [cx(run.start + k), y(v)]),
                    )}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width ?? 2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={s.dash ?? (s.dashed ? '6 4' : undefined)}
                  />
                ))}
                {s.values
                  .slice(0, n)
                  .map((v, i) =>
                    v == null || !Number.isFinite(v) || (!(s.dot ?? 2.5) && active !== i) ? null : (
                      <circle
                        key={i}
                        cx={cx(i)}
                        cy={y(v)}
                        r={active === i ? 6 : (s.dot ?? 2.5)}
                        fill={s.color}
                        stroke={active === i ? 'white' : undefined}
                        strokeWidth={active === i ? 2 : undefined}
                      />
                    ),
                  )}
              </g>
            ))}
          </g>
          {refLines.map((r) => (
            <g key={`ref-${r.label}`} className={c.refLine} style={{ color: r.color }}>
              <line
                x1={m.left}
                x2={width - m.right}
                y1={y(r.value)}
                y2={y(r.value)}
                strokeDasharray={r.dash ?? '6 4'}
              />
              <text x={width - m.right - 4} y={y(r.value) - 6} textAnchor="end">
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
                <g
                  key={`${marker.index}-${marker.label}`}
                  className={c.marker}
                  style={{ color: marker.color }}
                >
                  <line x1={x} x2={x} y1={m.top} y2={m.top + innerH} />
                  {marker.label && (
                    <text
                      x={marker.align === 'center' ? x : x + (flip ? -5 : 5)}
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
                      r={6}
                      fill="currentColor"
                      stroke="white"
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
                      row.tone === 'auto'
                        ? row.value != null && row.value < 0
                          ? 'red'
                          : 'teal'
                        : row.tone
                    }
                    style={row.color ? { color: row.color } : undefined}
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
    </div>
  );
}

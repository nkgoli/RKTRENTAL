'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  horizonChoices,
  niceScale,
  segments,
  stackExtents,
  xTickIndexes,
  type ChartValue,
} from '@/lib/analysis/chart-data';
import { dollars } from '@/lib/analysis/projections';
import styles from './analysis.module.css';
import c from './roi-chart.module.css';

/** Teal/slate series in the RealROI style; each passes 3:1 against white. */
export const chartColors = {
  teal: '#0d9488',
  tealLight: '#5eead4',
  slate: '#475569',
  slateLight: '#94a3b8',
  red: '#dc2626',
  amber: '#b45309',
  violet: '#7c3aed',
} as const;
export const seriesPalette = [
  chartColors.teal,
  chartColors.slate,
  chartColors.amber,
  chartColors.violet,
];

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
};

export type ChartMarker = { index: number; label: string; color?: string };

const compactUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

/** Card with the reference header strip: title, one-line basis and right-aligned controls. */
export function ChartCard({
  title,
  subtitle,
  controls,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.card} ${c.card}`}>
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
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={c.segmented} role="group" aria-label={label}>
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

type Tone = 'teal' | 'slate' | 'red' | 'amber';

/** Pale metric tiles with large values. */
export function Tiles({
  items,
}: {
  items: { label: string; value: ReactNode; note?: ReactNode; tone?: Tone }[];
}) {
  return (
    <dl className={c.tiles}>
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone ?? 'teal'}>
          <dt>{item.label}</dt>
          <dd>
            <strong>{item.value}</strong>
            {item.note && <small>{item.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Plain-language reading of the chart below it. */
export function Insight({ children }: { children: ReactNode }) {
  return <p className={c.insight}>{children}</p>;
}

/** Horizon state for a chart; `null` follows the full hold when it changes. */
export function useHorizon(length: number, label: string) {
  const [years, setYears] = useState<number | null>(null);
  const shown = years == null || years >= length ? length : years;
  const control =
    length > 1 ? (
      <Segmented
        label={label}
        options={horizonChoices(length).map((h) => ({ value: h.years, label: h.label }))}
        value={shown}
        onChange={(value) => setYears(value >= length ? null : value)}
      />
    ) : null;
  return [shown, control] as const;
}

/** Landmark chips summarising the chart in words. */
export function Chips({ items }: { items: { text: ReactNode; tone?: Tone }[] }) {
  if (!items.length) return null;
  return (
    <ul className={c.chips}>
      {items.map((item, index) => (
        <li key={index} data-tone={item.tone ?? 'slate'}>
          {item.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * Bars and lines on one shared zero baseline. Hover, touch or arrow keys read the
 * exact values for a year; `null` values leave a gap and read as "Unavailable".
 */
export function ComboChart({
  label,
  years,
  series,
  unit = 'USD',
  height,
  markers = [],
  details,
  xLabel = 'Year',
  axisTitle = 'Year',
  format,
}: {
  label: string;
  years: (number | string)[];
  series: ChartSeries[];
  unit?: 'USD' | 'Index';
  height?: number;
  markers?: ChartMarker[];
  /** Extra tooltip rows for the active index, such as an equity equation. */
  details?: (index: number) => [string, string][];
  xLabel?: string;
  /** Short x-axis title drawn beside the year labels. */
  axisTitle?: string;
  /** Tooltip formatter matching the adjacent table; defaults to cents or 4-dp index. */
  format?: (value: number) => string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(660);
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  useEffect(() => {
    if (!wrap.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);

  const narrow = width < 480;
  const h = height ?? (narrow ? 220 : 280);
  const m = { top: 18, right: 12, bottom: 30, left: narrow ? 52 : 64 };
  const innerW = Math.max(1, width - m.left - m.right);
  const innerH = h - m.top - m.bottom;
  const n = years.length;
  const band = innerW / Math.max(1, n);
  const cx = (i: number) => m.left + band * (i + 0.5);

  const stacked = series.filter((s) => s.kind === 'bar' && s.stack);
  const loose = series.filter((s) => s.kind === 'bar' && !s.stack);
  const lines = series.filter((s) => s.kind !== 'bar');
  const extents = stackExtents(stacked.map((s) => s.values));
  const scale = niceScale(
    [
      ...lines.flatMap((s) => s.values),
      ...loose.flatMap((s) => s.values),
      ...extents.top,
      ...extents.bottom,
    ],
    narrow ? 4 : 5,
  );
  const y = (v: number) => m.top + innerH - ((v - scale.min) / (scale.max - scale.min)) * innerH;
  const groups = (stacked.length ? 1 : 0) + loose.length;
  const barW = Math.max(2, Math.min(34, (band * 0.72) / Math.max(1, groups)));
  const groupX = (i: number, g: number) => cx(i) - (barW * groups) / 2 + g * barW;
  const axis = (v: number) => (unit === 'USD' ? compactUsd(v) : v.toFixed(0));
  const exact = (v: ChartValue) =>
    v == null || !Number.isFinite(v)
      ? 'Unavailable'
      : format
        ? format(v)
        : unit === 'USD'
          ? dollars(v)
          : v.toFixed(4);
  const ticks = xTickIndexes(n, innerW, narrow ? 40 : 48);
  const hasGap = series.some((s) => s.values.slice(0, n).some((v) => v == null));
  const hasNegativeBar = series.some(
    (s) => s.kind === 'bar' && s.negativeColor && s.values.some((v) => v != null && v < 0),
  );

  function pick(clientX: number) {
    const box = wrap.current?.querySelector('svg')?.getBoundingClientRect();
    if (!box || !n) return;
    const x = ((clientX - box.left) / box.width) * width;
    setActive(Math.min(n - 1, Math.max(0, Math.floor((x - m.left) / band))));
  }

  const rows =
    active == null
      ? []
      : [
          ...series.map((s) => [s.label, exact(s.values[active] ?? null)] as [string, string]),
          ...(details?.(active) ?? []),
        ];
  const heading = active == null ? '' : `${xLabel} ${years[active]}`;
  const tipLeft = active != null && cx(active) > width / 2;

  return (
    <div className={c.chart}>
      <div
        ref={wrap}
        className={c.plot}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use left and right arrow keys to read each ${xLabel.toLowerCase()}; exact values are also in the table.`}
        onKeyDown={(event) => {
          if (!n) return;
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
          onPointerMove={(event) => pick(event.clientX)}
          onPointerDown={(event) => pick(event.clientX)}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setActive(null);
          }}
        >
          <title id={`${id}-title`}>{`${label} (${unit === 'USD' ? 'USD' : 'index'})`}</title>
          {active != null && (
            <rect
              className={c.hover}
              x={cx(active) - band / 2}
              y={m.top}
              width={band}
              height={innerH}
            />
          )}
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
              <text x={m.left - 8} y={y(tick) + 4} textAnchor="end">
                {axis(tick)}
              </text>
            </g>
          ))}
          <text className={c.xtitle} x={m.left - 8} y={h - 8} textAnchor="end">
            {axisTitle}
          </text>
          {ticks.map((i) => (
            <text key={i} className={c.xtick} x={cx(i)} y={h - 8} textAnchor="middle">
              {years[i]}
            </text>
          ))}
          {markers
            .filter((marker) => marker.index >= 0 && marker.index < n)
            .map((marker) => (
              <g key={marker.label} className={c.marker} style={{ color: marker.color }}>
                <line x1={cx(marker.index)} x2={cx(marker.index)} y1={m.top} y2={m.top + innerH} />
                <text
                  x={cx(marker.index) + (cx(marker.index) > width - 120 ? -6 : 6)}
                  y={m.top + 10}
                  textAnchor={cx(marker.index) > width - 120 ? 'end' : 'start'}
                >
                  {marker.label}
                </text>
              </g>
            ))}
          {stacked.length > 0 &&
            years.map((_, i) => {
              let up = 0;
              let down = 0;
              return stacked.map((s) => {
                const v = s.values[i];
                if (v == null || !Number.isFinite(v) || v === 0) return null;
                const from = v >= 0 ? up : down;
                const to = from + v;
                if (v >= 0) up = to;
                else down = to;
                return (
                  <rect
                    key={`${s.label}-${i}`}
                    className={c.bar}
                    x={groupX(i, 0)}
                    width={barW}
                    y={y(Math.max(from, to))}
                    height={Math.max(1, Math.abs(y(from) - y(to)))}
                    fill={v < 0 && s.negativeColor ? s.negativeColor : s.color}
                  />
                );
              });
            })}
          {loose.map((s, g) =>
            s.values
              .slice(0, n)
              .map((v, i) =>
                v == null || !Number.isFinite(v) ? null : (
                  <rect
                    key={`${s.label}-${i}`}
                    className={c.bar}
                    x={groupX(i, g + (stacked.length ? 1 : 0))}
                    width={barW}
                    y={y(Math.max(0, v))}
                    height={Math.max(1, Math.abs(y(0) - y(v)))}
                    rx={Math.min(3, barW / 4)}
                    fill={v < 0 && s.negativeColor ? s.negativeColor : s.color}
                  />
                ),
              ),
          )}
          {lines.map((s) => (
            <g key={s.label}>
              {segments(s.values.slice(0, n)).map((run) => (
                <polyline
                  key={run.start}
                  points={run.values.map((v, k) => `${cx(run.start + k)},${y(v)}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                />
              ))}
              {s.values
                .slice(0, n)
                .map((v, i) =>
                  v == null || !Number.isFinite(v) ? null : (
                    <circle
                      key={i}
                      cx={cx(i)}
                      cy={y(v)}
                      r={active === i ? 5 : n > 20 ? 1.5 : 2.5}
                      fill={s.color}
                      stroke={active === i ? 'white' : undefined}
                      strokeWidth={active === i ? 2 : undefined}
                    />
                  ),
                )}
            </g>
          ))}
        </svg>
        {active != null && (
          <div
            className={c.tooltip}
            aria-hidden="true"
            style={
              narrow
                ? { position: 'static', marginTop: 8, width: 'auto', maxWidth: 'none' }
                : tipLeft
                  ? { right: Math.max(4, width - cx(active) + 12) }
                  : { left: Math.min(cx(active) + 12, Math.max(4, width - 200)) }
            }
          >
            <strong>{heading}</strong>
            {rows.map(([name, value], index) => {
              const s = series[index];
              return (
                <span key={name}>
                  {s ? (
                    <i
                      data-kind={s.kind === 'bar' ? 'bar' : s.dashed ? 'dashed' : 'line'}
                      style={{ color: s.color }}
                    />
                  ) : (
                    <i data-kind="none" />
                  )}
                  <em>{name}</em>
                  <b>{value}</b>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <p className={c.srOnly} aria-live="polite">
        {active == null ? '' : `${heading}: ${rows.map(([k, v]) => `${k} ${v}`).join('; ')}`}
      </p>
      <ul className={c.legend} aria-label={`${label} legend`}>
        {series.map((s) => (
          <li key={s.label}>
            <i
              data-kind={s.kind === 'bar' ? 'bar' : s.dashed ? 'dashed' : 'line'}
              style={{ color: s.color }}
            />
            {s.label}
            {s.dashed ? ' (dashed)' : ''}
          </li>
        ))}
        {hasNegativeBar && (
          <li>
            <i data-kind="bar" style={{ color: chartColors.red }} />
            Negative year
          </li>
        )}
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

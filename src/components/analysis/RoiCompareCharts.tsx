'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { referenceScale } from '@/lib/analysis/chart-data';
import { chartColors } from './RoiChart';
import c from './roi-chart.module.css';

function useWidth(initial = 660) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Arrow/Home/End/Escape over `count` items, shared by the scatter and the radar. */
function keyStep(event: KeyboardEvent, count: number, active: number | null) {
  const last = count - 1;
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? Math.min(last, (active ?? -1) + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? Math.max(0, (active ?? count) - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : event.key === 'Escape'
              ? null
              : undefined;
  if (next !== undefined) event.preventDefault();
  return next;
}

export type ScatterPoint = {
  label: string;
  x: number;
  y: number;
  color: string;
  /** Bubble radius in px (the reference sizes the property larger). */
  r?: number;
};

/**
 * Risk vs return scatter (RealROI C20): X volatility %, Y annualized return %.
 * `refLines` mark an asset whose volatility is not measured (it has a return
 * but no honest x position), labelled at the right end.
 */
export function ScatterChart({
  label,
  points,
  refLines = [],
  height = 256,
  xTitle = 'Volatility (%)',
  yTitle = 'Annualized Return (%)',
}: {
  label: string;
  points: ScatterPoint[];
  refLines?: { value: number; label: string; color: string }[];
  height?: number;
  xTitle?: string;
  yTitle?: string;
}) {
  const [wrap, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const narrow = width < 480;
  const xs = referenceScale(
    points.map((p) => p.x),
    narrow ? 4 : 5,
  );
  const ys = referenceScale([...points.map((p) => p.y), ...refLines.map((r) => r.value)]);
  const m = { top: 20, right: narrow ? 12 : 30, bottom: 44, left: 58 };
  const iw = Math.max(1, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const x = (v: number) => m.left + ((v - xs.min) / (xs.max - xs.min)) * iw;
  const y = (v: number) => m.top + ih - ((v - ys.min) / (ys.max - ys.min)) * ih;
  const point = active == null ? null : points[active];
  const spoken = point
    ? `${point.label}: volatility ${point.x.toFixed(1)}%, return ${point.y.toFixed(2)}%`
    : '';
  return (
    <div className={c.chart}>
      <div
        ref={wrap}
        className={c.plot}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use arrow keys to read each asset; exact values are also in the table.`}
        onKeyDown={(event) => {
          const next = keyStep(event, points.length, active);
          if (next !== undefined) setActive(next);
        }}
        onBlur={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-labelledby={`${id}-t`}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          <title id={`${id}-t`}>{label}</title>
          {xs.ticks.map((t) => (
            <g key={`x${t}`} className={c.grid}>
              <line x1={x(t)} x2={x(t)} y1={m.top} y2={m.top + ih} strokeDasharray="3 3" />
              <text x={x(t)} y={m.top + ih + 16} textAnchor="middle">
                {t}
              </text>
            </g>
          ))}
          {ys.ticks.map((t) => (
            <g key={`y${t}`} className={c.grid}>
              <line
                x1={m.left}
                x2={m.left + iw}
                y1={y(t)}
                y2={y(t)}
                strokeDasharray={t === 0 ? undefined : '3 3'}
                data-zero={t === 0 || undefined}
              />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end">
                {`${t.toFixed(0)}%`}
              </text>
            </g>
          ))}
          <line className={c.axis} x1={m.left} x2={m.left} y1={m.top} y2={m.top + ih} />
          <line className={c.axis} x1={m.left} x2={m.left + iw} y1={m.top + ih} y2={m.top + ih} />
          <text className={c.ytitle} x={m.left + iw / 2} y={height - 4} textAnchor="middle">
            {xTitle}
          </text>
          <text
            className={c.ytitle}
            transform={`translate(12 ${m.top + ih / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {yTitle}
          </text>
          {refLines.map((r) => (
            <g key={r.label} className={c.refLine} style={{ color: r.color }}>
              <line
                x1={m.left}
                x2={m.left + iw}
                y1={y(r.value)}
                y2={y(r.value)}
                strokeDasharray="6 4"
              />
              <text x={m.left + iw - 4} y={y(r.value) - 6} textAnchor="end">
                {r.label}
              </text>
            </g>
          ))}
          <g className={c.reveal}>
            {points.map((p, i) => (
              <circle
                key={p.label}
                cx={x(p.x)}
                cy={y(p.y)}
                r={(p.r ?? 9) + (active === i ? 2 : 0)}
                fill={p.color}
                stroke={active === i ? 'white' : undefined}
                strokeWidth={active === i ? 2 : undefined}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                style={{ cursor: 'pointer' }}
              />
            ))}
            {/* Direct labels on wide charts, so the points read without the key. */}
            {!narrow &&
              points.map((p) => {
                const right = x(p.x) < m.left + iw * 0.75;
                return (
                  <text
                    key={`l${p.label}`}
                    className={c.xtick}
                    x={x(p.x) + (right ? 1 : -1) * ((p.r ?? 9) + 6)}
                    y={y(p.y) + 4}
                    textAnchor={right ? 'start' : 'end'}
                    style={{ fontWeight: 600, fill: chartColors.ink }}
                  >
                    {p.label}
                  </text>
                );
              })}
          </g>
        </svg>
        {point && (
          <div
            className={c.tooltip}
            aria-hidden="true"
            data-static={narrow || undefined}
            style={
              narrow
                ? undefined
                : {
                    transform:
                      x(point.x) > m.left + iw / 2
                        ? `translate(calc(${x(point.x) - 16}px - 100%), ${Math.max(4, y(point.y) - 40)}px)`
                        : `translate(${x(point.x) + 16}px, ${Math.max(4, y(point.y) - 40)}px)`,
                  }
            }
          >
            <strong>{point.label}</strong>
            <span>
              <em>Volatility</em>
              <b>{point.x.toFixed(1)}%</b>
            </span>
            <span>
              <em>Return</em>
              <b>{point.y.toFixed(2)}%</b>
            </span>
          </div>
        )}
      </div>
      <p className={c.srOnly} aria-live="polite">
        {spoken}
      </p>
    </div>
  );
}

export type RadarSeries = { label: string; color: string; values: (number | null)[] };

/**
 * Multi-dimensional comparison radar (RealROI C23), 0–100 per axis, fill 0.2.
 * Unlike the reference it has a tooltip: hover, tap or arrow keys read an axis.
 * A `null` score leaves that vertex out (dashed edge) and reads "Not measured".
 */
export function RadarChart({
  label,
  axes,
  series,
  height = 320,
}: {
  label: string;
  axes: string[];
  series: RadarSeries[];
  height?: number;
}) {
  const [wrap, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const narrow = width < 480;
  const cx = width / 2;
  const cy = height / 2 + 4;
  const R = Math.max(40, Math.min(width / 2 - (narrow ? 56 : 80), height / 2 - 36));
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
  const pt = (i: number, v: number) =>
    [cx + (Math.cos(angle(i)) * (R * v)) / 100, cy + (Math.sin(angle(i)) * (R * v)) / 100] as const;
  const fmt = (v: number | null) => (v == null ? 'Not measured' : v.toFixed(0));
  const spoken =
    active == null
      ? ''
      : `${axes[active]}: ${series.map((s) => `${s.label} ${fmt(s.values[active])}`).join('; ')}`;
  return (
    <div className={c.chart}>
      <div
        ref={wrap}
        className={c.plot}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use arrow keys to read each dimension; scores are also in the table.`}
        onKeyDown={(event) => {
          const next = keyStep(event, axes.length, active);
          if (next !== undefined) setActive(next);
        }}
        onBlur={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-labelledby={`${id}-t`}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const px = ((event.clientX - box.left) / (box.width || 1)) * width - cx;
            const py = ((event.clientY - box.top) / (box.height || 1)) * height - cy;
            const a = Math.atan2(py, px);
            let best = 0;
            let gap = Infinity;
            axes.forEach((_, i) => {
              const d = Math.abs(Math.atan2(Math.sin(a - angle(i)), Math.cos(a - angle(i))));
              if (d < gap) {
                gap = d;
                best = i;
              }
            });
            setActive(best);
          }}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          <title id={`${id}-t`}>{label}</title>
          {[20, 40, 60, 80, 100].map((ring) => (
            <polygon
              key={ring}
              points={axes.map((_, i) => pt(i, ring).join(',')).join(' ')}
              fill="none"
              stroke={chartColors.border}
            />
          ))}
          {axes.map((axis, i) => {
            const [ex, ey] = pt(i, 100);
            const [lx, ly] = pt(i, 118);
            return (
              <g key={axis}>
                <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={chartColors.border} />
                <text
                  className={c.xtick}
                  x={lx}
                  y={ly + 4}
                  textAnchor={Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end'}
                  style={active === i ? { fontWeight: 600, fill: chartColors.ink } : undefined}
                >
                  {axis}
                </text>
              </g>
            );
          })}
          {/* Ring values, read along the bisector of the first two axes so they clear the
              axis labels; they match the 20-point rings drawn above. */}
          {[20, 40, 60, 80, 100].map((t) => {
            const a = angle(0) + Math.PI / axes.length;
            return (
              <text
                key={t}
                className={c.xtick}
                x={cx + (Math.cos(a) * (R * t)) / 100 + 3}
                y={cy + (Math.sin(a) * (R * t)) / 100 - 2}
                style={{ fontSize: 10 }}
              >
                {t}
              </text>
            );
          })}
          <g className={c.reveal}>
            {series.map((s) => {
              const complete = s.values.every((v) => v != null);
              const pts = s.values.map((v, i) => (v == null ? null : pt(i, v)));
              return (
                <g key={s.label}>
                  {complete ? (
                    <polygon
                      points={pts.map((p) => p!.join(',')).join(' ')}
                      fill={s.color}
                      fillOpacity={0.2}
                      stroke={s.color}
                      strokeWidth={2}
                    />
                  ) : (
                    pts.map((p, i) => {
                      const q = pts[(i + 1) % pts.length];
                      return p && q ? (
                        <line
                          key={i}
                          x1={p[0]}
                          y1={p[1]}
                          x2={q[0]}
                          y2={q[1]}
                          stroke={s.color}
                          strokeWidth={2}
                          strokeDasharray="5 4"
                        />
                      ) : null;
                    })
                  )}
                  {pts.map((p, i) =>
                    p ? (
                      <circle
                        key={i}
                        cx={p[0]}
                        cy={p[1]}
                        r={active === i ? 5 : complete ? 0 : 4}
                        fill={s.color}
                        stroke="white"
                        strokeWidth={active === i ? 2 : 1}
                      />
                    ) : null,
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        {active != null && (
          <div
            className={c.tooltip}
            aria-hidden="true"
            data-static={narrow || undefined}
            style={narrow ? undefined : { transform: `translate(${width - 220}px, 8px)` }}
          >
            <strong>{axes[active]}</strong>
            {series.map((s) => (
              <span key={s.label}>
                <i data-kind="bar" style={{ color: s.color }} />
                <em>{s.label}</em>
                <b>{fmt(s.values[active])}</b>
              </span>
            ))}
          </div>
        )}
      </div>
      <p className={c.srOnly} aria-live="polite">
        {spoken}
      </p>
      <ul className={c.legend} aria-label={`${label} legend`}>
        {series.map((s) => (
          <li key={s.label}>
            <i
              data-kind={s.values.every((v) => v != null) ? 'bar' : 'dashed'}
              style={{ color: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

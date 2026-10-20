'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { rentDistribution } from '@/lib/comps/distribution';
import c from '@/components/analysis/roi-chart.module.css';
import s from './rent-distribution.module.css';

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const k = (v: number) => `$${(v / 1000).toFixed(1)}k`;

/**
 * RealROI "Rental Distribution" (C25): a normal curve fitted to the included
 * comps, comps as dots on the curve, the subject's rent as a teal line and dot,
 * a dashed average and the suggested range as a band. It summarises the spread;
 * it is not a probability claim about this home's rent.
 */
export function RentDistribution({
  rents,
  subjectRent,
  subjectLabel,
  rangeLow,
  rangeHigh,
}: {
  rents: number[];
  subjectRent: number | null;
  subjectLabel: string;
  rangeLow?: number;
  rangeHigh?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  useEffect(() => {
    if (!wrap.current || typeof ResizeObserver === 'undefined') return;
    const o = new ResizeObserver(
      ([e]) => e.contentRect.width > 0 && setWidth(Math.round(e.contentRect.width)),
    );
    o.observe(wrap.current);
    return () => o.disconnect();
  }, []);
  const d = rentDistribution(rents, subjectRent);
  if (!d) return null;
  const h = 224;
  const m = { top: 25, right: 30, bottom: 26, left: 30 };
  const iw = Math.max(1, width - m.left - m.right);
  const ih = h - m.top - m.bottom;
  const round = (v: number) => Math.round(v * 100) / 100;
  const x = (v: number) => round(m.left + ((v - d.min) / (d.max - d.min || 1)) * iw);
  const y = (v: number) => round(m.top + ih - (v / 120) * ih);
  const line = d.curve
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.rent).toFixed(1)},${y(p.density).toFixed(1)}`)
    .join('');
  const area = `${line}L${x(d.max)},${y(0)}L${x(d.min)},${y(0)}Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => d.min + ((d.max - d.min) * i) / 4);
  const points = [
    ...d.comps.map((p) => ({ ...p, you: false })),
    ...(d.subject ? [{ ...d.subject, you: true }] : []),
  ].sort((a, b) => a.rent - b.rent);
  const point = active == null ? null : points[active];
  const close = d.subject && Math.abs(d.subject.rent - d.mean) / d.mean < 0.08;
  const left = d.subject ? d.subject.rent <= d.mean : true;
  const band =
    rangeLow && rangeHigh && rangeHigh > rangeLow
      ? { lo: Math.max(d.min, rangeLow), hi: Math.min(d.max, rangeHigh) }
      : null;
  return (
    <section className={s.card} aria-labelledby={`${id}-h`}>
      <header className={s.head}>
        <h2 id={`${id}-h`}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Rental Distribution
        </h2>
        <p>
          {subjectRent != null ? `Your ${subjectLabel} compared to` : 'Spread of'} {d.comps.length}{' '}
          comparable rental
          {d.comps.length === 1 ? '' : 's'}
        </p>
      </header>
      <div className={s.body}>
        <dl className={s.stats}>
          <div>
            <dt>Low</dt>
            <dd>{usd(d.low)}</dd>
          </div>
          <div data-tone="teal">
            <dt>Average</dt>
            <dd>{usd(d.mean)}</dd>
          </div>
          <div>
            <dt>High</dt>
            <dd>{usd(d.high)}</dd>
          </div>
        </dl>
        <div
          ref={wrap}
          className={c.plot}
          role="group"
          tabIndex={0}
          aria-label="Rental distribution. Use arrow keys to read each rent; the comps table lists every rent."
          onKeyDown={(e) => {
            const last = points.length - 1;
            const next =
              e.key === 'ArrowRight'
                ? Math.min(last, (active ?? -1) + 1)
                : e.key === 'ArrowLeft'
                  ? Math.max(0, (active ?? points.length) - 1)
                  : e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? last
                      : e.key === 'Escape'
                        ? null
                        : undefined;
            if (next === undefined) return;
            e.preventDefault();
            setActive(next);
          }}
          onBlur={() => setActive(null)}
        >
          <svg
            viewBox={`0 0 ${width} ${h}`}
            width="100%"
            height={h}
            role="img"
            aria-labelledby={`${id}-t`}
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - box.left) / (box.width || 1)) * width;
              let best = 0;
              points.forEach((p, i) => {
                if (Math.abs(x(p.rent) - px) < Math.abs(x(points[best].rent) - px)) best = i;
              });
              setActive(best);
            }}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          >
            <title id={`${id}-t`}>
              {`Rents from ${usd(d.low)} to ${usd(d.high)}, average ${usd(d.mean)}${subjectRent != null ? `; yours ${usd(subjectRent)}` : ''}`}
            </title>
            <defs>
              <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {band && (
              <rect
                x={x(band.lo)}
                width={Math.max(0, x(band.hi) - x(band.lo))}
                y={m.top}
                height={ih}
                fill="#14b8a6"
                fillOpacity={0.08}
                stroke="#14b8a6"
                strokeOpacity={0.2}
                strokeDasharray="3 3"
              />
            )}
            <line x1={m.left} x2={m.left + iw} y1={y(0)} y2={y(0)} stroke="#e2e8f0" />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(0) + 5} stroke="#e2e8f0" />
                <text x={x(t)} y={h - 6} textAnchor="middle" style={{ fontSize: 10 }}>
                  {k(t)}
                </text>
              </g>
            ))}
            <g className={c.reveal}>
              <path d={area} fill={`url(#${id}-g)`} />
              <path d={line} fill="none" stroke="#14b8a6" strokeWidth={2.5} />
            </g>
            <line
              x1={x(d.mean)}
              x2={x(d.mean)}
              y1={m.top}
              y2={y(0)}
              stroke="#64748b"
              strokeDasharray="5 5"
            />
            {!close && (
              <text
                x={x(d.mean) - 4}
                y={y(0) - 6}
                textAnchor="end"
                style={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }}
              >
                Avg {k(d.mean)}
              </text>
            )}
            {d.subject && (
              <g>
                <line
                  x1={x(d.subject.rent)}
                  x2={x(d.subject.rent)}
                  y1={m.top}
                  y2={y(0)}
                  stroke="#0d9488"
                  strokeWidth={2.5}
                />
                <text
                  x={x(d.subject.rent) + (left ? 6 : -6)}
                  y={m.top + 10}
                  textAnchor={left ? 'start' : 'end'}
                  style={{ fontSize: 10, fontWeight: 700, fill: '#0d9488' }}
                >
                  {`You ${k(d.subject.rent)}${close ? ' ≈ Avg' : ''}`}
                </text>
              </g>
            )}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={x(p.rent)}
                cy={y(p.density)}
                r={(p.you ? 7 : 5) + (active === i ? 2 : 0)}
                fill={p.you ? '#0d9488' : '#94a3b8'}
                stroke={p.you ? '#0f766e' : '#64748b'}
                strokeWidth={p.you ? 2 : 1.5}
              />
            ))}
          </svg>
          {point && (
            <div
              className={c.tooltip}
              aria-hidden="true"
              data-static={width < 480 || undefined}
              style={
                width < 480
                  ? undefined
                  : {
                      transform:
                        x(point.rent) > width / 2
                          ? `translate(calc(${x(point.rent) - 14}px - 100%), 8px)`
                          : `translate(${x(point.rent) + 14}px, 8px)`,
                    }
              }
            >
              <strong>{point.you ? `Your ${subjectLabel}` : 'Comparable'}</strong>
              <span>
                <em>Rent</em>
                <b data-tone="teal">{usd(point.rent)}/mo</b>
              </span>
            </div>
          )}
        </div>
        <p className={c.srOnly} aria-live="polite">
          {point
            ? `${point.you ? `Your ${subjectLabel}` : 'Comparable'}: ${usd(point.rent)} per month`
            : ''}
        </p>
        <ul className={c.legend}>
          {d.subject && (
            <li>
              <i className={s.you} /> Your {subjectLabel}
            </li>
          )}
          <li>
            <i className={s.comp} /> Comparables
          </li>
          {band && (
            <li>
              <i className={s.band} /> Suggested range
            </li>
          )}
        </ul>
        <p className={s.note}>
          Curve: a normal distribution with the comps&apos; mean and standard deviation, scaled to
          its peak. It describes the spread of these comps only.
        </p>
      </div>
    </section>
  );
}

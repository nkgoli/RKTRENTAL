'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { rentDistribution } from '@/lib/comps/distribution';
import s from './rent-distribution.module.css';

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
/** "$1.8K", "$2K": written out so server and browser render the same text (ICU differs). */
const compact = (v: number) =>
  Math.abs(v) >= 1000
    ? `$${(v / 1000).toFixed(2).replace(/\.?0+$/, '')}K`
    : `$${Math.round(v).toLocaleString('en-US')}`;

/** Three to six round ticks inside the domain ($1.8K / $2K / $2.2K …), never at odd values. */
export function rentTicks(min: number, max: number) {
  const span = max - min;
  if (!(span > 0)) return [Math.round(min)];
  const raw = span / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 5, 10].find((n) => raw / power <= n)! * power;
  const build = () => {
    const ticks: number[] = [];
    for (let t = Math.ceil(min / step) * step; t <= max + 1e-6; t += step) ticks.push(t);
    return ticks;
  };
  let ticks = build();
  if (ticks.length < 3) {
    step /= 2;
    ticks = build();
  }
  return ticks.map((t) => Math.round(t * 100) / 100);
}

/**
 * Rent distribution (C25): a normal curve fitted to the included comps, comps as dots on the
 * curve, the subject's rent as a marker line and dot, a dashed average and the suggested range
 * as a band. It summarises the spread; it is not a probability claim about this home's rent.
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
  const heading = <h2 id={`${id}-h`}>Rent distribution</h2>;
  if (!d)
    return (
      <section className={s.card} aria-labelledby={`${id}-h`}>
        {heading}
        <p className={s.empty} role="status">
          No comparable rents are included.
        </p>
      </section>
    );
  const h = 200;
  const m = { top: 12, right: 16, bottom: 28, left: 16 };
  const iw = Math.max(1, width - m.left - m.right);
  const ih = h - m.top - m.bottom;
  const round = (v: number) => Math.round(v * 100) / 100;
  const x = (v: number) => round(m.left + ((v - d.min) / (d.max - d.min || 1)) * iw);
  const y = (v: number) => round(m.top + ih - (v / 110) * ih);
  const line = d.curve
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.rent).toFixed(1)},${y(p.density).toFixed(1)}`)
    .join('');
  const area = `${line}L${x(d.max)},${y(0)}L${x(d.min)},${y(0)}Z`;
  const ticks = rentTicks(d.min, d.max);
  const points = [
    ...d.comps.map((p) => ({ ...p, you: false })),
    ...(d.subject ? [{ ...d.subject, you: true }] : []),
  ].sort((a, b) => a.rent - b.rent);
  const point = active == null ? null : points[active];
  const band =
    rangeLow && rangeHigh && rangeHigh > rangeLow
      ? { lo: Math.max(d.min, rangeLow), hi: Math.min(d.max, rangeHigh) }
      : null;
  return (
    <section className={s.card} aria-labelledby={`${id}-h`}>
      {heading}
      <div className={s.body}>
        <dl className={s.stats}>
          <div>
            <dt>Low</dt>
            <dd>{usd(d.low)}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{usd(d.mean)}</dd>
          </div>
          <div>
            <dt>High</dt>
            <dd>{usd(d.high)}</dd>
          </div>
          {d.subject && (
            <div>
              <dt>Yours vs average</dt>
              <dd>
                {Math.round(d.subject.rent) === Math.round(d.mean)
                  ? 'Even'
                  : `${d.subject.rent > d.mean ? '+' : '−'}${usd(Math.abs(d.subject.rent - d.mean))}`}
              </dd>
            </div>
          )}
        </dl>
        <div
          ref={wrap}
          className={s.plot}
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
            {band && (
              <rect
                className={s.bandFill}
                x={x(band.lo)}
                width={Math.max(0, x(band.hi) - x(band.lo))}
                y={m.top}
                height={ih}
              />
            )}
            <line className={s.baseline} x1={m.left} x2={m.left + iw} y1={y(0)} y2={y(0)} />
            {ticks.map((t) => (
              <text key={t} className={s.tick} x={x(t)} y={h - 8} textAnchor="middle">
                {compact(t)}
              </text>
            ))}
            <g className={s.reveal}>
              <path className={s.area} d={area} />
              <path className={s.curve} d={line} />
            </g>
            <line className={s.mean} x1={x(d.mean)} x2={x(d.mean)} y1={m.top} y2={y(0)} />
            {d.subject && (
              <line
                className={s.subject}
                x1={x(d.subject.rent)}
                x2={x(d.subject.rent)}
                y1={m.top}
                y2={y(0)}
              />
            )}
            {points.map((p, i) => (
              <circle
                key={i}
                className={p.you ? s.youDot : s.compDot}
                cx={x(p.rent)}
                cy={y(p.density)}
                r={(p.you ? 6 : 4) + (active === i ? 2 : 0)}
              />
            ))}
          </svg>
          {point && (
            <div
              className={s.tooltip}
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
                <b>{usd(point.rent)}/mo</b>
              </span>
            </div>
          )}
        </div>
        <p className={s.srOnly} aria-live="polite">
          {point
            ? `${point.you ? `Your ${subjectLabel}` : 'Comparable'}: ${usd(point.rent)} per month`
            : ''}
        </p>
        <ul className={s.legend}>
          {d.subject && (
            <li>
              <i className={s.you} /> Your {subjectLabel} {usd(d.subject.rent)}
            </li>
          )}
          <li>
            <i className={s.comp} /> Comparables
          </li>
          <li>
            <i className={s.avg} /> Average
          </li>
          {band && (
            <li>
              <i className={s.band} /> Suggested range {usd(rangeLow!)}–{usd(rangeHigh!)}
            </li>
          )}
        </ul>
        <p className={s.note}>
          {d.low === d.high
            ? `${d.comps.length === 1 ? 'Only one comparable is included' : 'All comparables have the same rent'}, so the curve uses an assumed ±10% spread.`
            : `Normal curve from the comps' average and standard deviation (${usd(d.sd)}).`}
        </p>
      </div>
    </section>
  );
}

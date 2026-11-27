import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/components/ui/cx';
import styles from './ColumnChart.module.css';

export type ColumnSeries = {
  key: string;
  label: string;
  /** Any CSS colour; normally one of the `--chart-N` tokens, in order. */
  color: string;
};

export type ColumnDatum = {
  key: string;
  /** Short axis label under the column ("Jun", "Jun '26"). */
  label: string;
  /** Longer heading for the hover card ("June 2026"); defaults to `label`. */
  title?: string;
  values: Record<string, number>;
  /** A target drawn as a short line across the column, such as rent due. */
  target?: number;
  /** A period still in progress: its bars are drawn lighter. */
  partial?: boolean;
};

/** Rounded, readable axis steps: 0 / 50K / 100K / 150K rather than 0 / 66,605 / 133,210. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((n) => raw / power <= n)! * power;
  const top = Math.ceil(max / step - 1e-9) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
}

/** At most `limit` evenly spaced axis labels, always including the last column. */
export function labelIndexes(length: number, limit = 8): Set<number> {
  if (length <= limit) return new Set(Array.from({ length }, (_, index) => index));
  const every = Math.ceil(length / limit);
  const shown = new Set<number>();
  for (let index = length - 1; index >= 0; index -= every) shown.add(index);
  return shown;
}

/**
 * Columns drawn in HTML so corners stay crisp at any width: thin bars with rounded tops,
 * hairline grid, a quiet axis and a hover card per column. Every value also belongs in a
 * table next to the chart; the hover card only repeats it.
 */
export function ColumnChart({
  series,
  data,
  format,
  axisFormat = format,
  label,
  targetLabel,
  partialNote = 'to date',
  height = 180,
  className,
}: {
  series: ColumnSeries[];
  data: ColumnDatum[];
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  /** Accessible name for the plot. */
  label: string;
  /** Name of the target line in the legend and hover card ("Due"). */
  targetLabel?: string;
  partialNote?: string;
  height?: number;
  className?: string;
}) {
  const max = Math.max(
    0,
    ...data.flatMap((datum) => [
      ...series.map((s) => datum.values[s.key] ?? 0),
      datum.target ?? 0,
    ]),
  );
  const ticks = niceTicks(max);
  const top = ticks.at(-1) || 1;
  const pct = (value: number) => `${Math.max(0, Math.min(100, (value / top) * 100))}%`;
  const shown = labelIndexes(data.length);
  const grouped = series.length > 1;
  const hasTarget = !!targetLabel && data.some((datum) => datum.target !== undefined);
  const columns = { gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` };

  return (
    <div className={cx(styles.chart, className)}>
      <ul className={styles.legend} aria-hidden="true">
        {series.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
        {hasTarget && (
          <li>
            <i className={styles.targetKey} />
            {targetLabel}
          </li>
        )}
      </ul>
      <div
        className={styles.frame}
        style={{ '--plot-height': `${height}px` } as CSSProperties}
        role="img"
        aria-label={label}
      >
        <div className={styles.yAxis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: pct(tick) }}>
              {axisFormat(tick)}
            </span>
          ))}
        </div>
        <div className={styles.plot} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className={styles.gridLine} style={{ bottom: pct(tick) }} />
          ))}
          <div className={styles.columns} style={columns}>
            {data.map((datum, index) => (
              <div
                key={datum.key}
                className={styles.column}
                data-partial={datum.partial ? 'true' : undefined}
                data-align={index < 2 ? 'start' : index >= data.length - 2 ? 'end' : undefined}
              >
                <div className={cx(styles.bars, grouped && styles.grouped)}>
                  {series.map((s) => (
                    <span
                      key={s.key}
                      className={styles.bar}
                      data-series={s.key}
                      style={{ height: pct(datum.values[s.key] ?? 0), background: s.color }}
                    />
                  ))}
                </div>
                {hasTarget && datum.target !== undefined && (
                  <span className={styles.target} style={{ bottom: pct(datum.target) }} />
                )}
                <Tip
                  title={`${datum.title ?? datum.label}${datum.partial ? ` · ${partialNote}` : ''}`}
                  rows={[
                    ...series.map((s) => ({
                      key: s.key,
                      label: s.label,
                      value: format(datum.values[s.key] ?? 0),
                      swatch: <i style={{ background: s.color }} />,
                    })),
                    ...(hasTarget && datum.target !== undefined
                      ? [
                          {
                            key: 'target',
                            label: targetLabel!,
                            value: format(datum.target),
                            swatch: <i className={styles.targetKey} />,
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.xAxis} style={columns} aria-hidden="true">
          {data.map((datum, index) => (
            <span key={datum.key}>{shown.has(index) ? datum.label : ''}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tip({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: string; swatch: ReactNode }[];
}) {
  return (
    <span className={styles.tip}>
      <strong>{title}</strong>
      {rows.map((row) => (
        <span key={row.key} className={styles.tipRow}>
          {row.swatch}
          <span>{row.label}</span>
          <b>{row.value}</b>
        </span>
      ))}
    </span>
  );
}

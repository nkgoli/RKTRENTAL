import {
  COLLECTION_RANGES,
  type CollectionMonth,
  type CollectionRange,
} from '@/lib/dashboard/queries';
import { bucketLabel } from '@/lib/returns/period';
import { formatUsd } from '@/lib/ledger';
import styles from './CollectionChart.module.css';

/** Rent collected per month against rent due, with a 6M / 12M / 2Y / 5Y switch kept in the URL. */
export function CollectionChart({
  months,
  range,
}: {
  months: CollectionMonth[];
  range: CollectionRange;
}) {
  const width = 640;
  const height = 124;
  const base = 124;
  const max = Math.max(1, ...months.flatMap((m) => [m.dueCents, m.collectedCents]));
  const slot = width / Math.max(months.length, 1);
  const barWidth = Math.max(2, slot * 0.62);
  const withYear = months.length > 12;
  const labelCount = Math.min(6, months.length);
  const labels = Array.from(
    { length: labelCount },
    (_, index) => months[Math.round((index * (months.length - 1)) / Math.max(1, labelCount - 1))],
  );
  return (
    <div className={styles.chart} data-testid="collection-chart">
      <div className={styles.toolbar}>
        <div className="chips" role="group" aria-label="Rent collection range">
          {(Object.keys(COLLECTION_RANGES) as CollectionRange[]).map((key) => (
            <a
              key={key}
              className={`chip${range === key ? ' active' : ''}`}
              href={key === '6M' ? '/dashboard' : `/dashboard?range=${key}`}
              aria-current={range === key ? 'true' : undefined}
            >
              {key}
            </a>
          ))}
        </div>
        <div className={styles.legend} aria-hidden="true">
          <span>
            <i />
            Collected
          </span>
          <span>
            <i />
            Due
          </span>
          <span className={styles.currentLegend}>
            <i />
            Current month (to date)
          </span>
        </div>
      </div>
      {!months.length && (
        <p className={styles.empty}>
          Collection data is unavailable. Choose another range or reload the dashboard.
        </p>
      )}
      <div className={styles.plot}>
        <div className={styles.scale} aria-hidden="true">
          {[0, 0.5, 1].map((fraction) => (
            <span key={fraction} style={{ top: `${((base - fraction * 100) / height) * 100}%` }}>
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                notation: 'compact',
                maximumFractionDigits: 0,
              }).format(Math.round(max * fraction) / 100)}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="124"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Rent collected against rent due, last ${months.length} months`}
        >
          <g aria-hidden="true" className={styles.grid}>
            {[0, 0.5, 1].map((fraction) => (
              <path key={fraction} d={`M0 ${base - fraction * 100}H${width}`} />
            ))}
          </g>
          {months.map((month, index) => {
            const x = index * slot + (slot - barWidth) / 2;
            const collected = (month.collectedCents / max) * 100;
            const due = (month.dueCents / max) * 100;
            return (
              <g key={month.key}>
                <title>{`${bucketLabel(month.key, true)}: ${formatUsd(month.collectedCents)} of ${formatUsd(month.dueCents)}`}</title>
                <rect
                  x={x}
                  y={base - collected}
                  width={barWidth}
                  height={collected}
                  rx={2}
                  fill="var(--design-primary)"
                  fillOpacity={index === months.length - 1 ? 0.45 : 1}
                  stroke={index === months.length - 1 ? 'var(--design-primary)' : undefined}
                  strokeDasharray={index === months.length - 1 ? '3 3' : undefined}
                />
                <path
                  d={`M${index * slot} ${base - due}h${slot}`}
                  stroke="var(--design-muted)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}
        </svg>
        <div className={styles.labels} aria-hidden="true">
          {labels.map((month) => (
            <span key={month.key}>
              {bucketLabel(month.key, withYear)}
              {month.key === months.at(-1)?.key ? ' · to date' : ''}
            </span>
          ))}
        </div>
      </div>
      <details className={styles.amounts}>
        <summary>View monthly amounts</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Monthly rent collection amounts"
        >
          <table className="table">
            <caption className={styles.caption}>Rent collected against rent due</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Collected</th>
                <th scope="col">Due</th>
                <th scope="col">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.key}>
                  <th scope="row">{bucketLabel(month.key, true)}</th>
                  <td>{formatUsd(month.collectedCents)}</td>
                  <td>{formatUsd(month.dueCents)}</td>
                  <td>{formatUsd(Math.max(0, month.dueCents - month.collectedCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

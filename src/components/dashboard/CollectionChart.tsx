import {
  COLLECTION_RANGES,
  type CollectionMonth,
  type CollectionRange,
} from '@/lib/dashboard/queries';
import { bucketLabel } from '@/lib/returns/period';
import { formatUsd } from '@/lib/ledger';
import { ColumnChart } from '@/components/charts/ColumnChart';
import styles from './CollectionChart.module.css';

const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 0,
});

/** 6M / 12M / 2Y / 5Y switch, kept in the URL. */
export function CollectionRangeChips({ range }: { range: CollectionRange }) {
  return (
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
  );
}

/** Rent collected per month against rent due; the current month is drawn lighter (to date). */
export function CollectionChart({ months }: { months: CollectionMonth[]; range?: CollectionRange }) {
  const withYear = months.length > 12;
  return (
    <div className={styles.chart} data-testid="collection-chart">
      {months.length ? (
        <ColumnChart
          label={`Rent collected against rent due, last ${months.length} months`}
          series={[{ key: 'collected', label: 'Collected', color: 'var(--chart-1)' }]}
          targetLabel="Due"
          data={months.map((month, index) => ({
            key: month.key,
            label: bucketLabel(month.key, withYear),
            title: bucketLabel(month.key, true),
            values: { collected: month.collectedCents },
            target: month.dueCents,
            partial: index === months.length - 1,
          }))}
          format={formatUsd}
          axisFormat={(cents) => compactUsd.format(cents / 100)}
        />
      ) : (
        <p className={styles.empty}>No collection data for this range.</p>
      )}
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
                <th scope="col" className="num">
                  Collected
                </th>
                <th scope="col" className="num">
                  Due
                </th>
                <th scope="col" className="num">
                  Outstanding
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, index) => (
                <tr key={month.key}>
                  <th scope="row">
                    {bucketLabel(month.key, true)}
                    {index === months.length - 1 ? ' · to date' : ''}
                  </th>
                  <td className="num">{formatUsd(month.collectedCents)}</td>
                  <td className="num">{formatUsd(month.dueCents)}</td>
                  <td className="num">
                    {formatUsd(Math.max(0, month.dueCents - month.collectedCents))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

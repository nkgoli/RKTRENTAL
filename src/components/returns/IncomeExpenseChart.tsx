import { bucketLabel, type SeriesPoint } from '@/lib/returns/period';
import { ColumnChart } from '@/components/charts/ColumnChart';
import styles from './returns.module.css';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 0,
});
/** Show the year on axis labels when the range crosses a calendar year. */
const withYear = (rows: SeriesPoint[]) =>
  new Set(rows.map((row) => row.month.slice(0, 4))).size > 1;

/** A readable chart and an equivalent, keyboard-accessible table of exact ledger amounts. */
export function IncomeExpenseChart({
  rows,
  label,
  height = 200,
}: {
  rows: SeriesPoint[];
  label: string;
  /** Plot height in px; taller where the chart shares a row with a long list. */
  height?: number;
}) {
  const hasActivity = rows.some((row) => row.incomeCents !== 0 || row.expensesCents !== 0);
  return (
    <div>
      {!hasActivity && (
        <p className={styles.empty}>No recorded income or expenses in this period.</p>
      )}
      {hasActivity && (
        <ColumnChart
          label={label}
          series={[
            { key: 'income', label: 'Income', color: 'var(--chart-1)' },
            { key: 'expenses', label: 'Expenses', color: 'var(--chart-2)' },
          ]}
          data={rows.map((row) => ({
            key: row.month,
            label: bucketLabel(row.month, withYear(rows)),
            title: bucketLabel(row.month, true),
            values: { income: row.incomeCents, expenses: row.expensesCents },
          }))}
          format={money}
          axisFormat={(cents) => compactUsd.format(cents / 100)}
          height={height}
        />
      )}
      <details className={styles.exact}>
        <summary>View exact amounts</summary>
        <div
          className={styles.tableScroll}
          role="region"
          aria-label={`${label} amounts`}
          tabIndex={0}
        >
          <table className="table">
            <caption className={styles.caption}>Income, expenses and NOI · USD</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="num">
                  Income
                </th>
                <th scope="col" className="num">
                  Expenses
                </th>
                <th scope="col" className="num">
                  NOI
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month}>
                  <th scope="row">{bucketLabel(row.month, true)}</th>
                  <td className="num">{money(row.incomeCents)}</td>
                  <td className="num">{money(row.expensesCents)}</td>
                  <td className="num">{money(row.incomeCents - row.expensesCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

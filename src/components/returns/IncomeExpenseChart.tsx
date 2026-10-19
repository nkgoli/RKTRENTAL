import { bucketLabel, type SeriesPoint } from '@/lib/returns/period';
import styles from './returns.module.css';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** A readable chart and an equivalent, keyboard-accessible table of exact ledger amounts. */
export function IncomeExpenseChart({ rows, label }: { rows: SeriesPoint[]; label: string }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.incomeCents, row.expensesCents]));
  const hasActivity = rows.some((row) => row.incomeCents !== 0 || row.expensesCents !== 0);
  const step = 680 / Math.max(1, rows.length);
  const bar = Math.min(15, step * 0.32);
  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
  return (
    <div>
      {!hasActivity && (
        <p className={styles.empty}>
          No recorded income or expenses in this period. Choose another range to review earlier
          activity.
        </p>
      )}
      {hasActivity && (
        <>
          <div
            className={styles.chartScroll}
            role="region"
            aria-label={`${label} chart`}
            tabIndex={0}
          >
            <svg viewBox="0 0 720 220" className={styles.chart} role="img" aria-label={label}>
              {[40, 105, 170].map((y) => (
                <line key={y} x1="20" x2="700" y1={y} y2={y} stroke="var(--rr-border)" />
              ))}
              {rows.map((row, index) => {
                const x = 20 + index * step + step / 2;
                const income = (row.incomeCents / max) * 140;
                const expenses = (row.expensesCents / max) * 140;
                return (
                  <g key={row.month}>
                    <title>{`${bucketLabel(row.month, true)}: income ${money(row.incomeCents)}, expenses ${money(row.expensesCents)}`}</title>
                    <rect
                      x={x - bar - 2}
                      y={170 - income}
                      width={bar}
                      height={income}
                      rx="2"
                      fill="var(--design-primary)"
                    />
                    <rect
                      x={x + 2}
                      y={170 - expenses}
                      width={bar}
                      height={expenses}
                      rx="2"
                      fill="var(--design-accent)"
                    />
                    {index % labelEvery === 0 && (
                      <text
                        x={x}
                        y="200"
                        textAnchor="middle"
                        fill="var(--design-muted)"
                        fontSize="14"
                      >
                        {bucketLabel(row.month, true)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className={styles.legend}>
            <span>
              <i />
              Income
            </span>
            <span>
              <i />
              Expenses
            </span>
          </div>
        </>
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

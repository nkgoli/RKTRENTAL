'use client';
import { useRouter } from 'next/navigation';
import styles from './returns.module.css';
import { Field, Input } from '@/components/ui/Forms';
import {
  PERIOD_KEYS,
  monthBucket,
  periodParams,
  type ResolvedPeriod,
  yearOverYearChange,
  type YearlyPoint,
} from '@/lib/returns/period';
import { formatMoney } from '@/lib/properties/format';

/** Returns are summaries: whole dollars, like the rest of the reports. */
const formatUsd = (cents: number) => formatMoney(Math.round(cents) / 100);

/**
 * Range chips plus a custom from/to month form. The selection lives in the
 * URL (`period`, and `from`/`to` for a custom range); `extra` carries other
 * params, such as the property filter or a unit, across changes.
 */
export function RangePicker({
  period,
  basePath,
  extra = {},
  now = new Date(),
}: {
  period: ResolvedPeriod;
  basePath: string;
  extra?: Record<string, string>;
  now?: Date;
}) {
  const router = useRouter();
  const href = (params: Record<string, string>) =>
    `${basePath}?${new URLSearchParams({ ...extra, ...params })}`;
  const current = periodParams(period);
  const lastMonth = monthBucket(new Date(period.end.getTime() - 1));
  return (
    <div className={styles.range}>
      <div className={styles.presets} role="group" aria-label="Date range">
        {PERIOD_KEYS.map((key) => (
          <a
            key={key}
            className={`chip${period.key === key ? ' active' : ''}`}
            href={href({ period: key })}
            aria-current={period.key === key ? 'true' : undefined}
          >
            {key === 'ALL' ? 'All' : key}
          </a>
        ))}
      </div>
      <details open={period.key === 'CUSTOM'}>
        <summary className="chip">Custom dates</summary>
        <form
          onSubmit={(event) => event.preventDefault()}
          onBlur={(event) => {
            const form = event.currentTarget;
            const data = new FormData(form);
            const from = String(data.get('from') ?? '');
            const to = String(data.get('to') ?? '');
            if (!form.checkValidity() || !from || !to || from > to) return;
            if (from === current.from && to === current.to) return;
            router.replace(href({ period: 'CUSTOM', from, to }), { scroll: false });
          }}
          key={new URLSearchParams(current).toString()}
          method="get"
          action={basePath}
          className={styles.custom}
          aria-label="Custom range"
        >
          {Object.entries(extra).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="period" value="CUSTOM" />
          <Field label="From">
            <Input
              name="from"
              type="month"
              max={monthBucket(now)}
              defaultValue={current.from ?? monthBucket(period.start)}
              required
            />
          </Field>
          <Field label="To">
            <Input
              name="to"
              type="month"
              max={monthBucket(now)}
              defaultValue={current.to ?? lastMonth}
              required
            />
          </Field>
        </form>
      </details>
      <span className={styles.period}>
        {period.label} · by {period.granularity}
      </span>
    </div>
  );
}

/** Calendar-year income statement for the selected range (shown when it spans several years). */
export function YearOverYear({ rows }: { rows: YearlyPoint[] }) {
  if (rows.length < 2) return null;
  const showChange = rows.some((row, index) => yearOverYearChange(row, rows[index - 1]) !== null);
  return (
    <div
      className={styles.tableScroll}
      role="region"
      aria-label="Year-over-year totals"
      tabIndex={0}
    >
      <table className={`table ${styles.mobileYearly}`} aria-label="Year-over-year totals">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col" className="num">
              Income
            </th>
            <th scope="col" className="num">
              Expenses
            </th>
            <th scope="col" className="num">
              NOI
            </th>
            {showChange && (
              <th scope="col" className="num">
                YoY
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const change = yearOverYearChange(row, rows[index - 1]);
            return (
              <tr key={row.year}>
                <td>
                  {row.year}
                  {row.months < 12 && <small className="muted"> · {row.months} mo</small>}
                </td>
                <td className="num">{formatUsd(row.incomeCents)}</td>
                <td className="num">{formatUsd(row.expensesCents)}</td>
                <td className="num">
                  <strong>{formatUsd(row.noiCents)}</strong>
                </td>
                {showChange && (
                  <td className="num muted">
                    {change === null
                      ? '—'
                      : `${change >= 0 ? '+' : '−'}${Math.abs(change * 100).toFixed(1)}%`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

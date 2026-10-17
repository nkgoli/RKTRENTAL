import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Forms';
import {
  PERIOD_KEYS,
  monthBucket,
  periodParams,
  type ResolvedPeriod,
  yearOverYearChange,
  type YearlyPoint,
} from '@/lib/returns/period';
import { formatUsd } from '@/lib/ledger';

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
  const href = (params: Record<string, string>) =>
    `${basePath}?${new URLSearchParams({ ...extra, ...params })}`;
  const current = periodParams(period);
  const lastMonth = monthBucket(new Date(period.end.getTime() - 1));
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
      <div className="chips" style={{ flexWrap: 'wrap' }} role="group" aria-label="Date range">
        {PERIOD_KEYS.map((key) => (
          <Link
            key={key}
            className={`chip${period.key === key ? ' active' : ''}`}
            href={href({ period: key })}
            aria-current={period.key === key ? 'true' : undefined}
          >
            {key === 'ALL' ? 'All' : key}
          </Link>
        ))}
      </div>
      <form method="get" action={basePath} className="row" aria-label="Custom range">
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
        <Button type="submit" variant={period.key === 'CUSTOM' ? 'primary' : 'secondary'} size="sm">
          Apply
        </Button>
      </form>
      <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
        {period.label} · by {period.granularity}
      </span>
    </div>
  );
}

/** Calendar-year income statement for the selected range (shown when it spans several years). */
export function YearOverYear({ rows }: { rows: YearlyPoint[] }) {
  if (rows.length < 2) return null;
  return (
    <table className="table" aria-label="Year-over-year totals">
      <thead>
        <tr>
          <th>Year</th>
          <th className="num">Income</th>
          <th className="num">Expenses</th>
          <th className="num">NOI</th>
          <th className="num">YoY</th>
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
              <td className="num muted">
                {change === null ? '—' : `${change >= 0 ? '+' : '−'}${Math.abs(change * 100).toFixed(1)}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

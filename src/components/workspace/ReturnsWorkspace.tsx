import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RangePicker, YearOverYear } from '@/components/returns/RangePicker';
import { formatMoney } from '@/lib/properties/format';
import type { ScopedReturns } from '@/lib/metrics/scoped';
import { IncomeExpenseChart } from '@/components/returns/IncomeExpenseChart';
import { periodParams } from '@/lib/returns/period';
import styles from './ReturnsWorkspace.module.css';

const moneyCents = (amount: number) => formatMoney(amount / 100);
const percent = (value: number | null) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`);

export function ReturnsWorkspace({
  returns,
  propertyId,
  propertyName,
  now,
}: {
  returns: ScopedReturns;
  propertyId: string;
  propertyName: string;
  now?: Date;
}) {
  const title = returns.unitNumber ? `Unit ${returns.unitNumber}` : propertyName;
  return (
    <div className={styles.page}>
      <RangePicker
        period={returns.period}
        basePath={`/properties/${propertyId}/returns`}
        extra={returns.unitId ? { unit: returns.unitId } : {}}
        now={now}
      />
      <p className={styles.context}>
        {returns.unitId
          ? 'Unit income follows settled payments. Property expenses, debt and value are allocated by scheduled or listed rent; equally when no rent is set.'
          : 'Income follows settled payments. Expenses and debt service cover the selected period.'}{' '}
        <a href={`/roi-analysis?${new URLSearchParams({ property: propertyId, view: 'actual', ...periodParams(returns.period) })}`}>
          Compare {propertyName} with projections
        </a>
      </p>
      <div className="kpis">
        <KpiCard
          label="Net operating income"
          value={moneyCents(returns.metrics.noiCents)}
          note="Income less operating expenses"
        />
        <KpiCard
          label="Cash flow"
          value={moneyCents(returns.metrics.cashFlowCents)}
          note="After debt service"
        />
        <KpiCard
          label="Cap rate"
          value={percent(returns.metrics.capRate)}
          note={
            returns.metrics.capRate === null
              ? 'Add property value to calculate'
              : 'Period NOI on property value'
          }
        />
      </div>
      <div className={styles.contentGrid}>
        <Card>
          <CardHeader
            title="Income vs expenses"
            action={<span className="muted">{returns.period.label}</span>}
          />
          <IncomeExpenseChart rows={returns.monthly} label={`${title}: ${returns.period.label}`} />
        </Card>
        <Card>
          <CardHeader
            title="Income statement"
            action={<span className="muted">{returns.period.label}</span>}
          />
          <dl className={styles.statement}>
            <dt>Rent collected</dt>
            <dd>{moneyCents(returns.metrics.incomeCents)}</dd>
            <dt>Operating expenses</dt>
            <dd>−{moneyCents(returns.metrics.expensesCents)}</dd>
            <dt>
              <strong>Net operating income</strong>
            </dt>
            <dd>
              <strong>{moneyCents(returns.metrics.noiCents)}</strong>
            </dd>
            <dt>Debt service</dt>
            <dd>−{moneyCents(returns.metrics.debtServiceCents)}</dd>
            <dt>
              <strong>Cash flow</strong>
            </dt>
            <dd>
              <strong>{moneyCents(returns.metrics.cashFlowCents)}</strong>
            </dd>
          </dl>
          {returns.unitId && (
            <p className={styles.rollup}>
              Rolls up into{' '}
              <Link
                href={`/properties/${propertyId}/returns?${new URLSearchParams(periodParams(returns.period))}`}
              >
                {propertyName} returns
              </Link>{' '}
              and{' '}
              <Link href={`/returns?${new URLSearchParams(periodParams(returns.period))}`}>
                portfolio returns
              </Link>
              .
            </p>
          )}
        </Card>
      </div>
      {returns.yearly.length > 1 && (
        <Card>
          <CardHeader
            title="Year over year"
            action={<span className="muted">{returns.period.label}</span>}
          />
          <YearOverYear rows={returns.yearly} />
        </Card>
      )}
    </div>
  );
}

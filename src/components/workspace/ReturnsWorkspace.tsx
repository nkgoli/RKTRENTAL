import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui';
import { SummaryBand } from '@/components/ui/SummaryBand';
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
      <SummaryBand
        label={`${title} returns`}
        eyebrow="Net operating income"
        value={moneyCents(returns.metrics.noiCents)}
        danger={returns.metrics.noiCents < 0}
        footer={
          <>
            <a
              className="btn btn-secondary btn-sm"
              href={`/roi-analysis?${new URLSearchParams({ property: propertyId, view: 'actual', ...periodParams(returns.period) })}`}
            >
              Compare {propertyName} with projections
            </a>
            {returns.unitId && (
              <span className={styles.footNote}>
                Unit income follows settled payments; property costs are shared by rent. Projections
                cover the whole property.
              </span>
            )}
          </>
        }
        stats={[
          { label: 'Cash flow', value: moneyCents(returns.metrics.cashFlowCents) },
          {
            label: 'Cap rate',
            value: percent(returns.metrics.capRate),
            detail:
              returns.metrics.capRate === null ? 'Add property value to calculate' : undefined,
          },
        ]}
      />
      <div className={styles.contentGrid}>
        <Card>
          <CardHeader title="Income vs expenses" />
          <IncomeExpenseChart rows={returns.monthly} label={`${title}: ${returns.period.label}`} />
        </Card>
        <Card>
          <CardHeader title="Income statement" />
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
          <CardHeader title="Year over year" />
          <YearOverYear rows={returns.yearly} />
        </Card>
      )}
    </div>
  );
}

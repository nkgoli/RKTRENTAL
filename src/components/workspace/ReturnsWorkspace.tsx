import Link from 'next/link';
import { Card, CardHeader, KpiIcon, TrendChip } from '@/components/ui';
import { RangePicker, YearOverYear } from '@/components/returns/RangePicker';
import { formatMoney } from '@/lib/properties/format';
import { returnsMonthLabels, type ScopedReturns } from '@/lib/metrics/scoped';
import styles from './ReturnsWorkspace.module.css';

const moneyCents = (amount: number) => formatMoney(amount / 100);
const percent = (value: number | null) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;

function IncomeExpenseChart({ returns, title }: { returns: ScopedReturns; title: string }) {
  const rows = returns.monthly;
  const labels = returnsMonthLabels(rows);
  const max = Math.max(1, ...rows.flatMap((row) => [row.incomeCents, row.expensesCents]));
  const width = 720;
  const height = 210;
  const base = 164;
  const group = width / Math.max(rows.length, 1);
  const barWidth = Math.min(13, group * 0.32);
  const labelEvery = Math.ceil(rows.length / 12);
  return <div className={styles.chartWrap}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} ${returns.period.granularity === 'quarter' ? 'quarterly' : 'monthly'} income versus expenses over the selected range`} className={styles.chart}>
      {[0, 1, 2].map((line) => <line key={line} x1="0" x2={width} y1={base - line * 55} y2={base - line * 55} className={styles.gridLine} />)}
      {rows.map((row, index) => {
        const center = index * group + group / 2;
        const incomeHeight = Math.max(row.incomeCents ? 2 : 0, (row.incomeCents / max) * 135);
        const expenseHeight = Math.max(row.expensesCents ? 2 : 0, (row.expensesCents / max) * 135);
        return <g key={row.month}>
          <rect x={center - barWidth - 2} y={base - incomeHeight} width={barWidth} height={incomeHeight} rx="4" className={styles.incomeBar} />
          <rect x={center + 2} y={base - expenseHeight} width={barWidth} height={expenseHeight} rx="4" className={styles.expenseBar} />
          {index % labelEvery === 0 && <text x={center} y="192" textAnchor="middle" className={styles.monthLabel}>{labels[index]}</text>}
        </g>;
      })}
    </svg>
    <div className={styles.legend}><span><i className={styles.incomeSwatch} />Income</span><span><i className={styles.expenseSwatch} />Expenses</span></div>
  </div>;
}

function ReturnMetric({ label, value, icon, tone, note }: {
  label: string; value: string; icon: string; tone: 'blue' | 'green' | 'coral'; note: string;
}) {
  return <Card className={styles.metricCard}>
    <div className={styles.metricTop}><KpiIcon tone={tone}>{icon}</KpiIcon><TrendChip>{note}</TrendChip></div>
    <p>{label}</p><strong>{value}</strong>
  </Card>;
}

export function ReturnsWorkspace({ returns, propertyId, propertyName, now }: {
  returns: ScopedReturns;
  propertyId: string;
  propertyName: string;
  now?: Date;
}) {
  const title = returns.unitNumber ? `Unit ${returns.unitNumber}` : propertyName;
  const rangeLabel = returns.period.key === '12M' ? '12 months' : returns.period.label;
  return <div className={styles.page}>
    <RangePicker
      period={returns.period}
      basePath={`/properties/${propertyId}/returns`}
      extra={returns.unitId ? { unit: returns.unitId } : {}}
      now={now}
    />
    <div className={styles.metricGrid}>
      <ReturnMetric label="Net operating income" value={moneyCents(returns.metrics.noiCents)} icon="↗" tone="green" note={rangeLabel} />
      <ReturnMetric label="Cash flow" value={moneyCents(returns.metrics.cashFlowCents)} icon="↔" tone="blue" note="After debt" />
      <ReturnMetric label="Cap rate" value={percent(returns.metrics.capRate)} icon="%" tone="coral" note={rangeLabel} />
    </div>
    <div className={styles.contentGrid}>
      <Card>
        <CardHeader title="Income vs expenses" action={<span className="muted">{returns.period.label}</span>} />
        <IncomeExpenseChart returns={returns} title={title} />
      </Card>
      <Card>
        <CardHeader title="Income statement" action={<span className="muted">{returns.period.label}</span>} />
        <dl className={styles.statement}>
          <dt>Rent collected</dt><dd>{moneyCents(returns.metrics.incomeCents)}</dd>
          <dt>Operating expenses</dt><dd>−{moneyCents(returns.metrics.expensesCents)}</dd>
          <dt><strong>Net operating income</strong></dt><dd><strong>{moneyCents(returns.metrics.noiCents)}</strong></dd>
          <dt>Debt service</dt><dd>−{moneyCents(returns.metrics.debtServiceCents)}</dd>
          <dt><strong>Cash flow</strong></dt><dd><strong>{moneyCents(returns.metrics.cashFlowCents)}</strong></dd>
        </dl>
        {returns.unitId && <p className={styles.rollup}>Rolls up into <Link href={`/properties/${propertyId}/returns`}>{propertyName} returns</Link> and <Link href="/returns">portfolio returns</Link>.</p>}
      </Card>
    </div>
    {returns.yearly.length > 1 && <Card>
      <CardHeader title="Year over year" action={<span className="muted">{returns.period.label}</span>} />
      <YearOverYear rows={returns.yearly} />
    </Card>}
  </div>;
}

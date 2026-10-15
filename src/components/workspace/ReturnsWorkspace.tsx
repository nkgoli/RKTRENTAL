import Link from 'next/link';
import { Card, CardHeader, KpiIcon, OccupancyRing, Sparkline, TrendChip } from '@/components/ui';
import { formatMoney } from '@/lib/properties/format';
import { returnsMonthLabels, type ScopedReturns } from '@/lib/metrics/scoped';
import styles from './ReturnsWorkspace.module.css';

export type ReturnUnitRow = {
  id: string;
  number: string;
  returns: ScopedReturns;
  currentRent: number | null;
  listedRent: number | null;
  marketRent: number | null;
};

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
  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} monthly income versus expenses over the last twelve months`} className={styles.chart}>
        {[0, 1, 2].map((line) => <line key={line} x1="0" x2={width} y1={base - line * 55} y2={base - line * 55} className={styles.gridLine} />)}
        {rows.map((row, index) => {
          const center = index * group + group / 2;
          const incomeHeight = Math.max(row.incomeCents ? 2 : 0, (row.incomeCents / max) * 135);
          const expenseHeight = Math.max(row.expensesCents ? 2 : 0, (row.expensesCents / max) * 135);
          return <g key={row.month}>
            <rect x={center - barWidth - 2} y={base - incomeHeight} width={barWidth} height={incomeHeight} rx="4" className={styles.incomeBar} />
            <rect x={center + 2} y={base - expenseHeight} width={barWidth} height={expenseHeight} rx="4" className={styles.expenseBar} />
            <text x={center} y="192" textAnchor="middle" className={styles.monthLabel}>{labels[index]}</text>
          </g>;
        })}
      </svg>
      <div className={styles.legend}><span><i className={styles.incomeSwatch} />Income</span><span><i className={styles.expenseSwatch} />Expenses</span></div>
    </div>
  );
}

function ReturnMetric({ label, value, icon, tone = 'blue', note }: { label: string; value: string; icon: string; tone?: 'blue' | 'green' | 'coral'; note: string }) {
  return <Card className={styles.metricCard}>
    <div className={styles.metricTop}><KpiIcon tone={tone}>{icon}</KpiIcon><TrendChip>{note}</TrendChip></div>
    <p>{label}</p><strong>{value}</strong>
  </Card>;
}

function ExpenseBreakdown({ returns }: { returns: ScopedReturns }) {
  const total = returns.expenseBreakdown.reduce((sum, row) => sum + row.amountCents, 0);
  return <Card>
    <CardHeader title="Expense breakdown" action={<span className="muted">{moneyCents(total)} total</span>} />
    {returns.expenseBreakdown.length ? <div className={styles.expenseList}>
      {returns.expenseBreakdown.map((row) => {
        const share = total ? (row.amountCents / total) * 100 : 0;
        return <div key={row.category} className={styles.expenseRow}>
          <div><strong>{row.label}</strong><span>{moneyCents(row.amountCents)} · {share.toFixed(1)}%</span></div>
          <div className={styles.expenseTrack}><i style={{ width: `${share}%` }} /></div>
        </div>;
      })}
    </div> : <p className="muted">No expenses recorded for this period.</p>}
  </Card>;
}

function UnitReturnsTable({ propertyId, units }: { propertyId: string; units: ReturnUnitRow[] }) {
  return <Card flush>
    <CardHeader title="Returns by unit" action={<span className="muted">{units.length} units</span>} />
    <div className={styles.tableWrap}>
      <table className="table" aria-label="Returns by unit">
        <thead><tr><th>Unit</th><th className="num">Collected</th><th className="num">Expenses</th><th className="num">NOI</th><th className="num">Occupancy</th><th className="num">Market gap</th></tr></thead>
        <tbody>
          {units.length === 0 && <tr><td colSpan={6} className="muted">No active units to report.</td></tr>}
          {units.map((unit) => {
            const comparisonRent = unit.currentRent ?? unit.listedRent;
            const gap = unit.marketRent != null && comparisonRent != null ? unit.marketRent - comparisonRent : null;
            return <tr key={unit.id}>
              <td><Link href={`/properties/${propertyId}/units/${unit.id}?tab=returns`} className={styles.unitLink}><strong>{unit.number}</strong></Link></td>
              <td className="num">{moneyCents(unit.returns.collectedCents)}</td>
              <td className="num">{moneyCents(unit.returns.metrics.expensesCents)}</td>
              <td className="num"><strong>{moneyCents(unit.returns.metrics.noiCents)}</strong></td>
              <td className="num">{unit.returns.occupancy}%</td>
              <td className="num">{gap == null ? '—' : `${gap >= 0 ? '+' : '−'}${formatMoney(Math.abs(gap))}`}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </Card>;
}

export function ReturnsWorkspace({
  returns,
  propertyId,
  propertyName,
  unitRows,
  unitRent,
}: {
  returns: ScopedReturns;
  propertyId: string;
  propertyName: string;
  unitRows?: ReturnUnitRow[];
  unitRent?: { listedRent: number | null; marketRent: number | null };
}) {
  const collectionPct = returns.dueCents ? Math.min(100, (returns.collectedCents / returns.dueCents) * 100) : 0;
  const incomeSeries = returns.monthly.map((row) => row.incomeCents);
  const title = returns.unitNumber ? `Unit ${returns.unitNumber}` : propertyName;

  return <div className={styles.page}>
    <div className={styles.metricGrid}>
      <ReturnMetric label="Net operating income" value={moneyCents(returns.metrics.noiCents)} icon="↗" tone="green" note="12 months" />
      <ReturnMetric label="Cash flow" value={moneyCents(returns.metrics.cashFlowCents)} icon="↔" tone="blue" note="After debt" />
      <ReturnMetric label="Cap rate" value={percent(returns.metrics.capRate)} icon="%" tone="coral" note="12 months" />
      <ReturnMetric label="Cash-on-cash" value={percent(returns.metrics.cashOnCash)} icon="◎" tone="blue" note="12 months" />
      <Card className={styles.metricCard}>
        <div className={styles.metricTop}><KpiIcon tone="green">◌</KpiIcon><TrendChip>{returns.occupiedUnits} / {returns.totalUnits} units</TrendChip></div>
        <p>Occupancy</p><div className={styles.occupancy}><OccupancyRing value={returns.occupancy} label={`${title} occupancy ${returns.occupancy}%`} /><span>{returns.occupancy}%</span></div>
      </Card>
      <Card className={styles.metricCard}>
        <div className={styles.metricTop}><KpiIcon tone="coral">$</KpiIcon><TrendChip>{returns.dueCents ? `${Math.round(collectionPct)}% collected` : 'No active rent'}</TrendChip></div>
        <p>Collected vs due</p><strong>{moneyCents(returns.collectedCents)} <small>/ {moneyCents(returns.dueCents)}</small></strong>
        <div className={styles.progressTrack}><i style={{ width: `${collectionPct}%` }} /></div>
        <Sparkline values={incomeSeries} tone="ok" label={`${title} monthly collected rent`} />
      </Card>
    </div>
    <div className={styles.contentGrid}>
      <Card>
        <CardHeader title="Income vs expenses" action={<span className="muted">{returns.period.label}</span>} />
        <IncomeExpenseChart returns={returns} title={title} />
      </Card>
      <ExpenseBreakdown returns={returns} />
      {unitRent && <Card>
        <CardHeader title="Rent vs market" action={<Link href={`/properties/${propertyId}/units/${returns.unitId}?tab=listing`}>See rent comps</Link>} />
        <div className={styles.rentComparison}>
          <div><span>Listed rent</span><strong>{formatMoney(unitRent.listedRent)}</strong></div>
          <div><span>Market rent</span><strong>{formatMoney(unitRent.marketRent)}</strong></div>
          <p className="muted">Market rent is the saved estimate for this unit. See rent comps for a current comparable-rent search.</p>
        </div>
      </Card>}
      <Card>
        <CardHeader title="Income statement" action={<TrendChip>12 mo</TrendChip>} />
        <dl className={styles.statement}>
          <dt>Rent collected</dt><dd>{moneyCents(returns.metrics.incomeCents)}</dd>
          <dt>Operating expenses</dt><dd>−{moneyCents(returns.metrics.expensesCents)}</dd>
          <dt><strong>Net operating income</strong></dt><dd><strong>{moneyCents(returns.metrics.noiCents)}</strong></dd>
          <dt>Debt service</dt><dd>−{moneyCents(returns.metrics.debtServiceCents)}</dd>
          <dt><strong>Cash flow</strong></dt><dd><strong>{moneyCents(returns.metrics.cashFlowCents)}</strong></dd>
        </dl>
        <p className={styles.rollup}>Rolls up into <Link href={`/properties/${propertyId}?tab=returns`}>{propertyName} returns</Link> and <Link href="/returns">portfolio returns</Link>.</p>
      </Card>
    </div>
    {unitRows && <UnitReturnsTable propertyId={propertyId} units={unitRows} />}
  </div>;
}

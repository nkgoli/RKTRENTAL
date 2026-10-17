import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/RouteStates';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { trendOf } from '@/components/dashboard/trend';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert, Progress } from '@/components/ui/Feedback';
import { Field, FormRow, Input, Select } from '@/components/ui/Forms';
import { requireManagerRole } from '@/lib/auth/access';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/expenses';
import { formatMoney } from '@/lib/properties/format';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import {
  formatPercent,
  loadReturnsOverview,
  periodParams,
  resolveReturnsPeriod,
  bucketLabel,
} from '@/lib/returns';
import { RangePicker, YearOverYear } from '@/components/returns/RangePicker';
import { addExpenseAction } from './actions';

export const dynamic = 'force-dynamic';

/** Returns are summaries: whole dollars, like the rest of the reports. */
const formatUsd = (cents: number) => formatMoney(Math.round(cents) / 100);

type SearchParams = Promise<{
  period?: string;
  from?: string;
  to?: string;
  property?: string;
  notice?: string;
  add?: string;
}>;

const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  'expense-added': { tone: 'success', text: 'Expense added. The returns below now include it.' },
  'expense-invalid': {
    tone: 'warning',
    text: 'Check the expense details: choose a property and category, enter an amount above zero and a valid date.',
  },
};

const returnsHref = (propertyId: string) => `/properties/${propertyId}?tab=returns`;

export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const now = new Date();
  const period = await resolveReturnsPeriod(session.organizationId, params, now);
  const periodKey = period.key;
  const range = periodParams(period);
  const overview = await loadReturnsOverview(session.organizationId, period);
  const selected =
    overview.properties.find((p) => p.propertyId === params.property) ?? null;
  const scope = selected ?? overview.portfolio;
  const notice = params.notice ? notices[params.notice] : undefined;
  const adding = params.add !== undefined;
  const query = (extra: Record<string, string> = {}) =>
    new URLSearchParams({
      ...range,
      ...(selected ? { property: selected.propertyId } : {}),
      ...extra,
    }).toString();
  const exportHref = `/returns/export?${query()}`;
  const metrics = scope?.metrics;
  const occupancy =
    overview.totalUnits > 0
      ? Math.round((overview.occupiedUnits / overview.totalUnits) * 100)
      : 0;
  const maxMonthly = Math.max(
    1,
    ...overview.monthly.map((m) => Math.max(m.incomeCents, m.expensesCents)),
  );
  const maxNoi = Math.max(1, ...overview.properties.map((p) => p.metrics.noiCents));
  const noiSeries = overview.monthly.map((m) => m.incomeCents - m.expensesCents);
  const expenseSeries = overview.monthly.map((m) => m.expensesCents);
  const noiTrend = selected ? null : trendOf(noiSeries);
  const expenseTrend = selected ? null : trendOf(expenseSeries, false);
  const totalExpenses = overview.expenseBreakdown.reduce((s, e) => s + e.amountCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Returns and metrics"
        actions={[
          { label: 'Owner payouts', href: '/payments' },
          { label: 'Export report', href: exportHref, primary: true },
        ]}
      />
      {notice && (
        <Alert tone={notice.tone}>
          <div>{notice.text}</div>
        </Alert>
      )}

      <section className="toolbar">
        <RangePicker
          period={period}
          basePath="/returns"
          extra={selected ? { property: selected.propertyId } : {}}
          now={now}
        />
        <form method="get" className="row">
          {Object.entries(range).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Field label="Property">
            <AutoSubmitSelect name="property" defaultValue={selected?.propertyId ?? 'all'}>
              <option value="all">All properties ({overview.properties.length})</option>
              {overview.properties.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  {p.propertyName}
                </option>
              ))}
            </AutoSubmitSelect>
          </Field>
          <noscript>
            <Button type="submit" variant="secondary" size="sm">
              Show
            </Button>
          </noscript>
        </form>
      </section>

      {metrics && (
        <section className="kpis three">
          <KpiCard
            label="Net operating income"
            value={formatUsd(metrics.noiCents)}
            note="Income less expenses"
            trend={noiTrend?.label}
            trendWarm={noiTrend?.warm}
            spark={selected ? undefined : noiSeries}
            sparkTone="ok"
            sparkLabel="Monthly NOI"
          />
          <KpiCard
            label="Cash flow"
            value={formatUsd(metrics.cashFlowCents)}
            note={`After ${formatUsd(metrics.debtServiceCents)} debt service`}
          />
          <KpiCard
            label="Cap rate"
            value={formatPercent(metrics.capRate)}
            note="NOI on property value"
          />
          <KpiCard
            label="Cash-on-cash return"
            value={formatPercent(metrics.cashOnCash)}
            note={`On ${metrics.cashInvestedCents ? formatUsd(metrics.cashInvestedCents) : '—'} invested`}
          />
          <KpiCard
            label="Occupancy"
            value={`${occupancy}%`}
            note={`${overview.occupiedUnits} of ${overview.totalUnits} units`}
            ring={occupancy}
            ringLabel={`${occupancy}% occupied`}
          />
          <KpiCard
            label="Expense ratio"
            value={formatPercent(metrics.expenseRatio)}
            note="Of income"
            trend={expenseTrend?.label}
            trendWarm={expenseTrend?.warm}
            spark={selected ? undefined : expenseSeries}
            sparkTone="warm"
            sparkLabel="Monthly expenses"
          />
        </section>
      )}

      <section className="split">
        <Card>
          <div className="card-header">
            <div>
              <h3>Income vs expenses</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {period.granularity === 'quarter' ? 'Quarterly' : 'Monthly'}, {selected ? selected.propertyName : 'portfolio total'}
              </p>
            </div>
          </div>
          <svg
            viewBox="0 0 720 200"
            style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 220 }}
            role="img"
            aria-label={`${period.granularity === 'quarter' ? 'Quarterly' : 'Monthly'} income versus expenses for the selected period`}
          >
            {overview.monthly.map((point, index) => {
              const slot = 680 / overview.monthly.length;
              const barWidth = Math.min(14, slot * 0.4);
              const x = 20 + index * slot + (slot - 2 * barWidth - 2) / 2;
              const incomeHeight = (point.incomeCents / maxMonthly) * 150;
              const expenseHeight = (point.expensesCents / maxMonthly) * 150;
              const labelEvery = Math.ceil(overview.monthly.length / 12);
              return (
                <g key={point.month}>
                  <rect
                    x={x}
                    y={170 - incomeHeight}
                    width={barWidth}
                    height={incomeHeight}
                    rx={Math.min(4, barWidth / 3)}
                    fill="var(--design-primary)"
                  />
                  <rect
                    x={x + barWidth + 2}
                    y={170 - expenseHeight}
                    width={barWidth}
                    height={expenseHeight}
                    rx={Math.min(4, barWidth / 3)}
                    fill="var(--design-accent)"
                  />
                  {index % labelEvery === 0 && (
                    <text x={x} y={190} fontSize={11} fill="var(--design-muted)">
                      {bucketLabel(point.month, overview.monthly.length > 12)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="row" style={{ justifyContent: 'center', gap: 16, fontSize: 12, color: 'var(--design-muted)' }}>
            <span className="row" style={{ gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--design-primary)' }} />
              Income
            </span>
            <span className="row" style={{ gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--design-accent)' }} />
              Expenses
            </span>
          </div>
        </Card>
        <Card>
          <div className="card-header">
            <div>
              <h3>NOI by property</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {period.label}
              </p>
            </div>
          </div>
          <ul className="bar-list" aria-label="Net operating income by property">
            {overview.properties.map((property) => (
              <li key={property.propertyId}>
                <span className="bar-name">{property.propertyName}</span>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{ width: `${Math.max(0, (property.metrics.noiCents / maxNoi) * 100)}%` }}
                  />
                </span>
                <span className="bar-value">{formatUsd(property.metrics.noiCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {!selected && overview.yearly.length > 1 && (
        <Card>
          <CardHeader title="Year over year" action={<span className="muted">{period.label}</span>} />
          <YearOverYear rows={overview.yearly} />
        </Card>
      )}

      <section className="card flush">
        <div className="card-header">
          <div>
            <p className="eyebrow">{period.label}</p>
            <h3>Returns by property</h3>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            ROI includes 3% assumed appreciation · Yield is scheduled rent ÷ value
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Property</th>
              <th className="num">Income</th>
              <th className="num">Expenses</th>
              <th className="num">NOI</th>
              <th className="num">Cap rate</th>
              <th className="num">Cash-on-cash</th>
              <th className="num">ROI</th>
              <th className="num">Yield</th>
            </tr>
          </thead>
          <tbody>
            {overview.properties.map((property) => (
              <tr key={property.propertyId}>
                <td>
                  <Link
                    className="cell-main"
                    href={returnsHref(property.propertyId)}
                    style={{ color: 'inherit' }}
                  >
                    <span>
                      <strong>{property.propertyName}</strong>
                      <small>
                        {property.units} {property.units === 1 ? 'unit' : 'units'} · {property.occupied} occupied
                      </small>
                    </span>
                  </Link>
                </td>
                <td className="num">{formatUsd(property.metrics.incomeCents)}</td>
                <td className="num">{formatUsd(property.metrics.expensesCents)}</td>
                <td className="num">
                  <strong>{formatUsd(property.metrics.noiCents)}</strong>
                </td>
                <td className="num">{formatPercent(property.metrics.capRate)}</td>
                <td className="num">{formatPercent(property.metrics.cashOnCash)}</td>
                <td className="num">{formatPercent(property.metrics.roi)}</td>
                <td className="num">{formatPercent(property.metrics.yieldRate)}</td>
              </tr>
            ))}
            {overview.portfolio && (
              <tr style={{ background: 'var(--rr-subtle)' }}>
                <td>
                  <div className="cell-main">
                    <span>
                      <strong>Portfolio</strong>
                      <small>
                        {overview.portfolio.units} {overview.portfolio.units === 1 ? 'unit' : 'units'} · {overview.portfolio.occupied} occupied
                      </small>
                    </span>
                  </div>
                </td>
                <td className="num">
                  <strong>{formatUsd(overview.portfolio.metrics.incomeCents)}</strong>
                </td>
                <td className="num">
                  <strong>{formatUsd(overview.portfolio.metrics.expensesCents)}</strong>
                </td>
                <td className="num">
                  <strong>{formatUsd(overview.portfolio.metrics.noiCents)}</strong>
                </td>
                <td className="num">
                  <strong>{formatPercent(overview.portfolio.metrics.capRate)}</strong>
                </td>
                <td className="num">
                  <strong>{formatPercent(overview.portfolio.metrics.cashOnCash)}</strong>
                </td>
                <td className="num">
                  <strong>{formatPercent(overview.portfolio.metrics.roi)}</strong>
                </td>
                <td className="num">
                  <strong>{formatPercent(overview.portfolio.metrics.yieldRate)}</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="grid-2">
        <Card>
          <CardHeader
            title="Expense breakdown"
            action={
              <span className="muted" style={{ fontSize: 13 }}>
                {formatUsd(totalExpenses)} total
              </span>
            }
          />
          <div className="stack" style={{ gap: 14 }}>
            {overview.expenseBreakdown.length === 0 && (
              <EmptyState title="No expenses this period" description="Record an expense to include it in your returns." action="Add expense" href={`/returns?${query({ add: '1' })}`} />
            )}
            {overview.expenseBreakdown.map((entry) => (
              <div key={entry.category}>
                <div className="row between">
                  <strong>{entry.label}</strong>
                  <span>
                    {formatUsd(entry.amountCents)}{' '}
                    <span className="muted">
                      ·{' '}
                      {totalExpenses > 0
                        ? `${((entry.amountCents / totalExpenses) * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </span>
                </div>
                <Progress
                  value={totalExpenses > 0 ? (entry.amountCents / totalExpenses) * 100 : 0}
                  label={`${entry.label} share of expenses`}
                  style={{ marginTop: 6 }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button href={`/returns?${query({ add: '1' })}`} variant="secondary" size="sm">
              + Add expense
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Export report" />
          <div className="stack">
            <p className="muted">
              Download the returns summary, per-property table and expense detail for the selected
              period and properties.
            </p>
            <dl className="kv" style={{ gridTemplateColumns: '100px 1fr' }}>
              <dt>Period</dt>
              <dd>
                {periodKey} · {period.label}
              </dd>
              <dt>Scope</dt>
              <dd>{selected ? selected.propertyName : `All properties (${overview.properties.length})`}</dd>
              <dt>Includes</dt>
              <dd>NOI, cash flow, cap rate, cash-on-cash, ROI, yield</dd>
            </dl>
            <Button href={exportHref} variant="primary">
              Export report (CSV)
            </Button>
          </div>
        </Card>
      </section>

      {adding && (
        <Card>
          <CardHeader
            title="Add expense"
            action={
              <Button href={`/returns?${query()}`} size="sm" variant="ghost">
                Cancel
              </Button>
            }
          />
          <form action={addExpenseAction} className="form">
            {Object.entries(range).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="returnProperty" value={selected?.propertyId ?? 'all'} />
            <FormRow columns={3}>
              <Field label="Property">
                <Select name="propertyId" required defaultValue={selected?.propertyId}>
                  {overview.properties.map((p) => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.propertyName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Select name="category" required>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {EXPENSE_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount">
                <Input name="amount" inputMode="decimal" placeholder="250.00" required />
              </Field>
            </FormRow>
            <FormRow columns={3}>
              <Field label="Date">
                <Input name="occurredOn" type="date" required />
              </Field>
              <Field label="Vendor">
                <Input name="vendor" placeholder="Optional" />
              </Field>
              <Field label="Description">
                <Input name="description" placeholder="Optional" />
              </Field>
            </FormRow>
            <div className="row">
              <Button type="submit" variant="primary">
                Save expense
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}

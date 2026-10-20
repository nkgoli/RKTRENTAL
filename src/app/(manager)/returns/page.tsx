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
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/lib/expenses';
import { formatMoney } from '@/lib/properties/format';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { propertyReportActivity } from '@/components/returns/report-activity';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { IncomeExpenseChart } from '@/components/returns/IncomeExpenseChart';
import styles from '@/components/returns/returns.module.css';
import {
  formatPercent,
  loadReturnsOverview,
  periodParams,
  resolveReturnsPeriod,
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

export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const now = new Date();
  const period = await resolveReturnsPeriod(session.organizationId, params, now);
  const periodKey = period.key;
  const range = periodParams(period);
  const overview = await loadReturnsOverview(session.organizationId, period);
  const selected = overview.properties.find((p) => p.propertyId === params.property) ?? null;
  const scoped = selected
    ? await loadPropertyWorkspaceReturns(session.organizationId, selected.propertyId, period)
    : null;
  const activity = scoped ? propertyReportActivity(scoped) : overview;
  const { monthly, yearly, expenseBreakdown } = activity;
  const shownProperties = selected ? [selected] : overview.properties;
  const scope = selected ?? overview.portfolio;
  // A property's returns open in the combined Returns & ROI workspace, beside its projection.
  const returnsHref = (propertyId: string) =>
    `/roi-analysis?${new URLSearchParams({ property: propertyId, view: 'actual', ...range })}`;
  const notice = params.notice ? notices[params.notice] : undefined;
  const adding = params.add !== undefined || params.notice === 'expense-invalid';
  const query = (extra: Record<string, string> = {}) =>
    new URLSearchParams({
      ...range,
      ...(selected ? { property: selected.propertyId } : {}),
      ...extra,
    }).toString();
  const exportHref = `/returns/export?${query()}`;
  const metrics = scope?.metrics;
  const occupancy =
    (scope?.units ?? 0) > 0 ? Math.round(((scope?.occupied ?? 0) / (scope?.units ?? 1)) * 100) : 0;
  const maxNoi = Math.max(1, ...shownProperties.map((p) => Math.abs(p.metrics.noiCents)));
  const noiSeries = monthly.map((m) => m.incomeCents - m.expensesCents);
  const expenseSeries = monthly.map((m) => m.expensesCents);
  const noiTrend = selected ? null : trendOf(noiSeries);
  const expenseTrend = selected ? null : trendOf(expenseSeries, false);
  const totalExpenses = expenseBreakdown.reduce((s, e) => s + e.amountCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Returns & ROI"
        title="Portfolio returns"
        actions={[
          { label: 'Owner payouts', href: '/payments' },
          {
            label: selected ? 'Compare with projections' : 'Property analysis',
            href: selected ? returnsHref(selected.propertyId) : '/roi-analysis',
          },
          { label: 'Export report', href: exportHref, primary: true },
        ]}
      />
      {params.property && params.property !== 'all' && !selected && (
        <Alert tone="warning">
          <p>The selected property is unavailable. Showing the portfolio report.</p>
        </Alert>
      )}
      {notice && (
        <Alert tone={notice.tone}>
          <div>{notice.text}</div>
        </Alert>
      )}

      {params.period === 'CUSTOM' &&
        (period.key !== 'CUSTOM' || params.from !== range.from || params.to !== range.to) && (
          <Alert tone="warning">
            <p>
              The date range was adjusted to valid months through the current month. Review the
              displayed range before exporting.
            </p>
          </Alert>
        )}
      <section className={styles.toolbar} aria-label="Report filters">
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

      <p className={styles.context}>
        {selected?.propertyName ?? 'Portfolio'} · {period.label}. Income follows settled payments.
        Returns use the selected period; occupancy is current. Open a property to compare its
        recorded returns with ROI projections.
      </p>
      <Alert tone="warning">
        <p>
          These portfolio figures are month-based summaries, not recorded-only results. Cash flow
          and cash-on-cash subtract scheduled debt service (loan payments are not recorded), ROI
          adds 3%/yr assumed appreciation, yield uses scheduled rent, and a month without expense
          records counts as here. For recorded actuals with coverage, open a property&rsquo;s{' '}
          <strong>Actual vs projected</strong>.
        </p>
      </Alert>
      {overview.properties.length === 0 && (
        <EmptyState
          title="No properties to report"
          description="Add a property to start tracking income, expenses and returns."
          action="View properties"
          href="/properties"
        />
      )}
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
            note={`Estimate: after ${formatUsd(metrics.debtServiceCents)} scheduled debt service, not recorded loan payments`}
          />
          <KpiCard
            label="Cap rate"
            value={formatPercent(metrics.capRate)}
            note={
              metrics.capRate === null
                ? 'Add property value to calculate'
                : 'Period NOI on property value'
            }
          />
          <KpiCard
            label="Cash-on-cash return"
            value={formatPercent(metrics.cashOnCash)}
            note={`Estimate on ${metrics.cashInvestedCents ? formatUsd(metrics.cashInvestedCents) : '—'} invested · scheduled debt`}
          />
          <KpiCard
            label="Occupancy"
            value={`${occupancy}%`}
            note={`${scope?.occupied ?? 0} of ${scope?.units ?? 0} units · current occupancy`}
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
                {period.granularity === 'quarter' ? 'Quarterly' : 'Monthly'},{' '}
                {selected ? selected.propertyName : 'portfolio total'}
              </p>
            </div>
          </div>
          <IncomeExpenseChart
            rows={monthly}
            label={`${selected?.propertyName ?? 'Portfolio'}: ${period.label}`}
          />
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
          <ul className={styles.barList} aria-label="Net operating income by property">
            {shownProperties.map((property) => (
              <li key={property.propertyId}>
                <Link href={returnsHref(property.propertyId)}>{property.propertyName}</Link>
                <strong>{formatUsd(property.metrics.noiCents)}</strong>
                <span className={styles.track}>
                  <span
                    className={styles.fill}
                    style={{ width: `${(Math.abs(property.metrics.noiCents) / maxNoi) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {yearly.length > 1 && (
        <Card>
          <CardHeader
            title="Year over year"
            action={<span className="muted">{period.label}</span>}
          />
          <YearOverYear rows={yearly} />
        </Card>
      )}

      <section className="card flush">
        <div className="card-header">
          <div>
            <p className="eyebrow">{period.label}</p>
            <h3>Returns by property</h3>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            Estimates: ROI adds 3%/yr assumed appreciation · cash-on-cash uses scheduled debt
            service · yield is scheduled rent ÷ value
          </span>
        </div>
        <div
          className={styles.tableScroll}
          role="region"
          aria-label="Returns by property"
          tabIndex={0}
        >
          <table className="table" aria-label="Returns by property">
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col" className="num">
                  Income
                </th>
                <th scope="col" className="num">
                  Expenses
                </th>
                <th scope="col" className="num">
                  NOI
                </th>
                <th scope="col" className="num">
                  Cap rate
                </th>
                <th scope="col" className="num">
                  Cash-on-cash (est.)
                </th>
                <th scope="col" className="num">
                  ROI (est.)
                </th>
                <th scope="col" className="num">
                  Yield (sched.)
                </th>
              </tr>
            </thead>
            <tbody>
              {shownProperties.map((property) => (
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
                          {property.units} {property.units === 1 ? 'unit' : 'units'} ·{' '}
                          {property.occupied} occupied
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
              {!selected && overview.portfolio && (
                <tr style={{ background: 'var(--rr-subtle)' }}>
                  <td>
                    <div className="cell-main">
                      <span>
                        <strong>Portfolio</strong>
                        <small>
                          {overview.portfolio.units}{' '}
                          {overview.portfolio.units === 1 ? 'unit' : 'units'} ·{' '}
                          {overview.portfolio.occupied} occupied
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
        </div>
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
            {expenseBreakdown.length === 0 && (
              <EmptyState
                title="No expenses this period"
                description="Record an expense to include it in your returns."
                action="Add expense"
                href={`/returns?${query({ add: '1' })}#add-expense`}
              />
            )}
            {expenseBreakdown.map((entry) => (
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
            <Button
              href={`/returns?${query({ add: '1' })}#add-expense`}
              variant="secondary"
              size="sm"
            >
              + Add expense
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Export report" />
          <div className="stack">
            <p className="muted">
              Download the returns summary with income and expense totals for the selected period
              and properties.
            </p>
            <dl className="kv" style={{ gridTemplateColumns: '100px 1fr' }}>
              <dt>Period</dt>
              <dd>
                {periodKey} · {period.label}
              </dd>
              <dt>Scope</dt>
              <dd>
                {selected
                  ? selected.propertyName
                  : `All properties (${overview.properties.length})`}
              </dd>
              <dt>Includes</dt>
              <dd>
                NOI and cap rate from recorded income and expenses; cash flow, cash-on-cash, ROI and
                yield as labelled estimates (scheduled debt, assumed appreciation, scheduled rent)
              </dd>
            </dl>
            <Button href={exportHref} variant="primary">
              Export report (CSV)
            </Button>
          </div>
        </Card>
      </section>

      {adding && (
        <Card id="add-expense">
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
                <Select name="propertyId" required defaultValue={selected?.propertyId ?? ''}>
                  <option value="" disabled>
                    Choose a property
                  </option>
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

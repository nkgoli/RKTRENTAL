import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/RouteStates';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Stat } from '@/components/ui/Card';
import { Alert, Progress } from '@/components/ui/Feedback';
import { Field, FormRow, Input, Select } from '@/components/ui/Forms';
import { requireManagerRole } from '@/lib/auth/access';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/expenses';
import { formatUsd } from '@/lib/ledger';
import {
  formatPercent,
  loadReturnsOverview,
  periodKeyFrom,
  resolvePeriod,
  PERIOD_KEYS,
  type PeriodKey,
} from '@/lib/returns';
import { addExpenseAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  period?: string;
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const periodKey: PeriodKey = periodKeyFrom(params.period);
  const period = resolvePeriod(periodKey, new Date());
  const overview = await loadReturnsOverview(session.organizationId, period);
  const selected =
    overview.properties.find((p) => p.propertyId === params.property) ?? null;
  const scope = selected ?? overview.portfolio;
  const notice = params.notice ? notices[params.notice] : undefined;
  const adding = params.add !== undefined;
  const exportHref = `/returns/export?period=${periodKey}${selected ? `&property=${selected.propertyId}` : ''}`;
  const periodHref = (key: PeriodKey) =>
    `/returns?period=${key}${selected ? `&property=${selected.propertyId}` : ''}`;
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
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="chips" style={{ flexWrap: 'nowrap' }}>
            {PERIOD_KEYS.map((key) => (
              <Link
                key={key}
                className={`chip${periodKey === key ? ' active' : ''}`}
                href={periodHref(key)}
              >
                {key}
              </Link>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
            {period.label}
          </span>
        </div>
        <form method="get" className="row">
          <input type="hidden" name="period" value={periodKey} />
          <Field label="Property">
            <Select name="property" defaultValue={selected?.propertyId ?? 'all'}>
              <option value="all">All properties ({overview.properties.length})</option>
              {overview.properties.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  {p.propertyName}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary" size="sm">
            Apply
          </Button>
        </form>
      </section>

      {metrics && (
        <section className="grid-3">
          <Stat label="Net operating income" value={formatUsd(metrics.noiCents)} />
          <Stat
            label="Cash flow"
            value={formatUsd(metrics.cashFlowCents)}
            delta={`After ${formatUsd(metrics.debtServiceCents)} debt service`}
          />
          <Stat
            label="Cap rate"
            value={formatPercent(metrics.capRate)}
            delta="NOI on portfolio value"
          />
          <Stat
            label="Cash-on-cash return"
            value={formatPercent(metrics.cashOnCash)}
            delta={`On ${metrics.cashInvestedCents ? formatUsd(metrics.cashInvestedCents) : '—'} invested`}
          />
          <Stat
            label="Occupancy"
            value={`${occupancy}%`}
            delta={`${overview.occupiedUnits} of ${overview.totalUnits} units`}
            progress={occupancy}
          />
          <Stat
            label="Expense ratio"
            value={formatPercent(metrics.expenseRatio)}
            delta={`${formatUsd(metrics.expensesCents)} of ${formatUsd(metrics.incomeCents)} income`}
          />
        </section>
      )}

      <section className="split">
        <Card>
          <div className="card-header">
            <div>
              <h3>Income vs expenses</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                Monthly, portfolio total
              </p>
            </div>
          </div>
          <svg
            viewBox="0 0 640 240"
            width="100%"
            role="img"
            aria-label="Monthly income versus expenses for the selected period"
          >
            {overview.monthly.map((point, index) => {
              const x = 50 + index * 48;
              const incomeHeight = (point.incomeCents / maxMonthly) * 160;
              const expenseHeight = (point.expensesCents / maxMonthly) * 160;
              return (
                <g key={point.month}>
                  <rect
                    x={x}
                    y={210 - incomeHeight}
                    width={16}
                    height={incomeHeight}
                    rx={4}
                    fill="var(--design-primary)"
                  />
                  <rect
                    x={x + 18}
                    y={210 - expenseHeight}
                    width={16}
                    height={expenseHeight}
                    rx={4}
                    fill="#94a3b8"
                  />
                  <text x={x} y={230} fontSize={11} fill="var(--design-muted)">
                    {point.month.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>
          {metrics && (
            <div className="row" style={{ marginTop: 8 }}>
              <Badge tone="info">Income {formatUsd(metrics.incomeCents)}</Badge>
              <Badge>Expenses {formatUsd(metrics.expensesCents)}</Badge>
              <Badge>NOI {formatUsd(metrics.noiCents)}</Badge>
            </div>
          )}
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
          <svg
            viewBox="0 0 320 220"
            width="100%"
            role="img"
            aria-label="Net operating income by property"
          >
            {overview.properties.map((property, index) => {
              const y = 16 + index * 52;
              const width = Math.max(0, (property.metrics.noiCents / maxNoi) * 220);
              return (
                <g key={property.propertyId}>
                  <text x={0} y={y} fontSize={12} fontWeight={600} fill="var(--design-text)">
                    {property.propertyName}
                  </text>
                  <rect x={0} y={y + 6} width={width} height={24} rx={6} fill="var(--design-primary)" />
                  <text x={width + 8} y={y + 23} fontSize={12} fill="var(--design-muted)">
                    {formatUsd(property.metrics.noiCents)}
                  </text>
                </g>
              );
            })}
          </svg>
        </Card>
      </section>

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
        <table className="table" style={{ marginTop: 12 }}>
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
                    href={`/properties/${property.propertyId}`}
                    style={{ color: 'inherit' }}
                  >
                    <Avatar initials={initials(property.propertyName)} size="sm" />
                    <span>
                      <strong>{property.propertyName}</strong>
                      <small>
                        {property.units} units · {property.occupied} occupied
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
                    <Avatar initials="Σ" size="sm" />
                    <span>
                      <strong>Portfolio</strong>
                      <small>
                        {overview.portfolio.units} units · {overview.portfolio.occupied} occupied
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
              <EmptyState title="No expenses this period" description="Record an expense to include it in your returns." action="Add expense" href={`/returns?period=${periodKey}&add=1`} />
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
            <Button href={`/returns?period=${periodKey}&add=1`} variant="secondary" size="sm">
              + Add expense
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Export report" action={<Badge tone="info">Owner-ready</Badge>} />
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
            <Alert>
              <div>
                Figures follow the payments ledger. Owner payouts are listed on{' '}
                <Link href="/payments">Payments</Link>.
              </div>
            </Alert>
          </div>
        </Card>
      </section>

      {adding && (
        <Card>
          <CardHeader
            title="Add expense"
            action={
              <Button href={`/returns?period=${periodKey}`} size="sm" variant="ghost">
                Cancel
              </Button>
            }
          />
          <form action={addExpenseAction} className="form">
            <input type="hidden" name="period" value={periodKey} />
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

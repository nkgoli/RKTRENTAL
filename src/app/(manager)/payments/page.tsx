import Link from 'next/link';
import { EmptyState } from '@/components/RouteStates';
import { PageHeader } from '@/components/shell/PageHeader';
import { Alert } from '@/components/ui/Feedback';
import { Badge, Avatar } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Pagination, PAGE_SIZE, pageFrom, paginate } from '@/components/ui/Pagination';
import { Field, FormRow, Input, Select } from '@/components/ui/Forms';
import { Progress } from '@/components/ui/Feedback';
import { requireManagerRole } from '@/lib/auth/access';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom, scopeQuery } from '@/lib/workspace/scope';
import {
  addMonths,
  ensureRentCharges,
  formatUsd,
  loadPaymentsOverview,
  monthKey,
  monthStart,
  type RentRollRow,
  type RentStatus,
} from '@/lib/ledger';
import {
  applyLateFeeAction,
  recordPaymentAction,
  refundPaymentAction,
  runPayoutsAction,
} from './actions';

import { parseMonthInput } from '@/lib/returns/period';
import styles from './payments.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  month?: string;
  filter?: string;
  record?: string;
  notice?: string;
  propertyId?: string;
  unitId?: string;
  page?: string;
}>;

const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  'payment-recorded': { tone: 'success', text: 'Payment recorded and applied to the ledger.' },
  'payment-duplicate': { tone: 'success', text: 'That payment was already recorded.' },
  'payment-failed': { tone: 'warning', text: 'The payment could not be recorded.' },
  'invalid-amount': { tone: 'warning', text: 'Enter an amount greater than zero, like 1,850.00.' },
  'fee-applied': { tone: 'success', text: 'Late fee added to the tenant ledger.' },
  'fee-already-applied': { tone: 'warning', text: 'A late fee was already applied this month.' },
  'fee-in-grace': { tone: 'warning', text: 'Rent is still inside its grace period.' },
  'fee-paid': { tone: 'warning', text: 'Rent is paid, so no late fee applies.' },
  'fee-no-fee': { tone: 'warning', text: 'This lease does not charge a late fee.' },
  'fee-no-rent-charge': { tone: 'warning', text: 'There is no rent charge for that month.' },
  refunded: { tone: 'success', text: 'Payment refunded.' },
  'refund-duplicate': { tone: 'success', text: 'That refund was already processed.' },
  'refund-failed': { tone: 'warning', text: 'The refund could not be processed.' },
  'payouts-sent': { tone: 'success', text: 'Owner payouts sent.' },
  'payouts-none': { tone: 'success', text: 'No owner payouts are waiting to be sent.' },
};

const badge: Record<RentStatus, { tone: BadgeTone; label: string }> = {
  PAID: { tone: 'success', label: 'Paid' },
  PENDING: { tone: 'warning', label: 'Pending' },
  LATE: { tone: 'danger', label: 'Late' },
  AUTOPAY: { tone: 'info', label: 'Autopay' },
};

const monthLabel = (month: string) =>
  monthStart(month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function filterRows(rows: RentRollRow[], filter: string) {
  if (filter === 'paid') return rows.filter((r) => r.status === 'PAID');
  if (filter === 'open') return rows.filter((r) => r.status !== 'PAID');
  if (filter === 'late') return rows.filter((r) => r.status === 'LATE');
  return rows;
}

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const now = new Date();
  const month = parseMonthInput(params.month) ? (params.month as string) : monthKey(now);
  const scope = scopeFilterFrom(params);
  const scopeParams = scopeQuery(scope).toString();
  const scopeSuffix = scopeParams ? `&${scopeParams}` : '';
  const filter = ['paid', 'open', 'late'].includes(params.filter ?? '')
    ? (params.filter as string)
    : 'all';

  // Idempotent: only creates rent charges that do not exist yet.
  await ensureRentCharges(session.organizationId, now);
  const overview = await loadPaymentsOverview(session.organizationId, month, now, undefined, scope);
  const filtered = filterRows(overview.rows, filter);
  const page = pageFrom(params.page, filtered.length);
  const rows = paginate(filtered, page);
  const filterQuery = filter === 'all' ? '' : `&filter=${filter}`;
  const notice = params.notice ? notices[params.notice] : undefined;
  const recording = params.record !== undefined;
  const returnFields = (
    <>
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="filter" value={filter} />
      {scope.propertyId && <input type="hidden" name="propertyId" value={scope.propertyId} />}
      {scope.unitId && <input type="hidden" name="unitId" value={scope.unitId} />}
    </>
  );
  const chip = (value: string, label: string) => (
    <Link
      key={value}
      aria-current={filter === value ? 'true' : undefined}
      className={`chip${filter === value ? ' active' : ''}`}
      href={`/payments?month=${month}${value === 'all' ? '' : `&filter=${value}`}${scopeSuffix}`}
    >
      {label} ({filterRows(overview.rows, value).length})
    </Link>
  );
  const paidOut = overview.payouts.reduce((s, p) => s + p.paidOutCents, 0);
  const payoutShare = Math.round(
    (paidOut / Math.max(1, paidOut + overview.payoutReadyCents)) * 100,
  );

  return (
    <>
      <ScopedWorkspace
        organizationId={session.organizationId}
        filter={scope}
        activeTab="payments"
      />
      <PageHeader
        eyebrow="Money"
        title="Payments"
        actions={[
          { label: 'Payment settings', href: '/integrations' },
          {
            label: '+ Record payment',
            href: `/payments?month=${month}&record=1${scopeSuffix}`,
            primary: true,
          },
        ]}
      />
      {notice && (
        <Alert tone={notice.tone}>
          <div>{notice.text}</div>
        </Alert>
      )}

      <div className="kpis" aria-label={`Payment totals for ${monthLabel(month)}`}>
        <KpiCard
          label={
            month === monthKey(now) ? 'Collected this month' : `Collected · ${monthLabel(month)}`
          }
          value={formatUsd(overview.collectedCents)}
          note={`Payments received in ${monthLabel(month)}`}
        />
        <KpiCard
          label="Outstanding"
          value={formatUsd(overview.outstandingCents)}
          note={`${overview.openCount} open balances · all charges due to date`}
        />
        <KpiCard
          label="Late"
          value={formatUsd(overview.lateCents)}
          note={`${overview.lateCount} past grace · includes posted late fees`}
        />
      </div>

      {recording && (
        <Card id="record-payment">
          <CardHeader
            title="Record payment"
            action={
              <Button
                href={`/payments?month=${month}${filterQuery}${scopeSuffix}`}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            }
          />
          {overview.rows.length === 0 && (
            <p className="muted">
              No leases in this month and scope. Choose another month or view leases.
            </p>
          )}
          <form action={recordPaymentAction} className="form">
            {returnFields}
            <FormRow>
              <Field label="Lease">
                <Select
                  name="leaseId"
                  defaultValue={
                    overview.rows.some((row) => row.leaseId === params.record) ? params.record : ''
                  }
                  required
                >
                  <option value="" disabled>
                    Choose a lease
                  </option>
                  {overview.rows.map((row) => (
                    <option key={row.leaseId} value={row.leaseId}>
                      {row.tenantName} · {row.propertyName}
                      {row.singleUnit ? '' : ` ${row.unitLabel}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount" hint="Cash, check or money order received outside the app.">
                <Input name="amount" inputMode="decimal" placeholder="1,850.00" required />
              </Field>
            </FormRow>
            <div className="row">
              <Button type="submit" variant="primary" disabled={overview.rows.length === 0}>
                Save payment
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section className="card flush">
        <div className="card-header">
          <div>
            <p className="eyebrow">{monthLabel(month)}</p>
            <h3>Rent roll</h3>
          </div>
          <nav className={styles.period} aria-label="Rent month">
            <a
              className="chip"
              aria-label="Previous month"
              href={`/payments?month=${addMonths(month, -1)}${filterQuery}${scopeSuffix}`}
            >
              ‹ Prev
            </a>
            <a
              className="chip"
              href={`/payments?month=${monthKey(now)}${filterQuery}${scopeSuffix}`}
            >
              This month
            </a>
            <a
              className="chip"
              aria-label="Next month"
              href={`/payments?month=${addMonths(month, 1)}${filterQuery}${scopeSuffix}`}
            >
              Next ›
            </a>
          </nav>
        </div>
        <div className={styles.filters}>
          <nav className="chips" aria-label="Rent status">
            {chip('all', 'All')}
            {chip('paid', 'Paid')}
            {chip('open', 'Open')}
            {chip('late', 'Late')}
          </nav>
          <p>
            Late covers this month’s rent past grace, excluding autopay and covered pending
            payments. Outstanding includes all charges due to date for these leases.
          </p>
        </div>
        <div className={styles.tableScroll} role="region" aria-label="Rent roll" tabIndex={0}>
          <table className={`table ${styles.table}`} aria-label="Rent roll">
            <thead>
              <tr>
                <th scope="col">Tenant</th>
                <th scope="col">Property</th>
                <th scope="col">Due</th>
                <th scope="col" className="num">
                  Rent
                </th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No rent charges in this view"
                      description="Choose another status or create a lease to start collecting rent."
                      action="View leases"
                      href="/leases"
                    />
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const b = badge[row.status];
                return (
                  <tr key={row.leaseId} data-lease={row.leaseId}>
                    <td>
                      <div className="cell-main">
                        <Avatar initials={row.initials} size="sm" />
                        <div>
                          <strong>
                            {row.tenantId ? (
                              <Link href={`/tenants/${row.tenantId}`} style={{ color: 'inherit' }}>
                                {row.tenantName}
                              </Link>
                            ) : (
                              row.tenantName
                            )}
                          </strong>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">
                        <div>
                          <strong>
                            <Link
                              href={`/properties/${row.propertyId}`}
                              style={{ color: 'inherit' }}
                            >
                              {row.propertyName}
                            </Link>
                          </strong>
                          <small>{row.singleUnit ? 'Single-unit' : row.unitLabel}</small>
                        </div>
                      </div>
                    </td>
                    <td className={styles.date}>{shortDate(row.dueDate)}</td>
                    <td className="num">
                      <Link href={`/leases/${row.leaseId}`}>{formatUsd(row.rentCents)}</Link>
                      {row.outstandingCents > 0 && row.outstandingCents !== row.rentCents && (
                        <small className="muted" style={{ display: 'block' }}>
                          {formatUsd(row.outstandingCents)} owed
                        </small>
                      )}
                    </td>
                    <td>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        {row.status === 'LATE' && row.lateFeeEligible && (
                          <form action={applyLateFeeAction}>
                            <input type="hidden" name="leaseId" value={row.leaseId} />
                            {returnFields}
                            <Button type="submit" size="sm">
                              Add late fee
                            </Button>
                          </form>
                        )}
                        {row.lateFeeApplied && <small className="muted">Late fee applied</small>}
                        {row.status !== 'PAID' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            href={`/payments?month=${month}&record=${row.leaseId}${scopeSuffix}#record-payment`}
                          >
                            Record payment
                          </Button>
                        )}
                        {row.status === 'PAID' && row.lastPaymentId && (
                          <form action={refundPaymentAction}>
                            <input type="hidden" name="paymentId" value={row.lastPaymentId} />
                            {returnFields}
                            <Button type="submit" size="sm" variant="ghost">
                              Refund
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          total={filtered.length}
          size={PAGE_SIZE}
          noun="leases"
          href={(p) => `/payments?month=${month}${filterQuery}${scopeSuffix}&page=${p}`}
        />
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <h3>Owner payouts</h3>
            <Badge tone={overview.payoutReadyCents ? 'warning' : 'success'}>
              {overview.payoutReadyCents ? 'Ready to send' : 'On schedule'}
            </Badge>
          </div>
          <div className="stack">
            {overview.payouts.map((payout) => (
              <div className="row between" key={payout.propertyId}>
                <div className="cell-main">
                  <div>
                    <strong>
                      <Link href={`/properties/${payout.propertyId}`} style={{ color: 'inherit' }}>
                        {payout.propertyName}
                      </Link>
                    </strong>
                    <p className="muted">
                      {payout.ownerName ?? 'No owner assigned'} · {formatUsd(payout.collectedCents)}{' '}
                      collected
                    </p>
                  </div>
                </div>
                <strong>{formatUsd(payout.readyCents)}</strong>
              </div>
            ))}
            <Progress value={payoutShare} label="Owner payout share" />
            <div className="row between">
              <p className="muted">
                {formatUsd(overview.payoutReadyCents)} ready to transfer · {formatUsd(paidOut)}{' '}
                already sent
              </p>
              <form action={runPayoutsAction}>
                {returnFields}
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={overview.payoutReadyCents === 0}
                >
                  Send payouts
                </Button>
              </form>
            </div>
            {overview.recentPayouts.length > 0 && (
              <p className="muted">
                Recent:{' '}
                {overview.recentPayouts
                  .map((p) => `${formatUsd(p.amountCents)} ${p.status}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card-header">
            <h3>Collection tools</h3>
          </div>
          <div className="stack">
            <div className="row between">
              <div>
                <strong>Late fees</strong>
                <p className="muted">Review overdue rent before applying a fee.</p>
              </div>
              <Button size="sm" href={`/payments?month=${month}&filter=late${scopeSuffix}`}>
                Review
              </Button>
            </div>
            <div className="row between">
              <div>
                <strong>Record offline payment</strong>
                <p className="muted">Keep the ledger current for checks or cash.</p>
              </div>
              <Button
                size="sm"
                href={`/payments?month=${month}&record=1${scopeSuffix}#record-payment`}
              >
                Record
              </Button>
            </div>
            <p className="muted">Transactions, receipts, and refunds keep an audit trail.</p>
          </div>
        </section>
      </div>
    </>
  );
}

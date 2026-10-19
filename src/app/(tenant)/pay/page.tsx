import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { PaymentNotice } from './PaymentNotice';
import { EmptyState } from '@/components/RouteStates';
import { requireTenantRole } from '@/lib/auth/access';
import { graceEnd } from '@/lib/ledger/core';
import { formatUsd, loadTenantPayView, monthLabel } from '@/lib/tenant-pay';
import { AutopayToggle } from './AutopayToggle';
import { AddPaymentMethods, PayForm } from './PayForm';
import portal from '../portal.module.css';
import styles from './pay.module.css';
import { PayIcon } from './PayIcon';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ notice?: string }>;

const notices: Record<string, { tone: 'success' | 'warning' | 'error'; text: string }> = {
  'review-required': {
    tone: 'warning',
    text: 'Review the amount and payment method, then confirm your payment.',
  },
  paid: {
    tone: 'success',
    text: 'Payment received. Your receipt is below and your balance is updated.',
  },
  pending: {
    tone: 'success',
    text: 'Bank payment started. It will show as Paid once your provider confirms it.',
  },
  'payment-duplicate': { tone: 'success', text: 'That payment was already recorded.' },
  'payment-failed': {
    tone: 'error',
    text: 'The payment could not be completed. Nothing was charged.',
  },
  'invalid-amount': {
    tone: 'error',
    text: 'Enter an amount greater than zero and no more than the amount due.',
  },
  'invalid-method': {
    tone: 'error',
    text: 'Choose bank transfer or card using the provider fields. Card and bank numbers are never entered here.',
  },
  'method-added': { tone: 'success', text: 'Payment method added. You can now turn on autopay.' },
  'method-failed': { tone: 'error', text: 'That payment method could not be added.' },
};

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fullDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export default async function TenantPayPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireTenantRole();
  const params = await searchParams;
  const notice = params.notice ? notices[params.notice] : undefined;
  const view = session.tenantId
    ? await loadTenantPayView(session.organizationId, session.tenantId, new Date())
    : null;

  if (!view) {
    return (
      <>
        <header className={styles.heading}>
          <p className="eyebrow">Tenant portal / Pay</p>
          <h1 style={{ fontSize: 'var(--rr-h1)' }}>Pay rent</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {session.name}
          </p>
        </header>
        <EmptyState
          title="No active lease"
          description="There is no active lease on your account yet, so there is nothing to pay."
          action="Check again"
          href="/pay"
        />
      </>
    );
  }

  const { amountDue } = view;
  const dueDate = amountDue.dueDate;
  const headingMonth = dueDate ? monthLabel(dueDate) : monthLabel(new Date());
  const grace = dueDate ? graceEnd(dueDate, view.graceDays) : null;
  const autopayMethodId = view.autopay.paymentMethodId ?? view.methods[0]?.id ?? null;

  return (
    <>
      <header className={styles.heading}>
        <p className="eyebrow">Tenant portal / Pay</p>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>
          Pay {headingMonth} rent
          <span className={styles.spark} aria-hidden="true">
            ✳
          </span>
        </h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {view.propertyName}
          {view.unitLabel ? ` · Unit ${view.unitLabel}` : ''}
          {dueDate ? ` · Due ${fullDate(dueDate)}` : ' · Nothing due right now'}
        </p>
      </header>

      {notice && <PaymentNotice tone={notice.tone} text={notice.text} code={params.notice} />}

      <section className={`card ${styles.hero}`} aria-labelledby="amount-due-title">
        <div className="card-header">
          <h2 id="amount-due-title" style={{ fontSize: 16 }}>
            Amount due
          </h2>
          {dueDate ? (
            <Badge tone="info">Due {shortDate(dueDate)}</Badge>
          ) : (
            <Badge tone="success">Paid</Badge>
          )}
        </div>
        {amountDue.lines.length > 0 ? (
          <>
            <dl className={styles.breakdown}>
              {amountDue.lines.map((line, index) => (
                <div key={line.chargeId ?? index} style={{ display: 'contents' }}>
                  <dt>
                    {line.label}
                    {line.paidCents > 0 ? ` (${formatUsd(line.paidCents)} already paid)` : ''}
                  </dt>
                  <dd>{formatUsd(line.outstandingCents)}</dd>
                </div>
              ))}
            </dl>

            <div className={styles.totalRow}>
              <strong>Total due{dueDate ? ` ${shortDate(dueDate)}` : ''}</strong>
              <strong className={`${portal.total} ${styles.total}`}>
                {formatUsd(amountDue.totalDueCents)}
              </strong>
            </div>
            {amountDue.pendingCents > 0 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {formatUsd(amountDue.pendingCents)} is on its way from your bank and will clear
                shortly.
              </p>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {grace && view.graceDays > 0 ? `No late fee if paid by ${shortDate(grace)}. ` : ''}
              Your payment status and receipt will appear below.
            </p>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            You&rsquo;re all paid up. Thank you — your next rent will appear here when it is due.
          </p>
        )}
      </section>

      {amountDue.totalDueCents > 0 ? (
        <PayForm
          leaseId={view.leaseId}
          totalDueCents={amountDue.totalDueCents}
          passFees={view.passFees}
          methods={view.methods}
        />
      ) : (
        <section aria-labelledby="payment-method-title">
          <h2 id="payment-method-title" style={{ fontSize: 'var(--rr-h3)', marginBottom: 4 }}>
            Payment method
          </h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Add a method now so paying next month takes one tap.
          </p>
          <AddPaymentMethods />
        </section>
      )}

      <AutopayToggle
        leaseId={view.leaseId}
        enabled={view.autopay.enabled}
        paymentMethodId={autopayMethodId}
        monthlyRentCents={view.monthlyRentCents}
        rentDueDay={view.rentDueDay}
      />

      <section className={`card ${styles.receipts}`} aria-labelledby="receipts-title">
        <div className="card-header">
          <h2 id="receipts-title" style={{ fontSize: 16 }}>
            Recent receipts
          </h2>
          <Link href="/lease" style={{ fontSize: 13, fontWeight: 600 }}>
            Documents <PayIcon name="arrow" />
          </Link>
        </div>
        {view.receipts.length > 0 ? (
          <ul className={styles.receiptList}>
            {view.receipts.map((receipt) => (
              <li className={styles.receipt} key={receipt.paymentId ?? receipt.label}>
                <span className={styles.receiptIcon} aria-hidden="true">
                  ✓
                </span>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: 14 }}>{receipt.label}</strong>
                  <small className="muted">{shortDate(receipt.date)}</small>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <strong style={{ display: 'block', fontSize: 14 }}>
                    {formatUsd(receipt.amountCents)}
                  </strong>
                  <Badge
                    tone={
                      receipt.status === 'SUCCEEDED'
                        ? 'success'
                        : receipt.status === 'PENDING'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {receipt.statusLabel}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Your receipts will appear here after your first payment.</p>
        )}
      </section>
    </>
  );
}

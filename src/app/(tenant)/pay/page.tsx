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
  'review-required': { tone: 'warning', text: 'Review and confirm your payment.' },
  paid: { tone: 'success', text: 'Payment received.' },
  pending: {
    tone: 'success',
    text: 'Bank payment started. It shows as Paid once it clears.',
  },
  'payment-duplicate': { tone: 'success', text: 'That payment was already recorded.' },
  'payment-failed': {
    tone: 'error',
    text: 'The payment could not be completed. Nothing was charged.',
  },
  'payment-unconfirmed': {
    tone: 'error',
    text: 'We could not confirm the payment result. Check your recent receipts before trying again.',
  },
  'invalid-amount': {
    tone: 'error',
    text: 'Enter an amount greater than zero and no more than the amount due.',
  },
  'invalid-method': {
    tone: 'error',
    text: 'Choose bank transfer or card using the provider fields. Card and bank numbers are never entered here.',
  },
  'method-added': { tone: 'success', text: 'Payment method added.' },
  'method-failed': { tone: 'error', text: 'That payment method could not be added.' },
};

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

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
          <h1 style={{ fontSize: 'var(--rr-h1)' }}>Pay rent</h1>
        </header>
        <EmptyState
          title="No active lease"
          description="Nothing to pay yet."
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
  // A lone, unpaid "{Month} rent" line just repeats the heading and the total, so it is listed
  // only when there are several lines, a partial payment, or another kind of charge.
  const [onlyLine] = amountDue.lines;
  const itemized =
    amountDue.lines.length > 1 ||
    (onlyLine !== undefined &&
      (onlyLine.paidCents > 0 || onlyLine.label !== `${headingMonth} rent`));

  return (
    <>
      <header className={styles.heading}>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>Pay {headingMonth} rent</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          {view.propertyName}
          {view.unitLabel ? ` · Unit ${view.unitLabel}` : ''}
        </p>
      </header>

      {notice && (
        <PaymentNotice
          tone={notice.tone}
          text={notice.text}
          code={params.notice}
          toastText={
            ['paid', 'pending'].includes(params.notice ?? '') && view.receipts[0]
              ? `Payment of ${formatUsd(view.receipts[0].amountCents)} submitted`
              : undefined
          }
        />
      )}

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
            {itemized && (
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
            )}

            <div className={styles.totalRow}>
              {itemized && <strong>Total due</strong>}
              <strong className={`${portal.total} ${styles.total}`}>
                {formatUsd(amountDue.totalDueCents)}
              </strong>
            </div>
            {amountDue.pendingCents > 0 && (
              <p className={`muted ${styles.note}`}>
                {formatUsd(amountDue.pendingCents)} is on its way from your bank.
              </p>
            )}
            {grace && view.graceDays > 0 && (
              <p className={`muted ${styles.note}`}>No late fee if paid by {shortDate(grace)}.</p>
            )}
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            You&rsquo;re all paid up.
          </p>
        )}
      </section>

      {amountDue.totalDueCents > 0 ? (
        <PayForm
          leaseId={view.leaseId}
          totalDueCents={amountDue.totalDueCents}
          passFees={view.passFees}
          methods={view.methods}
          autopay={{
            ...view.autopay,
            monthlyRentCents: view.monthlyRentCents,
            rentDueDay: view.rentDueDay,
          }}
        />
      ) : (
        <section aria-labelledby="payment-method-title">
          <h2 id="payment-method-title" style={{ fontSize: 16 }}>
            Payment method
          </h2>
          <AddPaymentMethods />
        </section>
      )}

      {amountDue.totalDueCents === 0 && (
        <AutopayToggle
          leaseId={view.leaseId}
          enabled={view.autopay.enabled}
          paymentMethodId={autopayMethodId}
          paymentMethodLabel={view.methods.find((method) => method.id === autopayMethodId)?.label}
          monthlyRentCents={view.monthlyRentCents}
          rentDueDay={view.rentDueDay}
        />
      )}

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
          <p className="muted">No receipts yet.</p>
        )}
      </section>
    </>
  );
}

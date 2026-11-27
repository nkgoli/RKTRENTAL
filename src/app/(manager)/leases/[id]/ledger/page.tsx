import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { AutoSubmitSelect, Badge } from '@/components/ui';
import { SummaryBand } from '@/components/ui/SummaryBand';
import { workspaceTabHref } from '@/components/workspace/routes';
import { RentLedgerRows } from '@/components/payments/RentLedger';
import { toLastPayment, toLedgerRows, toPaymentViews } from '@/components/payments/ledger-view';
import { ReminderWorkspace } from '@/components/notifications/ReminderWorkspace';
import { loadReminderChannels, loadReminderChoices } from '@/components/notifications/server';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { activeIntegration } from '@/lib/integrations/active';
import { findProvider } from '@/lib/integrations/catalog';
import { ensureRentCharges, leaseLedger, paymentsProviderLabel, periodLabel } from '@/lib/ledger';
import { formatMoney, termLabel } from '@/lib/ledger/statement';
import { leasesDb } from '@/lib/leases/queries';
import { leaseStatusBadge } from '../lease-view';
import { ledgerSummary } from './ledger-summary';
import styles from './ledger.module.css';

export const dynamic = 'force-dynamic';

/**
 * One lease's full Rent ledger: scope, balance, every charge and payment, and the late-rent
 * reminder review (preview first; nothing is sent without the confirm step).
 */
export default async function LeaseLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const session = await requireManagerRole();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const now = new Date();
  await ensureRentCharges(session.organizationId, now);
  const lease = await leasesDb(session.organizationId).detail(id);
  if (!lease) notFound();
  const terms = await db.lease.findMany({
    where: { organizationId: session.organizationId, unitId: lease.unitId },
    select: { id: true, startDate: true, endDate: true, status: true },
    orderBy: { startDate: 'desc' },
  });
  // The term picker only moves between leases on this unit in this organization.
  if (query.term && query.term !== lease.id && terms.some((t) => t.id === query.term))
    redirect(`/leases/${encodeURIComponent(query.term)}/ledger`);

  const [{ connection }, autopayCount, choices, channels] = await Promise.all([
    activeIntegration(session.organizationId, 'payments', ['stripe', 'mock']),
    db.autopaySetting.count({
      where: { organizationId: session.organizationId, leaseId: lease.id, enabled: true },
    }),
    loadReminderChoices(session.organizationId, { unitId: lease.unitId }),
    loadReminderChannels(session.organizationId),
  ]);
  const property = lease.unit.property;
  const title = property.name + (lease.unit.isImplicit ? '' : ' · Unit ' + lease.unit.number);
  const ledger = leaseLedger(lease, now);
  const rows = toLedgerRows(ledger.rows);
  const payments = toPaymentViews(ledger.payments);
  const lastPayment = toLastPayment(ledger.lastPayment);
  const summary = ledgerSummary(ledger, now);
  const status = leaseStatusBadge(lease, now);
  const sandbox = connection?.provider === 'mock';
  const providerName = connection
    ? (findProvider(connection.kind, connection.provider)?.name ?? connection.provider)
    : null;
  const providerLabel = paymentsProviderLabel(connection, providerName);
  const leaseHref = `/leases/${lease.id}`;
  const propertyPayments = workspaceTabHref(property.id, 'payments');
  const unitPayments = workspaceTabHref(property.id, 'payments', lease.unitId);
  const tenantNames = lease.tenants.map(({ tenant }) => tenant.name).join(', ');
  const reminderChoices = choices.filter((c) => c.id === lease.id);
  const period = periodLabel({ start: lease.startDate, end: lease.endDate }, ledger.rows);

  return (
    <>
      <PageHeader
        title={tenantNames ? `${title} · ${tenantNames}` : title}
        back={{ href: unitPayments, label: 'Payments' }}
        // The Leases section's "Create lease" shortcut does not belong on a ledger.
        actions={[]}
        meta={[
          lease.eSignStatus === 'SIGNED' ? 'Signed lease' : 'Lease not fully signed',
          termLabel(lease.startDate, lease.endDate),
          `${lease.graceDays}-day grace period`,
        ].join(' · ')}
      />
      <div className={styles.page}>
        <div className={styles.scopeBar}>
          <nav className={styles.scopeNav} aria-label="Ledger scope">
            <span className={styles.scopeLabel}>Ledger scope</span>
            <span className={styles.segmented}>
              <a href={propertyPayments}>Property</a>
              {!lease.unit.isImplicit && <a href={unitPayments}>Unit</a>}
              <a href={`${leaseHref}/ledger`} aria-current="page">
                Lease
              </a>
            </span>
          </nav>
          <form className={styles.termForm} method="get" action={`${leaseHref}/ledger`}>
            <label>
              <span>Lease term</span>
              <AutoSubmitSelect name="term" defaultValue={lease.id}>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {termLabel(t.startDate, t.endDate)} · {t.status.toLowerCase()}
                  </option>
                ))}
              </AutoSubmitSelect>
            </label>
            <noscript>
              <button className="btn btn-secondary btn-sm" type="submit">
                Open term
              </button>
            </noscript>
          </form>
          <span className={styles.scopeBadges}>
            <Badge tone={status.tone}>
              {lease.status === 'ACTIVE' && status.tone === 'success'
                ? 'Active lease'
                : status.label}
            </Badge>
            <Badge tone={sandbox ? 'warning' : providerName ? 'success' : 'neutral'}>
              {providerLabel}
            </Badge>
          </span>
        </div>

        <SummaryBand
          eyebrow={`Balance due · ${summary.asOfLabel}`}
          value={formatMoney(summary.balanceDueCents)}
          detail={
            <>
              {summary.lateCount > 0 ? (
                <span className={styles.danger}>
                  {summary.lateCount} late {summary.lateCount === 1 ? 'charge' : 'charges'} ·{' '}
                  {formatMoney(summary.lateCents)} past grace
                </span>
              ) : summary.openCount > 0 ? (
                <span>
                  {summary.openCount} open {summary.openCount === 1 ? 'charge' : 'charges'} ·{' '}
                  {formatMoney(summary.openCents)} due, within grace
                </span>
              ) : (
                <span>No open charges</span>
              )}
              {summary.pendingCents > 0 && (
                <span> · {formatMoney(summary.pendingCents)} pending, not deducted</span>
              )}
            </>
          }
          footer={
            <>
              <span>
                {autopayCount > 0
                  ? `Autopay on for ${autopayCount} ${autopayCount === 1 ? 'tenant' : 'tenants'}`
                  : 'Autopay off'}
              </span>
              {lease.status === 'ACTIVE' && (
                <a
                  className="btn btn-secondary btn-sm"
                  // Carries this lease so Payments records against it, never a sibling term.
                  href={`${unitPayments}${unitPayments.includes('?') ? '&' : '?'}record=1&lease=${encodeURIComponent(lease.id)}`}
                >
                  Record payment
                </a>
              )}
            </>
          }
          stats={[
            {
              label: 'Last payment',
              value: lastPayment ? formatMoney(lastPayment.amountCents) : 'None yet',
              detail: lastPayment ? `Received ${lastPayment.dateLabel}` : undefined,
            },
            { label: 'Credit on account', value: formatMoney(summary.creditCents) },
          ]}
        />

        <section className={styles.card} aria-labelledby="charge-ledger">
          <div className={styles.cardHead}>
            <h2 id="charge-ledger">Charge ledger</h2>
            <span className={styles.headLinks}>
              <a className={styles.goLink} href={leaseHref}>
                Lease workspace <span aria-hidden="true">→</span>
              </a>
            </span>
          </div>
          <RentLedgerRows
            groups={[
              {
                id: lease.id,
                heading: title,
                meta: period,
                balanceCents: ledger.balanceCents,
                active: lease.status === 'ACTIVE',
                rows,
                payments,
              },
            ]}
            groupHeadings={false}
            reminderHrefs={{ [lease.id]: '#reminder-review' }}
          />
          <p className={styles.caption}>
            Term to date · {formatMoney(ledger.chargedCents)} charged ·{' '}
            {formatMoney(ledger.paidCents)} paid
          </p>
        </section>

        <section
          className={styles.reminders}
          id="reminder-review"
          aria-labelledby="reminder-review-heading"
        >
          <h2 id="reminder-review-heading" className="eyebrow">
            Late-rent reminder
          </h2>
          {reminderChoices.length ? (
            <ReminderWorkspace
              choices={reminderChoices}
              channels={channels}
              lockedLeaseId={lease.id}
              storageKey={`payment-reminder:${session.organizationId}:${session.subjectId}`}
            />
          ) : (
            <p className={styles.muted}>Reminders are available once the lease is active.</p>
          )}
        </section>
      </div>
    </>
  );
}

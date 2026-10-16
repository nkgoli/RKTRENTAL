import { Alert } from '@/components/ui/Feedback';
import { activeIntegration } from '@/lib/integrations/active';
import { findProvider } from '@/lib/integrations/catalog';
import { ensureRentCharges, loadPropertyLedger, paymentsProviderLabel } from '@/lib/ledger';
import type { ScopeFilter } from '@/lib/workspace/scope';
import { PaymentsBoard, type BoardGroup } from './PaymentsBoard';
import styles from './leasing.module.css';

const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  'payment-recorded': { tone: 'success', text: 'Payment recorded and applied to the ledger.' },
  'payment-duplicate': { tone: 'success', text: 'That payment was already recorded.' },
  'payment-failed': { tone: 'warning', text: 'The payment could not be recorded.' },
  'invalid-amount': { tone: 'warning', text: 'Enter an amount greater than zero, like 1,850.00.' },
  'charge-created': { tone: 'success', text: 'Charge created.' },
  'charge-invalid': { tone: 'warning', text: 'The charge could not be created. Check the type, description, date and amount.' },
};

const dateParts = (date: Date) => ({
  month: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
  day: String(date.getUTCDate()).padStart(2, '0'),
  label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
});

/** Charge ledger for one property (and optionally one unit) with balance summary and charge/payment actions. */
export async function PaymentsPanel({ organizationId, scope, recording, notice }: {
  organizationId: string;
  scope: ScopeFilter;
  recording: boolean;
  notice?: string;
}) {
  const now = new Date();
  await ensureRentCharges(organizationId, now);
  const [ledger, { connection }] = await Promise.all([
    loadPropertyLedger(organizationId, scope, now),
    activeIntegration(organizationId, 'payments', ['stripe', 'mock']),
  ]);
  const message = notice ? notices[notice] : undefined;
  const providerName = connection ? (findProvider(connection.kind, connection.provider)?.name ?? connection.provider) : null;

  const groups: BoardGroup[] = ledger.groups.map((group) => ({
    leaseId: group.leaseId,
    label: group.label,
    place: group.singleUnit ? 'Whole property' : `Unit ${group.unitLabel}`,
    active: group.active,
    tenantNames: group.tenants.map((t) => t.name).join(', '),
    rows: group.rows.map((row) => {
      const due = dateParts(row.dueDate);
      return {
        key: row.key,
        type: row.typeLabel,
        description: row.description,
        month: due.month,
        day: due.day,
        dateLabel: due.label,
        amountCents: row.amountCents,
        paidCents: row.paidCents,
        balanceCents: row.balanceCents,
        status: row.status,
        derived: row.derived,
        applied: row.applied.map((a) => ({
          id: a.paymentId,
          amountCents: a.amountCents,
          dateLabel: a.date ? dateParts(a.date).label : 'unknown date',
          method: a.method,
        })),
      };
    }),
  }));

  return <section className={styles.panel} aria-label="Payments">
    {message && <Alert tone={message.tone}><div>{message.text}</div></Alert>}
    <PaymentsBoard
      propertyId={scope.propertyId ?? ''}
      unitId={scope.unitId}
      balanceCents={ledger.balanceCents}
      providerLabel={paymentsProviderLabel(connection, providerName)}
      providerConnected={Boolean(providerName)}
      tenants={ledger.tenants}
      groups={groups}
      openRecord={recording}
      today={now.toISOString().slice(0, 10)}
    />
  </section>;
}

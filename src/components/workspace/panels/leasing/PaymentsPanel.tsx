import { NoticeToast } from '@/components/ui/Toast';
import { activeIntegration } from '@/lib/integrations/active';
import { findProvider } from '@/lib/integrations/catalog';
import { db } from '@/lib/db/client';
import {
  ensureRentCharges,
  loadPropertyLedger,
  paymentsProviderLabel,
  summarizeUnits,
} from '@/lib/ledger';
import type { ScopeFilter } from '@/lib/workspace/scope';
import { ledgerDate, toLastPayment, toLedgerRows } from '@/components/payments/ledger-view';
import { PaymentsBoard, type BoardGroup } from './PaymentsBoard';
import styles from './leasing.module.css';

const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  'payment-recorded': { tone: 'success', text: 'Payment recorded and applied to the ledger.' },
  'payment-duplicate': { tone: 'success', text: 'That payment was already recorded.' },
  'payment-failed': { tone: 'warning', text: 'The payment could not be recorded.' },
  'invalid-amount': { tone: 'warning', text: 'Enter an amount greater than zero, like 1,850.00.' },
  'charge-created': { tone: 'success', text: 'Charge created.' },
  'charge-invalid': {
    tone: 'warning',
    text: 'The charge could not be created. Check the type, description, date and amount.',
  },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Rent ledger for one property (and optionally one unit) with balance summary and charge/payment actions. */
export async function PaymentsPanel({
  organizationId,
  scope,
  recording,
  notice,
  remindersHref,
}: {
  organizationId: string;
  scope: ScopeFilter;
  recording: boolean;
  notice?: string;
  remindersHref?: string;
}) {
  const now = new Date();
  await ensureRentCharges(organizationId, now);
  const [ledger, { connection }, unitCount] = await Promise.all([
    loadPropertyLedger(organizationId, scope, now),
    activeIntegration(organizationId, 'payments', ['stripe', 'mock']),
    scope.unitId || !scope.propertyId
      ? Promise.resolve(0)
      : db.unit.count({
          where: { organizationId, propertyId: scope.propertyId, isImplicit: false },
        }),
  ]);
  const summary = unitCount > 1 ? summarizeUnits(ledger.groups) : null;
  const message = notice ? notices[notice] : undefined;
  const providerName = connection
    ? (findProvider(connection.kind, connection.provider)?.name ?? connection.provider)
    : null;

  const groups: BoardGroup[] = ledger.groups.map((group) => ({
    leaseId: group.leaseId,
    label: group.label,
    place: group.singleUnit ? '' : group.unitLabel,
    active: group.active,
    tenantNames: group.tenants.map((t) => t.name).join(', '),
    balanceCents: group.balanceCents,
    rows: toLedgerRows(group.rows),
  }));
  // Say exactly what the balance covers so unit, property and lease views can be compared.
  const scoped = ledger.groups.find((g) => g.active) ?? ledger.groups[0];
  const place = scope.unitId
    ? scoped && !scoped.singleUnit
      ? scoped.unitLabel
      : 'This unit'
    : unitCount > 1
      ? `All ${unitCount} units`
      : 'Whole property';
  const ended = ledger.groups.length - ledger.activeLeaseCount;
  const scopeLabel = [
    place,
    plural(ledger.activeLeaseCount, 'active lease'),
    ended ? plural(ended, 'ended lease') : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={styles.panel} aria-label="Payments">
      {message && (
        <NoticeToast
          tone={message.tone === 'warning' ? 'error' : 'success'}
          message={message.text}
        />
      )}
      <PaymentsBoard
        key={`${scope.propertyId}:${scope.unitId ?? 'all'}`}
        propertyId={scope.propertyId ?? ''}
        unitId={scope.unitId}
        scopeLabel={scopeLabel}
        balanceCents={ledger.balanceCents}
        lastPayment={toLastPayment(ledger.lastPayment)}
        endedBalanceCents={ledger.endedBalanceCents}
        providerLabel={paymentsProviderLabel(connection, providerName)}
        providerConnected={Boolean(providerName)}
        remindersHref={remindersHref}
        tenants={ledger.tenants}
        groups={groups}
        summary={
          summary && {
            totalBalanceCents: summary.totalBalanceCents,
            units: summary.units.map((u) => ({
              unitId: u.unitId,
              leaseId: u.leaseId,
              unitLabel: u.unitLabel,
              tenantNames: u.tenantNames,
              balanceCents: u.balanceCents,
              status: u.status,
              nextDue: u.nextDue && {
                dateLabel: ledgerDate(u.nextDue.dueDate),
                amountCents: u.nextDue.amountCents,
              },
            })),
          }
        }
        openRecord={recording}
        today={now.toISOString().slice(0, 10)}
      />
    </section>
  );
}

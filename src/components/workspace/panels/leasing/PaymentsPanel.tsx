import Link from 'next/link';
import { Avatar, Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, FormRow, Input, Select } from '@/components/ui/Forms';
import {
  ensureRentCharges, formatUsd, loadPaymentsOverview, monthKey, monthStart, type RentStatus,
} from '@/lib/ledger';
import type { ScopeFilter } from '@/lib/workspace/scope';
import { recordPropertyPaymentAction } from './actions';
import { LeasingStats } from './LeasingStats';
import { withUnit } from './scope';
import styles from './leasing.module.css';

const badge: Record<RentStatus, { tone: BadgeTone; label: string }> = {
  PAID: { tone: 'success', label: 'Paid' },
  PENDING: { tone: 'warning', label: 'Pending' },
  LATE: { tone: 'danger', label: 'Late' },
  AUTOPAY: { tone: 'info', label: 'Autopay' },
};
const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  'payment-recorded': { tone: 'success', text: 'Payment recorded and applied to the ledger.' },
  'payment-duplicate': { tone: 'success', text: 'That payment was already recorded.' },
  'payment-failed': { tone: 'warning', text: 'The payment could not be recorded.' },
  'invalid-amount': { tone: 'warning', text: 'Enter an amount greater than zero, like 1,850.00.' },
};
const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** This month's rent roll for one property (and optionally one unit) with an inline Record payment form. */
export async function PaymentsPanel({ organizationId, scope, recording, notice }: {
  organizationId: string;
  scope: ScopeFilter;
  recording: boolean;
  notice?: string;
}) {
  const now = new Date();
  const month = monthKey(now);
  await ensureRentCharges(organizationId, now);
  const overview = await loadPaymentsOverview(organizationId, month, now, undefined, scope);
  const dueCents = overview.collectedCents + overview.outstandingCents;
  const base = `/properties/${scope.propertyId}/payments`;
  const message = notice ? notices[notice] : undefined;
  const monthName = monthStart(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return <section className={styles.panel} aria-label="Payments">
    <LeasingStats label="Payment stats" stats={[
      { label: 'Collected', value: formatUsd(overview.collectedCents), note: `of ${formatUsd(dueCents)} due` },
      { label: 'Outstanding', value: formatUsd(overview.outstandingCents), note: `${overview.openCount} open` },
      { label: 'Late', value: formatUsd(overview.lateCents), note: `${overview.lateCount} past due` },
    ]} />
    {message && <Alert tone={message.tone}><div>{message.text}</div></Alert>}
    {recording && <div className="card">
      <form action={recordPropertyPaymentAction} className="form">
        <input type="hidden" name="propertyId" value={scope.propertyId} />
        {scope.unitId && <input type="hidden" name="unitId" value={scope.unitId} />}
        <FormRow>
          <Field label="Lease">
            <Select name="leaseId" required>
              {overview.rows.map((row) => <option key={row.leaseId} value={row.leaseId}>
                {row.tenantName}{row.singleUnit ? '' : ` · ${row.unitLabel}`}
              </option>)}
            </Select>
          </Field>
          <Field label="Amount" hint="Cash, check or money order received outside the app.">
            <Input name="amount" inputMode="decimal" placeholder="1,850.00" required />
          </Field>
        </FormRow>
        <div className="row">
          <Button type="submit" variant="primary">Save payment</Button>
          <Button href={withUnit(base, scope.unitId)} variant="ghost">Cancel</Button>
        </div>
      </form>
    </div>}
    <div className="card flush">
      <div className={styles.listHeader}>
        <h3>Rent roll · {monthName}</h3>
        {!recording && <Button href={withUnit(base, scope.unitId, { record: '1' })} variant="primary" size="sm">+ Record payment</Button>}
      </div>
      {overview.rows.length === 0 ? <p className={styles.empty}>No rent charges this month. Create a lease to start collecting rent.</p> : <table className="table">
        <thead><tr><th>Tenant</th><th>Unit</th><th>Due</th><th className="num">Rent</th><th>Status</th></tr></thead>
        <tbody>{overview.rows.map((row) => {
          const b = badge[row.status];
          return <tr key={row.leaseId}>
            <td><div className="cell-main">
              <Avatar initials={row.initials} size="sm" />
              <strong>{row.tenantId
                ? <Link href={`/tenants/${row.tenantId}`} style={{ color: 'inherit' }}>{row.tenantName}</Link>
                : row.tenantName}</strong>
            </div></td>
            <td>{row.singleUnit ? 'Whole property' : row.unitLabel}</td>
            <td>{shortDate(row.dueDate)}</td>
            <td className="num"><Link href={`/leases/${row.leaseId}`}>{formatUsd(row.rentCents)}</Link></td>
            <td><Badge tone={b.tone}>{b.label}</Badge></td>
          </tr>;
        })}</tbody>
      </table>}
    </div>
  </section>;
}

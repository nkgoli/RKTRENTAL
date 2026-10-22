'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Avatar, Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FormRow, Input, Select } from '@/components/ui/Forms';
import { RentLedger, RentLedgerRows } from '@/components/payments/RentLedger';
import type {
  LastPaymentView,
  LedgerRowView,
  PaymentView,
} from '@/components/payments/ledger-view';
import { formatMoney } from '@/lib/ledger/statement';
import { createPropertyChargeAction, recordPropertyPaymentAction } from './actions';
import { withUnit } from './scope';
import styles from './payments.module.css';

export type BoardRow = LedgerRowView;
export type BoardGroup = {
  leaseId: string;
  /** Period of the listed charges, e.g. "Jan 2026 – Dec 2026". */
  label: string;
  place: string;
  active: boolean;
  tenantNames: string;
  balanceCents: number;
  rows: BoardRow[];
  payments: PaymentView[];
};
export type BoardTenant = { id: string; name: string; initials: string };
export type BoardUnit = {
  unitId: string;
  leaseId: string;
  unitLabel: string;
  tenantNames: string;
  balanceCents: number;
  /** Open on the unit's ended leases; never part of balanceCents or the total. */
  endedBalanceCents: number;
  endedLeaseCount: number;
  status: 'LATE' | 'DUE' | 'CURRENT' | 'ENDED';
  nextDue: { dateLabel: string; amountCents: number } | null;
};
export type BoardSummary = { units: BoardUnit[]; totalBalanceCents: number };
/** Lease a page asked to record a payment for (e.g. from the lease page), by id. */
export type RecordTarget = { open: boolean; leaseId?: string };

const unitPill: Record<BoardUnit['status'], { tone: BadgeTone; label: string }> = {
  LATE: { tone: 'danger', label: 'Late' },
  DUE: { tone: 'info', label: 'Due' },
  CURRENT: { tone: 'success', label: 'Current' },
  ENDED: { tone: 'neutral', label: 'Ended' },
};

/** "Townhome 1 · Sample Tenant"; the unit is left out for a single-family lease. */
const groupHeading = (g: Pick<BoardGroup, 'place' | 'tenantNames'>) =>
  [g.place, g.tenantNames].filter(Boolean).join(' · ') || 'Whole property';
/** Heading plus term, so two terms for the same unit and tenant can be told apart. */
const leaseName = (g: Pick<BoardGroup, 'place' | 'tenantNames' | 'label'>) =>
  `${groupHeading(g)} · ${g.label}`;

export function PaymentsBoard({
  propertyId,
  unitId,
  scopeLabel,
  balanceCents,
  lastPayment = null,
  endedBalanceCents = 0,
  providerLabel,
  providerConnected,
  remindersHref,
  tenants,
  groups,
  summary,
  openRecord,
  recordLeaseId,
  today,
}: {
  propertyId: string;
  unitId?: string;
  /** What the balance covers, e.g. "Whole property · 1 active lease". */
  scopeLabel?: string;
  balanceCents: number;
  lastPayment?: LastPaymentView;
  endedBalanceCents?: number;
  providerLabel: string;
  providerConnected: boolean;
  remindersHref?: string;
  tenants: BoardTenant[];
  groups: BoardGroup[];
  /** Set for a multi-unit property without a unit scope: replaces the ledger with a per-unit table. */
  summary: BoardSummary | null;
  openRecord: boolean;
  /**
   * Lease the page was asked to record a payment for (the lease page's Record payment). It is used
   * only when it is an active lease in this scope; otherwise the manager must choose explicitly.
   */
  recordLeaseId?: string;
  today: string;
}) {
  const [chargeOpen, setChargeOpen] = useState(false);
  const chargeFormId = useId();
  const paymentFormId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const activeGroups = groups.filter((g) => g.active);
  // One active lease is unambiguous; with several, nothing is preselected.
  const defaultLease = !summary && activeGroups.length === 1 ? activeGroups[0].leaseId : '';
  const target = recordLeaseId ? activeGroups.find((g) => g.leaseId === recordLeaseId) : undefined;
  // A requested lease that ended, moved or is outside this scope never falls back to another one.
  const staleTarget = Boolean(openRecord && recordLeaseId && !target);
  const [leaseId, setLeaseId] = useState(target?.leaseId ?? (staleTarget ? '' : defaultLease));
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [staleNotice, setStaleNotice] = useState(staleTarget && activeGroups.length > 0);

  const cell = (group: BoardGroup, row: BoardRow) => `${group.leaseId}|${row.key}`;
  const picked = groups.flatMap((g) =>
    g.rows.filter((r) => selected.has(cell(g, r))).map((r) => ({ g, r })),
  );
  const pickedLeases = new Set(picked.map(({ g }) => g.leaseId));
  const pickedOwed = picked.reduce((sum, { r }) => sum + r.balanceCents, 0);
  const pickedLease = [...pickedLeases][0] ?? '';
  const canRecordSelected =
    pickedLeases.size === 1 &&
    activeGroups.some((g) => g.leaseId === pickedLease) &&
    pickedOwed > 0;

  useEffect(() => {
    if (openRecord && activeGroups.length) setPaymentOpen(true);
  }, [openRecord, activeGroups.length]);

  const openPayment = (lease: string, cents: number) => {
    setStaleNotice(false);
    setLeaseId(lease);
    setAmount(cents > 0 ? (cents / 100).toFixed(2) : '');
    setPaymentOpen(true);
  };
  const closePayment = () => {
    setStaleNotice(false);
    setPaymentOpen(false);
  };
  const hidden = (
    <>
      <input type="hidden" name="propertyId" value={propertyId} />
      {unitId && <input type="hidden" name="unitId" value={unitId} />}
    </>
  );
  const staleMessage = `The lease you started from can no longer take payments here: it has ended or is not in this ${unitId ? 'unit' : 'property'}.`;
  const occupied = summary?.units.filter((u) => u.status !== 'ENDED').length ?? 0;
  const chosen = activeGroups.find((g) => g.leaseId === leaseId);
  const leasePicker =
    activeGroups.length > 1 || summary || !chosen ? (
      <Field label={summary ? 'Unit and lease' : 'Lease'}>
        <Select
          name="leaseId"
          value={chosen ? leaseId : ''}
          onChange={(e) => setLeaseId(e.target.value)}
          required
        >
          <option value="" disabled>
            {summary ? 'Choose a unit' : 'Choose a lease'}
          </option>
          {activeGroups.map((g) => (
            <option key={g.leaseId} value={g.leaseId}>
              {leaseName(g)}
            </option>
          ))}
        </Select>
      </Field>
    ) : (
      <>
        <p className={styles.note} data-testid="dialog-lease">
          {leaseName(chosen)}
        </p>
        <input type="hidden" name="leaseId" value={chosen.leaseId} />
      </>
    );

  const actions = (
    <>
      <Button
        variant="primary"
        size="sm"
        disabled={activeGroups.length === 0}
        onClick={() => {
          setLeaseId(defaultLease);
          setChargeOpen(true);
        }}
      >
        Create a charge
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={activeGroups.length === 0}
        onClick={() => openPayment(defaultLease, 0)}
      >
        Record payment
      </Button>
      {remindersHref && (
        <Button href={remindersHref} variant="secondary" size="sm">
          Reminders &amp; history
        </Button>
      )}
      <Button href="/integrations" variant="ghost" size="sm">
        Settings
      </Button>
    </>
  );

  return (
    <>
      <RentLedger
        scope={scopeLabel ?? (unitId ? 'This unit' : 'Whole property')}
        balanceCents={balanceCents}
        lastPayment={lastPayment}
        actions={actions}
        notes={
          <div className={styles.ledgerNotes}>
            <span
              className={`${styles.connection} ${providerConnected ? styles.connected : ''}`}
              title="Online payments"
            >
              {providerLabel}
            </span>
            {!summary && tenants.length > 0 && (
              <ul className={styles.tenantList} aria-label="Tenants on the active lease">
                {tenants.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tenants/${t.id}`} className={styles.tenantChip}>
                      <Avatar initials={t.initials} size="sm" />
                      {t.name}
                      <span aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {summary && (
              <span className={styles.note} data-testid="occupied-units">
                {occupied} occupied {occupied === 1 ? 'unit' : 'units'}
                {summary.units.length > occupied &&
                  ` · ${summary.units.length - occupied} with ended leases only`}
              </span>
            )}
            {staleTarget && activeGroups.length === 0 && (
              <p className={styles.warning} role="alert" data-testid="stale-lease">
                {staleMessage}
              </p>
            )}
            {endedBalanceCents !== 0 && (
              <p className={styles.note} data-testid="ended-balance">
                Ended leases carry {formatMoney(endedBalanceCents)},{' '}
                {summary ? 'listed on each unit’s Rent ledger' : 'shown in their own groups'} and
                not included in Balance due.
              </p>
            )}
            {!summary && groups.length > 0 && (
              <p className={styles.note}>
                Late charges are past the lease’s grace period. Scheduled charges are upcoming.
              </p>
            )}
          </div>
        }
      >
        {picked.length > 0 && (
          <div className={styles.bulkBar} role="status">
            <span>
              {picked.length} selected · {formatMoney(pickedOwed)} outstanding
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canRecordSelected}
              title={pickedLeases.size > 1 ? 'Select charges from one lease' : undefined}
              onClick={() => openPayment(pickedLease, pickedOwed)}
            >
              Record payment for selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {groups.length === 0 && (
          <p className={styles.empty}>
            No leases in this {unitId ? 'unit' : 'property'} yet.{' '}
            <Link href="/leases/new">Create a lease</Link> to start charging rent.
          </p>
        )}
        {summary && summary.units.length > 0 && (
          <div className={styles.group} role="region" aria-label="Unit balances" tabIndex={0}>
            <table className={styles.ledger} aria-label="Unit balances" data-testid="unit-summary">
              <thead>
                <tr>
                  <th scope="col" className={styles.firstCol}>
                    Unit
                  </th>
                  <th scope="col">Tenant</th>
                  <th scope="col" className={styles.num}>
                    Balance due
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Next due</th>
                  <th scope="col" aria-label="Open ledger" />
                </tr>
              </thead>
              <tbody>
                {summary.units.map((u) => {
                  const p = unitPill[u.status];
                  const href = withUnit(`/properties/${propertyId}/payments`, u.unitId);
                  return (
                    <tr key={u.unitId} data-status={u.status}>
                      <td className={styles.firstCol}>
                        <Link href={href} className={styles.unitLink}>
                          {u.unitLabel}
                        </Link>
                      </td>
                      <td>
                        {u.tenantNames || '—'}
                        {u.endedLeaseCount > 0 && (
                          <small className={styles.note}>
                            {u.status === 'ENDED' ? 'Previous tenant · ' : ''}
                            {u.endedLeaseCount} ended {u.endedLeaseCount === 1 ? 'lease' : 'leases'}
                          </small>
                        )}
                      </td>
                      <td className={styles.num}>
                        {u.status === 'ENDED' ? '—' : formatMoney(u.balanceCents)}
                        {u.endedBalanceCents !== 0 && (
                          <small>
                            {formatMoney(Math.abs(u.endedBalanceCents))}
                            {u.endedBalanceCents < 0 ? ' credit' : ''} on ended{' '}
                            {u.endedLeaseCount === 1 ? 'lease' : 'leases'}
                          </small>
                        )}
                      </td>
                      <td>
                        <Badge tone={p.tone}>{p.label}</Badge>
                      </td>
                      <td>
                        {u.nextDue ? (
                          <>
                            <span className={styles.nextDate}>{u.nextDue.dateLabel}</span>
                            <small className={styles.note}>
                              {formatMoney(u.nextDue.amountCents)}
                            </small>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={styles.go}>
                        <Link
                          href={href}
                          aria-label={`Open ${u.unitLabel} Rent ledger`}
                          className={styles.chevronLink}
                        >
                          ›
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="col" className={styles.firstCol} colSpan={2}>
                    Total
                  </th>
                  <th scope="col" className={styles.num}>
                    {formatMoney(summary.totalBalanceCents)}
                  </th>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {!summary && groups.length > 0 && (
          <RentLedgerRows
            groups={groups.map((g) => ({
              id: g.leaseId,
              heading: groupHeading(g),
              meta: `${g.label} (${g.rows.length} ${g.rows.length === 1 ? 'charge' : 'charges'})${g.active ? '' : ' · Ended'}`,
              balanceCents: g.balanceCents,
              active: g.active,
              rows: g.rows,
              payments: g.payments,
            }))}
            groupHeadings
            selection={{ selected, onChange: setSelected }}
          />
        )}
      </RentLedger>

      <Dialog
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        title="Create a charge"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChargeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={chargeFormId} variant="primary">
              Create charge
            </Button>
          </>
        }
      >
        <form id={chargeFormId} action={createPropertyChargeAction} className="form">
          {hidden}
          {leasePicker}
          <FormRow>
            <Field label="Type">
              <Select name="kind" defaultValue="OTHER" required>
                <option value="OTHER">Fee</option>
                <option value="DEPOSIT">Security deposit</option>
                <option value="LATE_FEE">Late fee</option>
              </Select>
            </Field>
            <Field label="Date">
              <Input name="dueDate" type="date" defaultValue={today} required />
            </Field>
          </FormRow>
          <Field label="Description">
            <Input name="description" maxLength={200} placeholder="e.g. Pet fee" required />
          </Field>
          <Field label="Amount">
            <Input name="amount" inputMode="decimal" placeholder="150.00" required />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={paymentOpen}
        onClose={closePayment}
        title="Record payment"
        footer={
          <>
            <Button variant="secondary" onClick={closePayment}>
              Cancel
            </Button>
            <Button type="submit" form={paymentFormId} variant="primary">
              Save payment
            </Button>
          </>
        }
      >
        <form id={paymentFormId} action={recordPropertyPaymentAction} className="form">
          {hidden}
          {staleNotice && (
            <p className={styles.warning} role="alert" data-testid="stale-lease">
              {staleMessage} Choose the lease to apply this payment to.
            </p>
          )}
          {leasePicker}
          <Field
            label="Amount"
            hint="Cash, check or money order received outside the app. Applied to the oldest charges first."
          >
            <Input
              name="amount"
              inputMode="decimal"
              placeholder="1,850.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
        </form>
      </Dialog>
    </>
  );
}

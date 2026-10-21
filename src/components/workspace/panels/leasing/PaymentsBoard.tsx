'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Avatar, Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FormRow, Input, Select } from '@/components/ui/Forms';
import { formatMoney, type StatementStatus } from '@/lib/ledger/statement';
import { createPropertyChargeAction, recordPropertyPaymentAction } from './actions';
import { withUnit } from './scope';
import styles from './payments.module.css';

export type BoardRow = {
  key: string;
  type: string;
  description: string;
  month: string;
  day: string;
  dateLabel: string;
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  status: StatementStatus;
  derived: boolean;
  applied: { id: string; amountCents: number; dateLabel: string; method: string }[];
};
export type BoardGroup = {
  leaseId: string;
  label: string;
  place: string;
  active: boolean;
  tenantNames: string;
  rows: BoardRow[];
};
export type BoardTenant = { id: string; name: string; initials: string };
export type BoardUnit = {
  unitId: string;
  leaseId: string;
  unitLabel: string;
  tenantNames: string;
  balanceCents: number;
  status: 'LATE' | 'DUE' | 'CURRENT';
  nextDue: { dateLabel: string; amountCents: number } | null;
};
export type BoardSummary = { units: BoardUnit[]; totalBalanceCents: number };

const unitPill: Record<BoardUnit['status'], { tone: BadgeTone; label: string }> = {
  LATE: { tone: 'danger', label: 'Late' },
  DUE: { tone: 'info', label: 'Due' },
  CURRENT: { tone: 'success', label: 'Current' },
};

/** "Townhome 1 · Sample Tenant"; the unit is left out for a single-family lease. */
const groupHeading = (g: Pick<BoardGroup, 'place' | 'tenantNames'>) =>
  [g.place, g.tenantNames].filter(Boolean).join(' · ') || 'Whole property';

const pill: Record<StatementStatus, { tone: BadgeTone; label: string }> = {
  PAID: { tone: 'success', label: 'Paid' },
  PARTIAL: { tone: 'warning', label: 'Partially paid' },
  LATE: { tone: 'danger', label: 'Late' },
  DUE: { tone: 'info', label: 'Due' },
  SCHEDULED: { tone: 'neutral', label: 'Scheduled' },
};

const CIRCUMFERENCE = 2 * Math.PI * 13;

function Ring({ row }: { row: BoardRow }) {
  const fraction = row.amountCents ? Math.min(1, row.paidCents / row.amountCents) : 0;
  return (
    <svg
      className={`${styles.ring} ${styles[`ring${row.status}`]}`}
      width="34"
      height="34"
      viewBox="0 0 34 34"
      aria-hidden="true"
    >
      <circle cx="17" cy="17" r="13" className={styles.ringTrack} />
      {fraction > 0 && fraction < 1 && (
        <circle
          cx="17"
          cy="17"
          r="13"
          className={styles.ringArc}
          strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`}
          transform="rotate(-90 17 17)"
        />
      )}
    </svg>
  );
}

export function PaymentsBoard({
  propertyId,
  unitId,
  balanceCents,
  providerLabel,
  providerConnected,
  tenants,
  groups,
  summary,
  openRecord,
  today,
}: {
  propertyId: string;
  unitId?: string;
  balanceCents: number;
  providerLabel: string;
  providerConnected: boolean;
  tenants: BoardTenant[];
  groups: BoardGroup[];
  /** Set for a multi-unit property without a unit scope: replaces the ledger with a per-unit table. */
  summary: BoardSummary | null;
  openRecord: boolean;
  today: string;
}) {
  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const chargeFormId = useId();
  const paymentFormId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<BoardRow | null>(null);
  const [amount, setAmount] = useState('');
  const activeGroups = groups.filter((g) => g.active);
  const defaultLease = summary ? '' : (activeGroups[0]?.leaseId ?? '');
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(groups.filter((g) => !g.active).map((g) => g.leaseId)),
  );
  const [leaseId, setLeaseId] = useState(defaultLease);

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

  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allRows = groups.flatMap((g) => g.rows.map((r) => cell(g, r)));
  const toggleAll = (on: boolean) => setSelected(on ? new Set(allRows) : new Set());
  const openPayment = (lease: string, cents: number) => {
    setLeaseId(lease);
    setAmount(cents > 0 ? (cents / 100).toFixed(2) : '');
    setPaymentOpen(true);
  };
  const hidden = (
    <>
      <input type="hidden" name="propertyId" value={propertyId} />
      {unitId && <input type="hidden" name="unitId" value={unitId} />}
    </>
  );
  const leasePicker =
    activeGroups.length > 1 || summary ? (
      <Field label={summary ? 'Unit' : 'Lease'}>
        <Select
          name="leaseId"
          value={leaseId}
          onChange={(e) => setLeaseId(e.target.value)}
          required
        >
          {summary && (
            <option value="" disabled>
              Choose a unit
            </option>
          )}
          {activeGroups.map((g) => (
            <option key={g.leaseId} value={g.leaseId}>
              {groupHeading(g)}
            </option>
          ))}
        </Select>
      </Field>
    ) : (
      <input type="hidden" name="leaseId" value={leaseId || defaultLease} />
    );

  return (
    <>
      <section className={styles.summary} aria-label="Payment summary">
        <div className={styles.summaryTop}>
          <div>
            <p className={styles.tenantsLabel}>Current balance</p>
            <strong className={styles.balance} data-testid="balance">
              {formatMoney(balanceCents)}
            </strong>
            <p className={styles.note}>
              Balance based on current charges and payments
              {balanceCents < 0 ? ' (credit on account)' : ''}
            </p>
          </div>
          <div className={styles.summaryActions}>
            <span className={`${styles.connection} ${providerConnected ? styles.connected : ''}`}>
              {providerLabel}
            </span>
            <Button href="/integrations" variant="secondary" size="sm">
              Settings
            </Button>
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
          </div>
        </div>
        {summary && (
          <p className={styles.note} data-testid="occupied-units">
            {summary.units.length} occupied {summary.units.length === 1 ? 'unit' : 'units'}
          </p>
        )}
        {!summary && tenants.length > 0 && (
          <div className={styles.tenants}>
            <span className={styles.tenantsLabel}>Tenants on the active lease</span>
            <ul>
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
          </div>
        )}
      </section>

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
        <div className="card">
          <p className={styles.empty}>
            No leases in this {unitId ? 'unit' : 'property'} yet.{' '}
            <Link href="/leases/new">Create a lease</Link> to start charging rent.
          </p>
        </div>
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
                  Balance
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
                    <td>{u.tenantNames || '—'}</td>
                    <td className={styles.num}>{formatMoney(u.balanceCents)}</td>
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
                        aria-label={`Open ${u.unitLabel} ledger`}
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
        <>
          <div className={styles.ledgerHeading}>
            <h3>Charge ledger</h3>
            <p className={styles.note}>
              Late charges are past the lease’s grace period. Scheduled charges are upcoming.
            </p>
          </div>
          <div className={styles.group} role="region" aria-label="Charge ledger" tabIndex={0}>
            <table className={styles.ledger} aria-label="Charge ledger">
              <thead>
                <tr>
                  <th scope="col" className={styles.check}>
                    <input
                      type="checkbox"
                      aria-label="Select all charges"
                      checked={allRows.length > 0 && allRows.every((c) => selected.has(c))}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.num}>
                    Amount
                  </th>
                  <th scope="col" aria-label="Payment progress" />
                  <th scope="col">Details</th>
                </tr>
              </thead>
              {groups.map((group) => {
                const closed = collapsed.has(group.leaseId);
                return (
                  <tbody key={group.leaseId}>
                    <tr className={styles.groupRow}>
                      <td colSpan={7}>
                        <button
                          type="button"
                          className={styles.groupToggle}
                          aria-expanded={!closed}
                          onClick={() =>
                            setCollapsed((cur) => {
                              const next = new Set(cur);
                              if (closed) next.delete(group.leaseId);
                              else next.add(group.leaseId);
                              return next;
                            })
                          }
                        >
                          <span
                            className={`${styles.chevron} ${closed ? styles.chevronClosed : ''}`}
                            aria-hidden="true"
                          />
                          <strong>{groupHeading(group)}</strong>
                          <span className={styles.groupMeta}>
                            {group.label} ({group.rows.length}{' '}
                            {group.rows.length === 1 ? 'charge' : 'charges'})
                            {group.active ? '' : ' · Ended'}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!closed &&
                      group.rows.map((row) => {
                        const p = pill[row.status];
                        return (
                          <tr key={row.key} data-status={row.status}>
                            <td className={styles.check}>
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.description}`}
                                checked={selected.has(cell(group, row))}
                                onChange={(e) => toggle(cell(group, row), e.target.checked)}
                              />
                            </td>
                            <td>
                              <div
                                className={styles.date}
                                aria-label={row.dateLabel}
                                title={row.dateLabel}
                              >
                                <span>{row.month}</span>
                                <strong>{row.day}</strong>
                              </div>
                            </td>
                            <td className={styles.desc}>
                              <small>{row.type}</small>
                              {row.description}
                            </td>
                            <td>
                              <Badge tone={p.tone}>{p.label}</Badge>
                            </td>
                            <td className={styles.num}>
                              {formatMoney(row.amountCents)}
                              <small>Balance: {formatMoney(row.balanceCents)}</small>
                            </td>
                            <td>
                              <Ring row={row} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.view}
                                aria-label={`View ${row.description}, ${row.dateLabel}`}
                                onClick={() => setDetail(row)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                );
              })}
            </table>
          </div>
        </>
      )}

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
          {!summary && activeGroups.length === 1 && (
            <p className={styles.note}>{groupHeading(activeGroups[0])}</p>
          )}
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
        onClose={() => setPaymentOpen(false)}
        title="Record payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
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
          {!summary && activeGroups.length === 1 && (
            <p className={styles.note}>{groupHeading(activeGroups[0])}</p>
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

      <Dialog
        open={Boolean(detail)}
        title={detail?.description ?? 'Charge details'}
        onClose={() => setDetail(null)}
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Done
          </Button>
        }
      >
        {detail && (
          <>
            <dl className={styles.facts}>
              <div>
                <dt>Type</dt>
                <dd>{detail.type}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{detail.dateLabel}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge tone={pill[detail.status].tone}>{pill[detail.status].label}</Badge>
                </dd>
              </div>
              <div>
                <dt>Charge</dt>
                <dd>{formatMoney(detail.amountCents)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{formatMoney(detail.paidCents)}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>{formatMoney(detail.balanceCents)}</dd>
              </div>
            </dl>
            {detail.derived && (
              <p className={styles.note}>
                Upcoming rent from the lease schedule. It becomes a charge when it comes due.
              </p>
            )}
            <h3>Payments applied</h3>
            {detail.applied.length === 0 ? (
              <p className={styles.note}>No payments applied yet.</p>
            ) : (
              <ul className={styles.applied}>
                {detail.applied.map((a, i) => (
                  <li key={`${a.id}-${i}`}>
                    <span>
                      <strong>{formatMoney(a.amountCents)}</strong> on {a.dateLabel}
                    </span>
                    <small>{a.method}</small>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}

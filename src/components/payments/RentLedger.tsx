'use client';

import { useId, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { formatMoney } from '@/lib/ledger/statement';
import {
  PAYMENT_PILL,
  STATUS_PILL,
  type LastPaymentView,
  type LedgerRowView,
  type PaymentView,
} from './ledger-view';
import styles from './rent-ledger.module.css';

export type RentLedgerGroup = {
  /** Stable id; selection keys are `${id}|${row.key}`. */
  id: string;
  heading: string;
  /** Period, charge count and (for ended leases) "Ended". */
  meta: string;
  balanceCents: number;
  active: boolean;
  rows: LedgerRowView[];
  /** Payment history for the term; shown even when the term has no charges. */
  payments?: PaymentView[];
};

export type LedgerSelection = {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

/**
 * The Rent ledger card used by every Payments scope (lease, unit, property): title, explicit scope,
 * actions, the Balance due / Last payment summary and then the body (rows or a unit table).
 */
export function RentLedger({
  scope,
  balanceCents,
  lastPayment,
  actions,
  notes,
  children,
  headingLevel = 2,
}: {
  scope: ReactNode;
  balanceCents: number;
  lastPayment: LastPaymentView;
  actions?: ReactNode;
  notes?: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <Heading id={titleId}>Rent ledger</Heading>
          <p className={styles.scope} data-testid="ledger-scope">
            {scope}
          </p>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <dl className={styles.facts}>
        <div>
          <dt>{balanceCents < 0 ? 'Credit on account' : 'Balance due'}</dt>
          <dd data-testid="balance">{formatMoney(Math.abs(balanceCents))}</dd>
        </div>
        <div>
          <dt>Last payment</dt>
          <dd data-testid="last-payment">
            {lastPayment ? (
              <>
                {lastPayment.dateLabel}
                <small>{formatMoney(lastPayment.amountCents)}</small>
              </>
            ) : (
              'None yet'
            )}
          </dd>
        </div>
      </dl>
      {notes}
      {children}
    </section>
  );
}

const cell = (groupId: string, rowKey: string) => `${groupId}|${rowKey}`;

/** "Balance $12.00" or, when payments exceed charges, "Credit $12.00". */
const balanceText = (cents: number) =>
  `${cents < 0 ? 'Credit' : 'Balance'} ${formatMoney(Math.abs(cents))}`;

/**
 * Every payment on one lease term, including ones that settled no listed charge (credit), so
 * payment-only history stays visible without inventing charges.
 */
function PaymentHistory({
  group,
  open,
}: {
  group: Pick<RentLedgerGroup, 'id' | 'heading' | 'payments'>;
  open: boolean;
}) {
  const payments = group.payments ?? [];
  if (!payments.length) return null;
  return (
    <details className={styles.history} open={open || undefined}>
      <summary>
        Payment history ({payments.length} {payments.length === 1 ? 'payment' : 'payments'})
      </summary>
      <ul className={styles.historyList} aria-label={`Payments on ${group.heading}`}>
        {payments.map((p) => {
          const pill = PAYMENT_PILL[p.status];
          return (
            <li key={p.id} data-status={p.status}>
              <span className={styles.main}>
                <strong>{p.reference}</strong>
                <small>
                  {p.dateLabel} · {p.method}
                </small>
              </span>
              <span className={styles.status}>
                <Badge tone={pill.tone}>{pill.label}</Badge>
              </span>
              <span className={styles.amount}>
                <strong>{formatMoney(p.amountCents)}</strong>
                {p.creditCents > 0 && <small>{formatMoney(p.creditCents)} credit</small>}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Charge rows in the quiet lease-ledger style, grouped by lease term, with details and optional selection. */
export function RentLedgerRows({
  groups,
  groupHeadings,
  selection,
  emptyText = 'No charges due yet.',
}: {
  groups: RentLedgerGroup[];
  groupHeadings: boolean;
  selection?: LedgerSelection;
  emptyText?: string;
}) {
  const [detail, setDetail] = useState<{ row: LedgerRowView; group: RentLedgerGroup } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(groupHeadings ? groups.filter((g) => !g.active).map((g) => g.id) : []),
  );
  const rows = groups.flatMap((g) => g.rows.map((r) => cell(g.id, r.key)));
  const hasPayments = groups.some((g) => g.payments?.length);
  if (!rows.length && !hasPayments) return <p className={styles.empty}>{emptyText}</p>;
  const toggle = (key: string, on: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (on) next.add(key);
    else next.delete(key);
    selection.onChange(next);
  };

  return (
    <>
      {selection && rows.length > 0 && (
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={rows.every((key) => selection.selected.has(key))}
            onChange={(e) => selection.onChange(new Set(e.target.checked ? rows : []))}
          />
          Select all charges
        </label>
      )}
      {groups.map((group) => {
        const closed = collapsed.has(group.id);
        const listId = `ledger-${group.id}`;
        return (
          <div key={group.id} className={styles.group} data-active={group.active}>
            {groupHeadings && (
              <button
                type="button"
                className={styles.groupToggle}
                aria-expanded={!closed}
                aria-controls={listId}
                onClick={() =>
                  setCollapsed((cur) => {
                    const next = new Set(cur);
                    if (closed) next.delete(group.id);
                    else next.add(group.id);
                    return next;
                  })
                }
              >
                <span className={styles.chevron} data-closed={closed} aria-hidden="true" />
                <strong>{group.heading}</strong>
                <span className={styles.groupMeta}>
                  {group.meta} · {balanceText(group.balanceCents)}
                </span>
              </button>
            )}
            {!closed && (
              <div id={listId}>
                {group.rows.length === 0 ? (
                  <p className={styles.noCharges}>
                    No charges on this lease
                    {group.balanceCents < 0 ? ` · ${formatMoney(-group.balanceCents)} credit` : ''}.
                  </p>
                ) : (
                  <ul className={styles.rows} aria-label={group.heading}>
                    {group.rows.map((row) => {
                      const pill = STATUS_PILL[row.status];
                      const key = cell(group.id, row.key);
                      return (
                        <li key={row.key} className={styles.row} data-status={row.status}>
                          {selection && (
                            <input
                              type="checkbox"
                              className={styles.check}
                              aria-label={`Select ${row.description}, ${row.dateLabel}`}
                              checked={selection.selected.has(key)}
                              onChange={(e) => toggle(key, e.target.checked)}
                            />
                          )}
                          <span className={styles.type}>
                            <Badge>{row.type}</Badge>
                          </span>
                          <span className={styles.main}>
                            <strong>{row.description}</strong>
                            <small>Due {row.dateLabel}</small>
                          </span>
                          <span className={styles.status}>
                            <Badge tone={pill.tone}>{pill.label}</Badge>
                          </span>
                          <span className={styles.amount}>
                            <strong>{formatMoney(row.amountCents)}</strong>
                            {row.balanceCents !== 0 && row.balanceCents !== row.amountCents && (
                              <small>{formatMoney(row.balanceCents)} left</small>
                            )}
                          </span>
                          <button
                            type="button"
                            className={styles.view}
                            aria-label={`Details for ${row.description}, ${row.dateLabel}`}
                            onClick={() => setDetail({ row, group })}
                          >
                            Details
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <PaymentHistory group={group} open={group.rows.length === 0} />
              </div>
            )}
          </div>
        );
      })}

      <Dialog
        open={Boolean(detail)}
        title={detail?.row.description ?? 'Charge details'}
        onClose={() => setDetail(null)}
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Done
          </Button>
        }
      >
        {detail && <ChargeDetail row={detail.row} group={detail.group} />}
      </Dialog>
    </>
  );
}

/** Charge facts, the lease it belongs to and the payments applied to it. */
function ChargeDetail({ row, group }: { row: LedgerRowView; group: RentLedgerGroup }) {
  return (
    <>
      <dl className={styles.detailFacts}>
        <div className={styles.detailLease}>
          <dt>Lease</dt>
          <dd>{[group.heading, group.meta].filter(Boolean).join(' · ')}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{row.type}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{row.dateLabel}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <Badge tone={STATUS_PILL[row.status].tone}>{STATUS_PILL[row.status].label}</Badge>
          </dd>
        </div>
        <div>
          <dt>Charge</dt>
          <dd>{formatMoney(row.amountCents)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{formatMoney(row.paidCents)}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{formatMoney(row.balanceCents)}</dd>
        </div>
      </dl>
      {row.derived && (
        <p className={styles.note}>
          Upcoming rent from the lease schedule. It becomes a charge when it comes due.
        </p>
      )}
      <h3 className={styles.appliedTitle}>Payments applied</h3>
      {row.applied.length === 0 ? (
        <p className={styles.note}>No payments applied yet.</p>
      ) : (
        <ul className={styles.applied}>
          {row.applied.map((a, i) => (
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
  );
}

'use client';

import { useId, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { formatMoney } from '@/lib/ledger/statement';
import { STATUS_PILL, type LastPaymentView, type LedgerRowView } from './ledger-view';
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
  const [detail, setDetail] = useState<LedgerRowView | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(groupHeadings ? groups.filter((g) => !g.active).map((g) => g.id) : []),
  );
  const rows = groups.flatMap((g) => g.rows.map((r) => cell(g.id, r.key)));
  if (!rows.length) return <p className={styles.empty}>{emptyText}</p>;
  const toggle = (key: string, on: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (on) next.add(key);
    else next.delete(key);
    selection.onChange(next);
  };

  return (
    <>
      {selection && (
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
                  {group.meta} · Balance {formatMoney(group.balanceCents)}
                </span>
              </button>
            )}
            {!closed && (
              <ul className={styles.rows} id={listId} aria-label={group.heading}>
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
                        onClick={() => setDetail(row)}
                      >
                        Details
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

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
            <dl className={styles.detailFacts}>
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
                  <Badge tone={STATUS_PILL[detail.status].tone}>
                    {STATUS_PILL[detail.status].label}
                  </Badge>
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
            <h3 className={styles.appliedTitle}>Payments applied</h3>
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

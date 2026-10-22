import type { BadgeTone } from '@/components/ui/Badge';
import type { LastPayment, PaymentHistoryEntry, StatementRow, StatementStatus } from '@/lib/ledger';

/** Serializable Rent ledger row shared by the lease, unit and property Payments views. */
export type LedgerRowView = {
  key: string;
  type: string;
  description: string;
  dateLabel: string;
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  status: StatementStatus;
  derived: boolean;
  applied: { id: string; amountCents: number; dateLabel: string; method: string }[];
  /** "2026-08": the due month, used to name a folded run of settled months. */
  month?: string;
};

export type LastPaymentView = { dateLabel: string; amountCents: number } | null;

/** One payment on a lease as shown in its payment history. */
export type PaymentView = {
  id: string;
  dateLabel: string;
  amountCents: number;
  status: PaymentHistoryEntry['status'];
  method: string;
  reference: string;
  /** Settled amount not applied to any listed charge: credit on the lease. */
  creditCents: number;
};

export const PAYMENT_PILL: Record<PaymentView['status'], { tone: BadgeTone; label: string }> = {
  SUCCEEDED: { tone: 'success', label: 'Received' },
  PENDING: { tone: 'info', label: 'Pending' },
  FAILED: { tone: 'danger', label: 'Failed' },
  REFUNDED: { tone: 'neutral', label: 'Refunded' },
};

export const STATUS_PILL: Record<StatementStatus, { tone: BadgeTone; label: string }> = {
  PAID: { tone: 'success', label: 'Paid' },
  PARTIAL: { tone: 'warning', label: 'Partially paid' },
  // Late always means unpaid past the lease's grace period.
  LATE: { tone: 'danger', label: 'Late · past grace' },
  DUE: { tone: 'info', label: 'Due' },
  SCHEDULED: { tone: 'neutral', label: 'Scheduled' },
};

export const ledgerDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** Rows newest first, the order of the preferred lease Rent ledger. */
export const toLedgerRows = (rows: StatementRow[]): LedgerRowView[] =>
  rows
    .map((row) => ({
      key: row.key,
      type: row.typeLabel,
      description: row.description,
      dateLabel: ledgerDate(row.dueDate),
      amountCents: row.amountCents,
      paidCents: row.paidCents,
      balanceCents: row.balanceCents,
      status: row.status,
      derived: row.derived,
      applied: row.applied.map((a) => ({
        id: a.paymentId,
        amountCents: a.amountCents,
        dateLabel: a.date ? ledgerDate(a.date) : 'unknown date',
        method: a.method,
      })),
      month: row.dueDate.toISOString().slice(0, 7),
    }))
    .reverse();

/** Date the charge was fully settled: the last payment applied to a paid row. */
export const paidDateLabel = (row: Pick<LedgerRowView, 'status' | 'applied'>) =>
  row.status === 'PAID' ? row.applied.at(-1)?.dateLabel : undefined;

const monthName = (month: string, withYear: boolean) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });

/** "January – August 2026", "December 2025 – February 2026" or "March 2026". */
export function monthRangeLabel(first: string, last: string): string {
  if (first === last) return monthName(first, true);
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  return `${monthName(first, !sameYear)} – ${monthName(last, true)}`;
}

export type SettledRun = {
  rows: LedgerRowView[];
  /** "January – August 2026 · 8 rent charges · all paid". */
  label: string;
};

/**
 * Folds the oldest run of fully paid charges (rows are newest first) so open, upcoming and the most
 * recent paid charge stay in view. Nothing is folded unless at least two older paid rows remain.
 */
export function foldSettledRows(rows: LedgerRowView[]): {
  visible: LedgerRowView[];
  settled: SettledRun | null;
} {
  let start = rows.length;
  while (start > 0 && rows[start - 1].status === 'PAID') start -= 1;
  // Keep the newest paid charge of the run visible as recent context.
  const from = start + 1;
  const folded = rows.slice(from);
  if (folded.length < 2) return { visible: rows, settled: null };
  const months = folded.map((r) => r.month).filter((m): m is string => Boolean(m));
  const range = months.length
    ? monthRangeLabel(months.at(-1)!, months[0])
    : `${folded.at(-1)!.dateLabel} – ${folded[0].dateLabel}`;
  const types = new Set(folded.map((r) => r.type));
  const noun = types.size === 1 ? `${[...types][0].toLowerCase()} charges` : 'charges';
  return {
    visible: rows.slice(0, from),
    settled: { rows: folded, label: `${range} · ${folded.length} ${noun} · all paid` },
  };
}

/**
 * A short excerpt for a lease summary: every open charge (late, due, partially paid), the next
 * scheduled charge and the most recent paid one, newest first.
 */
export function recentLedgerRows(rows: LedgerRowView[], limit = 4): LedgerRowView[] {
  const open = rows.filter((r) => r.status !== 'PAID' && r.status !== 'SCHEDULED');
  const scheduled = rows.filter((r) => r.status === 'SCHEDULED');
  const next = scheduled.at(-1);
  const paid = rows.find((r) => r.status === 'PAID');
  // Open charges are never dropped; context rows fill the remaining space.
  const keep = new Set(open);
  for (const row of [next, paid]) if (row && keep.size < limit) keep.add(row);
  return rows.filter((r) => keep.has(r));
}

export const toPaymentViews = (payments: PaymentHistoryEntry[]): PaymentView[] =>
  payments.map((p) => ({
    id: p.id,
    dateLabel: p.date ? ledgerDate(p.date) : 'Unknown date',
    amountCents: p.amountCents,
    status: p.status,
    method: p.method,
    reference: p.reference,
    creditCents: p.status === 'SUCCEEDED' && p.amountCents > 0 ? p.amountCents - p.appliedCents : 0,
  }));

export const toLastPayment = (last: LastPayment | null): LastPaymentView =>
  last && { dateLabel: ledgerDate(last.date), amountCents: last.amountCents };

import type { BadgeTone } from '@/components/ui/Badge';
import type { LastPayment, StatementRow, StatementStatus } from '@/lib/ledger';

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
};

export type LastPaymentView = { dateLabel: string; amountCents: number } | null;

export const STATUS_PILL: Record<StatementStatus, { tone: BadgeTone; label: string }> = {
  PAID: { tone: 'success', label: 'Paid' },
  PARTIAL: { tone: 'warning', label: 'Partially paid' },
  LATE: { tone: 'danger', label: 'Late' },
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
    }))
    .reverse();

export const toLastPayment = (last: LastPayment | null): LastPaymentView =>
  last && { dateLabel: ledgerDate(last.date), amountCents: last.amountCents };

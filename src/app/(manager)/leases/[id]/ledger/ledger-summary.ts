import type { PaymentHistoryEntry, StatementRow } from '@/lib/ledger';
import { ledgerDate } from '@/components/payments/ledger-view';

export type LedgerSummary = {
  asOfLabel: string;
  /** Balance due never goes below zero; a negative statement balance is credit instead. */
  balanceDueCents: number;
  creditCents: number;
  /** Unpaid charges past the lease's grace period. */
  lateCount: number;
  lateCents: number;
  /** Charges due but still within the grace period (including partly paid ones). */
  openCount: number;
  openCents: number;
  /** Payments started but not settled; never deducted from the balance. */
  pendingCents: number;
};

/** Summary band figures for one lease statement, keeping the ledger's exact semantics. */
export function ledgerSummary(
  ledger: {
    rows: Pick<StatementRow, 'status' | 'balanceCents'>[];
    balanceCents: number;
    payments: Pick<PaymentHistoryEntry, 'status' | 'amountCents'>[];
  },
  asOf: Date,
): LedgerSummary {
  const late = ledger.rows.filter((r) => r.status === 'LATE' && r.balanceCents > 0);
  const open = ledger.rows.filter(
    (r) => (r.status === 'DUE' || r.status === 'PARTIAL') && r.balanceCents > 0,
  );
  const sum = (rows: { balanceCents: number }[]) => rows.reduce((s, r) => s + r.balanceCents, 0);
  return {
    asOfLabel: ledgerDate(asOf),
    balanceDueCents: Math.max(ledger.balanceCents, 0),
    creditCents: Math.max(-ledger.balanceCents, 0),
    lateCount: late.length,
    lateCents: sum(late),
    openCount: open.length,
    openCents: sum(open),
    pendingCents: ledger.payments
      .filter((p) => p.status === 'PENDING')
      .reduce((s, p) => s + p.amountCents, 0),
  };
}

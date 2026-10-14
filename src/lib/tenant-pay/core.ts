/**
 * Pure tenant-pay rules: provider-token safety, card-fee math, amount-due breakdowns and
 * receipt shaping. Everything works on integer cents from the ledger, never touches the
 * database or the clock, and never sees a card or bank account number.
 */
import {
  computeBalance,
  formatUsd,
  monthKey,
  type LedgerCharge,
  type LedgerPayment,
  type PaymentStatusName,
} from '@/lib/ledger/core';

export { formatUsd };

/** Card processing fee passed to the tenant when the org passes fees on: 2.9% of the payment. */
export const CARD_FEE_BPS = 290;

export function cardFeeCents(amountCents: number, passFees: boolean): number {
  if (!passFees || amountCents <= 0) return 0;
  return Math.round((amountCents * CARD_FEE_BPS) / 10_000);
}

export type PayMethodType = 'card' | 'ach';

/**
 * Stand-ins for provider-hosted fields in development. In production these tokens come from
 * Stripe Elements / Plaid Link; the mock values let the whole flow run without real details.
 * Only the trailing digits are ever displayed, as PaymentMethod.last4.
 */
export const MOCK_TOKENS: Record<PayMethodType, { token: string; label: string; detail: string }> =
  {
    ach: {
      token: 'tok_mock_bank_6789',
      label: 'Bank transfer (ACH)',
      detail: 'Mock bank ••••6789',
    },
    card: { token: 'tok_mock_card_4242', label: 'Card', detail: 'Mock card ••••4242' },
  };

const looksLikeAccountNumber = (value: string) => /^\d{9,19}$/.test(value.replace(/[\s-]/g, ''));

/**
 * Accepts only provider-issued tokens. A raw card or account number is rejected outright so
 * it can never be stored, logged through this path, or sent onward as if it were a token.
 */
export function validateProviderToken(
  token: string,
  type: PayMethodType,
): { token: string; last4: string } {
  const value = token.trim();
  if (looksLikeAccountNumber(value))
    throw new Error('Enter card or bank details in the provider fields, not as a token');
  if (!/^tok_[A-Za-z0-9_]+$/.test(value) && !/^pm_[A-Za-z0-9_]+$/.test(value))
    throw new Error('Provider-issued payment token required');
  if (type !== 'card' && type !== 'ach') throw new Error('Choose card or bank transfer');
  const digits = value.replace(/\D/g, '');
  return { token: value, last4: digits.slice(-4) || '••••' };
}

export function validatePayAmount(amountCents: number, totalDueCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
    throw new Error('Enter an amount greater than zero');
  if (totalDueCents <= 0) throw new Error('Nothing is due right now');
  if (amountCents > totalDueCents) throw new Error('Amount is more than the amount due');
  return amountCents;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthLabel(date: Date): string {
  return MONTHS[date.getUTCMonth()] ?? '';
}

export function monthYearLabel(date: Date): string {
  return `${monthLabel(date)} ${date.getUTCFullYear()}`;
}

export function chargeLabel(charge: LedgerCharge): string {
  if (charge.kind === 'RENT') return `${monthLabel(charge.dueDate)} rent`;
  if (charge.kind === 'LATE_FEE') return 'Late fee';
  if (charge.kind === 'DEPOSIT') return 'Deposit';
  return charge.description?.trim() || 'Charge';
}

export type DueLine = {
  chargeId: string | undefined;
  label: string;
  dueDate: Date;
  amountCents: number;
  paidCents: number;
  outstandingCents: number;
};

export type AmountDue = {
  lines: DueLine[];
  totalDueCents: number;
  chargedCents: number;
  paidCents: number;
  pendingCents: number;
  creditCents: number;
  /** Earliest unpaid charge; the date the pay page headlines. */
  dueDate: Date | null;
  billingMonth: string | null;
};

/** Amount-due breakdown straight from the ledger: settled payments apply oldest first. */
export function buildAmountDue(charges: LedgerCharge[], payments: LedgerPayment[]): AmountDue {
  const balance = computeBalance(charges, payments);
  const lines = balance.allocations
    .filter((a) => a.outstandingCents > 0)
    .map((a) => ({
      chargeId: a.charge.id,
      label: chargeLabel(a.charge),
      dueDate: a.charge.dueDate,
      amountCents: a.charge.amountCents,
      paidCents: a.paidCents,
      outstandingCents: a.outstandingCents,
    }));
  const first = lines[0];
  return {
    lines,
    totalDueCents: balance.outstandingCents,
    chargedCents: balance.chargedCents,
    paidCents: balance.paidCents,
    pendingCents: balance.pendingCents,
    creditCents: balance.creditCents,
    dueDate: first?.dueDate ?? null,
    billingMonth: first ? monthKey(first.dueDate) : null,
  };
}

export type Receipt = {
  paymentId: string | undefined;
  label: string;
  amountCents: number;
  status: PaymentStatusName;
  statusLabel: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  date: Date;
};

const STATUS_LABEL: Record<PaymentStatusName, Receipt['statusLabel']> = {
  SUCCEEDED: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

/** Recent receipts, newest first. The label names the month the money settled. */
export function buildReceipts(payments: LedgerPayment[], limit = 6): Receipt[] {
  return payments
    .slice()
    .sort((a, b) => {
      const at = (a.paidAt ?? a.createdAt ?? new Date(0)).getTime();
      const bt = (b.paidAt ?? b.createdAt ?? new Date(0)).getTime();
      return bt - at;
    })
    .slice(0, limit)
    .map((p) => {
      const date = p.paidAt ?? p.createdAt ?? new Date(0);
      return {
        paymentId: p.id,
        label: `${monthLabel(date)} rent`,
        amountCents: p.amountCents,
        status: p.status,
        statusLabel: STATUS_LABEL[p.status],
        date,
      };
    });
}

/**
 * Pure rent-ledger rules. Everything here works on integer cents and UTC dates, never touches the
 * database and never reads the clock, so every result is reproducible from its inputs.
 *
 * Conventions:
 * - Rent is due on the 1st of each month the lease overlaps. No proration.
 * - A charge is identified by a deterministic key (`rent:<lease>:<YYYY-MM>`, `late-fee:<lease>:<YYYY-MM>`)
 *   stored in Charge.description, so planning is idempotent.
 * - Only SUCCEEDED payments settle charges. PENDING payments are tracked separately; FAILED and
 *   REFUNDED payments never count.
 * - Payments settle the oldest charge first (rent before late fee within the same due date).
 */

export type Cents = number;
export type ChargeKindName = 'RENT' | 'LATE_FEE' | 'DEPOSIT' | 'OTHER';
export type PaymentStatusName = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export type LeaseTerms = {
  id: string;
  startDate: Date;
  endDate: Date;
  monthlyRentCents: Cents;
  lateFeeCents: Cents;
  graceDays: number;
  status: 'DRAFT' | 'ACTIVE' | 'ENDED' | 'TERMINATED';
};

export type LedgerCharge = {
  id?: string;
  leaseId: string;
  kind: ChargeKindName;
  amountCents: Cents;
  dueDate: Date;
  description?: string | null;
};

export type LedgerPayment = {
  id?: string;
  leaseId: string;
  amountCents: Cents;
  status: PaymentStatusName;
  paidAt?: Date | null;
  createdAt?: Date;
  providerReference?: string | null;
};

export type NewCharge = {
  leaseId: string;
  kind: 'RENT' | 'LATE_FEE';
  amountCents: Cents;
  dueDate: Date;
  description: string;
};

// ---------------------------------------------------------------------------------------- money

/** Parses a decimal string, number or Prisma Decimal (2 places) into integer cents without float drift. */
export function toCents(value: { toString(): string } | string | number): Cents {
  const text = typeof value === 'number' ? value.toFixed(2) : value.toString().trim();
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) throw new Error(`Invalid money amount: ${text}`);
  const fraction = (match[3] ?? '').padEnd(3, '0');
  let cents = Number(match[2]) * 100 + Number(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1;
  return match[1] ? -cents : cents;
}

/** Cents → decimal string with exactly two places, suitable for Prisma Decimal columns. */
export function centsToDecimal(cents: Cents): string {
  assertCents(cents, true);
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function formatUsd(cents: Cents): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100 === 0 ? '' : `.${String(abs % 100).padStart(2, '0')}`;
  return `${cents < 0 ? '-' : ''}$${dollars}${rest}`;
}

export function assertCents(value: number, allowNegative = false): void {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0))
    throw new Error('Amount must be a whole number of cents');
}

// ---------------------------------------------------------------------------------------- dates

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthStart(key: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new Error('Invalid month');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export function addMonths(key: string, count: number): string {
  const start = monthStart(key);
  return monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + count, 1)));
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const DAY_MS = 86_400_000;

/** Last day on which rent can be paid without a late fee. */
export function graceEnd(dueDate: Date, graceDays: number): Date {
  return new Date(startOfUtcDay(dueDate).getTime() + Math.max(0, graceDays) * DAY_MS);
}

/** A charge is past its grace period once the whole grace day has elapsed. */
export function isPastGrace(dueDate: Date, graceDays: number, asOf: Date): boolean {
  return startOfUtcDay(asOf).getTime() > graceEnd(dueDate, graceDays).getTime();
}

// ---------------------------------------------------------------------------------------- keys

export const rentKey = (leaseId: string, month: string) => `rent:${leaseId}:${month}`;
export const lateFeeKey = (leaseId: string, month: string) => `late-fee:${leaseId}:${month}`;
export const manualPaymentRef = (key: string) => `manual:${key}`;
export const refundRef = (paymentId: string, key: string) => `refund:${paymentId}:${key}`;

// ---------------------------------------------------------------------------------------- charges

/** The month a lease first appears in the ledger: its first payment's month or the current month. */
function firstLedgerMonth(
  lease: LeaseTerms,
  payments: LedgerPayment[],
  asOfMonth: string,
  monthsBack: number,
): string {
  const earliest = payments
    .filter((p) => p.leaseId === lease.id && (p.paidAt ?? p.createdAt))
    .map((p) => monthKey((p.paidAt ?? p.createdAt) as Date))
    .sort()[0];
  const floor = addMonths(asOfMonth, -monthsBack);
  const wanted = earliest && earliest < asOfMonth ? earliest : asOfMonth;
  const start = [wanted, floor, monthKey(lease.startDate)].sort().at(-1) as string;
  return start;
}

/**
 * Monthly rent charges that should exist for a lease up to asOf but do not yet. Calling it again
 * with the created charges included returns an empty list.
 */
export function planRentCharges(
  lease: LeaseTerms,
  existing: LedgerCharge[],
  payments: LedgerPayment[],
  asOf: Date,
  monthsBack = 12,
): NewCharge[] {
  if (lease.status !== 'ACTIVE' || lease.monthlyRentCents <= 0) return [];
  assertCents(lease.monthlyRentCents);
  const asOfMonth = monthKey(asOf);
  const last = [asOfMonth, monthKey(lease.endDate)].sort()[0];
  const have = new Set(existing.map((c) => c.description));
  const out: NewCharge[] = [];
  for (
    let month = firstLedgerMonth(lease, payments, asOfMonth, monthsBack);
    month <= last;
    month = addMonths(month, 1)
  ) {
    const description = rentKey(lease.id, month);
    if (have.has(description)) continue;
    out.push({
      leaseId: lease.id,
      kind: 'RENT',
      amountCents: lease.monthlyRentCents,
      dueDate: monthStart(month),
      description,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------- balances

export type ChargeAllocation = {
  charge: LedgerCharge;
  paidCents: Cents;
  outstandingCents: Cents;
};

export type LeaseBalance = {
  chargedCents: Cents;
  paidCents: Cents;
  outstandingCents: Cents;
  /** Payments received beyond all charges; applied to the next charge that appears. */
  creditCents: Cents;
  pendingCents: Cents;
  allocations: ChargeAllocation[];
};

const kindOrder: Record<ChargeKindName, number> = { RENT: 0, DEPOSIT: 1, LATE_FEE: 2, OTHER: 3 };

export function settledCents(payments: LedgerPayment[]): Cents {
  return payments.reduce((sum, p) => (p.status === 'SUCCEEDED' ? sum + p.amountCents : sum), 0);
}

/** Applies settled payments to charges oldest-first and returns what each charge still owes. */
export function computeBalance(
  charges: LedgerCharge[],
  payments: LedgerPayment[],
  asOf?: Date,
): LeaseBalance {
  const due = charges
    .filter((c) => !asOf || c.dueDate.getTime() <= asOf.getTime())
    .slice()
    .sort(
      (a, b) =>
        a.dueDate.getTime() - b.dueDate.getTime() ||
        kindOrder[a.kind] - kindOrder[b.kind] ||
        (a.description ?? '').localeCompare(b.description ?? ''),
    );
  const total = settledCents(payments);
  let remaining = total;
  const allocations = due.map((charge) => {
    assertCents(charge.amountCents);
    const paid = Math.min(remaining, charge.amountCents);
    remaining -= paid;
    return { charge, paidCents: paid, outstandingCents: charge.amountCents - paid };
  });
  const chargedCents = due.reduce((sum, c) => sum + c.amountCents, 0);
  const paidCents = total - remaining;
  return {
    chargedCents,
    paidCents,
    outstandingCents: chargedCents - paidCents,
    creditCents: remaining,
    pendingCents: payments.reduce((s, p) => (p.status === 'PENDING' ? s + p.amountCents : s), 0),
    allocations,
  };
}

// ---------------------------------------------------------------------------------------- late fees

export type LateFeeDecision =
  | { eligible: true; fee: NewCharge }
  | {
      eligible: false;
      reason: 'no-fee' | 'no-rent-charge' | 'paid' | 'in-grace' | 'already-applied';
    };

/**
 * Whether a late fee may be added for the given month. The fee is the lease's flat late fee, charged
 * at most once per rent month, only when rent for that month is still unpaid after the grace period.
 */
export function assessLateFee(
  lease: LeaseTerms,
  month: string,
  charges: LedgerCharge[],
  payments: LedgerPayment[],
  asOf: Date,
): LateFeeDecision {
  if (lease.lateFeeCents <= 0) return { eligible: false, reason: 'no-fee' };
  const rentDesc = rentKey(lease.id, month);
  const feeDesc = lateFeeKey(lease.id, month);
  const rent = charges.find((c) => c.description === rentDesc);
  if (!rent) return { eligible: false, reason: 'no-rent-charge' };
  if (charges.some((c) => c.description === feeDesc))
    return { eligible: false, reason: 'already-applied' };
  if (!isPastGrace(rent.dueDate, lease.graceDays, asOf))
    return { eligible: false, reason: 'in-grace' };
  const allocation = computeBalance(charges, payments, asOf).allocations.find(
    (a) => a.charge.description === rentDesc,
  );
  if (!allocation || allocation.outstandingCents <= 0) return { eligible: false, reason: 'paid' };
  return {
    eligible: true,
    fee: {
      leaseId: lease.id,
      kind: 'LATE_FEE',
      amountCents: lease.lateFeeCents,
      dueDate: startOfUtcDay(asOf),
      description: feeDesc,
    },
  };
}

/** Late fees for every rent month that is past grace and unpaid (used by the batch job). */
export function planLateFees(
  lease: LeaseTerms,
  charges: LedgerCharge[],
  payments: LedgerPayment[],
  asOf: Date,
): NewCharge[] {
  const months = charges
    .filter((c) => c.kind === 'RENT' && c.description?.startsWith(`rent:${lease.id}:`))
    .map((c) => (c.description as string).slice(-7));
  const out: NewCharge[] = [];
  for (const month of months) {
    const decision = assessLateFee(lease, month, charges, payments, asOf);
    if (decision.eligible) out.push(decision.fee);
  }
  return out;
}

// ---------------------------------------------------------------------------------------- rent roll

export type RentStatus = 'PAID' | 'PENDING' | 'LATE' | 'AUTOPAY';

/** Status of one month's rent for a lease, as shown on the rent roll. */
export function rentStatus(input: {
  lease: LeaseTerms;
  month: string;
  charges: LedgerCharge[];
  payments: LedgerPayment[];
  autopay: boolean;
  asOf: Date;
}): { status: RentStatus; outstandingCents: Cents; rent?: LedgerCharge } {
  const { lease, month, charges, payments, autopay, asOf } = input;
  const rent = charges.find((c) => c.description === rentKey(lease.id, month));
  if (!rent) return { status: autopay ? 'AUTOPAY' : 'PENDING', outstandingCents: 0 };
  const balance = computeBalance(charges, payments);
  const allocation = balance.allocations.find((a) => a.charge === rent);
  const outstandingCents = allocation?.outstandingCents ?? rent.amountCents;
  if (outstandingCents <= 0) return { status: 'PAID', outstandingCents: 0, rent };
  // Pending payments cover what is left (e.g. an ACH debit in flight): wait for the provider.
  if (balance.pendingCents >= balance.outstandingCents && balance.pendingCents > 0)
    return { status: 'PENDING', outstandingCents, rent };
  if (isPastGrace(rent.dueDate, lease.graceDays, asOf))
    return { status: 'LATE', outstandingCents, rent };
  return { status: autopay ? 'AUTOPAY' : 'PENDING', outstandingCents, rent };
}

// ---------------------------------------------------------------------------------------- refunds

export type RefundPlan =
  | { kind: 'noop'; reason: 'already-refunded' }
  | { kind: 'full'; paymentId: string; refundCents: Cents }
  | {
      kind: 'partial';
      paymentId: string;
      refundCents: Cents;
      remainingCents: Cents;
      refundReference: string;
    };

/**
 * Plans a refund so total money stays auditable: a full refund flips the payment to REFUNDED; a
 * partial refund shrinks the original SUCCEEDED row and records the refunded amount as its own
 * REFUNDED row, so SUCCEEDED + REFUNDED always sums to what was originally received.
 * Payment.amount must stay positive, so refunds are never stored as negative rows.
 */
export function planRefund(
  payment: { id: string; amountCents: Cents; status: PaymentStatusName },
  amountCents: Cents | undefined,
  idempotencyKey: string,
): RefundPlan {
  if (payment.status === 'REFUNDED') return { kind: 'noop', reason: 'already-refunded' };
  if (payment.status !== 'SUCCEEDED') throw new Error('Only a settled payment can be refunded');
  const refund = amountCents ?? payment.amountCents;
  assertCents(refund);
  if (refund <= 0 || refund > payment.amountCents)
    throw new Error('Refund must be between 1 cent and the payment amount');
  if (refund === payment.amountCents)
    return { kind: 'full', paymentId: payment.id, refundCents: refund };
  return {
    kind: 'partial',
    paymentId: payment.id,
    refundCents: refund,
    remainingCents: payment.amountCents - refund,
    refundReference: refundRef(payment.id, idempotencyKey),
  };
}

// ---------------------------------------------------------------------------------------- payouts

/** Payout rows carry no property column, so the link rides in Payout.status. */
export function encodePayoutStatus(status: string, propertyId: string, month: string): string {
  return `${status}|property:${propertyId}|period:${month}`;
}

export function decodePayoutStatus(value: string): {
  status: string;
  propertyId?: string;
  month?: string;
} {
  const [status, ...rest] = value.split('|');
  const find = (name: string) => rest.find((p) => p.startsWith(`${name}:`))?.slice(name.length + 1);
  return { status, propertyId: find('property'), month: find('period') };
}

export type PayoutPlan = {
  propertyId: string;
  month: string;
  collectedCents: Cents;
  paidOutCents: Cents;
  /** Amount still to send to the owner. */
  readyCents: Cents;
  /** Stable key: re-running the same state sends nothing new; new money yields a new key. */
  idempotencyKey: string;
};

/** Owner payout owed for a property in a month: rent collected (net of refunds) minus prior payouts. */
export function planOwnerPayout(input: {
  propertyId: string;
  month: string;
  payments: LedgerPayment[];
  priorPayoutCents: Cents[];
}): PayoutPlan {
  const { propertyId, month } = input;
  const collectedCents = input.payments
    .filter((p) => p.status === 'SUCCEEDED' && p.paidAt && monthKey(p.paidAt) === month)
    .reduce((sum, p) => sum + p.amountCents, 0);
  const paidOutCents = input.priorPayoutCents.reduce((a, b) => a + b, 0);
  return {
    propertyId,
    month,
    collectedCents,
    paidOutCents,
    readyCents: Math.max(0, collectedCents - paidOutCents),
    idempotencyKey: `payout:${propertyId}:${month}:to-${collectedCents}`,
  };
}

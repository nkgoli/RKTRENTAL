/**
 * Pure statement rules behind the property Payments tab: one lease's charges (stored plus the
 * upcoming rent derived from the lease schedule), which payments settled each, and a display status.
 * Nothing here reads the database or the clock.
 */
import {
  addMonths,
  computeBalance,
  isPastGrace,
  monthKey,
  monthStart,
  rentKey,
  startOfUtcDay,
  type Cents,
  type ChargeKindName,
  type LeaseTerms,
  type LedgerCharge,
  type LedgerPayment,
} from './core';

export type StatementStatus = 'PAID' | 'PARTIAL' | 'LATE' | 'DUE' | 'SCHEDULED';

export type AppliedPayment = {
  paymentId: string;
  amountCents: Cents;
  date: Date | null;
  method: string;
};

export type StatementRow = {
  /** Stored charge id, or the deterministic rent key for a scheduled charge that has no row yet. */
  key: string;
  chargeId: string | null;
  kind: ChargeKindName;
  /** True when derived from the lease schedule rather than stored. */
  derived: boolean;
  typeLabel: string;
  description: string;
  dueDate: Date;
  amountCents: Cents;
  paidCents: Cents;
  balanceCents: Cents;
  status: StatementStatus;
  applied: AppliedPayment[];
};

export type LeaseStatement = {
  rows: StatementRow[];
  /** Charges minus settled payments for everything due by asOf; negative means credit. */
  balanceCents: Cents;
  chargedCents: Cents;
  paidCents: Cents;
};

const KIND_LABEL: Record<ChargeKindName, string> = {
  RENT: 'Rent',
  LATE_FEE: 'Late fee',
  DEPOSIT: 'Security deposit',
  OTHER: 'Fee',
};
const kindOrder: Record<ChargeKindName, number> = { RENT: 0, DEPOSIT: 1, LATE_FEE: 2, OTHER: 3 };
const SETUP_LABEL: Record<string, string> = {
  deposit: 'Security deposit',
  'move-in-fee': 'Move-in fee',
  'pet-deposit': 'Pet deposit',
};

/** Type column wording: move-in charges name themselves, everything else follows its kind. */
export function chargeTypeLabel(charge: Pick<LedgerCharge, 'kind' | 'description'>): string {
  const key = /^setup:(deposit|move-in-fee|pet-deposit):/.exec(charge.description ?? '');
  return key ? SETUP_LABEL[key[1]] : KIND_LABEL[charge.kind];
}

export const kindLabel = (kind: ChargeKindName) => KIND_LABEL[kind];

const monthName = (key: string) =>
  monthStart(key).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

/** Deterministic keys are stored in Charge.description; manual charges must never collide with them. */
export const isReservedDescription = (value: string) =>
  /^(rent|late-fee|setup):/i.test(value.trim());

/** Human wording for a charge: generated keys become "October rent for <place>". */
export function describeCharge(
  charge: Pick<LedgerCharge, 'kind' | 'description'>,
  place: string,
): string {
  const text = charge.description?.trim() ?? '';
  const setup = /^setup:(deposit|move-in-fee|pet-deposit):[^:]+$/.exec(text);
  if (setup) return `${SETUP_LABEL[setup[1]]} for ${place}`;
  const generated = /^(rent|late-fee):[^:]+:(\d{4}-\d{2})$/.exec(text);
  if (generated)
    return generated[1] === 'rent'
      ? `${monthName(generated[2])} rent for ${place}`
      : `${monthName(generated[2])} late fee for ${place}`;
  return text || `${KIND_LABEL[charge.kind]} for ${place}`;
}

export function paymentMethod(providerReference?: string | null): string {
  if (!providerReference || providerReference.startsWith('manual:'))
    return 'Cash or check (recorded manually)';
  return 'Online payment';
}

const paymentTime = (p: LedgerPayment) => (p.paidAt ?? p.createdAt)?.getTime() ?? 0;

const compareCharges = (a: LedgerCharge, b: LedgerCharge) =>
  a.dueDate.getTime() - b.dueDate.getTime() ||
  kindOrder[a.kind] - kindOrder[b.kind] ||
  (a.description ?? '').localeCompare(b.description ?? '');

/**
 * Rent charges the lease schedule implies for months after asOf (through the lease end) that have
 * no stored row. Stored rent charges are never duplicated and past months are never invented.
 */
export function scheduledRent(
  lease: LeaseTerms,
  charges: LedgerCharge[],
  asOf: Date,
): LedgerCharge[] {
  if (lease.status !== 'ACTIVE' || lease.monthlyRentCents <= 0) return [];
  const have = new Set(charges.map((c) => c.description));
  const today = startOfUtcDay(asOf).getTime();
  const last = monthKey(lease.endDate);
  const out: LedgerCharge[] = [];
  for (
    let month = [monthKey(lease.startDate), addMonths(monthKey(asOf), 1)].sort().at(-1) as string;
    month <= last;
    month = addMonths(month, 1)
  ) {
    const description = rentKey(lease.id, month);
    const dueDate = monthStart(month);
    if (have.has(description) || dueDate.getTime() <= today) continue;
    out.push({
      leaseId: lease.id,
      kind: 'RENT',
      amountCents: lease.monthlyRentCents,
      dueDate,
      description,
    });
  }
  return out;
}

/** Applies settled payments to charges oldest-first, remembering which payment paid which charge. */
export function applyPayments(
  charges: LedgerCharge[],
  payments: LedgerPayment[],
): Map<LedgerCharge, AppliedPayment[]> {
  const queue = payments
    .filter((p) => p.status === 'SUCCEEDED' && p.amountCents > 0)
    .sort((a, b) => paymentTime(a) - paymentTime(b))
    .map((p) => ({ payment: p, left: p.amountCents }));
  const out = new Map<LedgerCharge, AppliedPayment[]>();
  let cursor = 0;
  for (const charge of charges.slice().sort(compareCharges)) {
    const applied: AppliedPayment[] = [];
    let need = charge.amountCents;
    while (need > 0 && cursor < queue.length) {
      const entry = queue[cursor];
      const take = Math.min(need, entry.left);
      if (take > 0) {
        applied.push({
          paymentId: entry.payment.id ?? '',
          amountCents: take,
          date: entry.payment.paidAt ?? entry.payment.createdAt ?? null,
          method: paymentMethod(entry.payment.providerReference),
        });
        entry.left -= take;
        need -= take;
      }
      if (entry.left === 0) cursor += 1;
    }
    out.set(charge, applied);
  }
  return out;
}

export function statementStatus(input: {
  amountCents: Cents;
  paidCents: Cents;
  dueDate: Date;
  graceDays: number;
  asOf: Date;
}): StatementStatus {
  const { amountCents, paidCents, dueDate, graceDays, asOf } = input;
  if (paidCents >= amountCents) return 'PAID';
  if (isPastGrace(dueDate, graceDays, asOf)) return 'LATE';
  if (paidCents > 0) return 'PARTIAL';
  return dueDate.getTime() > startOfUtcDay(asOf).getTime() ? 'SCHEDULED' : 'DUE';
}

/** Builds one lease's statement rows, oldest first, including scheduled upcoming rent. */
export function buildLeaseStatement(input: {
  lease: LeaseTerms;
  charges: LedgerCharge[];
  payments: LedgerPayment[];
  place: string;
  asOf: Date;
}): LeaseStatement {
  const { lease, charges, payments, place, asOf } = input;
  const upcoming = scheduledRent(lease, charges, asOf);
  const everything = [...charges, ...upcoming];
  const applied = applyPayments(everything, payments);
  const rows = everything.sort(compareCharges).map((charge): StatementRow => {
    const list = applied.get(charge) ?? [];
    const paidCents = list.reduce((sum, a) => sum + a.amountCents, 0);
    return {
      key: charge.id ?? charge.description ?? `${charge.leaseId}:${charge.dueDate.toISOString()}`,
      chargeId: charge.id ?? null,
      kind: charge.kind,
      derived: !charge.id,
      typeLabel: chargeTypeLabel(charge),
      description: describeCharge(charge, place),
      dueDate: charge.dueDate,
      amountCents: charge.amountCents,
      paidCents,
      balanceCents: charge.amountCents - paidCents,
      status: statementStatus({
        amountCents: charge.amountCents,
        paidCents,
        dueDate: charge.dueDate,
        graceDays: lease.graceDays,
        asOf,
      }),
      applied: list,
    };
  });
  const due = computeBalance(charges, payments, asOf);
  const settled = payments.reduce((s, p) => (p.status === 'SUCCEEDED' ? s + p.amountCents : s), 0);
  return {
    rows,
    chargedCents: due.chargedCents,
    paidCents: settled,
    balanceCents: due.chargedCents - settled,
  };
}

export type TermGroup = {
  leaseId: string;
  label: string;
  rows: StatementRow[];
};

/** "May 2026 – Apr 2027" for a lease term. */
export function termLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Always two decimal places: $3,395.00, -$12.50. */
export function formatMoney(cents: Cents): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
}

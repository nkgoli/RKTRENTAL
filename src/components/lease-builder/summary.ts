import { feesFromDraft } from '@/lib/lease-create/fees';
import { contextFromDraft, resolveTerms, type ResolvedTerm } from '@/lib/lease-create/templates';
import type { WizardDraft } from '@/lib/lease-create/types';
import { parseLeaseDate, parseMoney } from '@/lib/leases/core';
import { toCents } from '@/lib/ledger/core';
import {
  previewScheduledCharges,
  type ChargesPreview,
  type PreviewRow,
} from '@/lib/ledger/lease-setup';
import { formatMoney } from '@/lib/ledger/statement';

/** Display values derived from the in-memory draft; no money maths beyond the ledger preview. */

const DAY_MS = 86_400_000;

export const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ');

/** 1st, 2nd, 3rd, 4th … */
export function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th'}`;
}

const formatDate = (options: Intl.DateTimeFormatOptions) => (date: Date) =>
  date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
export const longDate = formatDate({ month: 'long', day: 'numeric', year: 'numeric' });
export const mediumDate = formatDate({ month: 'short', day: 'numeric', year: 'numeric' });
export const shortDate = formatDate({ month: 'short', day: 'numeric' });
export const monthYear = formatDate({ month: 'short', year: 'numeric' });
const monthName = formatDate({ month: 'long' });

/** Cents for a typed amount, or null when it is blank or not money. */
export function centsOf(value: string): number | null {
  const money = parseMoney(value);
  return money ? toCents(money) : null;
}

/** "$2,100.00" for a typed amount, "—" when it is blank or not money. */
export function moneyText(value: string): string {
  const cents = centsOf(value);
  return cents === null ? '—' : formatMoney(cents);
}

/** Whole months and leftover days from the start through the inclusive end date. */
export function termLength(start: Date, end: Date): string {
  const after = new Date(end.getTime() + DAY_MS);
  const shift = (months: number) =>
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()));
  let months =
    (after.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    after.getUTCMonth() -
    start.getUTCMonth();
  while (months > 0 && shift(months) > after) months -= 1;
  const days = Math.round((after.getTime() - shift(Math.max(months, 0)).getTime()) / DAY_MS);
  const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (months > 0 && days > 0) return `${count(months, 'month')}, ${count(days, 'day')}`;
  return months > 0 ? count(months, 'month') : count(days, 'day');
}

export type TermFacts = { start: Date; end: Date; range: string; length: string } | null;

/** Start, end, "Mar 1, 2089 – Feb 28, 2090" and its length, or null until both dates are valid. */
export function termFacts(draft: WizardDraft): TermFacts {
  const start = parseLeaseDate(draft.startDate);
  const end = parseLeaseDate(draft.endDate);
  if (!start || !end || end < start) return null;
  return {
    start,
    end,
    range: `${mediumDate(start)} – ${mediumDate(end)}`,
    length: draft.endOption === 'month-to-month' ? 'Month-to-month' : termLength(start, end),
  };
}

/** The Payments ledger preview for the draft, or null until the dates are valid. */
export function chargesPreview(draft: WizardDraft, asOf = new Date()): ChargesPreview | null {
  const term = termFacts(draft);
  if (!term) return null;
  return previewScheduledCharges({
    startDate: term.start,
    endDate: term.end,
    fees: feesFromDraft(draft),
    asOf,
  });
}

export type MoveIn = { rows: PreviewRow[]; totalCents: number; recurring: PreviewRow[] };

/**
 * Charges due on the start date: the move-in charges plus a first rent that falls on that day,
 * then the rent that repeats after it. Regroups the ledger preview rows; amounts are unchanged.
 */
export function splitMoveIn(preview: ChargesPreview, startDate: Date): MoveIn {
  const start = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );
  const [first, ...rest] = preview.monthly;
  if (!first || first.date.getTime() !== start)
    return {
      rows: preview.moveIn,
      totalCents: preview.moveInTotalCents,
      recurring: preview.monthly,
    };
  return {
    rows: [...preview.moveIn, { ...first, label: `${monthName(first.date)} rent` }],
    totalCents: preview.moveInTotalCents + first.amountCents,
    recurring: rest,
  };
}

/** Everything due at move-in, or null until the dates and amounts allow a preview. */
export function dueAtMoveIn(draft: WizardDraft): number | null {
  const term = termFacts(draft);
  const preview = chargesPreview(draft);
  if (!term || !preview) return null;
  const moveIn = splitMoveIn(preview, term.start);
  return moveIn.rows.length ? moveIn.totalCents : null;
}

/** Template terms as resolved for this draft (empty for drafts without a template). */
export function draftTerms(draft: WizardDraft): ResolvedTerm[] {
  return draft.template
    ? resolveTerms(draft.template, contextFromDraft(draft), draft.termOverrides, draft.renewalTerms)
    : [];
}

/** Placeholder keys still unfilled in a resolved body, in order of appearance. */
export function blanksIn(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{([a-z_]+)\}\}/g)].map((match) => match[1]))];
}

export const fieldName = (key: string) => key.replaceAll('_', ' ');

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

/** "Ana, Ben and Cy" */
export const listText = (items: string[]) =>
  new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' }).format(items);

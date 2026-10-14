/**
 * Pure tenant-portal rules: occupant parsing, notice and renewal wording, file badges and the
 * recent-activity feed. No database, clock or storage access, so it is unit-testable as is.
 */
import { formatUsd } from '@/lib/ledger/core';
import { formatDate } from '@/lib/properties/format';
import type { Receipt } from '@/lib/tenant-pay/core';

const DAY_MS = 86_400_000;

/** Days before lease end at which the lease page starts asking about renewal. */
export const RENEWAL_WINDOW_DAYS = 90;

export function parseOccupants(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((end - start) / DAY_MS);
}

export type LeaseNotice =
  | { kind: 'move-out'; title: string; body: string; noticeGivenAt: Date | null; moveOutDate: Date }
  | { kind: 'renewal'; title: string; body: string }
  | null;

/** The lease page banner: a recorded move-out takes priority over the renewal reminder. */
export function leaseNotice(
  lease: { endDate: Date; noticeGivenAt: Date | null; moveOutDate: Date | null },
  managerName: string,
  now: Date,
): LeaseNotice {
  if (lease.moveOutDate) {
    const given = lease.noticeGivenAt ? `Notice given ${formatDate(lease.noticeGivenAt)}. ` : '';
    const left = daysBetween(now, lease.moveOutDate);
    const when =
      left > 0
        ? `${left} day${left === 1 ? '' : 's'} to go.`
        : left === 0
          ? 'That is today.'
          : 'That date has passed.';
    return {
      kind: 'move-out',
      title: `Move-out ${formatDate(lease.moveOutDate)}`,
      body: `${given}Your move-out date is ${formatDate(lease.moveOutDate)}. ${when}`,
      noticeGivenAt: lease.noticeGivenAt,
      moveOutDate: lease.moveOutDate,
    };
  }
  const left = daysBetween(now, lease.endDate);
  if (left >= 0 && left <= RENEWAL_WINDOW_DAYS) {
    return {
      kind: 'renewal',
      title: 'Renewal coming up',
      body: `Your lease ends ${formatDate(lease.endDate)}. Tell ${managerName} if you want to renew and we will send terms and a new lease to sign here.`,
    };
  }
  return null;
}

export type FileBadge = 'pdf' | 'img' | 'doc';

export function fileBadge(mimeType: string): FileBadge {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'img';
  return 'doc';
}

/** Images and PDFs open inline; Word files can only be downloaded. */
export function canPreview(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  tone: 'success' | 'info' | 'warning';
  date: Date;
};

/** Recent activity from the tenant's own ledger receipts, newest first. */
export function buildActivity(receipts: Receipt[], limit = 4): ActivityItem[] {
  return receipts.slice(0, limit).map((receipt, index) => {
    const amount = formatUsd(receipt.amountCents);
    const base = { id: receipt.paymentId ?? `receipt-${index}`, date: receipt.date };
    if (receipt.status === 'SUCCEEDED')
      return {
        ...base,
        title: `${receipt.label} received`,
        detail: `Your ${formatDate(receipt.date)} payment of ${amount} is confirmed.`,
        tone: 'success' as const,
      };
    if (receipt.status === 'PENDING')
      return {
        ...base,
        title: `${receipt.label} processing`,
        detail: `Your ${amount} bank payment is waiting on your provider.`,
        tone: 'info' as const,
      };
    return {
      ...base,
      title: `${receipt.label} ${receipt.statusLabel.toLowerCase()}`,
      detail: `A ${amount} payment on ${formatDate(receipt.date)} was ${receipt.statusLabel.toLowerCase()}.`,
      tone: 'warning' as const,
    };
  });
}

/** 0-100 progress for the open repair card: Received → Scheduled → Done. */
export function repairProgress(status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED') {
  return { NEW: 20, ASSIGNED: 45, IN_PROGRESS: 60, DONE: 100, CANCELLED: 0 }[status];
}

export function repairStatusLabel(
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED',
) {
  return {
    NEW: 'Received',
    ASSIGNED: 'Scheduled',
    IN_PROGRESS: 'In progress',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
  }[status];
}

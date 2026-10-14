import type { ESignStatus, LeaseStatus } from '@prisma/client';
import { formatDate, formatMoney, unitLabel } from '@/lib/properties/format';
import type { LeaseListItem } from './queries';

export { formatDate, formatMoney, unitLabel };

export function leaseName(lease: Pick<LeaseListItem, 'tenants'>) {
  return (
    lease.tenants.find((t) => t.isPrimary)?.tenant.name ??
    lease.tenants[0]?.tenant.name ??
    'No tenant'
  );
}

export function term(start: Date, end: Date) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function money(value: { toString(): string }) {
  return formatMoney(Number(value.toString()));
}

export function statusLabel(status: LeaseStatus) {
  return { DRAFT: 'Draft', ACTIVE: 'Active', ENDED: 'Ended', TERMINATED: 'Terminated' }[status];
}

export function signLabel(status: ESignStatus) {
  return {
    NOT_SENT: 'Not sent',
    SENT: 'Sent · awaiting',
    PARTIALLY_SIGNED: 'Partially signed',
    SIGNED: 'Signed',
    DECLINED: 'Declined',
  }[status];
}

import {
  computeBalance,
  formatUsd,
  startOfUtcDay,
  type LedgerCharge,
  type LedgerPayment,
} from '@/lib/ledger/core';

export type MailKind =
  'RENT_DUE' | 'RENT_LATE' | 'REPAIR_UPDATE' | 'LEASE_RENEWAL' | 'PASSWORD_RESET';
export type EmailMessage = {
  organizationId: string;
  eventKey: string;
  kind: MailKind;
  recipient: string;
  subject: string;
  body: string;
};
export type TenantRecipient = {
  name: string;
  email: string | null;
  user?: { email: string; emailNotificationsEnabled: boolean } | null;
};

const DAY = 86_400_000;
const dateText = (date: Date) => date.toISOString().slice(0, 10);

/** Aggregated RENT_LATE template for a manager-reviewed lease balance. */
export function overdueReminderMessage(input: {
  name: string;
  propertyName: string;
  unitNumber: string;
  amountCents: number;
  pendingCents: number;
  asOf: Date;
}) {
  return {
    subject: `Overdue payment reminder for ${input.propertyName}`,
    body: `Hello ${input.name},\n\n${formatUsd(input.amountCents)} remains overdue for ${input.propertyName}, unit ${input.unitNumber} as of ${dateText(input.asOf)}. This is the shared lease balance, including assessed charges only. Pending payments: ${formatUsd(input.pendingCents)}. Please contact your property manager if you have already paid.\n\nRocketRental`,
  };
}

export function eligibleRecipients(tenants: TenantRecipient[]) {
  const recipients = new Map<string, { name: string; email: string }>();
  for (const tenant of tenants) {
    if (tenant.user?.emailNotificationsEnabled === false) continue;
    const email = (tenant.email || tenant.user?.email || '').trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      recipients.set(email, { name: tenant.name, email });
  }
  return [...recipients.values()];
}

export function rentMessages(input: {
  organizationId: string;
  leaseId: string;
  propertyName: string;
  unitNumber: string;
  graceDays: number;
  tenants: TenantRecipient[];
  charges: LedgerCharge[];
  payments: LedgerPayment[];
  now: Date;
}): EmailMessage[] {
  const today = startOfUtcDay(input.now);
  const balance = computeBalance(input.charges, input.payments);
  const result: EmailMessage[] = [];
  for (const allocation of balance.allocations) {
    const charge = allocation.charge;
    if (charge.kind !== 'RENT' || !charge.id || allocation.outstandingCents <= 0) continue;
    const due = startOfUtcDay(charge.dueDate);
    const days = Math.round((due.getTime() - today.getTime()) / DAY);
    const late = days < -input.graceDays;
    if (!late && (days < 0 || days > 3)) continue;
    const kind: MailKind = late ? 'RENT_LATE' : 'RENT_DUE';
    for (const recipient of eligibleRecipients(input.tenants)) {
      result.push({
        organizationId: input.organizationId,
        eventKey: `${kind.toLowerCase()}:${charge.id}`,
        kind,
        recipient: recipient.email,
        subject: late
          ? `Rent late for ${input.propertyName}`
          : `Rent due soon for ${input.propertyName}`,
        body: `Hello ${recipient.name},\n\n${late ? 'Your rent is late' : 'Your rent is due soon'} for ${input.propertyName}, unit ${input.unitNumber}. ${formatUsd(allocation.outstandingCents)} remains due for the rent charge dated ${dateText(due)}.\n\nRocketRental`,
      });
    }
  }
  return result;
}

export function renewalMessages(input: {
  organizationId: string;
  leaseId: string;
  propertyName: string;
  unitNumber: string;
  endDate: Date;
  tenants: TenantRecipient[];
  now: Date;
}): EmailMessage[] {
  const days = Math.round(
    (startOfUtcDay(input.endDate).getTime() - startOfUtcDay(input.now).getTime()) / DAY,
  );
  if (days < 0 || days > 30) return [];
  return eligibleRecipients(input.tenants).map((recipient) => ({
    organizationId: input.organizationId,
    eventKey: `lease-renewal:${input.leaseId}:${dateText(input.endDate)}`,
    kind: 'LEASE_RENEWAL',
    recipient: recipient.email,
    subject: `Lease renewal approaching for ${input.propertyName}`,
    body: `Hello ${recipient.name},\n\nYour lease for ${input.propertyName}, unit ${input.unitNumber}, ends on ${dateText(input.endDate)}. Please contact your property manager about renewal.\n\nRocketRental`,
  }));
}

export function repairMessages(input: {
  organizationId: string;
  eventId: string;
  title: string;
  status: string;
  tenants: TenantRecipient[];
}): EmailMessage[] {
  return eligibleRecipients(input.tenants).map((recipient) => ({
    organizationId: input.organizationId,
    eventKey: `repair-update:${input.eventId}`,
    kind: 'REPAIR_UPDATE',
    recipient: recipient.email,
    subject: `Repair update: ${input.title}`,
    body: `Hello ${recipient.name},\n\nYour repair request "${input.title}" is now ${input.status.replaceAll('_', ' ').toLowerCase()}.\n\nRocketRental`,
  }));
}

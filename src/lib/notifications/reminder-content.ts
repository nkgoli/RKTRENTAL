import { createHash } from 'node:crypto';
import { computeBalance, isPastGrace, startOfUtcDay, toCents } from '@/lib/ledger/core';
import type { Prisma } from '@prisma/client';
import { overdueReminderMessage } from './messages';

export type ReminderLease = Prisma.LeaseGetPayload<{
  include: {
    unit: { include: { property: true } };
    tenants: { include: { tenant: { include: { user: true } } } };
    charges: true;
    payments: true;
  };
}>;
export type Channel = 'EMAIL' | 'SMS';
export function validEmail(value: string) {
  const [local, domain, extra] = value.split('@');
  return (
    value.length <= 254 &&
    extra === undefined &&
    Boolean(local && domain) &&
    local.length <= 64 &&
    !local.startsWith('.') &&
    !local.endsWith('.') &&
    !local.includes('..') &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    /^(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i.test(domain)
  );
}
export const validPhone = (v: string) => /^\+[1-9]\d{7,14}$/.test(v);
export const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function reminderContent(lease: ReminderLease, channel: Channel, now: Date) {
  const today = startOfUtcDay(now);
  const charges = lease.charges.map((c) => ({ ...c, amountCents: toCents(c.amount) }));
  const payments = lease.payments.map((p) => ({ ...p, amountCents: toCents(p.amount) }));
  const balance = computeBalance(charges, payments, today);
  const overdue = balance.allocations.filter(
    ({ charge: c, outstandingCents }) =>
      outstandingCents > 0 &&
      (c.kind === 'RENT'
        ? isPastGrace(c.dueDate, lease.graceDays, today)
        : c.kind === 'LATE_FEE'
          ? c.dueDate <= today
          : c.dueDate < today),
  );
  const amountCents = overdue.reduce((sum, a) => sum + a.outstandingCents, 0);
  const excluded: { tenantId: string; reason: string }[] = [];
  const blockedContacts = new Set<string>();
  const recipients = new Map<
    string,
    { tenantId: string; recipient: string; subject: string; body: string }
  >();
  for (const { tenant } of [...lease.tenants].sort((a, b) =>
    a.tenantId.localeCompare(b.tenantId),
  )) {
    const recipient =
      channel === 'EMAIL'
        ? (tenant.email || tenant.user?.email || '').trim().toLowerCase()
        : (tenant.phone || tenant.user?.phone || '').trim();
    const optedIn =
      channel === 'EMAIL'
        ? tenant.emailRemindersEnabled && tenant.user?.emailNotificationsEnabled !== false
        : tenant.smsRemindersEnabled;
    const reason = !optedIn
      ? 'OPTED_OUT'
      : !(channel === 'EMAIL' ? validEmail(recipient) : validPhone(recipient))
        ? 'INVALID_CONTACT'
        : undefined;
    if (reason) {
      excluded.push({ tenantId: tenant.id, reason });
      if (!optedIn && recipient) blockedContacts.add(recipient);
      continue;
    }
    recipients.set(recipient, {
      tenantId: tenant.id,
      recipient,
      ...overdueReminderMessage({
        name: tenant.name,
        propertyName: lease.unit.property.name,
        unitNumber: lease.unit.number,
        amountCents,
        pendingCents: balance.pendingCents,
        asOf: today,
      }),
    });
  }
  for (const contact of blockedContacts) recipients.delete(contact);
  const snapshot = {
    kind: 'RENT_LATE',
    leaseId: lease.id,
    propertyId: lease.unit.propertyId,
    unitId: lease.unitId,
    channel,
    asOf: today.toISOString().slice(0, 10),
    amountCents,
    pendingCents: balance.pendingCents,
    charges: overdue.map(({ charge, outstandingCents }) => ({
      id: charge.id,
      kind: charge.kind,
      dueDate: charge.dueDate.toISOString().slice(0, 10),
      outstandingCents,
    })),
    recipients: [...recipients.values()],
    excluded,
  };
  // Bind all ledger and recipient state, even changes that leave the total unchanged.
  const fingerprint = hash({
    snapshot,
    status: lease.status,
    graceDays: lease.graceDays,
    contacts: lease.tenants
      .map(({ tenant: t }) => [
        t.id,
        t.updatedAt,
        t.user?.updatedAt,
        t.emailRemindersEnabled,
        t.smsRemindersEnabled,
        t.user?.emailNotificationsEnabled,
      ])
      .sort(),
    ledger: [
      ...lease.charges.map((c) => [c.id, c.kind, c.amount.toString(), c.dueDate]),
      ...lease.payments.map((p) => [p.id, p.amount.toString(), p.status, p.paidAt]),
    ].sort(),
  });
  return { snapshot, fingerprint };
}

import { db } from '@/lib/db/client';
import { ensureRentCharges, toLedgerCharge, toLedgerPayment } from '@/lib/ledger/store';
import { rentMessages, renewalMessages, repairMessages, type EmailMessage } from './messages';
import { emailProvider, type EmailProvider } from './provider';

export async function sendMessages(messages: EmailMessage[], provider: EmailProvider) {
  let sent = 0;
  for (const message of messages) if (await provider.send(message)) sent++;
  return sent;
}

export async function publishRepairStatusEvent(organizationId: string, eventId: string) {
  const event = await db.maintenanceEvent.findFirst({
    where: { id: eventId, organizationId, kind: 'STATUS_CHANGED' },
    include: { maintenanceRequest: { include: { tenant: { include: { user: true } } } } },
  });
  if (!event?.toStatus || !event.maintenanceRequest.tenant) return 0;
  const messages = repairMessages({
    organizationId,
    eventId: event.id,
    title: event.maintenanceRequest.title,
    status: event.toStatus,
    tenants: [event.maintenanceRequest.tenant],
  });
  return sendMessages(messages, await emailProvider(organizationId));
}

/** Runs from the manager API route; replays unsent status events after an interrupted request. */
export async function runNotificationSweep(organizationId: string, now = new Date()) {
  await ensureRentCharges(organizationId, now);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [leases, repairEvents] = await Promise.all([
    db.lease.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: { include: { user: true } } } },
        charges: true,
        payments: true,
      },
    }),
    db.maintenanceEvent.findMany({
      where: { organizationId, kind: 'STATUS_CHANGED', toStatus: { not: null } },
      include: { maintenanceRequest: { include: { tenant: { include: { user: true } } } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const messages: EmailMessage[] = [];
  for (const lease of leases) {
    const common = {
      organizationId,
      leaseId: lease.id,
      propertyName: lease.unit.property.name,
      unitNumber: lease.unit.number,
      tenants: lease.tenants.map((row) => row.tenant),
      now,
    };
    messages.push(
      ...rentMessages({
        ...common,
        graceDays: lease.graceDays,
        charges: lease.charges.map(toLedgerCharge),
        payments: lease.payments.map(toLedgerPayment),
      }),
      ...renewalMessages({ ...common, endDate: lease.endDate }),
    );
  }
  for (const event of repairEvents) {
    if (!event.toStatus || !event.maintenanceRequest.tenant) continue;
    messages.push(
      ...repairMessages({
        organizationId,
        eventId: event.id,
        title: event.maintenanceRequest.title,
        status: event.toStatus,
        tenants: [event.maintenanceRequest.tenant],
      }),
    );
  }
  const sent = await sendMessages(messages, await emailProvider(organizationId));
  return { considered: messages.length, sent };
}

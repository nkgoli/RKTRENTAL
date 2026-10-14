/** Run after `npm run db:seed` with DATABASE_URL to verify the persisted mock outbox. */
import { db } from '@/lib/db/client';
import { runNotificationSweep } from '@/lib/notifications/service';

const organizationId = 'seed-rocket-rental';
const now = new Date('2026-12-01T00:00:00.000Z');

async function main() {
  await db.maintenanceEvent.upsert({
    where: { id: 'notification-seed-repair-event' },
    update: {},
    create: {
      id: 'notification-seed-repair-event',
      organizationId,
      maintenanceRequestId: 'seed-request-maple-4b',
      kind: 'STATUS_CHANGED',
      fromStatus: 'NEW',
      toStatus: 'IN_PROGRESS',
    },
  });
  const first = await runNotificationSweep(organizationId, now);
  const second = await runNotificationSweep(organizationId, now);
  const deliveries = await db.emailDelivery.findMany({
    where: { organizationId },
    orderBy: { kind: 'asc' },
  });
  const kinds = ['RENT_DUE', 'RENT_LATE', 'REPAIR_UPDATE', 'LEASE_RENEWAL'];
  for (const kind of kinds) {
    const example = deliveries.find((delivery) => delivery.kind === kind);
    if (!example) throw new Error(`Missing ${kind} email`);
    console.log(`${kind}: ${example.recipient} | ${example.subject}`);
  }
  if (first.sent < 4 || second.sent !== 0)
    throw new Error(`Unexpected send counts: first=${first.sent}, second=${second.sent}`);
  console.log(`Mock outbox: ${deliveries.length} rows; first sweep sent ${first.sent}; repeat sent ${second.sent}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

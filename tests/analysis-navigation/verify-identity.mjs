import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '55561');
assert.equal(url.pathname, '/rocketrental');
const db = new PrismaClient();
try {
  const identity =
    await db.$queryRaw`SELECT current_database() AS database, inet_server_port() AS port, current_setting('data_directory') AS directory`;
  console.log(
    JSON.stringify({
      identity,
      properties: await db.property.count(),
      units: await db.unit.count(),
      leases: await db.lease.count(),
    }),
  );
} finally {
  await db.$disconnect();
}

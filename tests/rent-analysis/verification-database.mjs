import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(url.port, '55436', 'Only the Task isolated database is allowed');
const db = new PrismaClient();
try {
  const identity =
    await db.$queryRaw`SELECT current_database() AS database, inet_server_port() AS port, current_setting('data_directory') AS directory`;
  assert.equal(identity[0].port, 55436);
  const state = JSON.parse(
    JSON.stringify({
      units: await db.unit.findMany({ orderBy: { id: 'asc' } }),
      leases: await db.lease.findMany({ orderBy: { id: 'asc' } }),
    }),
  );
  const file = '.orchestra/task-102d7024-before.json';
  if (process.argv[2] === 'baseline') {
    writeFileSync(file, JSON.stringify(state, null, 2));
    console.log(
      JSON.stringify({ identity, units: state.units.length, leases: state.leases.length }),
    );
  } else {
    const before = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(state.units.length, before.units.length);
    assert.deepEqual(state.leases, before.leases, 'All lease fields must remain unchanged');
    const allowed = new Set([
      'marketRent',
      'marketRentSetAt',
      'marketRentSetById',
      'marketRentSetByName',
      'updatedAt',
    ]);
    const changes = [];
    for (let i = 0; i < state.units.length; i++) {
      for (const key of Object.keys(state.units[i])) {
        if (JSON.stringify(state.units[i][key]) !== JSON.stringify(before.units[i][key])) {
          assert(allowed.has(key), `Unexpected change: ${state.units[i].id}.${key}`);
          assert.equal(state.units[i].id, 'demo-unit-maple-7');
          changes.push(key);
        }
      }
    }
    assert(changes.includes('marketRent'), 'Native apply must change market rent');
    assert(changes.includes('marketRentSetAt'), 'Native apply must record audit time');
    const applied = state.units.find((unit) => unit.id === 'demo-unit-maple-7');
    assert.equal(Number(applied.marketRent), 1725);
    assert.equal(applied.marketRentSetByName, 'Jordan Mills');
    console.log(
      JSON.stringify({
        identity,
        changedFields: changes,
        unchangedLeases: state.leases.length,
        unchangedOtherUnits: state.units.length - 1,
      }),
    );
  }
} finally {
  await db.$disconnect();
}

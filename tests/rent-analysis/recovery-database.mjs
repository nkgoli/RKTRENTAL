// Isolated persistence comparison and a temporary server-write failure for native recovery QA.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const url = new URL(process.env.DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost'].includes(url.hostname));
assert.equal(url.port, '55438');
const db = new PrismaClient();
const mode = process.argv[2];
const file = '.orchestra/task-c0e3b203-before.json';
try {
  const identity =
    await db.$queryRaw`SELECT current_database() AS database, inet_server_port() AS port, current_setting('data_directory') AS directory`;
  assert.equal(identity[0].port, 55438);
  assert.equal(
    path.resolve(identity[0].directory).toLowerCase(),
    path.resolve('.orchestra/task-c0e3b203-db').toLowerCase(),
  );
  if (mode === 'fault-on') {
    await db.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION task_c0e3b203_fail_market_rent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Task recovery probe: rejected before write'; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER task_c0e3b203_fail_market_rent BEFORE UPDATE OF "marketRent" ON "Unit" FOR EACH ROW WHEN (OLD.id = 'demo-unit-maple-7') EXECUTE FUNCTION task_c0e3b203_fail_market_rent()`,
    );
    console.log(
      JSON.stringify({
        identity,
        mode,
        result: 'Temporary write failure installed for the verification unit only',
      }),
    );
  } else if (mode === 'fault-off') {
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS task_c0e3b203_fail_market_rent ON "Unit"');
    await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS task_c0e3b203_fail_market_rent()');
    console.log(JSON.stringify({ identity, mode, result: 'Temporary write failure removed' }));
  } else {
    const state = JSON.parse(
      JSON.stringify({
        units: await db.unit.findMany({ orderBy: { id: 'asc' } }),
        leases: await db.lease.findMany({ orderBy: { id: 'asc' } }),
      }),
    );
    if (mode === 'baseline') {
      writeFileSync(file, JSON.stringify(state));
      console.log(
        JSON.stringify({ identity, mode, units: state.units.length, leases: state.leases.length }),
      );
    } else {
      const before = JSON.parse(readFileSync(file, 'utf8'));
      if (mode === 'unchanged') {
        assert.deepEqual(
          state,
          before,
          'Rejected attempt must preserve every unit and lease field',
        );
        console.log(
          JSON.stringify({
            identity,
            mode,
            unchangedUnits: state.units.length,
            unchangedLeases: state.leases.length,
          }),
        );
      } else {
        assert.equal(mode, 'applied');
        assert.deepEqual(state.leases, before.leases);
        assert.equal(state.units.length, before.units.length);
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
              assert.equal(state.units[i].id, 'demo-unit-maple-7');
              assert(allowed.has(key), `Unexpected change: ${key}`);
              changes.push(key);
            }
          }
        }
        assert(changes.includes('marketRent'));
        assert(changes.includes('marketRentSetAt'));
        const applied = state.units.find((unit) => unit.id === 'demo-unit-maple-7');
        assert.equal(Number(applied.marketRent), 1725.5);
        assert.equal(applied.marketRentSetByName, 'Jordan Mills');
        console.log(
          JSON.stringify({
            identity,
            mode,
            changedFields: changes,
            marketRent: applied.marketRent,
            listedRent: applied.listedRent,
            unchangedLeases: state.leases.length,
            unchangedOtherUnits: state.units.length - 1,
          }),
        );
      }
    }
  }
} finally {
  await db.$disconnect();
}

// Read-only business-data comparison; only hashes are written, in the dedicated local data directory.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const directory = path.resolve('.data/rent-selector-review');
const baselineFile = path.join(directory, 'verification-baseline.json');
const db = new PrismaClient({
  datasourceUrl:
    'postgresql://selector_review:selector_review@127.0.0.1:55572/rent_selector_review?schema=public',
});
try {
  const [identity] = await db.$queryRaw`
    SELECT current_database() AS database, inet_server_port() AS port,
           current_setting('data_directory') AS directory`;
  assert.equal(identity.database, 'rent_selector_review');
  assert.equal(identity.port, 55572);
  assert.equal(
    path.resolve(identity.directory).toLowerCase(),
    path.join(directory, 'postgres').toLowerCase(),
  );
  const state = {};
  for (const [name, orderBy] of [
    ['unit', { id: 'asc' }],
    ['lease', { id: 'asc' }],
    ['application', { id: 'asc' }],
    ['roiAnalysisState', { propertyId: 'asc' }],
  ]) {
    const rows = await db[name].findMany({ orderBy });
    state[name] = {
      count: rows.length,
      hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    };
  }
  if (process.argv.includes('baseline'))
    writeFileSync(baselineFile, JSON.stringify(state, null, 2));
  else assert.deepEqual(state, JSON.parse(readFileSync(baselineFile, 'utf8')));
  console.log(
    JSON.stringify({
      identity,
      mode: process.argv.includes('baseline') ? 'baseline' : 'unchanged',
      counts: Object.fromEntries(Object.entries(state).map(([name, value]) => [name, value.count])),
    }),
  );
} finally {
  await db.$disconnect();
}

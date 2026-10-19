import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLeaseDatabase, checkout } from './database-identity.mjs';
test('rejects retired or lookalike database ports before querying', async () => {
  for (const port of ['55429', '554940']) {
    process.env.DATABASE_URL = `postgresql://fixture:fixture@localhost:${port}/rocketrental`;
    let queried = false;
    await assert.rejects(
      assertLeaseDatabase({
        $queryRawUnsafe: async () => {
          queried = true;
        },
      }),
      /reserved lease|Invalid URL/,
    );
    assert.equal(queried, false);
  }
});
test('rejects a different data directory even on the reserved port', async () => {
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:55494/rocketrental';
  const db = {
    $queryRawUnsafe: async (sql) =>
      sql.includes('data_directory') ? [{ data_directory: checkout }] : [{ port: '55494' }],
  };
  await assert.rejects(assertLeaseDatabase(db), /identity mismatch/);
});

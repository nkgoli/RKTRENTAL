// Run: node --import ./prisma/os-userinfo.mjs tests/returns/run-actual-isolated.mjs
// Starts a throwaway embedded PostgreSQL under ignored .data/, deploys every migration and
// runs the actual-returns database tests. Never reads or resets the application database.
// Requires the optional prisma/package.json dev dependency (embedded-postgres).
import EmbeddedPostgres from '../../prisma/node_modules/embedded-postgres/dist/index.js';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const port = Number(process.env.ACTUAL_RETURNS_TEST_PORT ?? 55617);
const databaseDir = path.resolve('.data', `actual-returns-postgres-${randomUUID()}`);
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'returns_test',
  password: 'returns_test',
  port,
  persistent: true,
});
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://returns_test:returns_test@127.0.0.1:${port}/returns_test?schema=public`,
  RUN_ACTUAL_RETURNS_DB: '1',
};
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`Check failed: ${args.join(' ')}`);
}
try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('returns_test');
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run([
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.config.ts',
    'tests/returns/actual-service.db.test.ts',
  ]);
} finally {
  await postgres.stop();
  console.log(`Isolated test data retained at ${databaseDir}`);
}

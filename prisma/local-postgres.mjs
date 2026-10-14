import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaDir = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(
  process.env.ROCKETRENTAL_DB_DIR ?? path.join(prismaDir, '.local-postgres'),
);
const port = Number(process.env.ROCKETRENTAL_DB_PORT ?? 5432);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('ROCKETRENTAL_DB_PORT must be a valid TCP port');
}

const { default: EmbeddedPostgres } = await import('embedded-postgres');
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'rocketrental',
  password: 'rocketrental',
  port,
  persistent: true,
});

if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  await postgres.initialise();
}
await postgres.start();

const admin = postgres.getPgClient();
try {
  await admin.connect();
  const result = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    'rocketrental',
  ]);
  if (result.rowCount === 0) await postgres.createDatabase('rocketrental');
} finally {
  await admin.end();
}

console.log(`Local PostgreSQL ready on port ${port}.`);
console.log(
  `DATABASE_URL=postgresql://rocketrental:rocketrental@localhost:${port}/rocketrental?schema=public`,
);
console.log('Press Ctrl+C (or type q then Enter) to stop.');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  if (input.includes('q') || input.includes('\u0003')) void stop();
});
setInterval(() => {}, 60_000);

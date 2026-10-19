// Isolated production review. Never reads an application .env or reuses another review database.
// Run after npm ci, npm ci --prefix prisma, and npm run build.
import EmbeddedPostgres from '../../prisma/node_modules/embedded-postgres/dist/index.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const directory = path.resolve('.data/rent-selector-review');
const databaseDir = path.join(directory, 'postgres');
mkdirSync(directory, { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'selector_review',
  password: 'selector_review',
  port: 55572,
  persistent: true,
});
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://selector_review:selector_review@127.0.0.1:55572/rent_selector_review?schema=public',
  PORT: '3172',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: path.join(directory, 'storage'),
  ROCKETRENTAL_SANDBOX: 'true',
  ROCKETRENTAL_AUTH_COOKIE_SECURE: 'false',
  ROCKETRENTAL_AUTH_SECRET: 'isolated-selector-review-only-local-session-signing-key-2026',
};
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw Error(`Selector review command failed (${result.status})`);
}
let app;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  app?.kill();
  await postgres.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
try {
  await client.connect();
  if (
    !(await client.query("SELECT 1 FROM pg_database WHERE datname='rent_selector_review'")).rowCount
  )
    await postgres.createDatabase('rent_selector_review');
} finally {
  await client.end();
}
run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const seeded = await db.organization.findUnique({ where: { id: 'seed-rocket-rental' } });
await db.$disconnect();
if (!seeded) run(['--import', 'tsx', 'prisma/seed.ts']);
console.log(
  'Selector review: dedicated database on 55572; production app on http://localhost:3172.',
);
app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3172'], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
app.on('exit', stop);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (text) => {
  if (text.includes('q')) void stop();
});
setInterval(() => {}, 60000);

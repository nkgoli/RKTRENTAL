// Dedicated local review runtime. Never reads DATABASE_URL or an application .env.
// Run after npm ci, npm install --prefix prisma, (no production build required):
// node --import ./prisma/os-userinfo.mjs tests/analysis/roi-demo-runtime.mjs
import EmbeddedPostgres from '../../prisma/node_modules/embedded-postgres/dist/index.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const directory = path.resolve('.data/fictional-roi-demo');
const databaseDir = path.join(directory, 'postgres');
mkdirSync(directory, { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'roi_review',
  password: 'roi_review',
  port: 55579,
  persistent: true,
});
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://roi_review:roi_review@127.0.0.1:55579/fictional_roi_demo?schema=public',
  PORT: '3179',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: path.join(directory, 'storage'),
  ROCKETRENTAL_SANDBOX: 'true',
  ROCKETRENTAL_AUTH_COOKIE_SECURE: 'false',
  ROCKETRENTAL_AUTH_SECRET: 'isolated-roi-review-only-local-session-signing-key-2026',
};
function run(args) {
  const r = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) throw Error(`Review command failed (${r.status})`);
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
    !(await client.query("SELECT 1 FROM pg_database WHERE datname='fictional_roi_demo'")).rowCount
  )
    await postgres.createDatabase('fictional_roi_demo');
} finally {
  await client.end();
}
run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const seeded = await db.organization.findUnique({ where: { id: 'seed-rocket-rental' } });
await db.$disconnect();
if (!seeded) run(['--import', 'tsx', 'prisma/seed.ts']);
run(['--import', 'tsx', 'prisma/load-roi-examples.ts']);
console.log(
  'Fictional ROI demo: dedicated database on 55579; app on http://localhost:3179. Existing demo data retained.',
);
if (!process.argv.includes('--database-only')) {
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3179'], {
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  app.on('exit', stop);
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', (text) => {
  if (text.includes('q')) void stop();
});
setInterval(() => {}, 60000);

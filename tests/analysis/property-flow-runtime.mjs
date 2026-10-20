// Isolated, synthetic Add Property -> ROI browser fixture. Never loads app .env files.
import EmbeddedPostgres from '../../prisma/node_modules/embedded-postgres/dist/index.js';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const directory = path.resolve('.data/optional-property-roi');
const databaseDir = path.join(directory, 'postgres');
const stopFile = path.join(directory, 'stop-request');
if (existsSync(stopFile)) unlinkSync(stopFile);
mkdirSync(directory, { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'property_flow',
  password: 'property_flow',
  port: 55581,
  persistent: true,
});
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://property_flow:property_flow@127.0.0.1:55581/property_flow?schema=public',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: path.join(directory, 'storage'),
  ROCKETRENTAL_SANDBOX: 'true',
  ROCKETRENTAL_AUTH_COOKIE_SECURE: 'false',
  ROCKETRENTAL_AUTH_SECRET: 'isolated-property-flow-local-test-only-2026',
};
function run(args) {
  const r = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  if (r.error || r.status !== 0) throw r.error ?? Error(`Fixture command failed (${r.status})`);
}
const git = (...args) =>
  spawnSync('git', args, { encoding: 'utf8', windowsHide: true }).stdout.trim();
const identity = {
  checkout: process.cwd(),
  branch: git('branch', '--show-current'),
  startupHead: git('rev-parse', 'HEAD'),
  databaseDir,
  database: 'property_flow',
  databasePort: 55581,
  appPort: 3181,
  synthetic: true,
  startedAt: new Date().toISOString(),
  fixturePid: process.pid,
  appMode: process.env.PROPERTY_FLOW_PRODUCTION === '1' ? 'production' : 'development',
  stopFile,
};
let app;
let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (app?.pid) spawnSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true });
  await postgres.stop();
  writeFileSync(
    'docs/analysis/property-flow-runtime.json',
    JSON.stringify(
      {
        ...identity,
        appPid: app?.pid,
        stoppedAt: new Date().toISOString(),
        stopHead: git('rev-parse', 'HEAD'),
        released: true,
      },
      null,
      2,
    ),
  );
  process.exit(exitCode);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
setInterval(() => {
  if (existsSync(stopFile)) void stop();
}, 500).unref();
try {
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await postgres.initialise();
  await postgres.start();
  const client = postgres.getPgClient();
  await client.connect();
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='property_flow'")).rowCount)
    await postgres.createDatabase('property_flow');
  await client.end();
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  const seeded = await db.organization.findUnique({ where: { id: 'seed-rocket-rental' } });
  await db.$disconnect();
  if (!seeded) run(['--import', 'tsx', 'prisma/seed.ts']);
  app = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      identity.appMode === 'production' ? 'start' : 'dev',
      '-p',
      '3181',
    ],
    {
      env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  app.on('exit', (code) => void stop(code ?? 0));
  writeFileSync(
    'docs/analysis/property-flow-runtime.json',
    JSON.stringify(
      {
        ...identity,
        appPid: app.pid,
        released: false,
      },
      null,
      2,
    ),
  );
  console.log(
    'Synthetic property flow: http://localhost:3181; PostgreSQL 55581. Send q to release.',
  );
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (text) => {
    if (text.includes('q')) void stop();
  });
} catch (error) {
  console.error(error);
  await stop(1);
}

// Runs every Playwright suite against one seeded local database and one Next.js server.
// Without DATABASE_URL it starts the embedded Postgres (ROCKETRENTAL_DB_PORT, default 5432).
// The embedded database lives in a throwaway directory, so every run starts from a fresh seed.
// With DATABASE_URL the database is used as-is: seed it fresh first (`npm run db:seed`), because
// some suites (rent payments, move-in/out) change the seeded data.
// Extra arguments are passed to `playwright test` (e.g. `npm run test:e2e -- --project=leases`).
//
// The dev server is started here, not via Playwright's `webServer` block: the
// Next dev process spawns a `next-server` child that Playwright does not reap,
// which used to leave a listener behind after the run. This script owns the
// server and kills its whole process tree on every exit path.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPort = process.env.ROCKETRENTAL_DB_PORT ?? '5432';
const port = process.env.PORT ?? '3000';
const baseURL = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    `postgresql://rocketrental:rocketrental@localhost:${dbPort}/rocketrental?schema=public`,
  ROCKETRENTAL_DB_PORT: dbPort,
  ROCKETRENTAL_AUTH_SECRET:
    process.env.ROCKETRENTAL_AUTH_SECRET ?? 'e2e-only-secret-not-for-production-use-0123456789',
  ROCKETRENTAL_SANDBOX: process.env.ROCKETRENTAL_SANDBOX ?? 'true',
  ROCKETRENTAL_AUTH_COOKIE_SECURE: process.env.ROCKETRENTAL_AUTH_COOKIE_SECURE ?? 'false',
};
const node = process.execPath;
const bin = (...p) => path.join(root, 'node_modules', ...p);

/** Kill a child and its whole process tree (Next dev spawns a server child). */
function killTree(child) {
  if (!child || child.pid === undefined) return;
  if (child.exitCode !== null || child.signalCode) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        // already gone
      }
    }
  }
}

async function waitForServer(server) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next dev server exited (${server.exitCode})`);
    try {
      const res = await fetch(`${baseURL}/sign-in`);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for the Next dev server');
}

function run(label, args, extraEnv = {}) {
  console.log(`[e2e] ${label}`);
  const r = spawnSync(node, args, { cwd: root, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`);
}

let db;
let dbDir;
let server;
function finish(code) {
  killTree(server);
  server = undefined;
  killTree(db);
  db = undefined;
  if (dbDir) setTimeout(() => rmSync(dbDir, { recursive: true, force: true }), 1500).unref?.();
  process.exit(code);
}
process.on('SIGINT', () => finish(130));
process.on('SIGTERM', () => finish(143));

try {
  if (!process.env.DATABASE_URL) {
    const install = spawnSync('npm install --prefix prisma', {
      cwd: root,
      shell: true,
      stdio: 'inherit',
    });
    if (install.status !== 0) throw new Error('npm install --prefix prisma failed');
    console.log('[e2e] starting embedded Postgres');
    dbDir = mkdtempSync(path.join(os.tmpdir(), 'rocketrental-e2e-'));
    db = spawn(node, ['--import', './prisma/os-userinfo.mjs', 'prisma/local-postgres.mjs'], {
      cwd: root,
      env: { ...env, ROCKETRENTAL_DB_DIR: dbDir },
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    await new Promise((resolve, reject) => {
      db.stdout.on('data', (chunk) => {
        if (String(chunk).includes('Local PostgreSQL ready')) resolve();
      });
      db.on('exit', (c) => reject(new Error(`Postgres exited early (${c})`)));
    });
  }
  run('migrate', [bin('prisma', 'build', 'index.js'), 'migrate', 'deploy']);
  run(
    'seed',
    ['--import', './prisma/os-userinfo.mjs', '--import', 'tsx', 'prisma/seed.ts'],
    { NODE_ENV: 'development' },
  );
  console.log(`[e2e] starting Next dev server on ${baseURL}`);
  server = spawn(node, [bin('next', 'dist', 'bin', 'next'), 'dev', '-p', String(port)], {
    cwd: root,
    env: {
      ...env,
      PORT: String(port),
      MOCK_WEBHOOK_SECRET: env.MOCK_WEBHOOK_SECRET ?? 'dev-webhook-secret',
    },
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  await waitForServer(server);
  // PLAYWRIGHT_BASE_URL tells playwright.config.ts not to start a second server.
  const result = spawnSync(
    node,
    [bin('@playwright', 'test', 'cli.js'), 'test', ...process.argv.slice(2)],
    { cwd: root, env: { ...env, PLAYWRIGHT_BASE_URL: baseURL, PORT: String(port) }, stdio: 'inherit' },
  );
  finish(result.status ?? 1);
} catch (error) {
  console.error(`[e2e] ${error.message}`);
  finish(1);
}

// Runs every Playwright suite against one seeded local database and one Next.js server.
// Without DATABASE_URL it starts the embedded Postgres (ROCKETRENTAL_DB_PORT, default 5432).
// The embedded database lives in a throwaway directory, so every run starts from a fresh seed.
// With DATABASE_URL the database is used as-is: seed it fresh first (`npm run db:seed`), because
// some suites (rent payments, move-in/out) change the seeded data.
// Extra arguments are passed to `playwright test` (e.g. `npm run test:e2e -- --project=leases`).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPort = process.env.ROCKETRENTAL_DB_PORT ?? '5432';
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

function run(label, args, extraEnv = {}) {
  console.log(`[e2e] ${label}`);
  const r = spawnSync(node, args, { cwd: root, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`);
}

function runPlaywright(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, [bin('@playwright', 'test', 'cli.js'), 'test', ...args], {
      cwd: root,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    let summaryTimer;
    let fallbackTimer;
    let finalStatus;
    let settled = false;

    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(summaryTimer);
      clearTimeout(fallbackTimer);
      resolve(status);
    };
    const forward = (stream, chunk) => {
      stream.write(chunk);
      output = (output + chunk.toString()).slice(-128_000);
      const plain = output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '\n');
      const hasFinalSummary = /^\s*\d+\s+(?:passed|failed)\s*\([^)]+\)\s*$/m.test(plain);
      if (!hasFinalSummary || summaryTimer) return;

      summaryTimer = setTimeout(() => {
        if (child.exitCode !== null) return;
        const finalOutput = output
          .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
          .replace(/\r/g, '\n');
        const listedFailures = [...finalOutput.matchAll(/^\s*\d+\)\s+\[[^\]]+\]\s+›/gm)].length;
        const reportedFailures = [...finalOutput.matchAll(/^\s*(\d+)\s+failed\b/gm)].at(-1);
        finalStatus = Number(reportedFailures?.[1] ?? listedFailures) > 0 ? 1 : 0;
        console.error('[e2e] Playwright printed its final summary but stayed open; stopping the remaining process tree.');
        if (process.platform === 'win32' && child.pid) {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
          });
          killer.unref();
        } else {
          child.kill('SIGTERM');
        }
        fallbackTimer = setTimeout(() => finish(finalStatus), 2000);
      }, 10_000);
      summaryTimer.unref();
    };

    child.stdout.on('data', (chunk) => forward(process.stdout, chunk));
    child.stderr.on('data', (chunk) => forward(process.stderr, chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => finish(finalStatus ?? code ?? (signal ? 1 : 0)));
  });
}

let db;
let dbDir;
let finishing;
function finish(code) {
  if (finishing) return finishing;
  finishing = (async () => {
    if (db?.exitCode === null) {
      db.kill();
      await Promise.race([new Promise((resolve) => db.once('exit', resolve)), delay(3000)]);
    }
    if (dbDir) rmSync(dbDir, { recursive: true, force: true });
    process.exit(code);
  })();
  return finishing;
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
    db = spawn(node, ['prisma/local-postgres.mjs'], {
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
    ['--import', './prisma/os-userinfo.mjs', bin('tsx', 'dist', 'cli.mjs'), 'prisma/seed.ts'],
    { NODE_ENV: 'development' },
  );
  const result = await runPlaywright(process.argv.slice(2));
  await finish(result);
} catch (error) {
  console.error(`[e2e] ${error.message}`);
  await finish(1);
}

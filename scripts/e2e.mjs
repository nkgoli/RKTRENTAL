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
};
const node = process.execPath;
const bin = (...p) => path.join(root, 'node_modules', ...p);

function run(label, args, extraEnv = {}) {
  console.log(`[e2e] ${label}`);
  const r = spawnSync(node, args, { cwd: root, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`);
}

let db;
let dbDir;
function finish(code) {
  db?.kill();
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
  const result = spawnSync(
    node,
    [bin('@playwright', 'test', 'cli.js'), 'test', ...process.argv.slice(2)],
    { cwd: root, env, stdio: 'inherit' },
  );
  finish(result.status ?? 1);
} catch (error) {
  console.error(`[e2e] ${error.message}`);
  finish(1);
}

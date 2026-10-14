// Managed Preview launcher: embedded Postgres -> migrate -> seed -> next start.
// Run `npm run build` first. Honours PORT (default 3000) and ROCKETRENTAL_DB_PORT (default 5432).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
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
    process.env.ROCKETRENTAL_AUTH_SECRET ?? 'preview-only-secret-not-for-production-use-0123456789',
  ROCKETRENTAL_SANDBOX: process.env.ROCKETRENTAL_SANDBOX ?? 'true',
  ROCKETRENTAL_AUTH_COOKIE_SECURE: process.env.ROCKETRENTAL_AUTH_COOKIE_SECURE ?? 'false',
};
const node = process.execPath;
const bin = (...p) => path.join(root, 'node_modules', ...p);

function run(label, args, extraEnv = {}) {
  console.log(`[preview] ${label}`);
  const r = spawnSync(node, args, {
    cwd: root,
    env: { ...env, ...extraEnv },
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`);
}

function sh(label, command) {
  console.log(`[preview] ${label}`);
  const r = spawnSync(command, { cwd: root, env, shell: true, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`);
}

let db;
let app;
function shutdown(code = 0) {
  app?.kill();
  db?.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

try {
  if (!existsSync(bin('.bin'))) sh('npm install', 'npm install');
  if (!existsSync(path.join(root, '.next', 'BUILD_ID'))) sh('build', 'npm run build');

  if (!process.env.DATABASE_URL) {
    // Windows sandbox hosts can require the database directory to exist before initdb starts.
    mkdirSync(env.ROCKETRENTAL_DB_DIR ?? path.join(root, 'prisma', '.local-postgres'), {
      recursive: true,
    });
    console.log('[preview] installing embedded Postgres');
    const install = spawnSync('npm install --prefix prisma', {
      cwd: root,
      shell: true,
      stdio: 'inherit',
    });
    if (install.status !== 0) throw new Error('npm install --prefix prisma failed');
    console.log('[preview] starting embedded Postgres');
    db = spawn(node, ['--import', './prisma/os-userinfo.mjs', 'prisma/local-postgres.mjs'], {
      cwd: root,
      env,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    await new Promise((resolve, reject) => {
      db.stdout.on('data', (chunk) => {
        process.stdout.write(chunk);
        if (String(chunk).includes('Local PostgreSQL ready')) resolve();
      });
      db.on('exit', (c) => reject(new Error(`Postgres exited early (${c})`)));
    });
    db.on('exit', () => shutdown(1));
  }
  // Always apply pending migrations to the persistent local database before
  // seeding/serving, so a database created by an older build cannot drift from
  // prisma/migrations. If deploy still fails (a pre-migration or hand-edited
  // database), `npm run db:reset` deletes the embedded data directory and the
  // next preview recreates it from scratch.
  try {
    run('apply pending migrations', [bin('prisma', 'build', 'index.js'), 'migrate', 'deploy']);
  } catch (error) {
    console.error(
      '[preview] Migration failed. If this is the default local database, run ' +
        '`npm run db:reset` and start the preview again.',
    );
    throw error;
  }
  run(
    'seed',
    ['--import', './prisma/os-userinfo.mjs', '--import', 'tsx', 'prisma/seed.ts'],
    { NODE_ENV: 'development' },
  );
  console.log('[preview] starting Next.js');
  app = spawn(node, [bin('next', 'dist', 'bin', 'next'), 'start'], {
    cwd: root,
    env: { ...env, NODE_ENV: 'production' },
    stdio: 'inherit',
  });
  app.on('exit', (c) => shutdown(c ?? 0));
} catch (error) {
  console.error(`[preview] ${error.message}`);
  shutdown(1);
}

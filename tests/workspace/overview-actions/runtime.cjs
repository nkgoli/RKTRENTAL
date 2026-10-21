// Isolated browser-review fixture. Never connects to the user's live database.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS Windows review launcher. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const runtime = path.join(__dirname, '.runtime');
const projectRoot = process.env.OVERVIEW_PROJECT_ROOT ?? root;
const { Client } = require(require.resolve('pg', { paths: [path.join(projectRoot, 'prisma')] }));
const bin = path.join(projectRoot, 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin');
fs.mkdirSync(runtime, { recursive: true });
const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://rocketrental:rocketrental@127.0.0.1:55561/rocketrental?schema=public',
  ROCKETRENTAL_AUTH_SECRET: randomBytes(48).toString('base64'),
  ROCKETRENTAL_AUTH_COOKIE_SECURE: 'false',
  ROCKETRENTAL_SANDBOX: 'true',
  STORAGE_LOCAL_DIR: path.join(runtime, 'storage'),
  NODE_ENV: 'development',
};
let app;
let postgres;
const dataDir = path.join(runtime, 'postgres');
async function stop() {
  if (postgres)
    spawnSync(path.join(bin, 'pg_ctl.exe'), ['stop', '-D', dataDir, '-m', 'fast', '-w'], {
      stdio: 'inherit',
      windowsHide: true,
    });
}
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Fixture setup failed (${result.status})`);
}
async function main() {
  if (fs.existsSync(path.join(dataDir, 'postmaster.pid')))
    throw new Error('Fixture already has a PID file; reconcile before starting.');
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    const init = spawnSync(
      path.join(bin, 'initdb.exe'),
      ['-D', dataDir, '-U', 'rocketrental', '-A', 'trust', '--lc-messages=C'],
      { stdio: 'inherit', windowsHide: true },
    );
    if (init.status !== 0) throw new Error('Isolated initdb failed');
  }
  postgres = spawn(
    path.join(bin, 'postgres.exe'),
    ['-D', dataDir, '-p', '55561', '-h', '127.0.0.1'],
    { stdio: 'inherit', windowsHide: true },
  );
  const client = new Client({
    connectionString: 'postgresql://rocketrental@127.0.0.1:55561/postgres',
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await client.connect();
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='rocketrental'")).rowCount)
    await client.query('CREATE DATABASE rocketrental');
  await client.end();
  run([require.resolve('prisma/build/index.js'), 'migrate', 'deploy']);
  if (!fs.existsSync(path.join(runtime, 'seeded'))) {
    run(['--import', './prisma/os-userinfo.mjs', '--import', 'tsx', 'prisma/seed.ts']);
    fs.writeFileSync(path.join(runtime, 'seeded'), new Date().toISOString());
  }
  app = spawn(
    process.execPath,
    [require.resolve('next/dist/bin/next'), 'dev', '-p', '3261', '-H', '127.0.0.1'],
    { cwd: root, env, stdio: 'inherit' },
  );
  app.on('exit', async () => {
    await stop();
    process.exit(0);
  });
  console.log('Overview-actions fixture: http://localhost:3261, isolated PostgreSQL 55561');
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', (value) => {
  if (value.includes('q')) app?.kill();
});
main().catch(async (error) => {
  console.error(error.message);
  await stop();
  process.exit(1);
});

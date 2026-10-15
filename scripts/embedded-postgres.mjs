// Embedded Postgres launcher used by scripts/start.ps1.
//
// Unlike prisma/local-postgres.mjs this one never hides the failure reason:
// embedded-postgres rejects start() with `reject()` (no Error, so Node printed
// "undefined") when the postgres process exits early. We pass our own log hooks,
// keep every postgres line, and turn the empty rejection into a real message.
//
// Env: ROCKETRENTAL_DB_DIR (required), ROCKETRENTAL_DB_PORT, ROCKETRENTAL_DB_RESET=1.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = path.resolve(process.env.ROCKETRENTAL_DB_DIR ?? '');
const port = Number(process.env.ROCKETRENTAL_DB_PORT ?? 5432);
const reset = process.env.ROCKETRENTAL_DB_RESET === '1';
const log = (m) => console.log(`[postgres] ${m}`);

function describe(e) {
  if (e instanceof Error) return e.stack ?? e.message;
  if (e === undefined || e === null) {
    return 'postgres exited before it was ready (embedded-postgres rejected with no reason). See the postgres log lines above.';
  }
  return String(e);
}
function die(e, code = 1) {
  console.error(`[postgres] FAILED: ${describe(e)}`);
  process.exit(code);
}
process.on('unhandledRejection', (e) => die(e));
process.on('uncaughtException', (e) => die(e));

if (!process.env.ROCKETRENTAL_DB_DIR) die(new Error('ROCKETRENTAL_DB_DIR is not set'));
if (!Number.isInteger(port) || port < 1 || port > 65535) die(new Error(`Invalid port ${process.env.ROCKETRENTAL_DB_PORT}`));
log(`data dir: ${databaseDir}`);
log(`port: ${port}`);

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

if (reset && existsSync(databaseDir)) {
  log('ROCKETRENTAL_DB_RESET=1: deleting existing data dir');
  rmSync(databaseDir, { recursive: true, force: true });
}

// Stale postmaster.pid: remove it when no live process owns it.
const pidFile = path.join(databaseDir, 'postmaster.pid');
if (existsSync(pidFile)) {
  const pid = Number.parseInt(readFileSync(pidFile, 'utf8').split(/\r?\n/)[0], 10);
  if (Number.isInteger(pid) && pid > 0 && pidAlive(pid)) {
    die(new Error(`Data dir ${databaseDir} is already in use by running process ${pid} (postmaster.pid). Stop it first.`));
  }
  log(`removing stale postmaster.pid (pid ${pid} is not running)`);
  rmSync(pidFile, { force: true });
}

mkdirSync(databaseDir, { recursive: true });
const initialised = existsSync(path.join(databaseDir, 'PG_VERSION'));
const leftovers = readdirSync(databaseDir).filter((f) => f !== '.demo-seeded');
if (!initialised && leftovers.length > 0) {
  die(new Error(
    `Data dir ${databaseDir} is half-initialised (has files but no PG_VERSION: ${leftovers.slice(0, 5).join(', ')}). ` +
      'Re-run start.ps1 with -ResetDatabase to delete and re-create it.'));
}

// Make a busy port a clear message rather than a postgres crash.
await new Promise((resolve) => {
  const probe = net.createServer();
  probe.once('error', (e) => die(new Error(`Port ${port} is not available (${e.code}). Use -DbPort to pick another.`)));
  probe.listen(port, () => probe.close(resolve));
});

let EmbeddedPostgres;
try {
  const req = createRequire(path.join(root, 'prisma', 'package.json'));
  ({ default: EmbeddedPostgres } = await import(pathToFileURL(req.resolve('embedded-postgres'))));
} catch (e) {
  die(new Error(`Cannot load embedded-postgres (run: npm install --prefix prisma): ${describe(e)}`));
}

const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'rocketrental',
  password: 'rocketrental',
  port,
  persistent: true,
  onLog: (m) => process.stdout.write(`[postgres] ${String(m).trimEnd()}\n`),
  onError: (m) => process.stderr.write(`[postgres:error] ${m instanceof Error ? m.stack : String(m).trimEnd()}\n`),
});

try {
  if (!initialised) {
    log('initialising data dir (initdb)');
    await postgres.initialise();
  }
  log('starting postgres');
  await postgres.start();

  const admin = postgres.getPgClient();
  try {
    await admin.connect();
    const result = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', ['rocketrental']);
    if (result.rowCount === 0) await postgres.createDatabase('rocketrental');
  } finally {
    await admin.end();
  }
} catch (e) {
  try { await postgres.stop(); } catch { /* ignore */ }
  die(e);
}

console.log(`Local PostgreSQL ready on port ${port}.`);
console.log('Press Ctrl+C (or type q then Enter) to stop.');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try { await postgres.stop(); } finally { process.exit(0); }
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  if (input.includes('q') || input.includes('\u0003')) void stop();
});
setInterval(() => {}, 60_000);

// Task-owned development output; never reads or replaces a shared .env.
import { createServer } from 'node:http';
import next from 'next';
import configModule from 'next/dist/server/config.js';
const loadConfig = configModule.default ?? configModule;
const config = await loadConfig('phase-development-server', process.cwd());
const verificationId = process.env.RENT_VERIFICATION_ID ?? '102d7024';
if (!/^[a-z0-9]+$/.test(verificationId)) throw new Error('Invalid verification identity');
config.distDir = `.next/verification-${verificationId}`;
config.typescript.tsconfigPath = 'tests/rent-analysis/tsconfig.verification.json';

const port = Number(process.env.PORT ?? 3146);
const database = new URL(process.env.DATABASE_URL ?? '');
const databasePort = process.env.RENT_VERIFICATION_DATABASE_PORT ?? '55436';
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== databasePort) {
  throw new Error(`Verification runtime requires the isolated database on port ${databasePort}`);
}
const app = next({
  dev: true,
  hostname: '127.0.0.1',
  port,
});
await app.prepare();
createServer(app.getRequestHandler()).listen(port, '127.0.0.1', () => {
  console.log(
    `Task verification ready: http://127.0.0.1:${port}; database ${database.hostname}:${database.port}${database.pathname}`,
  );
});

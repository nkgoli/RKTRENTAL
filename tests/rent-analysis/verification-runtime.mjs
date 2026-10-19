// Task-owned development output; never reads or replaces a shared .env.
import { createServer } from 'node:http';
import next from 'next';
import configModule from 'next/dist/server/config.js';
const loadConfig = configModule.default ?? configModule;
const config = await loadConfig('phase-development-server', process.cwd());
config.distDir = '.next/verification-102d7024';
config.typescript.tsconfigPath = 'tests/rent-analysis/tsconfig.verification.json';

const port = Number(process.env.PORT ?? 3146);
const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55436') {
  throw new Error('Verification runtime requires the isolated database on port 55436');
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

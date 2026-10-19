// Uses only this task's production output and database; does not read a shared .env.
import { createServer } from 'node:http';
import next from 'next';
import configModule from 'next/dist/server/config.js';
const database = new URL(process.env.DATABASE_URL ?? '');
if (
  database.hostname !== '127.0.0.1' ||
  database.port !== '55561' ||
  database.pathname !== '/rocketrental'
) {
  throw new Error(
    'Navigation runtime requires its isolated database on 127.0.0.1:55561/rocketrental',
  );
}
const loadConfig = configModule.default ?? configModule;
const config = await loadConfig('phase-production-server', process.cwd());
config.distDir = '.next/build-analysis-navigation';
const app = next({ dev: false, hostname: '127.0.0.1', port: 3159 });
await app.prepare();
createServer(app.getRequestHandler()).listen(3159, '127.0.0.1', () => {
  console.log('Navigation production runtime: http://127.0.0.1:3159; isolated PostgreSQL 55561');
});

// Task-owned development output; never reads or replaces a shared .env.
import { createServer } from 'node:http';
import next from 'next';
import config from '../../next.config.ts';

const port = Number(process.env.PORT ?? 3145);
const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55435') {
  throw new Error('Verification runtime requires the isolated database on port 55435');
}
const app = next({
  dev: true,
  hostname: '127.0.0.1',
  port,
  conf: { ...config, distDir: '.next/verification-02a35c0b' },
});
await app.prepare();
createServer(app.getRequestHandler()).listen(port, '127.0.0.1', () => {
  console.log(
    `Task verification ready: http://127.0.0.1:${port}; database ${database.hostname}:${database.port}${database.pathname}`,
  );
});

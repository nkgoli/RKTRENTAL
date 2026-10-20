import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import next from 'next';
import { execFileSync } from 'node:child_process';

const [checkout, directory, build, source] = process.argv.slice(2);
const baseline = path.join(checkout, 'tests/lease-builder/.runtime-db/node_modules/baseline');
if (![checkout, baseline].includes(directory)) throw new Error('Unowned directory');
if (fs.readFileSync(path.join(directory, '.next/BUILD_ID'), 'utf8').trim() !== build)
  throw new Error('Build changed');
if (new URL(process.env.DATABASE_URL).port !== '55508') throw new Error('Unowned database');
if (directory === checkout) {
  execFileSync('git', ['merge-base', '--is-ancestor', source, 'HEAD'], { cwd: checkout });
  execFileSync('git', ['diff', '--quiet', source, '--', 'src', 'public'], { cwd: checkout });
}
const app = next({ dev: false, dir: directory, hostname: '127.0.0.1', port: 3308 });
await app.prepare();
const handle = app.getRequestHandler();
http
  .createServer((request, response) => {
    if (request.url === '/__builder_identity') {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({ checkout, directory, build, source, port: 3308, databasePort: 55508 }),
      );
    } else void handle(request, response);
  })
  .listen(3308, '127.0.0.1');

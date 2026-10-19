import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { checkout, dataDirectory } from './database-identity.mjs';
const [directory, build, candidate, portText] = process.argv.slice(2);
const port = Number(portText);
if (![3294, 3295].includes(port)) throw new Error('Unreserved review port');
const expected = port === 3294 ? checkout : path.join(checkout, '.playwright-mcp', 'baseline');
if (fs.realpathSync(directory) !== fs.realpathSync(expected))
  throw new Error('Review checkout mismatch');
if (fs.readFileSync(path.join(directory, '.next', 'BUILD_ID'), 'utf8').trim() !== build)
  throw new Error('Build identity mismatch');
execFileSync('git', ['merge-base', '--is-ancestor', candidate, 'HEAD'], { cwd: checkout });
execFileSync('git', ['diff', '--quiet', candidate, '--', 'src', 'public'], { cwd: checkout });
const require = createRequire(import.meta.url);
const next = require('next');
const app = next({ dev: false, dir: directory, hostname: '127.0.0.1', port });
await app.prepare();
const handle = app.getRequestHandler();
http
  .createServer((request, response) => {
    if (request.url === '/__lease_review_identity') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ checkout, directory, build, candidate, port, dataDirectory }));
    } else {
      void handle(request, response);
    }
  })
  .listen(port, '127.0.0.1');

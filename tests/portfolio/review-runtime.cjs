// Isolated, local-only review of a committed source snapshot. No live data setup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const workspace = path.resolve(__dirname, '../..');
const runtimeRoot = path.join(__dirname, '.runtime');
const snapshot = path.join(runtimeRoot, 'app');
const identityFile = path.join(runtimeRoot, 'identity.json');
const mode = process.argv[2];
const port = 3115;
const distDir = '.next-portfolio';

if (mode === 'prepare') {
  if (fs.existsSync(snapshot)) throw new Error('Snapshot already exists; reuse its identity.');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim();
  const sourceArchive = path.join(runtimeRoot, 'source.zip');
  execFileSync('git', ['archive', '--format=zip', `--output=${sourceArchive}`, sourceCommit, 'src', 'next.config.ts', 'tsconfig.json', 'package.json', 'eslint.config.mjs'], { cwd: workspace });
  const archiveSha256 = crypto.createHash('sha256').update(fs.readFileSync(sourceArchive)).digest('hex');
  const preparedAt = new Date().toISOString();
  fs.writeFileSync(identityFile, JSON.stringify({ sourceCommit, archiveSha256, preparedAt, port, distDir, snapshot }, null, 2));
  console.log(JSON.stringify({ sourceCommit, archiveSha256, preparedAt, sourceArchive }));
} else if (mode === 'configure') {
  const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
  const configPath = path.join(snapshot, 'next.config.ts');
  let config = fs.readFileSync(configPath, 'utf8');
  if (!config.includes('reactStrictMode: true,')) throw new Error('Review configuration anchor missing.');
  const buildId = `portfolio-${identity.sourceCommit.slice(0, 12)}-${identity.preparedAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
  config = config.replace('reactStrictMode: true,', `reactStrictMode: true,\n  distDir: '${distDir}',\n  generateBuildId: async () => '${buildId}',`);
  fs.writeFileSync(configPath, config);
  fs.copyFileSync(path.join(workspace, 'next-env.d.ts'), path.join(snapshot, 'next-env.d.ts'));
  identity.buildId = buildId;
  identity.reviewConfigSha256 = crypto.createHash('sha256').update(config).digest('hex');
  fs.writeFileSync(identityFile, JSON.stringify(identity, null, 2));
  console.log(JSON.stringify({ buildId, distDir, reviewConfigSha256: identity.reviewConfigSha256 }));
} else if (mode === 'build' || mode === 'start' || mode === 'health') {
  const database = new URL(process.env.DATABASE_URL);
  database.port = '5433';
  process.env.DATABASE_URL = database.toString();
  // Same public local-development fixture used by the existing manager session.
  process.env.ROCKETRENTAL_AUTH_SECRET = 'rocketrental-local-development-session-secret-change-me';
  process.env.ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false';
  process.env.STORAGE_LOCAL_DIR = 'C:/Users/nkgol/RocketRental/.data/storage';
  if (mode === 'health') {
    (async () => {
      const { PrismaClient } = require('@prisma/client');
      const db = new PrismaClient();
      try {
        await db.$queryRaw`SELECT 1`;
        const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
        const response = await fetch(`http://localhost:${port}/sign-in`);
        const html = await response.text();
        const actualBuildId = fs.readFileSync(path.join(snapshot, distDir, 'BUILD_ID'), 'utf8').trim();
        const health = { checkedAt: new Date().toISOString(), url: response.url, status: response.status, databaseReachable: true, buildId: actualBuildId, identityMatches: actualBuildId === identity.buildId && html.includes(actualBuildId) };
        fs.writeFileSync(path.join(runtimeRoot, 'health.json'), JSON.stringify(health, null, 2));
        console.log(JSON.stringify(health));
        if (!response.ok || !health.identityMatches) process.exitCode = 1;
      } finally {
        await db.$disconnect();
      }
    })().catch((error) => { console.error(error.message); process.exitCode = 1; });
  } else {
    process.chdir(snapshot);
    process.argv = [process.execPath, require.resolve('next/dist/bin/next'), mode, ...(mode === 'start' ? ['-p', String(port), '-H', '127.0.0.1'] : [])];
    require('next/dist/bin/next');
  }
} else {
  throw new Error('Use prepare, configure, build, start or health. Extract source.zip into .runtime/app between prepare and configure.');
}

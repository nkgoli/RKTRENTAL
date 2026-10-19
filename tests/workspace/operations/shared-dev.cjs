const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

// A watched project copy gives Next's CLI its own supported config and cache without
// changing the checkout's config, TypeScript settings or production .next output.
const checkout = path.resolve(__dirname, '../../..');
const runtime = path.join(__dirname, '.dev-runtime');
fs.mkdirSync(runtime, { recursive: true });

function syncDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      syncDirectory(from, to);
    } else if (entry.isFile()) {
      const sourceStat = fs.statSync(from);
      const targetStat = fs.existsSync(to) ? fs.statSync(to) : null;
      if (
        !targetStat ||
        Math.abs(sourceStat.mtimeMs - targetStat.mtimeMs) > 1 ||
        sourceStat.size !== targetStat.size
      ) {
        const temporary = path.join(runtime, '.copy-tmp', path.relative(runtime, to));
        fs.mkdirSync(path.dirname(temporary), { recursive: true });
        fs.copyFileSync(from, temporary);
        fs.utimesSync(temporary, sourceStat.atime, sourceStat.mtime);
        fs.renameSync(temporary, to);
      }
    } else {
      throw new Error('The shared development source contains an unsupported link.');
    }
  }
  const names = new Set(entries.map((entry) => entry.name));
  for (const name of fs.readdirSync(destination)) {
    if (names.has(name)) continue;
    const stale = path.join(destination, name);
    const resolved = fs.realpathSync(stale);
    if (!resolved.startsWith(fs.realpathSync(runtime) + path.sep)) {
      throw new Error('Refusing to remove a file outside the generated development copy.');
    }
    fs.rmSync(stale, { recursive: true });
  }
}

async function syncWithRetry(source, destination) {
  let attempts = 0;
  for (;;) {
    try {
      syncDirectory(source, destination);
      return;
    } catch (error) {
      if (!['EBUSY', 'EACCES', 'EPERM', 'ENOENT'].includes(error.code)) throw error;
      if (attempts === 0)
        console.warn('Shared source copy is busy; retrying without stopping Next.');
      await delay(Math.min(1000, 250 * ++attempts));
    }
  }
}

async function main() {
  for (const name of ['src', 'public']) {
    const source = path.join(checkout, name);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(runtime, name);
    // Remove only the link left by an older launcher, never the linked source.
    if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) {
      if (fs.realpathSync(destination) !== fs.realpathSync(source)) {
        throw new Error(`The shared development ${name} link points elsewhere.`);
      }
      fs.unlinkSync(destination);
    }
    await syncWithRetry(source, destination);
    let pending;
    let syncing = false;
    let requested = false;
    async function refresh() {
      requested = true;
      if (syncing) return;
      syncing = true;
      try {
        do {
          requested = false;
          await syncWithRetry(source, destination);
        } while (requested);
      } finally {
        syncing = false;
      }
    }
    fs.watch(source, { recursive: true }, () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        refresh().catch((error) => {
          console.error('Shared source copy failed:', error.code || error.message);
          process.exit(1);
        });
      }, 200);
    });
  }

  fs.copyFileSync(path.join(checkout, 'package.json'), path.join(runtime, 'package.json'));
  fs.writeFileSync(
    path.join(runtime, 'next.config.ts'),
    `
import projectConfig from '../../../../next.config';

export default { ...projectConfig, distDir: '.next-ux-dev' };
`,
  );
  fs.writeFileSync(
    path.join(runtime, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../../../tsconfig.json',
        compilerOptions: { paths: { '@/*': ['./src/*'] } },
        include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', '.next-ux-dev/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2,
    ),
  );

  // Match the existing local demo runtime; keep these settings process-local.
  const database = new URL(process.env.DATABASE_URL);
  database.port = '5433';
  process.env.DATABASE_URL = database.toString();
  process.env.ROCKETRENTAL_AUTH_SECRET = 'rocketrental-local-development-session-secret-change-me';
  process.env.ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false';
  process.env.STORAGE_LOCAL_DIR = 'C:/Users/nkgol/RocketRental/.data/storage';
  process.env.NODE_ENV = 'development';

  console.log(
    JSON.stringify({
      url: 'http://localhost:3102',
      launcherPid: process.pid,
      checkout,
      projectDirectory: runtime,
      outputDirectory: path.join(runtime, '.next-ux-dev'),
    }),
  );
  process.chdir(runtime);
  process.argv = [
    process.execPath,
    require.resolve('next/dist/bin/next'),
    'dev',
    '-H',
    '127.0.0.1',
    '-p',
    '3102',
  ];
  require('next/dist/bin/next');
}

main().catch((error) => {
  console.error('Shared development launcher failed:', error.code || error.message);
  process.exitCode = 1;
});

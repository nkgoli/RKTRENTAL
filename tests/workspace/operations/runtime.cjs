const path = require('node:path');

// Local UX review only: isolate Next's build cache without changing shared .env files.
// The authentication value below is the existing public development fixture value.
const database = new URL(process.env.DATABASE_URL);
database.port = '5433';
process.env.DATABASE_URL = database.toString();
process.env.ROCKETRENTAL_AUTH_SECRET = 'rocketrental-local-development-session-secret-change-me';
process.env.ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false';
process.env.STORAGE_LOCAL_DIR = 'C:/Users/nkgol/RocketRental/.data/storage';
process.chdir(path.join(__dirname, '.runtime'));
const build = process.argv.includes('--build');
process.argv = [
  process.execPath,
  require.resolve('next/dist/bin/next'),
  build ? 'build' : 'start',
  ...(build ? [] : ['-p', '3112']),
];
require('next/dist/bin/next');

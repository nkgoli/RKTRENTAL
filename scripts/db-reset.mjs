// Reset the default local (embedded) Postgres data directory used by
// `npm run db:local` and `npm run preview`, e.g. when the database was created
// by an older schema and `prisma migrate deploy` can no longer reconcile it.
//
// Safety: this only ever deletes the embedded data directory under prisma/
// (default `prisma/.local-postgres`, or ROCKETRENTAL_DB_DIR when it points
// inside that folder). It refuses when DATABASE_URL is set, because that means
// you are pointing at an external database this script must not touch.
// Stop `npm run db:local` / `npm run preview` first, then re-run them; the
// preview launcher applies pending migrations and re-seeds on the next start.
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prismaDir = path.join(root, 'prisma');

if (process.env.DATABASE_URL) {
  console.error(
    '[db:reset] DATABASE_URL is set, so an external database is in use. ' +
      'Unset it to reset the embedded local database; this script never touches external databases.',
  );
  process.exit(1);
}

const target = path.resolve(
  process.env.ROCKETRENTAL_DB_DIR ?? path.join(prismaDir, '.local-postgres'),
);
const allowedRoot = path.resolve(prismaDir);
if (target === allowedRoot || !target.startsWith(allowedRoot + path.sep)) {
  console.error(`[db:reset] Refusing to delete ${target}: it is not an embedded data directory under prisma/.`);
  process.exit(1);
}

if (!existsSync(target)) {
  console.log(`[db:reset] Nothing to reset: ${target} does not exist.`);
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
console.log(`[db:reset] Deleted ${target}`);
console.log('[db:reset] Next `npm run preview` (or db:local + db:migrate + db:seed) recreates it.');

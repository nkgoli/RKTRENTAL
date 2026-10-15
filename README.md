# RocketRental

Rental property management for managers and tenants: properties and units,
leases with e-signature, rent collection, screening, maintenance, documents,
expenses and returns. Next.js (App Router) + TypeScript, PostgreSQL via
Prisma, Vitest unit tests, Playwright e2e tests.

## Quick start

Prerequisites: Node 22+ and npm. Docker is optional (only for the
docker-compose Postgres or the production image). No live provider keys are
needed: every external provider runs as a sandbox/mock adapter by default.

```bash
npm install
# create .env from the block in docs/environment.md (sandbox providers, no live keys)
npm run db:local       # terminal 1: embedded Postgres 16 on :5432, leave it running
npm run db:migrate     # terminal 2: apply Prisma migrations (prisma migrate deploy)
npm run db:seed        # seed the demo portfolio and accounts
npm run dev            # http://localhost:3000, sign in at /sign-in
```

Prefer Docker or your own Postgres? Run `npm run db:up` (docker compose) or
point `DATABASE_URL` in `.env` at your database and skip `db:local`. Set
`ROCKETRENTAL_DB_PORT` (and the port in `DATABASE_URL`) if 5432 is taken.
Embedded data persists in `prisma/.local-postgres/` (git-ignored); if that
database ever falls out of sync with the migrations, stop the database and
run `npm run db:reset`, then start again. `db:migrate` is non-interactive;
use `npm run db:migrate:dev` when authoring a new migration.

## Start on Windows

One command starts everything (prerequisite check, `npm ci` when needed,
`.env`, database, migrations, demo seed on first run, build, app):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

`-ExecutionPolicy Bypass` applies to that one process only and avoids the
"running scripts is disabled" error; it works in Windows PowerShell 5.1 and
PowerShell 7 (`pwsh`). The script prints `http://localhost:3000` once the app
responds; press Ctrl+C to stop the app and its database. Needs Node 22+ and
npm; Docker is only needed with `-Docker`. `Get-Help .\scripts\start.ps1 -Full`
lists everything.

| Option          | Effect                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `-Dev`          | Next.js dev server instead of a production build                              |
| `-Port 3100`    | App port (default 3000)                                                       |
| `-DbPort 5433`  | Postgres port (default 5432); also updates the local `DATABASE_URL` port       |
| `-StopExisting` | Stop an old copy holding the ports (the `RocketRentalPreview` scheduled task) |
| `-Seed`         | Re-run the demo seed (otherwise once per embedded database)                    |
| `-SkipInstall`  | Skip `npm ci`; `-Rebuild` forces a rebuild                                    |
| `-Docker`       | Postgres from `docker compose` instead of embedded Postgres                   |
| `-ResetDatabase`| Delete and re-create this checkout's embedded data dir for `-DbPort` (opt-in)  |
| `-SkipDatabase` | Use the database already named in `DATABASE_URL`                              |

If port 3000 or 5432 is busy, the script reports the holding process (and the
scheduled task, if that is the cause) and exits without stopping anything.
Re-run with `-StopExisting` to stop the old copy, or use `-Port` / `-DbPort`.
For example, `powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -Port 3100 -DbPort 5433`
starts the app on 3100 and embedded Postgres on 5433.

`start.ps1` keeps its embedded data in `.data\postgres-<port>` inside the checkout
(git-ignored), so it never shares a directory with another copy such as
`RocketRentalPreview`; an inherited `ROCKETRENTAL_DB_DIR` is ignored. A stale
`postmaster.pid` (no live process) is removed automatically. A half-initialised
data dir is never deleted silently: the script stops with the reason and the
tail of `%TEMP%\rocketrental\postgres.err.log` / `postgres.out.log`, and exits
non-zero. Add `-ResetDatabase` to wipe and re-initialise that data dir (all local
data in it is lost).

An existing `.env` is never rewritten, but for the run the script overrides stale
values with the ones from `-Port` / `-DbPort`: `PORT`, `ROCKETRENTAL_DB_PORT`,
`DATABASE_URL` (and `DIRECT_URL` / `SHADOW_DATABASE_URL` when set, all pointing at
the bundled Postgres on `-DbPort`), and `NEXTAUTH_URL` / `AUTH_URL` / `APP_URL`
when set. A `ROCKETRENTAL_AUTH_SECRET` shorter than 32 characters (the old
31-character placeholder) is replaced by a built-in local-dev secret, because
shorter ones make sign-in fail with a server error. Each override is printed as
`Stale .env value overridden: NAME=old -> new`. Migrations, seed and the app all
use that one database.

The Next.js server's stdout and stderr are shown in the console prefixed with
`[next]` and also written to `%TEMP%\rocketrental\app-<port>.log`. The path is
printed at start-up and again if the app fails to start, so a server-side
"Application error" page can be matched to its real error (look for the `Digest`).

## Demo accounts (dev only)

| Account | Email                               | Password          |
| ------- | ----------------------------------- | ----------------- |
| Manager | `jordan.mills@rocketrental.example` | `JordanDemo#2026` |
| Tenant  | `alex.rivera@email.com`             | `AlexDemo#2026`   |

Demo passwords are seeded only when `NODE_ENV` is not `production`. To seed
them intentionally elsewhere, set `SEED_DEMO_PASSWORDS=1`; never enable that
on a real production system.

## Preview, tests and e2e

```bash
npm run build          # production build
npm run preview        # embedded DB + pending migrations + seed + next start (PORT honoured)
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, zero warnings
npm test               # Vitest unit tests
npx playwright install chromium   # once
npm run test:e2e       # Playwright suites on PORT (default 3000); server is killed on exit
```

`test:e2e` starts its own embedded Postgres on a throwaway directory, migrates,
seeds, starts one Next dev server and kills the whole server process tree when
it finishes, so no listener is left behind. `preview` applies any pending
migrations to the persistent local database before seeding; if that database
is irreconcilable, run `npm run db:reset` and start the preview again.

## Scripts

| Script                   | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Dev server                                          |
| `npm run build`          | Generate Prisma client and build for production     |
| `npm start`              | Serve the production build                          |
| `npm run preview`        | Embedded DB + migrate + seed + `next start`         |
| `npm run db:local`       | Start the embedded Postgres (installs on first run) |
| `npm run db:up`          | Start Postgres via docker compose                   |
| `npm run db:migrate`     | `prisma migrate deploy`                             |
| `npm run db:deploy`      | Alias for `db:migrate`                              |
| `npm run db:migrate:dev` | Author a new migration                              |
| `npm run db:seed`        | Run `prisma/seed.ts`                                |
| `npm run db:reset`       | Delete the embedded local database (never external) |
| `npm run typecheck`      | `tsc --noEmit`                                      |
| `npm run lint`           | ESLint (zero warnings allowed)                      |
| `npm test`               | Vitest unit tests (`src/**`, `tests/**`)            |
| `npm run test:e2e`       | Playwright suites against one seeded DB and server  |
| `npm run format:check`   | Prettier check                                      |
| `npm run format`         | Format the repository with Prettier                 |
| `npm run postinstall`    | Generate the Prisma client after dependency install |

## Documentation

- [Environment configuration](docs/environment.md) â€” local template and variable explanations.
- [Deployment guide](docs/deployment.md) â€” environment variables, Postgres,
  S3-compatible storage, sandbox vs live providers, webhooks, Docker.
- [Manager help](docs/managers.md) â€” day-to-day work for property managers.
- [Tenant help](docs/tenants.md) â€” paying rent and requesting repairs.
- [Changelog](CHANGELOG.md) â€” release notes, including v1.0.0.

## Folder layout

```
prisma/               schema.prisma, migrations/, seed.ts
src/app/(manager)/    manager routes (dashboard, properties, leases, ...)
src/app/(tenant)/     tenant routes (home, lease, pay, repairs)
src/app/(auth)/       sign-in / sign-out
src/app/api/          files, notifications and webhook endpoints
src/lib/              auth, db, storage, providers, ledger and domain logic
tests/<area>/         Vitest (*.test.ts) and Playwright (*.spec.ts) per area
scripts/              e2e runner, preview launcher, db reset
.github/workflows/    CI (lint, typecheck, test, build, e2e, Docker build)
```

Import alias: `@/*` maps to `src/*`.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, unit tests (including the
database integration tests against a Postgres service), build and e2e on every
push to `main` and every pull request, plus a separate job that builds the
production Docker image.

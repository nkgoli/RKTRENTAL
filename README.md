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
cp .env.example .env   # sandbox providers, no live keys (PowerShell: Copy-Item .env.example .env)
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

| Script                  | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Dev server                                           |
| `npm run build`         | Generate Prisma client and build for production      |
| `npm start`             | Serve the production build                           |
| `npm run preview`       | Embedded DB + migrate + seed + `next start`          |
| `npm run db:local`      | Start the embedded Postgres (installs on first run)  |
| `npm run db:up`         | Start Postgres via docker compose                    |
| `npm run db:migrate`    | `prisma migrate deploy`                              |
| `npm run db:migrate:dev`| Author a new migration                               |
| `npm run db:seed`       | Run `prisma/seed.ts`                                 |
| `npm run db:reset`      | Delete the embedded local database (never external)  |
| `npm run typecheck`     | `tsc --noEmit`                                       |
| `npm run lint`          | ESLint (zero warnings allowed)                       |
| `npm test`              | Vitest unit tests (`src/**`, `tests/**`)             |
| `npm run test:e2e`      | Playwright suites against one seeded DB and server   |
| `npm run format:check`  | Prettier check                                       |

## Documentation

- [Deployment guide](docs/deployment.md) — environment variables, Postgres,
  S3-compatible storage, sandbox vs live providers, webhooks, Docker.
- [Manager help](docs/managers.md) — day-to-day work for property managers.
- [Tenant help](docs/tenants.md) — paying rent and requesting repairs.
- [Changelog](CHANGELOG.md) — release notes, including v1.0.0.

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

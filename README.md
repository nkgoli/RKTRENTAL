# RocketRental

Rental property management app for managers and tenants. Next.js (App Router) + TypeScript, PostgreSQL via Prisma, Vitest for unit tests, Playwright for e2e.

## Quick start

Requirements: Node 22+ and npm. No Docker is needed; an embedded PostgreSQL 16 runs from `prisma/`.

```bash
npm install
cp env.example .env     # local-only defaults, no secrets (PowerShell: Copy-Item env.example .env)
npm run db:local        # terminal 1: start embedded Postgres on :5432 and leave it running
npm run db:migrate      # terminal 2: apply Prisma migrations
npm run db:seed         # seed the 45-unit portfolio and the demo accounts
npm run dev             # http://localhost:3000, sign in at /sign-in
```

Prefer Docker or your own Postgres? Use `npm run db:up` (docker compose) or point `DATABASE_URL` in `.env` at your database, and skip `db:local`. Set `ROCKETRENTAL_DB_PORT` (and the port in `DATABASE_URL`) if 5432 is taken. Data persists in `prisma/.local-postgres/` (git-ignored); stop the runner with Ctrl+C.

`db:migrate` runs `prisma migrate deploy` (non-interactive); use `npm run db:migrate:dev` when authoring a new migration. `db:seed` loads `.env` and a small preload (`prisma/os-userinfo.mjs`) that works around `os.userInfo()` failing with `ENOMEM` on some sandboxed hosts.

## Demo accounts (dev only)

The local seed creates two demo sign-ins. Jordan Mills is a manager and Alex Rivera is a tenant:

| Account | Email                               | Password          |
| ------- | ----------------------------------- | ----------------- |
| Manager | `jordan.mills@rocketrental.example` | `JordanDemo#2026` |
| Tenant  | `alex.rivera@email.com`             | `AlexDemo#2026`   |

Demo password hashes are written by the seed when `NODE_ENV` is not `production`. To seed them intentionally in production, set `SEED_DEMO_PASSWORDS=1`; do not enable that flag on a production system.

## Scripts

| Script               | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Start the dev server                                        |
| `npm run build`      | Generate the Prisma client and build for prod               |
| `npm start`          | Serve the production build                                  |
| `npm run lint`       | ESLint (zero warnings allowed)                              |
| `npm run typecheck`  | `tsc --noEmit`                                              |
| `npm test`           | Vitest unit tests                                           |
| `npm run test:e2e`   | Playwright e2e (run `npx playwright install chromium` once) |
| `npm run db:migrate` | `prisma migrate dev`                                        |
| `npm run db:seed`    | Run `prisma/seed.ts`                                        |
| `npm run db:local`   | Start the embedded Postgres (installs it on first run)      |
| `npm run preview`    | Embedded DB + migrate + seed + `next start` (after build)   |
| `npm run format`     | Prettier                                                    |

## Running as a Managed Preview

The Preview needs a database, so it starts one itself. After `npm run build`, run `npm run preview` (package script `preview`, readiness path `/sign-in`; honours `PORT`). The script installs/starts the embedded Postgres, applies migrations, seeds the demo data and then runs `next start`. Everything stops when the process is stopped. Set `DATABASE_URL` to use an external database instead (the embedded one is then skipped); `ROCKETRENTAL_AUTH_SECRET` defaults to a preview-only value and should be set for any real deployment. Sign in with the demo accounts below.

## Folder layout

```
prisma/               schema.prisma, migrations/, seed.ts
src/app/(manager)/    manager-facing routes
src/app/(tenant)/     tenant-facing routes
src/app/(auth)/       sign-in / account routes
src/components/       shared UI components
src/lib/db/           Prisma client
src/lib/auth/         auth and session helpers
src/lib/storage/      file/document storage adapters
src/styles/           global CSS and design tokens
tests/unit/           Vitest tests
tests/e2e/            Playwright tests
.github/workflows/    CI (lint, typecheck, test, build, e2e)
```

Import alias: `@/*` maps to `src/*`.

## CI

`.github/workflows/ci.yml` runs `npm ci`, typecheck, lint, unit tests (db, auth, storage and UI), build and e2e against a Postgres service on every push to `main` and every pull request.

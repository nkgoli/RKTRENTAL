# RocketRental

Rental property management app for managers and tenants. Next.js (App Router) + TypeScript, PostgreSQL via Prisma, Vitest for unit tests, Playwright for e2e.

## Local setup

Requirements: Node 22+, npm, and Docker (or any PostgreSQL 16 instance).

```bash
npm install
cp env.example .env         # contains local-only defaults, no secrets
npm run db:up               # starts Postgres via docker compose
npm run db:migrate          # applies Prisma migrations
npm run db:seed             # seed the sample portfolio and dev demo accounts
npm run dev                 # http://localhost:3000
```

If you do not use Docker, point `DATABASE_URL` in `.env` at your own Postgres. The sign-in flow and seeded role-based pages require the database; the placeholder root page can load without querying it.

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
| `npm run format`     | Prettier                                                    |

## Running as a Managed Preview

The app is a standard Next.js package. Publish it as a package preview with the script `start` after `npm run build`, readiness path `/` (set `PORT` if the host requires it; Next.js honours it). No database or env vars are needed for the placeholder home page.

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

The only model is a placeholder (`AppMeta`); real models arrive in later Tasks. Import alias: `@/*` maps to `src/*`.

## CI

`.github/workflows/ci.yml` runs `npm ci`, lint, typecheck, unit tests, build and e2e against a Postgres service on every push to `main` and every pull request.

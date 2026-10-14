# Local PostgreSQL

The app uses PostgreSQL through Prisma. For normal development, set `DATABASE_URL`
to a PostgreSQL database and run `npm run db:migrate` followed by
`npm run db:seed` from the repository root.

If Docker or a PostgreSQL server is unavailable, use the embedded PostgreSQL
runner. It downloads a PostgreSQL 16 binary during installation and keeps its
data in `prisma/.local-postgres/`.

1. Run `npm install --prefix prisma`.
2. Run `npm run db:local --prefix prisma` and leave that terminal open.
3. In another terminal at the repository root, run:

   ```powershell
   $env:DATABASE_URL='postgresql://rocketrental:rocketrental@localhost:5432/rocketrental?schema=public'
   npm run db:migrate
   npm run db:seed
   $env:RUN_DB_INTEGRATION='1'
   node node_modules/vitest/vitest.mjs run --config tests/db/vitest.config.mts
   ```

   The first two commands load the schema and sample portfolio; the last
   command includes live PostgreSQL constraint tests.

Set `ROCKETRENTAL_DB_PORT` before starting the runner if port 5432 is occupied,
and use the same port in `DATABASE_URL`. Press Ctrl+C, or type `q` then Enter,
to stop the local server. The data directory is preserved for the next run.

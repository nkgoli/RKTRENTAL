# Environment configuration

Create `.env` from the block below for a local installation. The database URL
uses only the credentials of the bundled local PostgreSQL instance. Replace it
when connecting to another database. Leave optional provider keys empty until
you have test credentials; keep real secrets in your deployment secret store.

```dotenv
# Connection to the bundled local PostgreSQL database; replace for external DBs.
DATABASE_URL="postgresql://rocketrental:rocketrental@localhost:5432/rocketrental?schema=public"
# Port used by the bundled local PostgreSQL server; keep it aligned with DATABASE_URL.
ROCKETRENTAL_DB_PORT=5432
# Optional persistent directory for embedded Postgres (default: prisma/.local-postgres).
# ROCKETRENTAL_DB_DIR=prisma/.local-postgres
# HTTP port for the Next.js server.
PORT=3000
# Local-only cookie-signing placeholder; generate a unique long secret for deployment.
ROCKETRENTAL_AUTH_SECRET="local-dev-only-secret-not-for-production-0123456789"
# Enables built-in mock providers and signing in local demos.
ROCKETRENTAL_SANDBOX=true
# Allows session cookies over local HTTP; use true when serving over HTTPS.
ROCKETRENTAL_AUTH_COOKIE_SECURE=false
# Set to 1 only when intentionally seeding demo passwords outside development.
SEED_DEMO_PASSWORDS=
# Optional Stripe test key; leave empty to use mock payments.
STRIPE_SECRET_KEY=
# Optional Stripe webhook signing secret; leave empty without Stripe webhooks.
STRIPE_WEBHOOK_SECRET=
# Local mock webhook signing placeholder; replace it if using that endpoint.
MOCK_WEBHOOK_SECRET="dev-webhook-secret"
# Optional Plaid credential reference; the current adapter remains mocked.
PLAID_SECRET=
# Optional TransUnion credential reference; the current adapter remains mocked.
TRANSUNION_API_KEY=
# Optional Checkr credential reference; the current adapter remains mocked.
CHECKR_API_KEY=
# Optional RentRange credential reference; the current adapter remains mocked.
RENTRANGE_API_KEY=
# Optional Rentometer credential reference; the current adapter remains mocked.
RENTOMETER_API_KEY=
# Storage driver: local files by default, or s3 for a configured S3-compatible bucket.
STORAGE_DRIVER=local
# Local file storage directory when STORAGE_DRIVER is local.
STORAGE_LOCAL_DIR=.data/storage
# Optional S3-compatible endpoint; leave empty for the default AWS endpoint.
S3_ENDPOINT=
# S3 bucket name; required when STORAGE_DRIVER is s3.
S3_BUCKET=
# S3 region; change to match the configured bucket.
S3_REGION=us-east-1
# S3 access key ID; required for S3 storage and supplied by your secret store.
S3_ACCESS_KEY_ID=
# S3 secret access key; required for S3 storage and supplied by your secret store.
S3_SECRET_ACCESS_KEY=
# Set true for S3-compatible services that require path-style URLs.
S3_FORCE_PATH_STYLE=
```

`npm run preview` and `npm run test:e2e` supply their own local sandbox and
HTTP cookie settings, so those commands can run without creating `.env`.
When `DATABASE_URL` is unset, `npm run test:e2e` starts a fresh database in a
throwaway directory. With `DATABASE_URL` set, it uses that database as-is.

The S3 adapter also accepts `AWS_S3_BUCKET`, `AWS_REGION`,
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as fallbacks for the matching
`S3_*` settings. For test runs, `RUN_DB_INTEGRATION=1` opts the PostgreSQL
integration tests into `npm test` after migrations have been applied.
`ROCKETRENTAL_DEMO_MANAGER_PASSWORD` and `ROCKETRENTAL_DEMO_TENANT_PASSWORD`
override the passwords used by browser tests when testing a custom seed.

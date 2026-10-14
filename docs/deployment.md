# Deployment

RocketRental is a single Next.js app backed by PostgreSQL. The production
Docker image at the repo root is the supported deployment unit; any host that
runs OCI containers and can reach a Postgres 16 database can serve it.

## Build and run with Docker

```bash
cp .env.example .env   # fill in real values, see the table below
docker build -t rocketrental:1.0.0 .
docker run --env-file .env -p 3000:3000 rocketrental:1.0.0
```

The image is multi-stage (`deps` -> `builder` -> `runner`, Node 22 Alpine,
non-root `nextjs` user). On start, `scripts/docker-entrypoint.sh` runs
`prisma migrate deploy` and then `next start -H 0.0.0.0 -p $PORT`
(`PORT` defaults to 3000). If you run the app without the entrypoint, apply
migrations as a separate release step instead:

```bash
node node_modules/prisma/build/index.js migrate deploy
```

Do not run `npm run db:seed` against production; the seed creates demo data.
It only writes demo passwords outside development when `SEED_DEMO_PASSWORDS=1`
is set deliberately — leave it unset in production.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string, e.g. `postgresql://user:pass@host:5432/rocketrental?schema=public` |
| `ROCKETRENTAL_AUTH_SECRET` | yes | Long random secret that signs session cookies |
| `PORT` | no | HTTP port (default 3000) |
| `STRIPE_SECRET_KEY` | no | Stripe **test** key (`sk_test_...`); live keys are refused by design |
| `STRIPE_WEBHOOK_SECRET` | with Stripe | Verifies `POST /api/webhooks/stripe` |
| `MOCK_WEBHOOK_SECRET` | dev/e2e only | Verifies `POST /api/webhooks/mock`; that endpoint is disabled in production |
| `STORAGE_DRIVER` | no | `local` or `s3` (default: `s3` when `S3_BUCKET` is set, else `local`) |
| `STORAGE_LOCAL_DIR` | no | Directory for `local` storage (default `.data/storage`) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` | for S3 | S3-compatible endpoint, bucket, region (`AWS_*` fallbacks accepted) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | for S3 | Storage credentials from your secret store |
| `S3_FORCE_PATH_STYLE` | no | `true` for MinIO-style path addressing |
| `ROCKETRENTAL_DB_PORT` | local only | Port of the embedded Postgres used by `db:local`/`preview` |
| `SEED_DEMO_PASSWORDS` | no | Leave unset in production (see above) |

`PLAID_SECRET`, `TRANSUNION_API_KEY`, `CHECKR_API_KEY`, `RENTRANGE_API_KEY`
and `RENTOMETER_API_KEY` appear in Settings > Integrations as credential
references; those providers currently run through the sandbox adapters below.

## Postgres

Any PostgreSQL 16 works: a managed instance, a container, or the bundled
`docker compose up -d db` service for small deployments. The app only needs a
database it can create tables in. Migrations live in `prisma/migrations/` and
are applied with `prisma migrate deploy`; there is no destructive step. Back
up the database before each release and restore-test the backup periodically.

For local development you can skip external Postgres entirely: `npm run
db:local` runs an embedded Postgres whose data persists in
`prisma/.local-postgres/`. The preview launcher applies pending migrations to
it on every start; `npm run db:reset` deletes it (and refuses to run while
`DATABASE_URL` points at an external database).

## File storage (S3-compatible)

Uploaded documents and photos go through the storage adapter in
`src/lib/storage`. Set `STORAGE_DRIVER=s3` with an endpoint, bucket and
credentials to use AWS S3 or any S3-compatible store such as MinIO
(`S3_ENDPOINT=http://minio:9000`, `S3_FORCE_PATH_STYLE=true`). Create the
bucket beforehand and scope the credentials to that bucket only. With the
`local` driver, files live under `STORAGE_LOCAL_DIR` on the container/host
disk — put it on a persistent volume, or prefer S3 for multi-instance hosts.

## Providers: sandbox vs live

Payments, banking, screening, rent comps and email are provider-backed, and
the default everywhere is **sandbox**:

- **Payments** — the mock provider by default; Stripe only when
  `STRIPE_SECRET_KEY` starts with `sk_test_`. The adapter rejects live keys,
  so this build cannot move real money.
- **Screening** (TransUnion SmartMove, Checkr), **banking** (Plaid) and
  **rent comps** (RentRange, Rentometer) — mock adapters return deterministic
  sandbox results; the API keys above are recorded as credential references
  in Settings > Integrations until live adapters are wired in.
- **Email** — the mock provider records each message in the notification
  outbox (`EmailDelivery`); no mail leaves the system.

Before enabling any live provider, review its adapter, move the real keys
into your secret store (never into `.env.example` or an image layer), and
re-test charges, payouts and screening in its sandbox mode first.

## Webhooks

Payment and screening providers call back `POST /api/webhooks/<provider>`:

- `POST /api/webhooks/stripe` with the `stripe-signature` header, verified
  against `STRIPE_WEBHOOK_SECRET`.
- `POST /api/webhooks/mock` with the `x-mock-signature` header, verified
  against `MOCK_WEBHOOK_SECRET`; returns 404 in production.

Signatures are HMAC-SHA256 over `<timestamp>.<body>` with a five-minute
tolerance. Deliveries are idempotent: a replayed event ID is acknowledged as
a duplicate instead of being applied twice, and events for organizations
without a connected provider are rejected. Point the provider's sandbox
webhook endpoint at your deployment's public URL and confirm deliveries show
as healthy under Settings > Integrations after a test event.

## Operations checklist

1. Set `DATABASE_URL` and a unique `ROCKETRENTAL_AUTH_SECRET`; keep all
   provider keys in sandbox/test mode until go-live review.
2. Run migrations (automatic in the Docker entrypoint).
3. Serve over HTTPS behind your proxy; the app trusts its session cookie.
4. Persist `STORAGE_LOCAL_DIR` or use S3 storage.
5. Watch Settings > Integrations for webhook/sync failures after deploy.

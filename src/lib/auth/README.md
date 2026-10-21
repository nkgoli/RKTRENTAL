# Authentication setup

Email and password credentials are stored on `User` as nullable scrypt hashes in `passwordHash`. Hashes use a random 16-byte salt and the `scrypt$N$r$p$salt$hash` format; authentication compares the derived key in constant time. There is no plaintext fallback.

The seed sets the Jordan Mills manager and Alex Rivera tenant demo password hashes when `NODE_ENV` is not `production`. Set `SEED_DEMO_PASSWORDS=1` to opt in explicitly when running the seed in production. See the root README's **Demo accounts (dev only)** section for local sign-in details. Do not enable demo accounts on a production system.

Set `ROCKETRENTAL_AUTH_SECRET` to a random value of at least 32 characters for a deployed environment.

## Password recovery

`/recover` accepts an email address and returns the same conditional inbox confirmation for known, unknown, ambiguous and rate-limited accounts. Account lookup and delivery run with Next's `after()` callback, outside the public response. The request limiter allows five requests per email or IP in fifteen minutes using the existing process-local limiter; multi-instance deployments also need an edge/shared limiter.

The installed email transport is the durable mock outbox. Recovery requires `ROCKETRENTAL_SANDBOX=true`, the configured authentication secret (at least 32 characters), and `ROCKETRENTAL_APP_URL` set to the application's canonical HTTPS origin. Explicit sandbox use permits a loopback HTTP origin such as `http://localhost:3100`; only loopback request origins are accepted as a development fallback. No live SMTP transport is installed. A disabled transport or missing global configuration returns an unavailable state before account lookup.

Sandbox reset mail is stored in `EmailDelivery` with kind `PASSWORD_RESET`; it is excluded from the organization-wide notification outbox API because it contains a bearer link. Inspect this mail only through an authorized local database connection. Passwords, reset links and provider exception details are never application-logged.

The fifteen-minute HMAC token has a distinct reset purpose and binds the current `passwordHash` and `updatedAt` version. Reset verifies the token, hashes the new password, and conditionally updates the exact old hash/version in one database statement. Exactly one concurrent request can win; the new hash invalidates every outstanding reset token and the advanced `updatedAt` revokes existing sessions. No Prisma schema change is needed. New passwords require 12–128 characters and confirmation.

Focused verification: `npm test -- tests/auth`. Set `AUTH_RECOVERY_DATABASE_URL` explicitly to a disposable local PostgreSQL database to include the sandbox delivery/concurrent-consumption/replay/session-revocation integration test. That test creates a uniquely named organization and deletes only that fixture on completion.

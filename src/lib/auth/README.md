# Authentication setup

Email and password credentials are stored on `User` as nullable scrypt hashes in `passwordHash`. Hashes use a random 16-byte salt and the `scrypt$N$r$p$salt$hash` format; authentication compares the derived key in constant time. There is no plaintext fallback.

The seed sets the Jordan Mills manager and Alex Rivera tenant demo password hashes when `NODE_ENV` is not `production`. Set `SEED_DEMO_PASSWORDS=1` to opt in explicitly when running the seed in production. See the root README's **Demo accounts (dev only)** section for local sign-in details. Do not enable demo accounts on a production system.

Set `ROCKETRENTAL_AUTH_SECRET` to a random value of at least 32 characters for a deployed environment.

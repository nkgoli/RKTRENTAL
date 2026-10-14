# Authentication setup

The seeded development accounts can sign in with these demo credentials:

| Role                   | Email                               | Password          |
| ---------------------- | ----------------------------------- | ----------------- |
| Manager (Jordan Mills) | `jordan.mills@rocketrental.example` | `JordanDemo#2026` |
| Tenant (Alex Rivera)   | `alex.rivera@email.com`             | `AlexDemo#2026`   |

These fallback passwords are accepted only when `NODE_ENV=development`. You can override them with `ROCKETRENTAL_DEMO_MANAGER_PASSWORD` and `ROCKETRENTAL_DEMO_TENANT_PASSWORD`. Do not use the demo credentials outside a local development environment.

Set `ROCKETRENTAL_AUTH_SECRET` to a random value of at least 32 characters for a deployed environment. Deployed credentials use `ROCKETRENTAL_AUTH_PASSWORD_HASHES`, a JSON object from normalized email addresses to `scrypt$<base64url salt>$<base64url hash>` values. The derived hash must be 32 bytes; use a unique salt of at least 16 bytes for each user.

The current seed stores Alex as a tenant record and does not store either password. The development-only account mapping resolves those seeded identities without changing the rental data model.

# Changelog

All notable changes to RocketRental. This project uses semantic versioning.

## [Unreleased] — 2026-10-21

### UX pass

- Added scoped overdue payment reminders with explicitly selected recipients, editable bound previews, email/SMS sandbox tests, persistent outcome history and duplicate-safe interrupted-send recovery. Older arrears and assessed fees remain separate from current-month totals.
- Refined manager lists, property and leasing forms, financial analysis, shared confirmations and feedback in the preceding manager UX pass.
- Gave the tenant portal desktop navigation, a two-column Home, one rent action, dismissible renewal reminders, contextual account controls and clearer lease documents.
- Added a focused payment-review dialog, a compact method chooser, accurate autopay guidance, inline repair validation and consistent request cards with photo previews.
- Preserved sign-in email on errors, added email-and-token password recovery through the sandbox outbox, simplified sign-out and explained role redirects. Reset links expire after 15 minutes; password changes invalidate prior links and sessions.
- Improved shared field accessibility, dialog focus, toast timing, keyboard states and responsive controls. Review findings include explicit reasons for the six remaining cross-cutting P2 deferrals.

## [1.0.0] - 2026-10-14

First production release: a complete rental property management app for
managers and tenants, with sandbox-backed external providers (Stripe test
mode only) and a deployable Docker image.

### Phase 1 — Foundation

- Next.js (App Router) + TypeScript app with Prisma/PostgreSQL schema,
  embedded local Postgres for development, and `prisma migrate deploy`
  -based upgrades.
- Email/password auth with signed session cookies, manager and tenant route
  guards, owner identities, and per-organization scoping.
- Portfolio seed: a 45-unit demo portfolio with manager and tenant demo
  accounts, plus CI running typecheck, lint, unit tests, build and e2e.

### Phase 2 — Properties and portfolio

- Properties and units with occupancy status, listed/market rent with an
  audit trail, portfolio details, property financials and archiving.
- File and document storage with local and S3-compatible drivers, signed
  URLs, and lease/property/unit-scoped access control.

### Phase 3 — Tenants and leases

- Tenant records with notes, emergency contacts and move-in/move-out flow.
- Lease creation wizard, lease events, e-signature flow with signed lease
  PDFs, and a per-lease charge/payment ledger.

### Phase 4 — Payments and tenant portal

- Tenant portal: home, lease view, rent payment by card or ACH, saved
  payment methods, autopay and payment history, plus a mobile repairs flow.
- Provider layer with mock payments/banking/screening/comps adapters,
  Stripe test-mode payments, idempotent signed webhooks for payments and
  screening, and a provider health/integrations settings screen.

### Phase 5 — Screening and applications

- Rental applications with FCRA consent capture, screening requests and
  reports, and a written-criteria decision workflow with an audit trail.

### Phase 6 — Maintenance

- Maintenance board with priorities, vendor assignment, status workflow,
  photo attachments and tenant-visible repair tracking.

### Phase 7 — Money insight and notifications

- Expense tracking per property and a returns screen with NOI, cash flow,
  cap rate, cash-on-cash return, ROI and yield, with CSV export.
- Sandbox email notifications (rent due/late, repair updates, lease
  renewals) recorded in a durable outbox.
- Rent comps workbench using sandbox market-data providers.
- Manager dashboard rollups for occupancy, arrears and expiring leases.

### Release engineering

- Route loading, empty, error and not-found states, plus keyboard and screen
  reader improvements backed by the Playwright accessibility suite.
- Production multi-stage Dockerfile that applies migrations on container
  start, `.dockerignore`, and a CI Docker build job.
- Setup, deployment and user-help documentation (`README.md`, `docs/`).
- Fixes: the e2e runner now kills the Next dev server process tree on exit,
  and the preview launcher applies pending migrations to the local database
  on every start (`npm run db:reset` recovers an irreconcilable database).

### Known limitations

- OWNER accounts are denied the manager app until a scoped owner view exists.
- `npm audit` still reports items in the Next.js, Prisma and
  `eslint-config-next` dependency chains; addressing them requires breaking
  upgrades.
- The Docker image is built in CI but has not been verified locally.
- Most sample leases have income only for August through October 2026;
  Alex Rivera's tenant history extends back to December 2025.
- ROI calculations assume 3% annual property appreciation.

## [0.1.0] - 2026-10-01

- Initial scaffold: app shell, schema migrations and test harnesses that the
  phases above built on. Superseded by 1.0.0.

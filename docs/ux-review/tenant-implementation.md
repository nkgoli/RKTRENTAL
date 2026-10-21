# Tenant, account and shared UX implementation

Implemented the remaining tenant and account findings on top of the manager UX result. Tenant Home now has one rent action and a desktop layout; Pay opens a focused confirmation; repairs share accessible cards and inline validation; lease documents have clear preview/download actions. Account controls, sign-in feedback, role redirects and shared controls follow the light visual system.

## Finding status

| Review file | Fixed | Deferred | Unfixed P0/P1 |
| --- | ---: | ---: | ---: |
| [Tenant portal](tenant-portal.md) | 9 | 0 | 0 |
| [Account and auth](account-auth.md) | 7 | 0 | 0 |
| [Forms and dialogs](forms-dialogs.md) | 10 | 6 | 0 |

Each Status cell includes its implementation or deferral reason. The six deferred P2 items concern specialized financial tables, disclosures and empty states, remaining specialized forms, maintenance date presets and secondary legacy plus labels. The preceding manager pass's fixes remain intact.

## Retained evidence

Screenshots, test logs and the disposable database remain in the retained checkout, outside Git. Relative evidence links below resolve from this document in that checkout:

`C:\Users\nkgol\RocketRental\.orchestra\workspaces\@674zha634hg1uxuy9ha\repository`

The before captures used the exact manager result `e413aa3e319c4bd3732108051836f979daad518f`. Both sets use the same sandbox data, production Next server and configured Playwright browser. Viewports are 1280 × 800 and 390 × 844. No READY Managed Preview was available; checks used the local production server. The account surface is the actual account menu; there is no separate account profile page.

| Surface | Before 1280 | After 1280 | Before 390 | After 390 |
| --- | --- | --- | --- | --- |
| Home | [Before](screenshots/tenant-before-home-1280.png) | [After](screenshots/tenant-after-home-1280.png) | [Before](screenshots/tenant-before-home-390.png) | [After](screenshots/tenant-after-home-390.png) |
| Pay | [Before](screenshots/tenant-before-pay-1280.png) | [After](screenshots/tenant-after-pay-1280.png) | [Before](screenshots/tenant-before-pay-390.png) | [After](screenshots/tenant-after-pay-390.png) |
| Maintenance / repairs | [Before](screenshots/tenant-before-maintenance-1280.png) | [After](screenshots/tenant-after-maintenance-1280.png) | [Before](screenshots/tenant-before-maintenance-390.png) | [After](screenshots/tenant-after-maintenance-390.png) |
| Lease / documents | [Before](screenshots/tenant-before-documents-1280.png) | [After](screenshots/tenant-after-documents-1280.png) | [Before](screenshots/tenant-before-documents-390.png) | [After](screenshots/tenant-after-documents-390.png) |
| Sign in | [Before](screenshots/tenant-before-sign-in-1280.png) | [After](screenshots/tenant-after-sign-in-1280.png) | [Before](screenshots/tenant-before-sign-in-390.png) | [After](screenshots/tenant-after-sign-in-390.png) |
| Recovery | [Before (404)](screenshots/tenant-before-recovery-1280.png) | [After](screenshots/tenant-after-recovery-1280.png) | [Before (404)](screenshots/tenant-before-recovery-390.png) | [After](screenshots/tenant-after-recovery-390.png) |
| Account menu | [Before](screenshots/tenant-before-account-1280.png) | [After](screenshots/tenant-after-account-1280.png) | [Before](screenshots/tenant-before-account-390.png) | [After](screenshots/tenant-after-account-390.png) |

## Browser observations

- All seven surfaces fit both widths without document overflow. Home uses desktop tabs and two columns; phone navigation remains fixed with content clearance. Full-page captures place fixed navigation at the initial viewport fold; viewport and end-of-page checks distinguish that capture behavior from overlap.
- Phone end-of-page checks leave approximately 31px between content and navigation: [Home](screenshots/tenant-after-home-end-390.png), [Pay](screenshots/tenant-after-pay-end-390.png), [Lease](screenshots/tenant-after-lease-end-390.png), [Repairs](screenshots/tenant-after-repairs-end-390.png). Axe found no WCAG 2 A/AA or 2.1 AA violations on these four tenant routes at either checked width.
- Payment confirmation opens at the action, focuses Cancel, contains forward and reverse Tab movement, closes on Escape and restores the Pay trigger. The method chooser opens and cancels without saving. Evidence: confirmation [1280](screenshots/tenant-after-confirm-1280.png) / [390](screenshots/tenant-after-confirm-390.png); chooser [1280](screenshots/tenant-after-method-chooser-1280.png) / [390](screenshots/tenant-after-method-chooser-390.png).
- Empty repair submission shows inline errors, marks the description invalid and focuses it. Evidence: [1280](screenshots/tenant-after-validation-1280.png) / [390](screenshots/tenant-after-validation-390.png).
- Failed sign-in retains the email, clears the password and returns focus to it; empty submission focuses email. Evidence: [1280](screenshots/tenant-after-sign-in-invalid-1280.png) / [390](screenshots/tenant-after-sign-in-invalid-390.png). Actual tenant and manager sign-in/sign-out flows succeeded.
- Recovery was exercised from email request through the sandbox outbox link, password validation, successful reset, subsequent sign-in and rejected reuse. Both widths fit without overflow; request and password forms have no automated WCAG A/AA violations. Empty submission and Try another email restore input focus. Sent confirmation [1280](screenshots/tenant-after-recovery-sent-1280.png) / [390](screenshots/tenant-after-recovery-sent-390.png); new password [1280](screenshots/tenant-after-recovery-password-1280.png) / [390](screenshots/tenant-after-recovery-password-390.png); success [1280](screenshots/tenant-after-recovery-success-1280.png) / [390](screenshots/tenant-after-recovery-success-390.png); used link [1280](screenshots/tenant-after-recovery-used-1280.png) / [390](screenshots/tenant-after-recovery-used-390.png). The public seeded demo password was retained; its hash/version advanced. No reset tokens were added to evidence or Git.
- Renewal dismissal persists across reload for the current lease term. Lease PDF preview returned HTTP 200 with application/pdf. A forced unavailable photo showed its labelled fallback: [390](screenshots/tenant-after-photo-fallback-390.png).
- Both role redirects show context and can be dismissed, removing the notice query parameter. [Tenant notice](screenshots/tenant-role-notice.png).
- Shared manager smoke checks used fully loaded Dashboard, Payments and New property views at both widths, with no document overflow: Dashboard [1280](screenshots/tenant-shared-dashboard-1280.png) / [390](screenshots/tenant-shared-dashboard-390.png); Payments [1280](screenshots/tenant-shared-payments-1280.png) / [390](screenshots/tenant-shared-payments-390.png); New property [1280](screenshots/tenant-shared-property-form-1280.png) / [390](screenshots/tenant-shared-property-form-390.png).

## Verification

- **Full automated suite passed:** `node node_modules/vitest/vitest.mjs run --config vitest.config.ts` (the package's `test` command), **1,101 passed, 53 skipped; 168 files passed, 10 skipped**. The existing opt-in database suites remain skipped. `AUTH_RECOVERY_DATABASE_URL` enabled the new isolated database recovery test. [Full output](screenshots/tenant-full-test-run.txt).
- **Production build passed:** `node node_modules/next/dist/bin/next build`, including compilation, lint, type validation and route generation. [Output](screenshots/tenant-build.txt).
- **Typecheck and scoped lint passed:** `node node_modules/typescript/bin/tsc --noEmit`; ESLint with `--max-warnings=0` over every changed/new source and test TypeScript file. `git diff --check` passed.
- **Recovery security passed:** unit and real PostgreSQL tests cover expiration, tampering, canonical origin restrictions, ambiguous/unknown accounts, concurrent reset consumption, replay, invalidation of other outstanding links and session revocation. The database test creates and removes only its unique organization. Reset links are excluded from the organization outbox API.
- **Review status audit passed:** all 32 rows have Fixed or Deferred with a reason; all P0/P1 rows are Fixed. [Counts](screenshots/tenant-status-counts.json).
- The configured Playwright browser supplied the observed route, keyboard and accessibility checks above. The separate CLI Playwright project runner was not run. The full unit/integration test command was run once more after the final production-source changes.

Non-failing tooling output includes the existing multiple-lockfile Next warning, a future Vite configuration warning and jsdom's unsupported full-document navigation notice.

Database checks reused the existing isolated local Postgres instance. Read-only SQL `SELECT COUNT(*) AS applied_migrations FROM "_prisma_migrations" WHERE finished_at IS NOT NULL` returned **21**. Database data remains under `tests/.local-postgres/` and is excluded from Git.

## Limits

- The existing seeded property and repair photo bytes are gradient fixtures; the UI uses authorized photo endpoints with accessible failure states. No replacement property photography was supplied.
- Recovery uses the installed sandbox mail outbox. Live email transport is not configured, so non-sandbox recovery fails closed with an unavailable message. A canonical app URL and authentication secret are required; the existing process-local request limiter needs an edge/shared equivalent for multiple instances. See [authentication setup](../../src/lib/auth/README.md).
- Payment confirmation, payment-method selection and repair validation were exercised without charging money, enabling autopay or submitting a new repair. Provider mutation behavior is covered by automated tests.
- Browser observations cover the named routes and representative shared consumers, not every legacy financial screen. The six documented P2 deferrals remain explicit.

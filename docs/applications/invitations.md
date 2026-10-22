# Applicant invitations and submission

Managers can create an invitation from **Applications → Send application** or the property Applications tab. Property and unit context carries into the form and is checked again on the server. Creation requires a full name, one valid email address, and a unit belonging to an active property in the manager's organization. Creation opens a preview; it never sends email automatically.

## Routes and behavior

| Route                                      | Purpose                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `/applications/send?propertyId=…&unitId=…` | Manager creation with validated preselection                                           |
| `/applications/invitations/[id]`           | Private manager preview, copy, intentional send/retry, status and expired-link renewal |
| `/applications/invitations`                | Paginated invitation history with property/unit filters                                |
| `/applications` and property Applications  | Recent invitations, saved drafts and submission status alongside existing reviews      |
| `/apply/[token]`                           | Public, invitation-scoped form, saved draft and submission receipt                     |
| `POST /api/applications/invitations`       | Authenticated manager creation                                                         |
| `POST /api/applications/invitations/[id]`  | Authenticated manager send or renewal                                                  |
| `POST /api/applications/submit`            | Token-authorized draft save or submission                                              |

`ApplicationInvitation` is separate from `Application`. Invitations and saved drafts do not enter screening, household, lease or submitted-application counts. On submission, a transaction creates exactly one `SUBMITTED` application and links it to the invitation. Existing single-applicant grouping and review behavior remains intact. The applicant may correct their full name; email and unit are bound to the invitation. No unrelated personal fields are required.

The applicant explicitly confirms their details before submitting. This confirmation is **not screening authorization**. No consent or screening report is created; the existing review continues to show awaiting consent and blocks screening. A provider-specific consent collection flow is outside this implementation.

## Delivery configuration

| Setting                          | Requirement                                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLICATIONS_PUBLIC_ORIGIN`     | Trusted HTTPS origin only, with no credentials, query, fragment or path. Never derived from request headers. Loopback HTTP is allowed only with explicit sandbox mode.                                   |
| `APPLICATIONS_INVITATION_SECRET` | Dedicated, high-entropy server secret of at least 32 characters, stable across server instances and restarts. Used for AES-256-GCM encryption of copyable tokens at rest. Back up and restrict this key. |
| `ROCKETRENTAL_SANDBOX=true`      | Records a sandbox email attempt and makes no network send. A connected non-mock email provider blocks dispatch in sandbox.                                                                               |
| `REMINDERS_LIVE_ENABLED=true`    | Required for live SMTP through the existing reminder transport. This switch is shared with payment reminders; coordinate deployment accordingly.                                                         |
| Organization email connection    | Exactly one connected non-settings `EMAIL` connection with provider `smtp`. `settings.credentialPrefix` must match `RR_REMINDER_[A-Z0-9_]+`.                                                             |
| SMTP credentials                 | Under that prefix, configure `_SMTP_HOST`, `_SMTP_PORT` (465 or 587), `_SMTP_FROM` (one email address), `_SMTP_USER`, `_SMTP_PASSWORD`. Secrets stay in server configuration. TLS is required.           |

Apply the migration and generate the Prisma client before starting the updated server. The new migration is `20261026000000_application_invitations`; existing migrations are unchanged.

Invitations reuse `reminder-transport.ts` and its SMTP configuration, TLS, timeout and error classification. The older `notifications/provider.ts` durable mock and existing notification behavior are unchanged. Invitation attempts have their own durable table; a sandbox invitation does not masquerade as a delivered `EmailDelivery` row.

| Observed state  | Manager meaning                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| No attempt      | Invitation exists; no email has been attempted. Copying a link does not change this.                                   |
| `UNCONFIGURED`  | Email unavailable; copy still works. Configure transport and intentionally retry.                                      |
| `MOCK_RECORDED` | Sandbox recorded; no email sent.                                                                                       |
| `SENDING`       | Dispatch claimed, provider outcome pending. Further sends are blocked. A process failure can leave this state pending. |
| `ACCEPTED`      | Provider accepted the email; delivery is unconfirmed.                                                                  |
| `FAILED`        | Known transport failure; an intentional new retry is allowed.                                                          |
| `UNCERTAIN`     | Ambiguous timeout/error; retry is blocked to prevent duplicate mail.                                                   |

No invitation UI labels SMTP acceptance as delivered. There is no delivery webhook, bounce inbox, or automatic reconciliation for invitation SMTP. For a pending/uncertain attempt, an administrator must investigate its stored provider ID and transport logs before any operational repair. The UI provides no bypass and no background retry. An active link can still be copied.

## Access and replay protections

- Every manager read/write requires the current manager role and organization scope. Owner, tenant and admin roles cannot invoke these manager operations. Unit/property membership and active-property status are checked server-side; composite database foreign keys enforce organization membership.
- Tokens contain 32 cryptographically random bytes, expose no applicant or scope identifiers, and expire after seven days. The lookup uses a SHA-256 hash; recoverable copies are authenticated ciphertext. A token authorizes only that invitation. Treat the link as a bearer secret and share it only with its applicant.
- Public pages disable caching, indexing and referrer propagation. Configure reverse-proxy/access-log redaction for `/apply/*` and avoid collecting these URLs in analytics. Applicant POSTs carry the token in the JSON body.
- Request keys and unique constraints protect creation and send replays. The same normalized email/unit pair returns the existing invitation, including after submission. This version supports one invitation/application cycle per email/unit pair; it does not start a second application cycle for that pair.
- Database row locks serialize saves, submissions, renewals and send claims. Submitted data cannot be changed by a late draft. Repeated/concurrent submissions return the existing receipt. A committed send claim precedes the external transport call; process failure never triggers a blind resend.
- An expired, unsubmitted link can be renewed by a manager. Renewal increments its generation and invalidates the old token. Old-generation sends and repeated renewal requests are rejected. A pending/uncertain send blocks renewal as well.
- Successful/sandbox sends have a one-minute resend interval. Each link generation permits at most ten email attempts, including unavailable/failed attempts. The valid link remains available for copying at that limit.
- JSON schemas reject injected organization, unit, email and consent fields on applicant submission. Same-origin checks apply to all POST endpoints. Invalid, expired and inactive public links share a generic unavailable page.

## Verification

Verified on the retained task checkout using a dedicated local PostgreSQL database on port 5497 and a production `next start` server on port 3297. Only synthetic `example.test` applicants and sandbox/stub transports were used. No real applicant was contacted.

- `prisma validate`, all 25 migrations deployed, and `prisma migrate status`: passed. No existing migration content changed. A full database/schema diff found only the pre-existing `LeaseTemplateItem` index-name mismatch between the lease-template migration's long name and Prisma's generated name; no invitation drift was present.
- `npm run build`: passed. Verified production build ID: `DsMMwOtC9hLZCkDdDXS9d`. `tsc --noEmit`, scoped ESLint, and `git diff --check`: passed. The build emits the existing multi-lockfile tracing-root and Prisma package-configuration deprecation warnings.
- With `RUN_DB_INTEGRATION=1` against the isolated database, `vitest run --config vitest.config.ts tests/applications tests/db/application-invitations.test.ts tests/workspace/leasing/applications-light.test.tsx tests/screening tests/notifications`: **92 tests passed across 15 files**, none skipped. Covers real PostgreSQL concurrency/constraints; current-role and organization scope; malformed, expired and rotated tokens; draft and submitted replay; no fabricated consent; accepted, failed, uncertain, sandbox and unavailable delivery; API session/origin/input boundaries; and existing screening, notification and UI regressions.
- Production configured-Playwright checks passed at 1280×1000 and 390×844: property/unit preselection, creation/preview, link copy, intentional sandbox send, draft save/reload, explicit confirmation, submit/receipt reload, manager tracking and existing review. Screening remained disabled without consent. No horizontal overflow on checked pages; keyboard Tab moved from property to unit. Axe WCAG 2 A/AA and 2.1 AA checks found zero violations on the manager creation and applicant form at both sizes.
- Negative browser checks passed: invalid/expired links, expired-link renewal and old-token rejection, an authenticated mismatched property/unit POST (404), an unauthenticated manager POST (401), immediate resend throttling, and unavailable email with working copy. Temporary connected-live-provider metadata deliberately triggered the sandbox refusal and was removed afterward.
- Database evidence from `tests/applications/browser-fixtures.ts evidence`: the desktop and mobile synthetic applicants each have one `SUBMITTED` application, zero consents, zero reports and one `MOCK_RECORDED` attempt.

The configured browser occasionally lost its MCP session; checks were resumed after read-only reconnection. The final observations above are completed checks. Early selector/auth-origin setup failures are not counted as successful checks. Native Edge, live SMTP/inbox delivery, and the whole-project test suite were not run.

### Retained screenshots

Images are local evidence, excluded from Git. They remain under `.playwright-mcp/` in this task's retained checkout:
`C:/Users/nkgol/RocketRental/.orchestra/workspaces/@52ea1wf6wrystkzbf0l/repository`.

| Flow                              | Desktop                                   | 390px                                    |
| --------------------------------- | ----------------------------------------- | ---------------------------------------- |
| Create with property/unit context | `applications-create-1280.png`            | `applications-create-390.png`            |
| Preview and private link          | `applications-preview-1280.png`           | `applications-preview-390.png`           |
| Applicant form                    | `applications-applicant-1280.png`         | `applications-applicant-390.png`         |
| Submission receipt                | `applications-submitted-1280.png`         | `applications-submitted-390.png`         |
| Manager submitted status          | `applications-tracking-1280.png`          | `applications-tracking-390.png`          |
| Existing application review       | `applications-review-1280.png`            | `applications-review-390.png`            |
| Email unavailable/copy            | `applications-email-unavailable-1280.png` | `applications-email-unavailable-390.png` |

Additional captures: `applications-applicant-draft-1280.png`, `applications-sandbox-1280.png`, `applications-resend-390.png`, `applications-invalid-390.png`, `applications-expired-390.png`, and `applications-renew-390.png`.

The optional `tests/applications/browser-fixtures.ts` helper requires an explicit `APPLICATION_INVITATION_TEST_FIXTURES=1`, sandbox mode and a local database URL. Its `prepare`, `block-email`, `restore-email` and `evidence` commands are for the isolated seeded test database only. Run with the repository's `prisma/os-userinfo.mjs` preload in restricted Windows environments. Never point it at a shared or live database.

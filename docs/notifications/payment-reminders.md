# Overdue payment reminders

This service adds manager-reviewed email/SMS reminders alongside the existing notification sweep and mock email outbox. It uses the existing ledger allocation and RENT_LATE message library. It does not change authentication, signing, PDF or payment settlement behavior. Deploy the additive migration and regenerate Prisma before using it:

```powershell
npm.cmd ci
npm.cmd run db:migrate
node node_modules/prisma/build/index.js generate
```

## UI contract

All manager endpoints require a current authenticated `MANAGER` session. Owner, tenant and admin roles are rejected. Organization and manager come from the verified session; property, unit, tenants and contact addresses come from the selected lease in that organization. Requests cannot supply content, recipients, amounts or organization IDs. JSON bodies reject unknown fields; cookie mutation requests with a foreign Origin are rejected. Responses contain personal contact information and must be displayed only in the authenticated manager workspace; do not cache them.

| Endpoint                                       | Request                                                           | Successful response                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /api/payment-reminders/preview`          | `{ "leaseId": "…", "channel": "EMAIL" }` or `SMS`                 | Persisted preview with `id`, `createdAt`, `expiresAt`, `snapshot`, scope and fingerprint             |
| `POST /api/payment-reminders/dispatch`         | `{ "previewId": "…", "idempotencyKey": "<UUID>" }`                | Persisted operation plus `attempts`; inspect each status, never label the whole response “delivered” |
| `GET /api/payment-reminders/history?leaseId=…` | Lease ID                                                          | Latest 100 dispatched operations, newest first, including content and per-recipient attempts         |
| `POST /api/payment-reminders/reconcile`        | `{ "attemptId": "…" }`                                            | Current attempt after a provider lookup, or a safe error requiring operator investigation            |
| `PATCH /api/payment-reminders/preferences`     | `{ "emailRemindersEnabled": true, "smsRemindersEnabled": false }` | Updated flags for the authenticated tenant only                                                      |

Show the preview's as-of date, overdue amount, pending amount, charge breakdown, every recipient, exact subject/body, excluded contacts/reasons, and expiry before enabling Send. Balances are the **shared lease balance**; do not sum the amount once per cotenant. A preview expires after 10 minutes. Only its creating manager can dispatch it; other managers in the same organization can view dispatched history. Create a UUID before Send and retain it through network retries. Retry the same preview/key, then refresh history; a successful HTTP response does not prove delivery.

`snapshot` contains `kind: RENT_LATE`, `leaseId`, `propertyId`, `unitId`, `channel`, UTC `asOf`, integer `amountCents` and `pendingCents`, `charges: [{id, kind, dueDate, outstandingCents}]`, `recipients: [{tenantId, recipient, subject, body}]`, and `excluded: [{tenantId, reason}]`. Snapshot and rendered content are persisted; the dispatch API never accepts client edits to them. Timestamps are ISO strings in JSON. IDs are opaque.

Balances allocate only `SUCCEEDED` payments, oldest charge first, using the ledger's rent-before-fee tie ordering. Failed/refunded payments do not settle debt. Pending payments are disclosed without reducing unpaid amounts. Future charges are excluded. Rent must be past the lease grace period; persisted assessed late fees include today, while other charges must be before today (UTC). Fees are never projected or assessed by reminders. Ended/terminated leases remain eligible for past arrears; draft leases are excluded. The service reads actual persisted ledger charges; use the normal billing workflow to post any missing charges before previewing.

Email uses the tenant email, falling back to its linked user's email, and requires both tenant `emailRemindersEnabled` and the existing user's `emailNotificationsEnabled` preference. SMS uses tenant phone, falling back to user phone, and requires explicit `smsRemindersEnabled` (default false). Email addresses are validated and normalized; SMS requires E.164 (`+` and 8–15 digits). Contacts are deduplicated within a lease. An opted-out matching contact suppresses that shared address/number even if another cotenant has it enabled. The preferences endpoint allows a tenant to change only its own flags and never overrides the global email opt-out. Tenants without accounts remain SMS-disabled until an operator records their verified preference through an authorized tenant administration workflow; no public manager opt-in override is supplied here.

## Status and recovery

| Status          | Meaning                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `READY`         | Dispatch reserved durably; no transport call claimed yet                                 |
| `SENDING`       | Attempt claimed and stored before external I/O; outcome pending                          |
| `MOCK_RECORDED` | Sandbox audit row only; no provider or delivery                                          |
| `ACCEPTED`      | SMTP relay accepted or Twilio queued/sent the message; delivery unconfirmed              |
| `DELIVERED`     | Authenticated Twilio delivery callback or provider reconciliation confirmed delivery     |
| `FAILED`        | Provider explicitly rejected or reported failed/undelivered                              |
| `UNCERTAIN`     | Timeout, unexpected transport failure, or interrupted sender; delivery may have occurred |
| `CANCELLED`     | Balance, contact, preference, authorization, expiry or transport changed before claiming |

The database persists organization/property/unit/lease/manager/channel scope, rendered snapshot, dispatch time/key, recipient attempts, provider name/ID, claim/acceptance/delivery/update timestamps and safe error codes. Unique organization/idempotency and preview/recipient keys, plus a same-state/UTC-day dedupe key, prevent concurrent/repeated dispatch. Serializable reservation retries never enclose external I/O. An atomic READY → SENDING claim permits one sender across processes. Retrying the same key may resume an unclaimed READY attempt after a crash; it revalidates state and expiry first. SENDING older than 60 seconds becomes UNCERTAIN when history or the same operation is read. Neither uncertain nor failed/accepted attempts are automatically resent.

`STALE_PREVIEW` (409) means refresh and review a new preview. Changes to the ledger (even equal totals), recipients, preferences or lease eligibility invalidate the fingerprint. `REMINDER_ALREADY_DISPATCHED` means that state has already been dispatched today. `IDEMPOTENCY_KEY_REUSED` and `PREVIEW_ALREADY_DISPATCHED` require preserving the original operation/key. An unresolved READY/SENDING/UNCERTAIN attempt blocks another dispatch for that lease/channel even on a later day (`UNRESOLVED_DISPATCH`). Investigate first. Definite failures can be retried by an explicitly reviewed new preview when the state/day changes; there is no background retry job.

Other errors: 401 `AUTH_REQUIRED`; 403 `MANAGER_REQUIRED`/`INVALID_ORIGIN`; 404 lease/preview/attempt not found (also used for foreign organization IDs); 400 invalid/unknown fields or malformed JSON; 415 non-JSON mutation; 422 `NOT_OVERDUE`/`NO_ELIGIBLE_RECIPIENTS`; 503 unconfigured or unavailable service. No secrets or raw provider exception bodies are returned. A browser/network failure after Send is an unknown outcome: keep the key and consult history.

Twilio reconcile performs a read-only Message lookup by the stored SID. A signed callback can recover a missing SID after a send timeout through the attempt ID in its callback URL. SMTP acceptance remains ACCEPTED permanently because generic SMTP has no authenticated delivery-status lookup here. For uncertain SMTP, inspect the relay logs using stable Message-ID `<reminder-ATTEMPT_ID@FROM_DOMAIN>`. `MANUAL_RECONCILIATION_REQUIRED` means preserve the unresolved state until an authorized operator obtains conclusive provider evidence; this API offers no blind “force resend” or claim of confirmed email delivery. Provider account/credential changes may require the original credentials for reconciliation.

External transmission cannot be atomic with ledger updates. State is rechecked in a serializable transaction immediately before claiming each recipient. Changes committed after that claim cannot recall an in-flight message. A database failure after provider acceptance leaves an uncertain operation; never repeat it with a new key.

## External configuration

Defaults fail closed outside explicit sandbox mode. `ROCKETRENTAL_SANDBOX=true` records mock attempts and forbids connected live providers. No recipients are contacted in sandbox. Existing notification sweep behavior and its outbox remain unchanged; these new adapters are selected only for payment reminders.

For live operation, an operator must configure an existing SMTP relay or Twilio account, turn sandbox off, set `REMINDERS_LIVE_ENABLED=true`, and create exactly one `CONNECTED` ProviderConnection row per organization's channel: kind `EMAIL`, provider `smtp`, or kind `SMS`, provider `twilio`. Connection `settings` contains only `{ "credentialPrefix": "RR_REMINDER_ORG_EMAIL" }` (or another prefix matching `RR_REMINDER_[A-Z0-9_]+`). This follows the existing organization-scoped ProviderConnection convention. The integration screen currently has no email/SMS connection editor; provision these rows through your existing authorized server administration process. Do not put secrets in settings, source, client bundles or logs.

For prefix `RR_REMINDER_ORG_EMAIL`, supply server environment variables ending in `_SMTP_HOST`, `_SMTP_PORT` (465 or 587), `_SMTP_USER`, `_SMTP_PASSWORD`, and `_SMTP_FROM` (one bare valid email). SMTP requires TLS, normal certificate validation and authenticated credentials. Configure the relay's authorized sender/domain and its SPF/DKIM/DMARC externally. Nodemailer connection/greeting timeouts are 10 seconds, socket timeout is 20 seconds, and the attempt boundary is 25 seconds. Attachments and URL/file loading are disabled.

For prefix `RR_REMINDER_ORG_SMS`, supply `_TWILIO_ACCOUNT_SID`, `_TWILIO_AUTH_TOKEN`, `_TWILIO_FROM` (an E.164 SMS-capable sender). Use a separately configured prefix for each organization's account when required. Supply global `REMINDERS_TWILIO_CALLBACK_URL` as the exact public HTTPS URL ending `/api/webhooks/notifications/twilio`, without query/hash or credentials. The service appends `attemptId`; the SDK validates callbacks against this external URL, independent of reverse-proxy Host headers. Forward URL-encoded bodies and `X-Twilio-Signature` unchanged. Account, sender, recipient and message SID are checked before state updates. Terminal states resist replay and out-of-order updates. An authenticated 21610 opt-out failure disables that tenant's SMS reminders locally. Configure Twilio's opt-out handling, sender registration and required permissions externally. Automatic SDK request retries are disabled.

Store the variables above only in your private deployment environment. Environment files stay out of the committed deliverable. This task created no accounts and performed no live sends. Configuration enables the real adapters; deployment credentials and deliverability remain external setup requirements.

Official references checked during implementation:

- [Nodemailer SMTP transport](https://nodemailer.com/smtp) and [message result fields](https://nodemailer.com/)
- [Twilio Message resource and status values](https://www.twilio.com/docs/messaging/api/message-resource)
- [Twilio status callbacks](https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks) and [request validation](https://www.twilio.com/docs/usage/security#validating-requests)

## Verification

Run against an isolated migrated PostgreSQL database, using only synthetic fixtures and injected/mock transports:

```powershell
$env:RUN_DB_INTEGRATION='1'
node node_modules/vitest/vitest.mjs run tests/notifications tests/ledger tests/auth/actions.test.ts tests/auth/recovery.test.ts tests/auth/recovery-outbox.test.ts
npm.cmd run typecheck
node node_modules/prisma/build/index.js validate
```

The database tests create uniquely named organizations and remove their fixtures. Do not point integration tests at production. They cover partial balances, arrears/fees/future charges, two tenants and leases, isolation/roles, contact preferences, stale previews, concurrent/repeated sends, failure/uncertain recovery, restart history, and provider reconciliation. Unit contract checks intercept SMTP/Twilio calls and validate signed callbacks without network delivery.

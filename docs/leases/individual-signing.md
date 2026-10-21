# Individual lease signing contract

`src/lib/esign/service.ts` owns signing for new leases and renewals. It persists agreements and each party's signature in PostgreSQL, including in sandbox mode. Apply migration `20261024000000_individual_lease_signing` and regenerate Prisma before using it. The migration adds tables and constraints; it does not backfill historical signatures or change ledger rows.

## Identity and sending

- The designated lessor's signing account is **`Property.ownerId`**, pointing to a same-organization `User` with role `OWNER` or `MANAGER`. There is no fallback to the current manager or an email/name search. A company may be the named lessor in the wizard; `snapshot.lessor.signingUserId` identifies its designated signing representative. If a lessor email was entered, it must match that account.
- Every lease tenant must have **`Tenant.userId`**, linked to a same-organization `TENANT` account. Tenant and account emails must match after trimming and case normalization. Every required party must have a distinct account and email. Case-insensitive duplicate account emails are rejected globally, matching credential login's ambiguity rule. A missing mapping requires an account link; typing an email at signing never creates or reassigns one.
- `sendLeaseForSignature(organizationId, leaseId, client?)` remains compatible with the authenticated manager wizard action. This is a trusted server-service entry point, not an unauthenticated HTTP endpoint. Only call it after manager authorization, deriving organization scope from the session. Its returned `id` is now a durable agreement ID, not `mock-${leaseId}`.
- Send freezes the source, required roster, consent wording and SHA-256 digest. Concurrent/repeated sends of unchanged current terms return the same agreement. `LeaseAgreement.version` increases per lease, and a renewal uses its own lease ID and starts with no signatures. Creating or activating a lease remains the responsibility of the lease services; signing performs no billing or activation.

## HTTP and service calls

`GET /api/leases/{leaseId}/signing` uses the current signed session cookie and returns the immutable `snapshot`, agreement `id`, `version`, `snapshotHash`, `signers` with per-party `signedAt`, `myPartyId`, aggregate `status`, `archiveStatus`, `consentVersion`, and `consentText`. Only the designated current owner/lessor, current linked tenants, and organization managers can read it. An organization manager outside the roster can read but cannot sign. Other owners, unrelated tenants and other organizations receive 404.

`POST` to that same endpoint requires the session cookie, an accepted same-origin `Origin`, and `Content-Type: application/json`:

```json
{
  "agreementId": "<id returned by GET>",
  "snapshotHash": "<digest returned by GET>",
  "fullName": "Alex Rivera",
  "email": "alex@example.com",
  "phone": "+1 (415) 555-0123",
  "consent": true,
  "consentVersion": "lease-esign-v1"
}
```

Show the complete agreement snapshot and exact `consentText` before submitting; collect an explicit consent checkbox. The name must contain letters, be 2–200 characters, and contain no control characters; email must be valid and match the bound account; phone must contain 7–15 digits with ordinary phone punctuation. The endpoint rejects extra fields, including signer IDs, timestamps and authentication metadata. The server derives the signing party from the authenticated user. It records the submitted contact values, explicit consent/version, authenticated subject/email/authentication version/session issue time, and a server timestamp. It never updates the account's contact information.

For server-rendered signing views/actions, use `getSigningAgreement(session, leaseId, client?)` and `submitLeaseSignature(session, leaseId, body, client?)`. Supply only a session from `getSession()`, never one deserialized from user input. Both recheck current account identity and revocation state. Existing `getLeaseSignStatus(organizationId, leaseId, client?)` remains a trusted manager-scoped read.

An owner can log in with `next=/api/leases/{leaseId}/signing` to reach this narrow endpoint. This does not grant owner access to manager pages, files APIs, or unrelated leases. A future signing screen can call these services without changing general owner permissions. The screen and changes to the manager wizard's existing mock labels/buttons are owned by the UI work; the old completion action now returns the retired-operation error.

| Result    | Meaning                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- |
| 200       | Signature recorded, or identical normalized payload already recorded for this party/version          |
| 400       | Invalid contact, missing consent/version, or extra/unrecognized payload fields                       |
| 401       | Missing, expired, revoked or invalid session cookie                                                  |
| 403       | Invalid origin or submitted email differs from the designated signing account                        |
| 404       | No accessible agreement or party; no cross-organization existence disclosure                         |
| 409       | Stale agreement/hash, changed source/mapping, superseded version, or attempted signature replacement |
| 413 / 415 | Request too large / unsupported content type                                                         |
| 500       | Temporary service/storage failure; replay the identical request safely                               |

Responses are private and non-cacheable. Signers see roster names/emails/status but do not receive other parties' submitted phone numbers or authentication evidence.

## Versions, concurrency and history

Serializable transactions, a lease row lock, a unique `(leaseId, version)`, one current agreement per lease, and one party row per `(agreementId, userId)` serialize sends and signatures. Transactions retry serialization/deadlock conflicts. Exact normalized replays return status without replacing proof or appending duplicate events. Concurrent different payloads from one account record one winner and reject the other. No process-memory envelope store participates.

Database triggers reject rewriting agreement snapshots/identities and recorded signatures. Changes to contractual lease fields, the draft's data, or lease tenant membership supersede the current agreement, reset the lease's current signing status, and require a new version, including after an edit is reverted. Property/account changes are also checked against the frozen source at read/sign/send time. Previous snapshots, signature records, completion times and renewal events remain retained. `updateLeaseTerms` can create the need for a fresh send; it never transfers signatures. Termination of a signed/partially signed lease records `moveOutDate` without changing its signed `endDate`.

Historical `SIGNED` lease rows without an agreement remain untouched and readable through the legacy status function (`archiveStatus: LEGACY_UNKNOWN`, empty roster). They cannot be converted into invented individual proof; sending them again fails with an instruction to create a renewal/amendment. Their signed contractual fields are protected from in-place editing. Existing documents remain untouched.

## Signing completion versus PDF archival

`SENT` means no required signatures, `PARTIALLY_SIGNED` means some, and `SIGNED` means all required signatures are durably recorded. On the last signature, the same transaction sets `LeaseAgreement.signedAt`, `Lease.signedAt`, and `archiveStatus = PDF_PENDING`. Before that, `archiveStatus = AWAITING_SIGNATURES`. Superseded current terms report `NOT_SENT` and cannot accept signatures. The `COMPLETED` activity explicitly says the PDF is pending.

**No PDF is generated, uploaded, or claimed to exist by this signing service.** The archival task should consume a specific `(organizationId, agreementId, version, snapshotHash)` whose `signedAt` is present and whose persisted parties all have signatures. Render from **that stored snapshot and those signature rows**, never from current mutable lease/template/account data. Canonical dates and money are the snapshot's top-level fields; `wizard` preserves supplemental inputs, `termsSnapshot.items` preserves resolved template wording, and `selectedText` freezes non-template option/clause/rule/disclosure wording. `snapshot.lessor` explicitly identifies the named lessor and signing representative. Attachment names are inputs, not evidence of file storage.

Use an archival idempotency key based on agreement ID/version, not just lease ID or the shared PDF filename. Add a durable document/storage reference and a stored state only after storage succeeds. On generation/storage failure, retain the signatures and `PDF_PENDING` so archival can retry independently. Do not sign any party, activate a lease, or create ledger charges in that worker. The compatibility functions `completeMockSigning`, `handleEsignCallback`, and mock provider completion all reject bulk signing; a future external provider must establish authenticated per-party evidence rather than revive them.

## Reproducing the checks

Run against a disposable PostgreSQL cluster created within the checkout (the test verifies `SHOW data_directory` before writing). Data is retained locally for inspection; signed evidence is not deleted during teardown.

```powershell
$env:ROCKETRENTAL_DB_DIR = Join-Path (Get-Location) 'prisma/.local-postgres/signing'
$env:ROCKETRENTAL_DB_PORT = '55473'
node --import ./prisma/os-userinfo.mjs prisma/local-postgres.mjs
# In a separate PowerShell process:
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@127.0.0.1:55473/rocketrental'
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js generate
$env:RUN_DB_INTEGRATION = '1'
node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/db/individual-signing.test.ts tests/db/lease-template.test.ts tests/lease-create/lease-create.test.ts tests/leases/leases.test.ts tests/security/sandbox-payment-security.test.ts src/lib/auth/policy.test.ts src/lib/auth/session.test.ts
npm.cmd run typecheck
```

The signing database tests cover an owner plus two tenants, simultaneous/replayed and conflicting submissions, a fresh Node process reading persisted signatures, stale versions, draft/roster edits, renewal/ledger/history preservation, legacy records, account ambiguity/reassignment, authorization failures, retired mock callbacks, and real route handlers with signed session cookies and CSRF checks. `next/headers.cookies()` is the only mocked HTTP boundary; service queries and session revocation checks use PostgreSQL.

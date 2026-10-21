# Signed agreement archival

Signing and archival are separate durable results. Apply migration
`20261025000000_signed_lease_archive` and regenerate Prisma before deploying the
updated service. The predecessor individual-signing migration remains required.
No historical signatures are invented or existing lease documents replaced.

## Completion and recovery

The final authenticated signature commits first, leaving `PDF_PENDING`. The same
request then attempts archival from that specific immutable `LeaseAgreement` and
its persisted party rows. Only all-signed agreements qualify; superseded signed
versions remain eligible so later edits cannot strand their archives. No lease
activation or ledger operation runs in this worker.

`archiveSignedAgreement` holds a PostgreSQL transaction-scoped advisory lock for
one agreement. Other workers return pending instead of duplicating work. Storage
uses a deterministic key containing the organization, lease, agreement and
version. The worker verifies stored bytes by SHA-256 before committing the
Document, unique `LeaseAgreementFile` link and `ARCHIVED` state together. A crash
releases the lock; bytes left by a rolled-back transaction can be reused at the
same key. There is no filename-based deduplication or process-memory completion
flag. Generation timestamps and PDF metadata derive from the signing record.

Generation, storage, or verification failure preserves signatures and records
`PDF_FAILED`, a safe error message, attempt count and a retry time one minute
later. If the database is unavailable while recording the error, the original
pending row remains the queue entry. No new signature is needed.

Due work retries on authorized signing/status reads and lease file lists. The
existing manager-authenticated `POST /api/notifications/run` also runs a bounded
organization archive sweep, suitable for its existing scheduled-caller pattern.
An owner invocation of that job does not run an organization-wide archive sweep.
There is no new autonomous scheduler process: deployments needing recovery while
no one is browsing must keep that authenticated scheduled job running.

The sweep handles up to 10 agreements by default (maximum 25); individual reads
handle at most two versions of the accessed lease. Worker transactions time out
after two minutes. A persistent storage/configuration/font failure remains
retryable and visible; it never becomes a completed archive.

## Complete agreement and separate originals

The final PDF uses the frozen property/parties, dates, rent/deposit/fees, resolved
terms, selected clauses/rules/disclosures and supplemental wizard values. It
includes actual submitted signer names, email, phone, server timestamps, consent
wording/version and recorded authentication audit values. The complete review
record is reproduced in a separately labeled annex and embedded as JSON. Raw
template options in that annex do not become additional operative terms.

Embedded open-source Noto fonts support Latin, Greek, Cyrillic, CJK, Arabic,
Hebrew and Devanagari names;
measured line wrapping and pagination retain long clauses and identifiers. An
unsupported character is rejected before a new agreement is sent or a new
signature is committed, instead of silently changing a name. The deployment must
add an appropriate font before accepting additional scripts. An existing signed
record whose text cannot be rendered remains in a truthful retryable failure
state. This is a record of authenticated electronic signatures, not a claim of a
certificate-based PDF digital signature.

Sending freezes every actual `ADDENDUM` Document on that lease by ID, name, MIME,
size and SHA-256. Names typed into the wizard alone never count as stored files.
The send operation preserves each original's document ID, name and byte content,
copying verified bytes to a protected storage key before pinning the reference.
Old direct-upload PUT URLs cannot overwrite that reviewed copy. The old upload
object may remain unreferenced; no cleanup of historical objects is attempted.

Each original stays a distinct file. Its bytes are not rewritten with invented
signature marks. `LeaseAgreementFile` links it to every version that included it.
Before final archival, the worker checks each pinned original's bytes again.
Prior renewals and uploaded originals remain intact. A new renewal has a new
lease/agreement identity and independent final PDF. Addendums must actually be
attached to the renewal to be part of that renewal's reviewed manifest.

Existing immutable snapshots without an addendum manifest archive as recorded;
later uploads cannot be retroactively declared signed. Adding an addendum to a
current agreement changes its source hash and requires a new send/review.

## UI and access contract

Signing envelopes now expose `archiveStatus`, `archivedAt`, `archiveDocumentId`,
`archiveNextAttemptAt` and the safe `archiveError`. `SIGNED` still describes the
signature result, independently of whether a PDF exists.

| Archive state         | Meaning                                                         |
| --------------------- | --------------------------------------------------------------- |
| `AWAITING_SIGNATURES` | One or more required signatures are missing; no final PDF       |
| `PDF_PENDING`         | Signatures complete; worker pending or another worker is active |
| `PDF_FAILED`          | Archival unverified; automatic retry due at the returned time   |
| `ARCHIVED`            | Verified final PDF and document reference committed             |
| `LEGACY_UNKNOWN`      | Historical lease lacks individual signing proof                 |

`publicDocument` returns an `agreements` array with `agreementId`, `version`,
`artifact`, `signatureStatus`, `signedAt`, `supersededAt`, `archiveStatus`, and `sha256` for each
version link. `SIGNED` identifies the generated final lease; an original addendum
uses `INCLUDED_IN_SIGNED_AGREEMENT` after all parties sign, and
`AWAITING_SIGNATURES` beforehand. An unsigned superseded version reports
`SUPERSEDED`; signed historical versions retain their signing proof. An empty array is unverified, regardless of file
kind or filename. A shared original can have links to multiple versions.
`documentAgreementMetadata` supplies the same mapping for library queries that
include `agreementFiles.agreement`. UI wiring remains a separate task.

Existing list/preview/download routes and access policy apply: managers within
their organization, owners of the property, and tenants on that lease. Other
owners/tenants/organizations receive no access. Pinned originals and generated
final documents cannot be deleted through FileService, and database constraints
prevent deleting or rewriting referenced metadata. File deletion takes the same
lease lock as sending before checking references or touching storage bytes.

## Reproducing the self-checks

The disposable cluster is retained under `prisma/.local-postgres/signing` on
port 55473. Tests verify `SHOW data_directory` before any fixture writes. The
`lease_archive_final` database uses UTF8 (created from template0 with C locale) so real
non-ASCII fixture names are supported; no project/runtime database is used.

```powershell
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@127.0.0.1:55473/lease_archive_final'
$env:RUN_DB_INTEGRATION = '1'
$env:STORAGE_LOCAL_DIR = Join-Path (Get-Location) 'prisma/.local-postgres/archive-storage'
node --import ./prisma/os-userinfo.mjs node_modules/prisma/build/index.js migrate deploy
node --import ./prisma/os-userinfo.mjs node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/db/lease-archive.test.ts tests/db/individual-signing.test.ts tests/esign/pdf.test.ts tests/storage tests/security/storage-security.test.ts tests/documents tests/lease-create/lease-create.test.ts
npm.cmd run typecheck
```

Synthetic rendered-PDF evidence and final observed check results are recorded in
the task submission. Rendered images and tool caches stay local, outside Git.

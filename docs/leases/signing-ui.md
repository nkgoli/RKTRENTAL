# Lease review, individual signatures and documents

Create lease and Renew lease now hand off to the same authenticated signing view.
Review & send retains the light wizard layout and now shows all resolved wording,
custom clauses/rules, designated owner account, every tenant email and individual
attachment preview/download links. Actual files marked Addendum are included in
the immutable agreement; supporting documents remain separate.

The owner / lessor signs at `/sign/leases/{leaseId}`. Owners land at `/sign`, which
lists only their properties' agreements and retained document links. General
manager pages and actions remain unavailable to owners. Managers can open the
signing page as observers; a manager can sign only when that account is the
designated property owner. No signer selector or client-supplied party ID exists.

Every signer types their full name and phone and explicitly checks the exact
stored consent wording. Their account email is displayed as a required read-only
field because the service requires it to match the designated account. Corrections
to account identity must be reconciled before sending; this form never edits
account contacts. Server identity, source/hash validation and signature persistence
remain in the existing signing service.

The roster shows every owner/tenant signature independently. Saved parties see an
already-signed confirmation after reload. A stale-version response disables the
form and clears consent until the signer checks status and reviews again. Network
failures retain typed details and allow status checking. The view polls visible
pending agreements every 15 seconds and offers an explicit Check status action.

`SIGNED` and document storage are separate results: processing and retryable
failure preserve signatures and never request new signatures. Only `ARCHIVED`
with a document ID shows the final PDF links. Recovery reads honor the service's
retry time. The lease detail Agreement tab offers a manager-only current-version
send action, including recovery when activation succeeded but sending failed.
The wizard no longer invokes the retired bulk/mock completion action or claims
that email was sent.

Tenant Lease now lists current, upcoming and previous leases separately from the
Home/Pay current-lease selection. Selecting `/lease?lease={leaseId}` uses the same
tenant membership policy and lists that lease's files. Prior renewal files remain
accessible. The manager's existing Documents library automatically lists the final
lease and each original addendum; lease detail also offers PDF/image preview.

## Verification observed on 2026-10-21

- `npm.cmd test -- --reporter=dot`: **171 files passed, 13 skipped; 1,125 tests
  passed, 77 skipped**. The default suite gates database integration tests.
- With `RUN_DB_INTEGRATION=1`, `tests/db/individual-signing.test.ts` and
  `tests/db/lease-archive.test.ts`: **23 tests passed** against the disposable
  PostgreSQL cluster. Includes actual account permissions, conflicting/replayed
  signatures, term changes, process persistence, storage faults and renewal history.
- `tests/lease-signing/signing-panel.test.tsx`: **10 tests passed**, included in
  the full-suite total. Covers observer restrictions, validation/focus, readonly
  account email, envelope merging, reload/stale states, document processing/failure,
  verified document links, full wording and separate addendums.
- `npm.cmd run typecheck`: passed. `npm.cmd run build`: passed, including Next's
  lint/type validation. `git diff --check`: passed.

Configured Playwright used a local production server on port 3238 because no
Managed Preview session existed. All records and accounts were synthetic; no real
tenant messages or signatures were produced. Browser transport resets were
recovered by reading saved state before continuing.

The new lease was resumed in Create lease at Review & send and activated there.
The owner signed first, then Tenant one, then Tenant two. A second draft was
resumed from the original lease's Renew lease action, sent from the renewal Review
& send screen, then signed by Tenant one, Tenant two, and the owner last. Each party
returned through their own login and reloaded after signing. For each lease the
database audit found **three independent consented signatures, one final PDF,
one separate addendum and ARCHIVED status**. Repeated reads did not create another
PDF. Both leases stayed ACTIVE, preserving the pre-existing activation/billing
behavior.

Browser checks also observed:

- 1280px and 390px Review & send, signing, waiting/completed and document screens;
  checked phone pages had no horizontal overflow.
- Blank inputs produce inline errors and focus the alert; keyboard Space checks
  consent. The account email is read-only.
- A browser-intercepted stale hash was sent to the real signing endpoint, which
  returned 409; the UI disabled submission, then recovered after Check status and
  fresh consent. No signature was stored for the rejected request.
- Managers outside the roster have no signing form. An unrelated owner received
  404 for signing, 403 for the addendum file, and a role redirect from `/leases`.
- New-lease preview opened in a PDF tab and returned `application/pdf` with `%PDF-`
  bytes. Both final PDFs downloaded with the versioned filename. Renewal preview
  returned 200 with 371,537 bytes. Tenant Documents showed the separate addendum;
  returning to the prior lease still showed its PDF and pet addendum. Manager
  Documents showed two final PDFs in separate lease groups and both addendums.

## Retained evidence and reproduction

Evidence stays in this Task's retained checkout, outside Git:
`C:/Users/nkgol/RocketRental/.orchestra/workspaces/@446vdd41tedyd7utltb/repository`.
The submission names individual screenshot paths. Representative files:

- `signing-new-review-1280.png`, `.playwright-mcp/signing-new-review-390.png`
- `.playwright-mcp/signing-renewal-review-1280.png`, `.playwright-mcp/signing-renewal-review-390.png`
- `.playwright-mcp/signing-new-owner-1280.png`, `.playwright-mcp/signing-new-owner-signed-390.png`
- `.playwright-mcp/signing-new-tenant-one-1280.png`, `.playwright-mcp/signing-new-tenant-two-390.png`
- `.playwright-mcp/signing-renewal-one-390.png`, `.playwright-mcp/signing-renewal-two-1280.png`, `.playwright-mcp/signing-renewal-owner-390.png`
- `.playwright-mcp/signing-validation-390.png`, `.playwright-mcp/signing-stale-version-390.png`
- `.playwright-mcp/signing-new-completed-1280.png`, `.playwright-mcp/signing-renewal-completed-390.png`
- `.playwright-mcp/signing-renewal-tenant-documents-390.png`, `.playwright-mcp/signing-manager-documents-1280.png`
- `.playwright-mcp/signing-new-pdf-preview.png`

The disposable UTF8 `signing_ui` database uses port 55480 and the cluster at
`tests/lease-signing/node_modules/postgres`. Storage is in the adjacent `storage`
directory. `fixture.ts` verifies `SHOW data_directory` before writing; `database`
creates only the UTF8 fixture database, the default command creates the synthetic
new-lease draft, `renewal <leaseId>` creates its renewal draft, and `audit` reads
agreement/party/file counts. Run it with `node --import ./prisma/os-userinfo.mjs
--import tsx tests/lease-signing/fixture.ts <command>` and the disposable
`DATABASE_URL`/`STORAGE_LOCAL_DIR`. Apply migrations before seeding. The retained
`new.json`, `renewal.json`, `audit.json`, `full-suite.log`, `database-check.log` and
`build.log` are under `tests/lease-signing/node_modules/`.

## Deployment requirements

Apply the individual-signing and signed-archive migrations, generate Prisma, retain
the archival fonts and configure durable file storage. Each property must have its
designated owner account and each tenant must have a matching linked account.
No automatic email/SMS delivery is implemented; share the signing page link with
the parties through an authorized channel. A configured authenticated notification
job is still required for archival recovery when nobody is browsing; status reads
retry due work while a party visits. See [signing service](individual-signing.md)
and [archival service](signed-archive.md). No Preview was published, deployment made
or remote push requested by this Task.

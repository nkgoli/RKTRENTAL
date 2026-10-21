# Signed archive implementation verification

Automatically archive complete signed lease PDFs and separate addendums is implemented
as a committed candidate. Signing commits independently of archival. Immutable version
links, verified stable storage keys and a PostgreSQL worker lock prevent duplicate final
documents; recoverable failures never require another signature.

## Observed checks

- **Passed: 89 targeted tests across the final scoped runs.** This includes 13 real
  PostgreSQL archival scenarios, 10 individual-signing regressions, seven renderer
  checks, and storage/security/document/job/lease-create regressions. The final
  affected database runs passed 13 archival tests and 10 signing tests. Test fixture
  repairs added explicit row ordering and a real changed-rent value; no production
  assertion was removed or relaxed.
- **Passed: fresh migration deployment, Prisma validation, generation and schema
  comparison.** All 23 migrations deployed to disposable UTF8 database
  `lease_archive_final` on port 55473. Tests verified `SHOW data_directory` matched
  `prisma/.local-postgres/signing` before writes. Schema comparison leaves only the
  pre-existing `LeaseTemplateItem` index-name mismatch, outside this change.
- **Passed: project typecheck, scoped ESLint and Git whitespace checks.**
- **Passed: PDF text/content and visual checks.** Three synthetic PDFs contain 22
  pages (10 + 6 + 6). PyMuPDF rendered every page; contact sheets and full-size
  signature pages were inspected. Bounding-box and independent logical-text checks
  found no clipping or missing tested content. Root spot checks also inspected long
  terms and Arabic, Hebrew and Devanagari signatures. Exact hashes and sizes are in
  [inspection-results.json](pdf-evidence/inspection-results.json).

The full integration command was:

```powershell
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@127.0.0.1:55473/lease_archive_final'
$env:RUN_DB_INTEGRATION = '1'
$env:STORAGE_LOCAL_DIR = Join-Path (Get-Location) 'prisma/.local-postgres/archive-storage-final'
node --import ./prisma/os-userinfo.mjs node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/db/lease-archive.test.ts tests/db/individual-signing.test.ts tests/esign tests/storage tests/security/storage-security.test.ts tests/documents tests/lease-create/lease-create.test.ts
npm.cmd run typecheck
```

The affected database files were rerun after the fixture corrections. Integration
coverage includes partial signing, final-signature persistence, concurrent final
signers/replays/workers, a storage exception, torn bytes, a database rollback after
successful storage, request/job retry, superseded versions, renewal preservation,
separate addendums, stale upload URLs, retention, all file-access roles, and actual
multilingual signature names. Unsupported characters are rejected before new
signatures commit.

## Retained PDF evidence

All evidence below is synthetic and retained in this Task checkout:
`C:/Users/nkgol/RocketRental/.orchestra/workspaces/@446vdd41tedyd7utltb/repository`.
PDF samples and screenshots are local evidence, not committed application assets.
The [PDF inspection report](pdf-evidence/README.md) records rendering instructions,
font provenance and the exact scope of visual checks.

- [Long agreement](pdf-evidence/synthetic-long-signed-agreement.pdf), with
  [pages 1–4](pdf-evidence/synthetic-long-signed-agreement-contact-1.png),
  [pages 5–8](pdf-evidence/synthetic-long-signed-agreement-contact-2.png) and
  [pages 9–10](pdf-evidence/synthetic-long-signed-agreement-contact-3.png).
- [Renewal with a separate addendum reference](pdf-evidence/synthetic-renewal-with-addendum-reference.pdf),
  [pages 1–4](pdf-evidence/synthetic-renewal-with-addendum-reference-contact-1.png) and
  [pages 5–6](pdf-evidence/synthetic-renewal-with-addendum-reference-contact-2.png).
- [Multiscript signatures](pdf-evidence/synthetic-multiscript-signatures.pdf),
  [Arabic/Hebrew signature page](pdf-evidence/synthetic-multiscript-signatures-page-5.png) and
  [Devanagari signature page](pdf-evidence/synthetic-multiscript-signatures-page-6.png).

## Delivery limits

UI wiring, browser UX checks, Preview publication, a production build and remote push
were not part of this backend Task. The [implementation contract](signed-archive.md)
documents the UI statuses and recovery behavior. Recovery with no browsing traffic
depends on invoking the existing authenticated manager sweep on a schedule. Font
coverage is finite; additional scripts require another bundled font and rendering
check. Plain extractors vary on right-to-left text; logical `ActualText` and embedded
signature JSON preserve the original names. This submission does not claim a
certificate-based PDF digital signature or independently signed addendum bytes.

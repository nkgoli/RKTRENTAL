# Signed lease archival integration repair

The retained archive and signing UI result is reconciled with current project main.
The actual non-force merge reproduced conflicts only in `package.json` and
`package-lock.json`. Both now contain the union of the PDF and reminder dependencies;
installation preserved the resolved lockfile. No application behavior was rewritten.

## Preserved inputs

- Retained signing UI head: `11072a2847ba00ada6c2695460d5bd5b2913f518`.
- Archival implementation: `87fe1039e530f2f013d128db8648e1cbef3caaad`.
- Main merged into the retained branch: `a70b0801af237edc3e90cd2f1d030723eb6abced`.
- Main's deterministic signing proof ordering remains present alongside archival
  assertions. Prisma retains archive relations, checksums and uniqueness constraints
  together with reminder models, preferences and SMS provider support.
- Archive, storage, document library and notification-sweep code match the retained
  head. Main's reminder migration and workspace timeline data retain their exact
  Git blobs. Conflict-free changes outside lease/PDF ownership are preserved.
- All three synthetic PDF hashes match the original
  [inspection results](pdf-evidence/inspection-results.json). Rendered pages, text and
  contact sheets remain untracked in the retained checkout; none was regenerated or
  added to Git. The prior 22-page inspection remains applicable.

## Affected verification

- Passed: **151 tests across 23 files**, with real PostgreSQL integration enabled.
  Coverage includes individual signatures, archive concurrency/storage failures and
  retries, renewals, separate addendums, document access, signing-panel behavior,
  archive jobs, reminder transports/APIs and reminder database behavior.
- Passed: Prisma validation and client generation. Migration deployment found 24
  migrations and successfully added the reminder migration to the retained UTF8
  `lease_archive_final` test database on port 55473. Archive tests verify the cluster
  directory is `prisma/.local-postgres/signing` before writes.
- Passed: project typecheck, scoped archive/signing ESLint, dependency installation
  and `npm ls --depth=0` (all declared packages present).
- Passed: whitespace checks on the two conflict resolutions and this report.
  Broader comparisons expose existing CRLF/whitespace in already committed
  migrations, timeline data and a font license. Those inputs were preserved to
  avoid changing deployed migration checksums or unrelated source.

Commands used for the affected checks:

```powershell
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@127.0.0.1:55473/lease_archive_final'
$env:RUN_DB_INTEGRATION = '1'
$env:STORAGE_LOCAL_DIR = Join-Path (Get-Location) 'prisma/.local-postgres/archive-storage-final'
node --import ./prisma/os-userinfo.mjs node_modules/prisma/build/index.js validate
node --import ./prisma/os-userinfo.mjs node_modules/prisma/build/index.js generate
node --import ./prisma/os-userinfo.mjs node_modules/prisma/build/index.js migrate deploy
node --import ./prisma/os-userinfo.mjs node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/db/lease-archive.test.ts tests/db/individual-signing.test.ts tests/esign tests/storage tests/security/storage-security.test.ts tests/documents tests/lease-create/lease-create.test.ts tests/lease-signing tests/notifications tests/workspace/payment-reminders
npm.cmd run typecheck
node node_modules/eslint/bin/eslint.js src/lib/esign src/lib/storage src/lib/documents src/app/api/notifications/run tests/db/individual-signing.test.ts tests/db/lease-archive.test.ts --max-warnings=0
npm.cmd ls --depth=0
git diff --check HEAD -- package.json package-lock.json docs/leases/archive-integration-repair.md
```

The original [archive verification](signed-archive-verification.md) and subsequent
[signing UI evidence](signing-ui.md) are retained. This integration repair did not
repeat the full suite, PDF rendering, browser checks or production build because
those implementations were unchanged. No Preview or remote push is part of this
repair. The completion check records the exact final candidate and root-main
containment after the commit, including preservation of root's unrelated local files.

# Combined integration and delivery — 2026-10-21

The combined RocketRental release passed verification, was fast-forwarded into the bound main checkout and pushed normally to origin/main. An independent remote-ref read confirmed the delivered code and report-history commit `1f6153badc734f8e61cd7553807d11c0dc4f679f`. This final report is a documentation-only follow-up; its containing commit and independent final remote confirmation are recorded in the Task submission and the retained delivery receipt linked below.

## Repository and delivery

- Assigned checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@63x6z1p56soa9k51k1q/repository`.
- Retained work branch: `orchestra/work-2gcjdifqik3o7helc0b-0h08edahcfw2ddb0gvs`.
- Bound destination: `C:/Users/nkgol/RocketRental`, checked out on `refs/heads/main`.
- Configured origin fetch/push destination: `https://github.com/nkgoli/RKTRENTAL.git`.
- Original main/task base: `a70b0801af237edc3e90cd2f1d030723eb6abced`.
- Corrected archive/signing integration already settled on main: `477de7c9d9a6a30e0545a5b17ba356ce884f6c92`.
- Preserved preflight report commit: `3350c9787b7ee22a0633225478e4ee9c9a35b42a` (also retains `b7486c34bd947fb6cb4ad902e5694cc1874ff1b6`).
- Verified combined candidate and first delivered main: `1f6153badc734f8e61cd7553807d11c0dc4f679f`. The release merge used `git merge --no-overwrite-ignore --no-edit 477de7c9d9a6a30e0545a5b17ba356ce884f6c92` in the assigned checkout. Its code, Prisma schema, assets and dependency files exactly match the settled corrected integration; only this Task's report was added.
- Before delivery, `git -C <bound-root> fetch origin main` observed origin/main at `07e82431ddaad1d28f79b0c54c46e346ebfa373a`. An ancestry check returned 0; there was no concurrent remote update to reconcile.
- `git -C <bound-root> merge --no-overwrite-ignore --no-edit 1f6153badc734f8e61cd7553807d11c0dc4f679f` fast-forwarded main from the settled integration without conflict.
- `git -C <bound-root> push origin main:main` succeeded normally, advancing remote main from `07e82431ddaad1d28f79b0c54c46e346ebfa373a` to `1f6153badc734f8e61cd7553807d11c0dc4f679f`.
- A separate `git -C <bound-root> ls-remote origin refs/heads/main` independently returned `1f6153badc734f8e61cd7553807d11c0dc4f679f`. Exact settled-source and verified-candidate containment in root main both returned 0.

The final report-only fast-forward/push is confirmed separately in the Task's delivery check. Its full final main SHA, independent remote SHA and source-containment results are retained in [the delivery receipt](../../tests/lease-signing/node_modules/release-delivery.json), outside Git to avoid a self-referential commit hash. No force operation, branch switch, reset, stash, clean, Preview publication, production database change or live tenant message was used.

## Source containment and conflict resolution

Every source below exists locally and `git merge-base --is-ancestor <source> <verified-candidate>` returned 0. The same sources are required in the final main and remote confirmation. Already-contained results were not merged again.

| Source | Exact commit |
| --- | --- |
| Corrected archive/signing/main integration | `477de7c9d9a6a30e0545a5b17ba356ce884f6c92` |
| Lease PDF archival | `87fe1039e530f2f013d128db8648e1cbef3caaad` |
| Review, independent signing and completed Documents | `11072a2847ba00ada6c2695460d5bd5b2913f518` |
| Reminder flow and deterministic signing proof reads | `2bf936a4888edc4d5478734a09eb16ae0a262495` |
| Durable reminder delivery/configuration | `b35c4e2cc545f35e2aa0a2d84e70fc93c8f0730f` |
| Maintenance editor redesign | `877197ba57e078a658e484097da8957ae21df5e5` |
| Maintenance browser-history draft protection | `eb2abf16100bc285be3bc65b0f6bcc2038cffae9` |
| Compact lease summary | `9742d6355ab9d03f11517781dd219f699ac84fdf` |
| Truthful terminal lease status | `bf33105bd87e000eabc7fc691603573df3467fc5` |
| Property/edit/ROI actions | `791eea50ebcf4aad748c5dcd7e0497b13c97f2c8` |
| Custom report dates across unit changes | `f17324fc25d0f9ba196841925c8ff350a0f11c03` |

The lease owner resolved the earlier `package.json`/`package-lock.json` conflicts by retaining the union of PDF and reminder dependencies. The corrected commit preserves the signing UI, immutable archive behavior, reminder schema/migration and deterministic proof ordering; see [the archive integration repair](../leases/archive-integration-repair.md). The release merge itself had no conflicts and required no application-source changes. The earlier prerequisite block was honored until both lease Tasks were reported closed; their checkout and untracked PDF evidence remained undisturbed.

## Combined-tree verification

All new release checks used the combined candidate above. Documentation-only follow-up changes do not invalidate those code checks.

| Check | Observed result |
| --- | --- |
| Dependency install and Prisma generation | `npm.cmd ci --no-audit --no-fund` passed against the combined lockfile; Prisma Client 6.19.3 generated. Embedded PostgreSQL dependencies installed in this checkout. |
| Database safety and migrations | A new UTF8 cluster was initialized at `tests/lease-signing/node_modules/postgres`, localhost port 55491. A Node `pg` query verified `SHOW data_directory` matches that exact assigned-checkout path before writes. All 24 migrations deployed successfully. Prisma `validate` passed and `migrate status` reported up to date. |
| Full automated suite with database integration | `npm.cmd test -- --no-file-parallelism` with `RUN_DB_INTEGRATION=1`, explicit local `DATABASE_URL`, `ESIGN_TEST_DB_DIR` identifying the verified cluster and task-local storage: **194 files passed, 5 skipped; 1,298 tests passed, 25 skipped**, 150.54 seconds. Includes real signing/archive, reminder and provider database suites. |
| Maintenance PostgreSQL regression | `node --import ./prisma/os-userinfo.mjs --import tsx tests/maintenance/editor.integration.ts`: **11 checks passed**, including scope/role isolation, validation, real rollback, persistence, deduplication, stale conflict, completion and reopening. Used its synthetic fixture in the same isolated database. |
| Typecheck | `npm.cmd run typecheck`: passed. |
| Production build | `npm.cmd run build`: passed, including Prisma generation, Next compilation, lint/type validation and route/static generation. |
| Report whitespace | `git diff --check` on this Task's report: passed. Existing whitespace in already committed migrations/font licenses was preserved, including migration checksums. |
| Production browser smoke | Configured Orchestra Playwright against `http://localhost:3331`, production build, isolated database and `ROCKETRENTAL_SANDBOX=true`: affected desktop and 390px checks below passed. No checked page exceeded viewport width. |

Logs and database audit remain local under `tests/lease-signing/node_modules/`: `release-full-suite.log`, `release-build.log`, `audit.json`. Database files, storage and dependencies remain on disk. The release app and its PostgreSQL server were stopped after checks. A `psql.exe` probe was unavailable in the embedded package; the installed Node driver supplied the successful data-directory safety check. The initial stdin stop attempt found a closed session; `pg_ctl` stopped the exact verified cluster instead.

## Desktop and 390px browser evidence

All screenshots below are local to the retained release checkout's `.playwright-mcp/`, excluded from Git. The production UI matches the unchanged source-owner implementations and their existing reports/design context. Representative mobile Documents, maintenance, reminder-history and desktop ROI captures were visually inspected as well as checking semantic state and page widths.

| Flow | What was observed | Retained evidence filenames |
| --- | --- | --- |
| Review and independent signing | Full terms and separate pet addendum; manager observer has no signature form. Owner first, then two independently authenticated tenants signed. Reload retained signatures; final state was `All signed · Documents ready`. Database audit found three consented signatures, `ARCHIVED`, exactly one final lease PDF and one separate addendum. | `release-signing-review-desktop.png`, `release-signing-manager-390.png`, `release-owner-signed-390.png`, `release-signing-completed-desktop.png`, `release-signing-completed-390.png` |
| Documents and download | Tenant and manager pages list the final lease and addendum separately at 1280 and 390. Both preview and download endpoints returned 200, `application/pdf` and `%PDF-` bytes for both files. Repeated reads/reload retained one final PDF. | `release-tenant-documents-1280.png`, `release-tenant-documents-390.png`, `release-manager-documents-1280.png`, `release-manager-documents-390.png` |
| Reminders | Ended lease's September arrears stayed separate from the empty October monthly summary: $800 remaining rent plus $50 assessed fees. Scoped lease/recipient preselected, edited exact subject/body reviewed at both widths. One intentional sandbox attempt was recorded; reload and expanded history retained that exact content, recipient, channel and `Sandbox · not delivered` status. | `release-reminder-overview-1280.png`, `release-reminder-overview-390.png`, `release-reminder-review-1280.png`, `release-reminder-review-390.png`, `release-reminder-history-1280.png`, `release-reminder-history-390.png` |
| Property/edit/ROI | One populated Edit property action; changing City then cancelling retained Austin at both widths. Edit unit retained active-lease status locking. Custom January–June 2026 report scope survived all-units/unit switching and opening Actual vs projected then browser Back. Scoped returns, whole-property comparison and compact lease overview remained available without overflow. | `release-property-edit-1280.png`, `release-property-edit-390.png`, `release-unit-edit-1280.png`, `release-unit-edit-390.png`, `release-scoped-returns-1280.png`, `release-scoped-returns-390.png`, `release-roi-analysis-1280.png`, `release-roi-analysis-390.png` |
| Maintenance | Dirty browser Back retained the URL/draft and showed the discard dialog at both widths; Cancel retained the draft. Title, priority and vendor saved together. Reload showed the saved title, High priority, QA Repairs and the expected New-to-Assigned promotion and persisted activity. | `release-maintenance-dirty-back-1280.png`, `release-maintenance-dirty-back-390.png`, `release-maintenance-saved-1280.png`, `release-maintenance-saved-390.png` |

A few smoke-script assumptions were corrected from actual snapshots: Send stays on the successful review/signing panel rather than redirecting; final PDF links use the actual file name; recorded reminder content is inside a disclosure; broad dialog selectors also matched an unopened dialog. Tight navigation loops also timed out while browser Back/client navigation settled; separate observed steps confirmed correct scope and dates. These harness attempts were not counted as product failures or passed checks until the actual state was inspected and the intended flow completed. No release-source repair was needed.

The prior complete renewal/PDF rendering evidence is reused because those implementations are unchanged: [signing UI](../leases/signing-ui.md), [archival verification](../leases/signed-archive-verification.md), [maintenance](../maintenance/editor-redesign.md), [lease summary](../workspace/lease-summary.md), [property actions](../workspace/overview-actions-verification.md), and [reminder checks](../notifications/reminder-flow-checks.md). Their retained images and PDFs were not copied or regenerated.

## Preserved work and limitations

- Bound main's unrelated `prisma/package-lock.json` edit (6 insertions, 1 deletion) and untracked `start-rocketrental.ps1` were preserved through integration. Rechecked SHA-256 values remained `E0374A667501AEEEA1BF8A013BD8866362EED83659133BF0F48A7D523AF840E0` and `EAC3F9D3F765EDE3A7FAA32DE7FB2E755C1835FA1127EA46D7C03FCC34B9251F`, respectively. Neither was staged or committed by this Task.
- Root ignored environment, runtime, cache, dependency and database files were preserved. No other Task checkout was opened or edited. The assigned checkout's only authored committed change is this release report; shared submitted source commits remain intact.
- The earlier optional broad 121-test Playwright run remains historical: 48 passed, 58 failed, 3 skipped, 12 not run, with unrelated fixture/selector/launcher failures documented by the reminder Task. It was not repeated or claimed green. Required full automated/database checks and the affected release smoke checks passed.
- Existing Next workspace-root, Prisma configuration and Vite loader notices remain. Test-gated skips are reported in the counts above.
- Deployment still requires migrations, durable file storage and an authenticated scheduled archive-retry job; live reminder delivery requires private SMTP/Twilio configuration. This Task tested local sandbox behavior only. No production data, live notification or Preview operation was requested or performed.

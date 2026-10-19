# Rent Analysis workspace

Direct manager entry: `/rent-analysis`. Local verification entry:
`http://127.0.0.1:3148/rent-analysis` (correction runtime; manager sign-in required).

## Navigation and integration

- No query: explicit property search/selection over authorized active properties.
- `?property=<id>`: saved unit estimates and separate current lease/listed/market rents. No property-wide blended comps.
- `?property=<id>&unit=<id>`: scoped comparison workbench. An implicit unit of a `SINGLE_UNIT` property opens directly without a unit picker.
- Unknown, archived, foreign and mismatched identities show selection recovery, never a fallback property/unit. The page catches data-loading failures through its route error boundary; retry retains the URL.
- Unit picker and filters preserve property/unit/filter query context. Overview unit-row links carry only explicit, validated filter choices, including empty size bounds. Absent or invalid choices fall back to the destination subject's defaults. Changing property starts fresh. Exclusions remain local to the workbench and reset after refresh/filter changes.
- Open in Listing uses the allowlisted navigation builder and the same validated filters. Lease links carry both property and unit and open the existing create-lease flow; this page does not change leases.

Sidebar wiring remains a subsequent coordinated integration in the shared shell owner’s scope. Add a manager navigation entry named **Rent Analysis** targeting `/rent-analysis`; do not preselect a property. This candidate does not implement ROI Analysis or claim the whole two-feature request complete. No shared selector or shell files were changed.

## Reuse and data boundaries

Design: `Designs/rocketrental-analysis` revision 36, selection, rent comparison and phone screens; `Diagrams/rocketrental-mindmap` revision 4, rental comps branch. Uses the existing compact manager shell and real session-scoped property/unit data, not design sample facts.

The checkout contains verification candidate `280d28ff80efb650dde3489bd5d03743436e2f80`, navigation candidate `23b55f33a8b27196c66604968d5e1faf81a20384` and selection service commit `df96477` in its ancestry. Initial HEAD was `7752972eb9e459ad356e8b9a0b8c8cc49708ad60`.

`src/lib/analysis/rent.ts` consumes the public `PropertySelectionResult` DTO as a type and implements its existing active-property/organization/nonarchived-unit query contract for this route. Importing the full analysis service at runtime exposed the existing ROI engine’s `.js` import resolution failure in Webpack. Keeping the DTO import type-only avoids loading the ROI numerical engine into Rent Analysis; its owning files remain untouched. A shared runtime selection-only service can replace this adapter when integrated. No rent-estimate formula is duplicated.

`RentCompsPanel`, `FilterBar`, `CompsWorkbench`, existing provider/cache service and `suggestRent`/`summarize` remain the comparison pipeline. Current rent is from exactly one ACTIVE lease whose start/end contain the current UTC date; it is distinct from listed rent and saved market rent. Missing values are labeled. Saved-estimate gaps compare with current lease when present, otherwise listed rent; absent baselines produce no invented gap.

This build has sandbox comps adapters only. Both provider brands are explicitly labeled demo, not live data. Timestamps include date, time and UTC, with actual cache state. Provider failure keeps filters and a retry refresh control; empty results provide same-subject reset. Safe apply uses the existing manager action/service, with an additional active-property pricing-unit check before apply. Only market rent/audit fields are requested; listed rents and leases are untouched.

## Isolated verification identities

Locked `npm ci` dependencies, Prisma Client 6.19.3 and all 19 current migrations were used. Task database: PostgreSQL 16.14, database `rocketrental`, local port **55436**, data directory `.orchestra/task-102d7024-db`. SQL `current_database()`, `inet_server_port()` and `current_setting('data_directory')` confirmed this identity. The deterministic demo seed produced 8 properties, 69 units and 410 leases. No shared `.env`, user database or other runtime was changed.

Runtime: loopback **3146**, generated output `.next/verification-102d7024`. The isolated runtime/database are retained running for review; final `/sign-in` health check returned HTTP 200. Stop only these task-owned processes when review is finished; retain their database files.
Production output: `.next/build-102d7024`. Both helpers preload Next’s phase configuration; build workers receive its serialized configuration so they use the same isolated output. They use `tests/rent-analysis/tsconfig.verification.json` rather than allowing Next to edit the shared TypeScript configuration. Initial recipe attempts wrote default output and generated TypeScript includes; those task-generated root TypeScript edits were restored, and final runs use the isolated identities above.

Reproduce in PowerShell from this checkout (choose these ports only while available):

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd ci --prefix prisma --ignore-scripts --no-audit --no-fund
$env:ROCKETRENTAL_DB_PORT='55436'
$env:ROCKETRENTAL_DB_DIR=Join-Path (Get-Location) '.orchestra/task-102d7024-db'
node --import ./prisma/os-userinfo.mjs prisma/local-postgres.mjs
```

In a separate task-owned process, set `DATABASE_URL` to the local database above. Use `prisma migrate deploy` and `node --import ./prisma/os-userinfo.mjs --import tsx scripts/demo-seed/index.ts` **only for a newly allocated isolated database**; the seed resets its target. Windows restricted-token initialization required an elevated database process in this environment. Locked dependency installation required elevated registry access. The direct tsx import avoids its CLI child process losing the existing OS user-info shim.

Set a task-only `ROCKETRENTAL_AUTH_SECRET`, `ROCKETRENTAL_SANDBOX=true` and `ROCKETRENTAL_AUTH_COOKIE_SECURE=false` in the runtime process, then:

```powershell
node --import ./prisma/os-userinfo.mjs --import tsx tests/rent-analysis/verification-runtime.mjs
```

## Completed self-checks

- `npm test -- tests/rent-analysis tests/comps tests/rent-comps`: **44 tests / 9 files passed**. Covers explicit selection, unavailable/foreign/archived identity handling, mismatched unit, separate lease/listed rents, single-family resolution, existing navigation/filter/calculation/action regressions and market-only writes.
- `npm run typecheck`: passed.
- Scoped ESLint over the changed route, rent adapter, comps components/actions and tests: passed.
- `node --import ./prisma/os-userinfo.mjs --import tsx tests/rent-analysis/verification-build.mjs`: production build passed, including `/rent-analysis`.
- `verification-scope.ts`: actual database authorized selection, foreign organization and mismatched unit rejection; archived-property probe rejected then transaction rolled back.
- `verification-database.mjs baseline` before native apply and `verify` after: only `demo-unit-maple-7` market rent changed to **$1,725**, plus actor/time and Prisma `updatedAt`. Listed rent stayed **$1,835**, current lease **$1,855**; all **410 complete lease rows** and **68 other complete unit rows** remained identical. Baseline stays local at `.orchestra/task-102d7024-before.json`.

## Native Edge observations

Windows MCP acquired the desktop and used a new tab in the human’s existing Edge window. Phone evidence uses Edge responsive emulation at **390 × 844 CSS pixels**. Screenshots below are under `tests/rent-analysis/evidence/` and were captured through Windows MCP with the task-owned capture helper.

| Flow | Observed result | Screenshot |
| --- | --- | --- |
| Direct entry and property search | No auto-selection; searching Maple returned only Maple Court | `native-selection-desktop.png` (initial selection) |
| Multi-unit overview | 12 units with separate saved/current/listed values; Unit 3A opened its scoped workbench | `native-units-desktop.png` |
| Open in Listing | Same unit and explicit filter query retained in existing property Listing | `native-open-listing.png` |
| Keyboard filter, refresh, exclusion, apply | Home/Enter radius 1 mile + Update changed 6 comps to 3; Refresh retained filters; keyboard apply saved 1725; excluding first comp left 2 and changed suggestion 1870 to 1945 | `native-apply-exclusion.png` plus SQL comparison |
| Phone subject and filters | Property context, unit picker, demo timestamp and two-column filters fit 390px | `native-subject-390.png`, `native-filters-390.png` |
| Phone empty/reset | Min sqft 9999 + Enter gave zero comps, no apply and same-subject Reset; reset returned 6 comps and default filters | `native-empty-390.png` |
| Phone summary/table | Separate lease/listed/market values, suggested gap, audit and renewal link readable; table remains horizontally scrollable | `native-summary-390.png`, `native-table-390.png` |
| Single-family direct property | Elm home workbench opens without a unit picker | `native-home-390.png` |
| Mismatched property/unit | Maple + Elm unit yields selection recovery, no fallback workbench | `native-rejected-scope-390.png` |

The task tab and DevTools were closed and desktop ownership released. Existing user tabs were preserved. No upstream push or Preview publication was performed. Sandbox data is not a live-market verification; provider outage recovery is implemented but a live external provider was not configured or claimed.

## Recovery correction — 2026-10-19

**Preserve filters across unit links and recover failed market-rent applications** starts from candidate `95af5cd5e001b2629ecc371fa603f7eaacddc286`, verified as an ancestor of this checkout's initial `8eb95af5bff33f02302e98458baccd08ee0cb41b`. The initial implementation evidence above is historical; this correction used the separate runtime and database below. Design revision 36's rent and phone layouts remain in place.

Overview links now use the existing query builder with explicit filters validated through `parseFilters`. They preserve the same authorized property and selected unit. Invalid identity rejection, change-property selection and same-subject reset are unchanged. The new helper does not freeze the previous unit's implicit defaults into the next link.

The apply field holds an exact string draft, including spaces, currency signs, commas and decimal places. React's [form action behavior](https://react.dev/reference/react-dom/components/form) resets uncontrolled fields when the action resolves, including an action returning a validation result. A controlled field prevents that reset and also keeps user edits when exclusions change the suggestion. Pending submissions announce their status, make the amount read-only and disable the submit button. Errors use an associated alert, validation marks the field invalid, and focus returns for correction. Editing clears stale validation feedback; uncertainty stays visible until another result arrives.

Lookup failures return a confirmed rejection before a write is attempted. A thrown write or lost response returns an **unknown** outcome: the UI says the update may have been saved and explains that retrying sets the amount again. It never claims that an uncertain write left rent unchanged. Successful writes remain successful even if subsequent view revalidation fails; the confirmation explains the refresh limitation and displays the acknowledged amount. Authentication/authorization redirects still propagate through Next, including the client recovery wrapper. The existing organization-scoped market-rent service remains the sole write path.

### Automated evidence

- Before the fix: **8 failed / 15 passed** across the three targeted regression files. Failures reproduced missing row-link filters, exact draft replacement, exclusion-driven draft replacement, thrown lookup/write/cache errors and lost-response page replacement. [Original regression output](../../tests/rent-analysis/evidence/recovery-before.txt).
- After the fix: **57 passed / 9 files** with `npm.cmd test -- tests/rent-analysis tests/comps tests/rent-comps --reporter=verbose`. Includes pending/focus/correction interactions, client and server redirects, lookup rejection, write uncertainty, revalidation-after-save and existing Listing/legacy/navigation/calculation/persistence contracts. [Passing output](../../tests/rent-analysis/evidence/recovery-after.txt).
- `npm.cmd run typecheck`: passed. [Typecheck output](../../tests/rent-analysis/evidence/recovery-typecheck.txt).
- Scoped ESLint over the changed route, workbench, action/state, navigation, tests and verification helpers with `--max-warnings=0`: passed.
- `RENT_VERIFICATION_ID=c0e3b203 node --import ./prisma/os-userinfo.mjs --import tsx tests/rent-analysis/verification-build.mjs`: passed, including compilation, lint/type validation and static generation. [Build output](../../tests/rent-analysis/evidence/recovery-build.txt). Next's existing multiple-lockfile workspace-root warning remains; it did not fail the build. Output is `.next/build-c0e3b203`; only the task-owned verification TypeScript config acquired generated includes.

### Isolated persistence and runtime

This checkout had no inherited dependencies or database files. Locked installs and Prisma Client 6.19.3 were prepared here. A new PostgreSQL 16.14 cluster at `.orchestra/task-c0e3b203-db`, port **55438**, database `rocketrental`, received all 19 migrations and the deterministic seed: 69 units and 410 leases. SQL `current_database()`, `inet_server_port()` and `current_setting('data_directory')` confirmed the identity. No other runtime or database was modified.

The development runtime uses **127.0.0.1:3148**, `.next/verification-c0e3b203`, `tests/rent-analysis/tsconfig.verification.json`, sandbox comps and local HTTP authentication. Launch with `RENT_VERIFICATION_ID=c0e3b203`, `RENT_VERIFICATION_DATABASE_PORT=55438`, `PORT=3148`, and the isolated `DATABASE_URL` before running the existing `verification-runtime.mjs` helper. The runtime/database are retained for review; their outputs do not replace shared build output. No shared `.env` was edited.

`node tests/rent-analysis/recovery-database.mjs baseline` saved a local comparison at `.orchestra/task-c0e3b203-before.json`. `unchanged` after native invalid submission and after the injected write exception proved **all 69 complete unit rows and all 410 complete lease rows identical**. `fault-on` installed a temporary trigger that rejects market-rent writes for `demo-unit-maple-7` only; `fault-off` removed both trigger and function before retry. The action conservatively treated the thrown write as uncertain even though the probe's database comparison established rollback.

After correction, `applied` proved only `demo-unit-maple-7.marketRent` (**1920 → 1725.50**), its actor/name/time audit fields and automatic `updatedAt` changed. Listed rent stayed **1835**, current lease **1855**; all 410 complete lease rows and 68 other complete unit rows stayed identical. Database data remains local, outside submitted artifacts.

### Native Edge coverage

Windows MCP used a new task tab in the human's existing Edge window (window handle 526058), a 2560×1600 desktop, and Edge responsive emulation at **390×844 CSS pixels**. Native input/scroll/keyboard interactions exercised the real application; screenshots were saved by the Windows MCP capture helper.

| Flow | Observed result | Evidence |
| --- | --- | --- |
| Desktop overview navigation + reload | Unit 3B → overview Unit 3A preserved radius 3, beds 2, baths any, empty min/max size, days 90, status all; Ctrl+R kept them | [Desktop filtered row](../../tests/rent-analysis/evidence/recovery-filtered-row-desktop.png) |
| Desktop validation | Malformed `2190 $0.00 ` retained after Enter, inline error and focused field; database unchanged | [Desktop validation](../../tests/rent-analysis/evidence/recovery-validation-desktop.png) |
| Desktop thrown write | Typed ` $1,725.50 ` retained, including both spaces (verified by native select/copy); inline uncertain-outcome message; form/URL remained usable | [Desktop write failure](../../tests/rent-analysis/evidence/recovery-write-error-desktop.png) |
| Phone recovery | Unknown-outcome message and retained amount fit 390px; subsequent ` $0.00 ` validation retained the draft and focus | [Phone write failure](../../tests/rent-analysis/evidence/recovery-write-error-390.png), [phone validation](../../tests/rent-analysis/evidence/recovery-validation-390.png) |
| Phone correction | Enter with ` $1,725.50 ` succeeded after the trigger was removed; confirmation, market value and actor appeared; exact draft remained | [Phone correction](../../tests/rent-analysis/evidence/recovery-corrected-390.png) |
| Phone overview navigation + reload | Unit 3A → overview Unit 3B kept all explicit filters through Ctrl+R | [Phone filtered row](../../tests/rent-analysis/evidence/recovery-filtered-row-390.png) |
| Intentional resets | Min sqft 9999 produced no comps; Reset filters cleared the filter query but retained Maple/3B and restored size defaults 774–1047. Change property returned bare `/rent-analysis` and property selection | [Phone reset](../../tests/rent-analysis/evidence/recovery-reset-390.png) |

The task tab and DevTools were closed; desktop ownership was released. Existing user tabs and other runtimes were preserved. Native evidence covers validation and a real database-write exception. Lookup failures, post-commit acknowledgement loss and transport errors are simulated in focused regressions; a real network outage or live external comps provider is not claimed. Drafts are local to the current workbench and intentionally reset when changing subject/filter context or reloading; URL filters survive reload. Sidebar/shared-shell integration and ROI remain outside this correction. This is a local Git candidate, with no merge, push or Preview publication claimed.

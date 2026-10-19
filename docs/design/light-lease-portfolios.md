# Light lease portfolios

Implemented **Implement light global and scoped lease portfolios** from Designs/rocketrental-light-leasing revision 46 (leases and leases-phone), using Designs/rocketrental-light-system revision 7 and the existing shared shell.

## Main merge recovery

Current merge candidate: `cbc314d460a7ae2b23e0ae2ea30e9559aa20e7af`, with parents `8261cb928a5ad26e40cd40de66470761a93f440b` (previous portfolio candidate) and `a7cfc0fd93e31caa7f6ede67179282d3a6ea5bbd` (observed project main). The final submission adds this recovery record only; its exact commit is in the typed receipt. Main was observed in the project root before merging into this same assigned work branch. Root's unrelated dirty `prisma/package-lock.json` and untracked `start-rocketrental.ps1` were left untouched.

The actual merge had one **add/add conflict**, `tests/leases/review-runtime.ps1`: main supplied the lease-detail runtime, while this branch supplied the portfolio runtime. Resolution retains main's script at its original path, byte-for-byte (Git blob `82b4fcef6d3112b74f4df5c90840384faa49c438`), and moves the unchanged portfolio script to `tests/leases/portfolio-review-runtime.ps1` (blob `1390c65d46e331d04475ced885c98dafce9974ea`). Portfolio fixture/browser callers and this handoff now use the distinct portfolio filename. Main's lease-detail documentation keeps its original valid command. Isolated portfolio ports 3294/3295/55494, database-directory checks and all other runtime guards are preserved.

Application files merged automatically. Integrated lease-detail, property, payment, repair and other main changes are preserved; this portfolio's UI files are unchanged by the resolution. Both recorded parents and the reviewed foundation are ancestors of the merge. There was no reset, rebase, force update, target-main modification or publication.

Affected checks rerun: two portfolio/scope test files, **5 tests passed**; runtime guard checks, **2 passed**; scoped ESLint for the two changed browser/fixture callers, TypeScript, and PowerShell syntax parsing for both runtime scripts passed. The copied scripts' blob identities and main ancestry were checked. Merge-wide whitespace checking reported pre-existing whitespace in main's runtime/gitignore files; these integrated files were preserved exactly. The recovery's own changes pass `git diff --check`.

Earlier successful build, visual/source tests, isolated runtime lifecycle and desktop/390px browser evidence below are reused as **historical evidence**. The merged application has not been rebuilt or served by this recovery, and those observations must not be labelled as checks of the merged candidate. The historical runtime state names corrective candidate `780059d525acab583ec30c66f8aff652802b64ec` and build `_TUIjhJh6UFUaLiG3asAz`; after main changed application source, the guard intentionally refuses to treat that state as current. No runtime, fixture, migration, seed or service shutdown was performed during merge recovery. A future merged-candidate runtime review requires its own verified build/start rather than bypassing that guard. Native Edge remains explicitly pending and manager-coordinated, with no current desktop grant.

## Historical candidate and runtime (before main merge)

- Assigned checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@49gllk33jr96qti32eb/repository`.
- Branch: `orchestra/work-2gcjdifqik3o7helc0b-5c5rykprj8c898gscx5`.
- Original visual implementation: `2b12a2c4de83b9b741e71026b59c84cb077865aa`; reviewed foundation `37314def68c96b2cf550b0f18a90ad9c42425d75` remains an ancestor.
- Runtime isolation corrective candidate: `780059d525acab583ec30c66f8aff652802b64ec`. The final submission adds this handoff update only; its containing commit is in the typed completion receipt.
- Candidate production build: `_TUIjhJh6UFUaLiG3asAz`, reused unchanged. No application source changed in the corrective work; runtime status verifies `git diff --quiet <runtime-candidate> -- src public` and candidate ancestry before reuse.
- Historical hidden production review server: [local sign-in](http://127.0.0.1:3294/sign-in), reserved app port **3294**. Hidden baseline: port **3295**, exact foundation copy under `.playwright-mcp/baseline`, build `CKXocpRczfPg4v2Pj1PK2`.
- Preserved isolated PostgreSQL: **55494**, database rocketrental, original preserved `.playwright-mcp/lease-postgres` data directory. All three reserved ports were verified free before startup. The old postmaster PID had no live owner; the existing cluster recovered normally on the new port. No initialization, reseed or migration occurred during corrective work.
- Prior runtime addresses are retired for this Task. Do not use historical port references in old reports to operate services. The payment Task's services were not stopped, reseeded, migrated or modified, and no unknown listener was killed.
- Runtime readiness below was observed before the main merge. It is not a current merged-candidate readiness claim; see Main merge recovery. Process IDs must always be verified rather than reused from history.
- Review uses the standard seeded manager account defined in `prisma/seed.ts`. No credentials or auth cookies are included here. No target-main integration, push, Preview publication or deployment was performed.

### Hidden start/status/stop

From this assigned checkout, in PowerShell with permission to inspect Windows processes and listeners:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/portfolio-review-runtime.ps1 -Action start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/portfolio-review-runtime.ps1 -Action status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/portfolio-review-runtime.ps1 -Action stop
```

Start reuses only a fully verified running instance or starts hidden processes on the reserved ports. The existing fixture directory and production builds must already exist. It never initializes, seeds or migrates a database. If a reserved port has an unverified owner it refuses; do not substitute a port or kill that owner. Runtime state is kept in `.playwright-mcp/lease-runtime.json`.

Status checks this exact checkout, candidate ancestry, unchanged application source, on-disk build IDs, server command lines/PIDs and listener ownership, plus each server's `/__lease_review_identity` response. PostgreSQL must report the exact preserved directory through `SHOW data_directory`, report port 55494, and match the directory's postmaster PID and listener. Stop validates all identities before stopping either owned app PID and then uses `pg_ctl` against only that verified directory; it never kills by port.

The database fixture helper performs both database and full runtime verification before any upsert. Its strict target parser rejects the retired database port and lookalike ports before SQL; a reserved-port database reporting a different directory also fails. Browser checks run the same runtime status preflight, honor `PLAYWRIGHT_BASE_URL` and `LEASE_BASELINE_URL`, and reject origins that do not match the verified service ports.

### Historical runtime-isolation corrective verification

- Scoped lint of the changed browser/fixture files and new identity/server/guard files passed with `--max-warnings=0`; repository TypeScript check passed. `node --test tests/leases/review-runtime.test.mjs`: **2 passed**, including retired/lookalike port rejection before queries and wrong-directory rejection.
- Hidden `start`, `status`, verified `stop`, restarted `start`, and subsequent browser status preflight all passed. One initial startup-controller wait on PostgreSQL descendants was repaired to wait only for the launcher process; only that identified task-owned controller was ended. Its verified PostgreSQL process/data were preserved.
- Production portfolio command, against the committed corrective runtime candidate:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3294'
$env:LEASE_BASELINE_URL = 'http://127.0.0.1:3295'
$env:LEASE_CAPTURE_PREFIX = 'relocated-'
node node_modules/@playwright/test/cli.js test tests/leases/portfolio-flows.spec.ts --project=leases --workers=1
```

The final run passed all four checks in 21.0s: production flows at 1440x1000 and 390x844, and exact-foundation baseline capture checks at both viewports. Filters, search/reset, page 2, global/scoped View, renewal, draft resume, vacant-unit setup, empty views, keyboard focus/navigation and no page overflow all passed. Original visual captures below remain valid; the corrective run also saved `.playwright-mcp/relocated-*.png` captures without replacing them. Existing successful visual-source tests and production build were reused because application source is unchanged. Native Edge remains pending and manager-coordinated; no desktop acquisition was performed.

## Changes

Global lists retain live source counts, active/expiring/draft/ended predicates, case-insensitive tenant/property search, query-aware reset and 20-row pagination. The three summary metrics use the approved shared document/people icons and semantic theme variables. Desktop retains compact semantic table markup; at 700px and below the same rows become labelled cards, with identity, signature state, property/unit, monthly rent, term and reachable actions. The source data is rendered once, preserving links and lease identity.

Property/unit lists retain Current, Drafts and Past sections and past pagination. Slice-local rules apply compact headings, count chips, dashed empty-section treatments and wrapping phone actions. Their surrounding workspace shell, header and navigation remain inherited.

Detail links retain `propertyId`/`unitId`. Setup, renewal and draft entry links retain those query coordinates and additionally supply the existing wizard's `property`/`unit` parameters. No wizard, detail, template editor, domain action or schema was changed. Wizard-owned redirects may normalize their URL after entry; this change preserves list entry context and verifies the existing wizard opens.

No illustrative design data, preview selectors, design footer, disabled prototype actions or sample counts were added to product UI. The property route wrapper required no change.

## Original visual implementation verification (reused)

| Check                     | Observed result                                                                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Affected tests            | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/leases tests/workspace/leasing`: 6 files, 19 tests passed. Includes added source-list pagination/search/filter and scoped link assertions.                                                                                       |
| Scoped lint               | `node node_modules/eslint/bin/eslint.js` with the two assigned route TSX paths, LeasesPanel and the three added verification files, `--max-warnings=0`: exit 0.                                                                                                                                           |
| Typecheck                 | `node node_modules/typescript/bin/tsc --noEmit`: exit 0. The repository has one shared TypeScript program; no separate slice project exists.                                                                                                                                                              |
| Production build          | `npm.cmd run build`: exit 0; Prisma generated, Next compiled/linted/typechecked, 22 static pages generated, traces completed.                                                                                                                                                                             |
| Production browser checks | Original visual run: four checks passed in 14.0s in isolated Chromium. Current parameterized command and relocated results are recorded above; the original run is historical evidence.                                                                                                                   |
| Isolated database         | `prisma migrate deploy`: all 19 migrations applied. `node --import ./prisma/os-userinfo.mjs --import tsx prisma/seed.ts`: 4 properties, 45 units, 41 active occupied leases seeded. `node tests/leases/portfolio-fixtures.mjs`: idempotently added one draft and 22 past rows solely in this isolated DB. |
| Patch hygiene             | `git diff --check`: exit 0. Unrelated paths unchanged; an installation-only lockfile change was restored to its exact prior content.                                                                                                                                                                      |

Configured Playwright MCP initially navigated/sign-in successfully and observed global desktop/phone results, then returned `MCP_SESSION_NOT_FOUND`. The expressly permitted repository runner fallback completed the final evidence. Earlier runner failures were test-selector/capture-readiness issues: labelled generic containers were queried as regions, and screenshots could catch streamed loading skeletons. Selectors were corrected and captures now wait for visible lease rows and loaded fonts; all final checks passed. Prisma engine download and isolated PostgreSQL/browser process startup needed approved execution outside sandbox token/cache restrictions. Existing Prisma deprecation, Next workspace-root inference and Vite future-loader warnings remain non-failing.

## Production routes and states

Every flow below passed at both 1440x1000 and 390x844. Capture readiness and document scroll width were asserted; no introduced horizontal page overflow was observed. Existing tab strips may scroll internally.

| Route/state                                                        | Action and observed outcome                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/leases`                                                          | 41 active leases from the isolated source, first 20 rows; visible identity and actions.                                                                                                                                  |
| `/leases?tab=expiring`                                             | Filter link opens the one active lease ending within 60 days.                                                                                                                                                            |
| `/leases?tab=drafts`                                               | One draft; Continue setup opens the existing Create lease wizard.                                                                                                                                                        |
| `/leases?tab=ended`                                                | 22 past fixtures, first 20 rows.                                                                                                                                                                                         |
| `/leases?q=Alex+Rivera`                                            | Search returns one active row; Clear search restores 20 first-page rows.                                                                                                                                                 |
| `/leases?page=2`                                                   | Next changes URL and shows the next 20 active rows; source totals retained.                                                                                                                                              |
| `/leases?q=NoSuchLeaseReview`                                      | No leases match this view, clear-search next step visible.                                                                                                                                                               |
| `/leases?propertyId=seed-property-maple&unitId=seed-unit-maple-11` | Scoped View preserves both IDs and opens the exact lease; scoped Renew preserves IDs plus wizard scope and opens Create lease. View focus outline exists; Tab reaches Renew, Shift+Tab returns to View, Enter navigates. |
| `/properties/seed-property-maple/leases`                           | Current, Drafts and Past present; View opens a lease with property context.                                                                                                                                              |
| `/properties/seed-property-maple/leases?unit=seed-unit-maple-11`   | Same sections scoped to Unit 4B; draft resume link keeps property/unit IDs and opens Create lease.                                                                                                                       |
| Same unit route plus `&page=2`                                     | Past section shows remaining two of 22 rows.                                                                                                                                                                             |
| `/properties/seed-property-maple/leases?unit=seed-unit-maple-7`    | No leases yet; Set up lease opens Create lease with the vacant unit selected.                                                                                                                                            |
| `/leases?unitId=seed-unit-maple-7`                                 | No active leases yet with create action.                                                                                                                                                                                 |

Fixture details and reproducible checks live in `tests/leases/portfolio-fixtures.mjs`, `portfolio-flows.spec.ts` and `lease-portfolios.test.tsx`. The fixture guard now requires port 55494 and verifies the exact PostgreSQL data directory and full runtime identity before writes. The 22 historical rows are intentionally artificial pagination fixtures, not real portfolio history.

## Captures

All images are from fully loaded production routes in isolated runner Chromium. Before and after use identical seeded/added fixture data and viewport sizes.

| Surface          | Desktop before / after                                                                                                          | 390px before / after                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Global portfolio | [Before](../../.playwright-mcp/leases-1440-before.png) / [After](../../.playwright-mcp/leases-1440-after.png)                   | [Before](../../.playwright-mcp/leases-390-before.png) / [After](../../.playwright-mcp/leases-390-after.png)                   |
| Property leases  | [Before](../../.playwright-mcp/property-leases-1440-before.png) / [After](../../.playwright-mcp/property-leases-1440-after.png) | [Before](../../.playwright-mcp/property-leases-390-before.png) / [After](../../.playwright-mcp/property-leases-390-after.png) |
| Unit leases      | [Before](../../.playwright-mcp/unit-leases-1440-before.png) / [After](../../.playwright-mcp/unit-leases-1440-after.png)         | [Before](../../.playwright-mcp/unit-leases-390-before.png) / [After](../../.playwright-mcp/unit-leases-390-after.png)         |
| Search empty     | [Desktop](../../.playwright-mcp/leases-empty-1440.png)                                                                          | [Phone](../../.playwright-mcp/leases-empty-390.png)                                                                           |
| Page 2           | [Desktop](../../.playwright-mcp/leases-page2-1440.png)                                                                          | [Phone](../../.playwright-mcp/leases-page2-390.png)                                                                           |

## Coordinated native checklist (pending)

No native Edge observation or desktop acquisition was performed by this Task. Manager-coordinated existing-Edge review remains pending:

- Sign in at port 3294, inspect global portfolio desktop and 390px cards, tab-strip scrolling and page overflow.
- Tab/Shift+Tab through search, filter links, View/Renew and pagination; confirm visible blue focus and Enter navigation.
- Check search/reset/page 2, then property and unit route View, Renew, Continue setup and vacant-unit Set up lease.
- Confirm no stale loading frame, and compare the supplied before/after captures with the reviewed design hierarchy.

These are review instructions, not claimed native results. No desktop permission or human-window request is needed for the completed automated evidence.

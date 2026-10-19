# Property, unit and listing workspace review

Reviewed 18 October 2026; resumed 19 October 2026. **Implementation and design updates are committed; the isolated review app is ready, and native Edge acceptance is blocked by desktop access.** This report distinguishes source/test evidence, design renders, and the desktop checks that remain outstanding.

## Basis and scope

- Read the foundation's [full app review](full-app-review.md) before implementation. Its compact spacing, flat cards, navy palette, global focus treatment and established workspace tabs remain the baseline.
- Read Designs/rocketrental-app revision 288 screens `properties`, `property-detail`, `unit-detail`, `property-listing`, `sfh-listing`, and `rent-comps`. Updated only these screens plus CSS scoped beneath their `.portfolio` wrapper. Other writers' screens and styles were preserved.
- Read Diagrams/rocketrental-mindmap revision 4, including `f-props` and `f-comps`. These branches have no additional repository file attachments. The task attachment list was empty.
- Confirmed the declared foundation candidate is the checkout's starting HEAD and ancestor. The shared checkout acquired concurrent changes in other areas during this work; none were edited or included in this area's intended commit.
- No database migration, seed, rent update, property archive, unit deletion, upload, provider change or lease submission was performed. Tests for rejected submissions use mocked actions and isolated in-memory fixtures.

## Route and screen coverage

“Improved” below describes implemented source and inspected design work. It does **not** claim a passed native browser acceptance check.

| Route or view | Design screen | Disposition and rationale | Evidence / remaining check |
| --- | --- | --- | --- |
| `/properties`, grid | properties | Improved. Visible Search action; filters expose their selected state and a real focus target; long names/addresses wrap; existing photo retrieval and fallback illustrations remain. Add property retains the active search/filter/view. | Design render and source review. Native desktop/390px before/after pending. |
| `/properties?view=list` | properties, list state | Improved. Named keyboard-focusable table scroll region; existing fields, filters and links retained. Grid/List controls gain larger pointer targets. | Source review; native narrow scrolling/focus pending. |
| `/properties?add=1` | properties, add state | Improved. Existing native dialog and cancel/close behavior retained. Field errors now have stable IDs and are associated with the inputs, including property type and owner. | Mocked rejected submission and single-family explanation tests passed. Native dialog focus, Escape and phone layout pending. |
| `/properties/:id` | property-detail | Improved. Units show beds/baths/size alongside unit number; tenant names link to their profiles; Open links identify their unit; Add unit is reachable from the table header. Table has named keyboard scrolling. Next steps use simple rows. Actual property type labels the facts card. | Design render, source review, existing timeline tests. Native unit selection, table paging and linked tabs pending. |
| `/properties/:id?unit=:unitId` | unit-detail | Improved through scoped facts/media/timeline styles. Existing lease history, payment strip, inline facts, next steps, media and deletion restrictions remain. Focus outlines on timeline links stay visible inside their clipped track. | Design render, media/timeline tests; native occupied/vacant/archived and edit/cancel states pending. |
| Property add-unit form | property-detail, add state | Improved. A bounded single-column form aligns with the workspace; errors are associated with inputs. Existing validation, reset-after-success and server action remain. | Mocked rejected submission passed. Native empty/duplicate/success states pending; creation must use an isolated fixture. |
| Property/unit inline edit forms | property-detail / unit-detail | Already coherent in behavior: existing labeled inline fields, Save/Cancel, pending state, active-lease status restriction, archive/restore and delete confirmation are preserved. Scoped facts layout is tightened for narrow widths. | Source review only for live edit/cancel, confirmation and restricted states. Shared InlineFacts.tsx was outside the owned files and was not edited. |
| `/properties/:id/listing`, multiple active units | property-listing | Improved. Saved market rent is distinguished from a new comp suggestion; current lease vs listed rent is explicit; missing estimates say Not set; count identifies units with estimates; each See comps link names its unit. Empty state links back to the property. | Design render, existing listing-mode tests. Native table scrolling, empty data and See comps transition pending. |
| `/properties/:id/listing`, single active home | sfh-listing | Improved. One compact Rent comps subject card replaces repeated headings. Home terminology remains when filters send the implicit unit ID. Existing count-based listing-mode rules are preserved. | Design render and home terminology/continuation component test. Native property/filter/lease transition pending. |
| `/properties/:id/listing?unit=:unitId` | rent-comps | Improved. Subject, status, list price and selector are grouped; filters use shrinkable 6/3/2-column tracks; map and summary stack below 900px; nearest comps and legends wrap. Comparison table is contained in a named keyboard scroll region. Excluded rows retain readable contrast and their note updates when re-included. | Design render; inclusion, all-excluded, no-match, rejected-rent and continuation tests passed. Native desktop/phone filters, focus, map readability and provider failure pending. |
| `/rent-comps` | rent-comps, compatibility landing | Already coherent. Selects an authorized pricing unit, retains filter parameters, and redirects through the compatibility route into its property listing. No-unit recovery remains. | Source review and canonical routing tests; native cross-property selector pending. |
| `/properties/:id/units/:unitId` with overview/listing/returns tab | unit-detail / rent-comps, compatibility route | Already coherent. Redirects to the canonical property workspace, preserves unit and relevant query values; the destination checks property/organization membership. | Listing/filter and Returns/period redirect tests passed; native redirect and invalid-unit boundary pending. |
| Legacy property `?tab=` and documents destination | property-detail, compatibility helpers | Already coherent. Canonical routing helper retains unit context and filters; documents route remains an overview destination. No changes to another area's documents route. | Routing tests passed, including documents unit/notice retention. |

Scoped Applications, Leases, Payments, Returns, Maintenance and Documents contents remain with their respective areas. Existing tab destinations were checked by the shared scoped-tabs tests. The completed lease detail's Overview / Agreement / Documents / Payments / Activity tabs were not edited.

## Important interaction and state decisions

- Rent suggestions and market-gap calculations are unchanged. Applying rent still calls the existing action; adjacent copy clarifies that it updates the saved market estimate, not the lease or listed rent. Rejected rent now identifies the input and associates its message. The continuation says Create lease for a vacant/turnover unit and Use for renewal for an occupied unit, with the same existing wizard destination.
- Filters retain automatic select/radio submission and the explicit Update comps button. Radio-chip focus is drawn on the visible label. No-match recovery still resets filters for the selected unit; excluding every comp removes the suggestion/apply form and explains how to recover.
- No-provider/error UI and Integrations recovery are preserved. Cached and last-synced indicators still use the existing provider service. A live provider failure was not induced.
- Photo grids retain uploaded imagery, missing-preview fallback, cover/order/remove controls, documents and upload modes. Captions can wrap. Coarse-pointer media controls are 44px; the grid gives them enough space. Image data/storage were not changed.
- Empty directory, empty units, archived property, missing unit and permission boundaries retain existing server-side checks and recovery. The no-units listing has a contextual recovery link instead of an otherwise empty table. These states still need native review.
- The schematic map remains explicitly labeled as schematic. No geographic accuracy, provider freshness or rent outcome is claimed from the design examples.

## Design revisions and render evidence

Latest area update was revision **300**. Other areas may advance the shared design after this report. Screens were read and written individually with revision guards. The design's size ceiling was encountered and resolved by consolidating styles within the owned screens; no other screens were removed or moved.

| Screen | Area save revision | Inspected render |
| --- | --- | --- |
| properties | 297 | [Revision 300](../../tests/portfolio/evidence/design-properties-r300.png) |
| property-detail | 298 | [Revision 300](../../tests/portfolio/evidence/design-property-detail-r300.png) |
| unit-detail | 294 | [Revision 300](../../tests/portfolio/evidence/design-unit-detail-r300.png) |
| property-listing | 292 | [Revision 292](../../tests/portfolio/evidence/design-property-listing-r292.png) |
| rent-comps | 299 | [Revision 300](../../tests/portfolio/evidence/design-rent-comps-r300.png) |
| sfh-listing | 300 | [Revision 300](../../tests/portfolio/evidence/design-sfh-listing-r300.png) |

All six renders were visually inspected. Corrected the detached Search button, oversize workspace heading, missing property-media section, repeated comparison heading and unnecessarily tall unit facts layout during iteration. Design screenshots are static examples; they are **not** Windows MCP screenshots or proof of application behavior. Their examples use the established design fixtures, while the application continues to render actual records and imagery.

## Checks performed

| Check | Observed result |
| --- | --- |
| `npm.cmd run test -- tests/portfolio tests/properties tests/rent-comps tests/workspace/media.test.tsx tests/workspace/timeline.test.ts` | Passed: 25 tests, 6 files before the final rent-error association test and routing tests were added. Unchanged successful checks reused. |
| `npm.cmd run test -- tests/portfolio/routing.test.ts tests/rent-comps/workbench.test.tsx tests/workspace/workspace.test.tsx tests/workspace/scoped-tabs.test.tsx` | 13 passed, 1 failed. All 7 new/updated portfolio/comps tests passed, both scoped-tab tests passed, and 4 of 5 workspace tests passed. The remaining failure is the concurrent Returns chart-label change, outside this task. |
| TypeScript, `npm.cmd run typecheck` | Passed on the shared tree at 21:32 PDT. Later production build encountered the cross-area type mismatch below; that earlier result is not a claim that the final shared tree is type-clean. |
| ESLint on every changed TS/TSX file with `--max-warnings=0`; repeated on final CompsWorkbench and new tests | Passed. |
| Scoped `git diff --check` | Passed for the owned changes at review. |
| `node --import ./prisma/os-userinfo.mjs C:/Users/nkgol/RocketRental/node_modules/next/dist/bin/next build` | Application compilation passed; build failed at type validation in concurrently edited `src/app/(manager)/leases/new/page.tsx:78`: the supplied `context` prop is absent from that area's UnitPicker props. Also emitted warnings in other areas' maintenance/returns CSS and tenant forms. No cross-area repair was attempted. |
| Existing workspace Returns regression | `tests/workspace/workspace.test.tsx:95` expected the older chart label `Unit 4B monthly income versus expenses over the selected range`; current Returns renders `Unit 4B: Nov 2025 – Oct 2026`. React also reported an SVG title-children warning in that area. Left for its owner. |
| Live financial/destructive tests | Not run. Rejected property/unit/rent submissions were tested with mocked actions; no live record was modified. |
| Required Windows MCP desktop/phone/keyboard checks | Blocked, as below. |

## Native Edge runtime and blocker

The initial Windows MCP Snapshot observed the human's existing **Personal Microsoft Edge** window, maximized on a 2560×1600 display. Its active RocketRental page was **http://localhost:3101/dashboard**. This is the pre-existing foundation runtime; no inspected candidate runtime URL or build ID is claimed for this task.

Desktop ownership was granted before observation. Two attempts to click the observed Properties navigation item returned:

> Automatic approval review failed: Selected model is at capacity. Please try a different model.

The tool explicitly said neither action executed and that this was review infrastructure failure, not an unsafe-action determination. The required browser action was not bypassed through another tool/profile. Ownership was released. A later lease request timed out with four waiters; the pending observation was stopped and the desktop yielded again. No later click or navigation executed.

Typed clarification notifications also failed on the same approval-service capacity error. This is a reporting limitation, not an accepted question receipt. The source and this report preserve the concrete evidence for resumption.

In the first attempt, Git staging was attempted with only the owned paths. The sandbox refused creation of the worktree's external `index.lock`. The authorized escalation request then failed on the same approval-model capacity error before execution. The typed working-set checkpoint also failed automatic approval review; no successful checkpoint receipt is claimed from that attempt.

On resumption, the declared foundation commit remained an ancestor and the owned changes were intact alongside other areas' commits. The current scope was revalidated. A fresh desktop request returned `DESKTOP_CONTROL_WAIT_TIMEOUT` with two waiters. A typed question about the desktop turn and coordinated `http://localhost:3102` runtime was accepted by Orchestra. The leasing coverage report identifies that runtime as Operations-owned and preserves ports 3100/3101 as references; the Operations report still identifies its earlier port-3112 snapshot. No competing server or build was started. Required app observation remains pending readiness confirmation and desktop access.

**No task-specific native before/after screenshots were captured.** There is no desktop or phone visual acceptance claim. The design captures above do not replace that requirement.

## Isolated candidate runtime: ready

The manager superseded the proposed port-3102 dependency and authorized an isolated review runtime. The scoped implementation commit is `6259ab8212cb0ce040260d222fdc64f04595758b`. The review app at **http://localhost:3115** uses an archive of that exact commit, not another checkout or the concurrent unstaged files. The archive SHA-256 is `1e46a8ef418ade3017d218f2e73c0f4618173388f15a94c8668fab9a69e86f90`.

The snapshot and all Next output are beneath `tests/portfolio/.runtime/app`. Its worker-visible `next.config.ts` sets `distDir: '.next-portfolio'` and the build ID **`portfolio-6259ab8212cb-20261019052420`**. The only snapshot configuration adjustments are that isolated output directory and build identifier; application source comes unchanged from the commit. The reusable launcher is [review-runtime.cjs](../../tests/portfolio/review-runtime.cjs); its metadata and caches stay ignored in `.runtime/`.

The isolated production build **passed** source compilation, lint/type validation, page data collection, all 22 static pages and build tracing. The first attempt failed because the worker resolved a relative preload path from the snapshot; rerunning with the absolute preload below fixed that environment issue. This successful candidate build supersedes the earlier shared-tree type failure for this snapshot. Next emitted a multiple-lockfile workspace-root warning; the configured build output remained inside the owned runtime directory.

```powershell
node tests/portfolio/review-runtime.cjs prepare
Expand-Archive -LiteralPath 'tests/portfolio/.runtime/source.zip' -DestinationPath 'tests/portfolio/.runtime/app'
node tests/portfolio/review-runtime.cjs configure
node --env-file=C:/Users/nkgol/RocketRental/.env --import file:///C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6fmicph499j20nbevsv/repository/prisma/os-userinfo.mjs tests/portfolio/review-runtime.cjs build
node --env-file=C:/Users/nkgol/RocketRental/.env --import file:///C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6fmicph499j20nbevsv/repository/prisma/os-userinfo.mjs tests/portfolio/review-runtime.cjs start
node --env-file=C:/Users/nkgol/RocketRental/.env --import file:///C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6fmicph499j20nbevsv/repository/prisma/os-userinfo.mjs tests/portfolio/review-runtime.cjs health
```

Preparation ran once; reuse the existing snapshot on resumption. The server bound successfully to `127.0.0.1:3115`. At **2026-10-19 05:25:37.782 UTC**, the health check observed **HTTP 200** at `http://localhost:3115/sign-in`, a successful read-only database query, and a matching build ID in both the served HTML and the isolated `BUILD_ID` file. This verifies runtime availability and identity, not a native app flow. The runtime uses the existing local database on port 5433 and existing file storage; no migration, seed, reset or data submission occurred. Ports 3100/3101, shared `.next`, unrelated processes and other tasks' staged changes were preserved.

Only after that successful health check, a fresh `take_desktop` returned this exact receipt:

```json
{"granted":false,"reasonCode":"DESKTOP_CONTROL_WAIT_TIMEOUT","waiters":3,"next":"Another agent has the desktop. Call take_desktop again to keep your place, or do other work first."}
```

The receipt supplied no holder, queue, request or diagnostic ID. The attempt-scoped operational trace for 2026-10-19 05:25–05:27 UTC returned no records, so no additional desktop diagnostic identifier is available. Missing trace records do not establish why the queue timed out. `release_desktop` returned `{"released":false}`. No Windows action was issued, no desktop ownership was bypassed, and no unchanged acquisition loop was repeated. The current manager view was not altered. Native before/after, phone and keyboard evidence remain blocked on a granted desktop turn.

## Remaining acceptance work

1. Obtain a desktop turn. Capture the reference/before application views in the existing Edge session, if that runtime remains available.
2. Reuse the verified isolated candidate at port 3115. Its recorded source/build identity and successful build are above; do not rebuild or reprepare an unchanged snapshot. Preserve the reference runtimes and database/storage.
3. At desktop and 390px, inspect all six screens plus directory list/no matches, property and unit edit/cancel, add-property dialog/focus/Escape, add-unit rejected input, media missing/empty states, comparison no matches/all excluded/provider error and invalid-unit recovery. Capture native before/after images and important focus states.
4. Verify all-units/unit/property switching, filter retention, compatibility redirects and entry into linked workspace tabs. Verify scroll regions with the keyboard and touch-size controls in phone emulation.
5. Exercise successful or destructive/financial submissions only against an isolated fixture. Reuse the successful scoped tests, and rerun affected checks if native review requires a source fix.

The scoped source work is preserved for review and completion. The Git candidate is reported separately from native acceptance. Full acceptance, integration, publication and remote push have not been claimed.

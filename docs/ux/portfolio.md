# Property, unit and listing workspace review

Reviewed 18–19 October 2026. **The property, unit and listing improvements are committed, all six design screens were rendered and inspected, and native Edge desktop/phone evidence now exists.** Desktop access is resolved. The review found and corrected undersized inline edit controls. The final phone editor, compatibility, cross-property and scoped-navigation checks are recorded below.

## Basis and scope

- Read the foundation's [full app review](full-app-review.md) before implementation. Kept its compact spacing, flat cards, navy palette, global focus treatment and established workspace tabs.
- Read Designs/rocketrental-app revision 288 and updated only `properties`, `property-detail`, `unit-detail`, `property-listing`, `sfh-listing`, `rent-comps` and styles beneath their owned `.portfolio` wrapper. The current shared design has advanced beyond this area's last save; other writers' screens remain preserved.
- Followed Diagrams/rocketrental-mindmap revision 4, including `f-props` and `f-comps`. Those nodes had no further repository attachments; the task attachment list was empty.
- Confirmed the declared foundation commit was the starting HEAD and ancestor. Used the assigned shared checkout and committed explicit owned paths. Other areas' changes were preserved.
- No migration, seed/reset, successful property/unit edit, rent application, archive, deletion, upload, provider refresh or lease/payment submission was performed. An empty add-property submission was rejected by validation; no record was created. Financial/destructive rejection tests use mocked actions and in-memory fixtures.

## Route and screen coverage

| Route / state | Design | Disposition and observed coverage |
| --- | --- | --- |
| `/properties`, grid | properties | **Improved.** Visible Search action, selected filters, wrapping names/addresses and larger Grid/List targets. Existing imagery retained. Native desktop and 390px phone reviewed. |
| `/properties?view=list` | properties | **Improved.** Named keyboard-focusable table region. Native List transition and no-match search/recovery passed. Search submitted with Enter; query/view retained. |
| `/properties?add=1` | properties | **Improved.** Add keeps search/filter/view; stable field-error IDs associate messages with inputs. Native initial Close focus, Tab focus on Property name, Escape/cancel, phone dialog scrolling and rejected empty submission observed. |
| `/properties/:id` | property-detail | **Improved.** Units expose configuration, tenant links and named Open links; header Add unit reaches the bounded form. Actual property type labels facts; next steps are compact rows. Native Maple overview, unit table, add-unit anchor and media/empty-document sections reviewed. |
| `/properties/:id?unit=:unitId` | unit-detail | **Improved.** Compact facts/media, visible timeline focus and readable inline editing. Native timeline link to Unit 1A, keyboard switch to 1B, All units recovery, Edit/Cancel and active-lease restrictions observed. Desktop and phone overview reviewed. |
| Property add-unit form | property-detail | **Improved.** Bounded single-column layout and input-associated errors. Native desktop layout and anchor reviewed; mocked rejected submission passed. Successful/duplicate live creation not exercised. |
| Property/unit inline facts | property-detail / unit-detail | **Improved after native review.** Bare controls were too small. Owned CSS now supplies consistent 40px controls, visible focus/error treatment, readable hints, single-column phone fields and 44px coarse-pointer targets. Shared InlineFacts behavior, Save/Cancel, restrictions and confirmations unchanged. Corrected desktop and phone editor inspected, including Tab focus, occupied-status restriction, scrolling to Save/Cancel, and cancellation without saving. |
| `/properties/:id/listing`, multiple units | property-listing | **Improved.** Saved market estimate distinguished from a new suggestion; current lease/listed rent identified; missing estimates say Not set; See comps names its unit. Native desktop table and phone horizontal scroll to actions passed; See comps opened the selected unit listing. |
| `/properties/:id/listing`, single home | sfh-listing | **Improved.** Removed duplicate comparison heading; compact subject/status/list price; preserved property-level home context. Native 18 Elm Street desktop and phone reviewed. Home terminology/filter continuation component test passed. |
| `/properties/:id/listing?unit=:unitId` | rent-comps | **Improved.** Compact subject/selector, shrinkable filters, stacked narrow map/summary, readable exclusions, named table region and associated rent errors. Native desktop and phone filters/map/summary reviewed; checkbox exclusion of all six comps removed suggestion/apply controls; Space re-included a comp and restored the summary. |
| `/rent-comps` compatibility landing | rent-comps | **Already coherent.** Chooses an authorized unit, retains pricing filters and redirects to its property listing. Source and canonical-route tests reviewed; native compatibility redirect with radius=1 and keyboard cross-property selection to 18 Elm Street passed. |
| `/properties/:id/units/:unitId` compatibility | unit-detail / rent-comps | **Already coherent.** Preserves unit and relevant query values; destination validates property/organization membership. Listing/filter and Returns/period routing tests passed; native legacy listing redirect preserved unit/radius; missing-unit URL showed Page not found and recovery navigation. |
| Legacy property `?tab=` / documents destination | property-detail | **Already coherent.** Canonical helper retains unit/filter context; documents remain an overview destination. Routing test includes unit/notice retention. No other area's document route changed. |

Scoped Applications, Leases, Payments, Returns, Maintenance and Documents contents remain with their area owners. Shared scoped-tab tests passed. Native links to Applications, Leases, Payments and Maintenance retained Unit 1B. Returns loaded directly with the correct unit, but client tab navigation stalled; see the specific finding below. The established lease-detail Overview / Agreement / Documents / Payments / Activity tabs were not edited.

## Native Windows MCP evidence

Used the human's existing **Personal Microsoft Edge** session on a **2560×1600** display. Phone checks used that same Edge tab's native DevTools responsive mode at **390×844**, not another browser or a Playwright session. Screenshots are unedited Windows MCP capture bytes.

Each focused batch had its own granted desktop lease. The original manager tab was observed at **http://localhost:3104/dashboard** and left at its original mid-page scroll. A separate fifth tab in the existing window was used for review. Device emulation and DevTools were closed, the fourth manager tab restored and ownership released between batches.

| Screen | Desktop before (reference app) | Desktop after | Phone after |
| --- | --- | --- | --- |
| Properties | [Before](../../tests/portfolio/evidence/desktop-before-properties.png) | [After](../../tests/portfolio/evidence/desktop-after-properties.png) | [390px](../../tests/portfolio/evidence/phone-after-properties.png) |
| Property overview | [Before](../../tests/portfolio/evidence/desktop-before-property.png) | [After](../../tests/portfolio/evidence/desktop-after-property.png) | [390px](../../tests/portfolio/evidence/phone-after-property.png) |
| Unit overview | [Before](../../tests/portfolio/evidence/desktop-before-unit.png) | [After](../../tests/portfolio/evidence/desktop-after-unit.png) | [390px](../../tests/portfolio/evidence/phone-after-unit.png) |
| Multi-unit listing | [Before](../../tests/portfolio/evidence/desktop-before-listing.png) | [After](../../tests/portfolio/evidence/desktop-after-listing.png) | [390px](../../tests/portfolio/evidence/phone-after-listing.png) |
| Unit rent comps | [Before](../../tests/portfolio/evidence/desktop-before-comps.png) | [After](../../tests/portfolio/evidence/desktop-after-comps.png) | [390px](../../tests/portfolio/evidence/phone-after-comps.png) |
| Single-family listing | [Before](../../tests/portfolio/evidence/desktop-before-sfh.png) | [After](../../tests/portfolio/evidence/desktop-after-sfh.png) | [390px](../../tests/portfolio/evidence/phone-after-sfh.png) |

Useful interaction evidence:

- Directory [List view](../../tests/portfolio/evidence/desktop-after-list.png), [no matches](../../tests/portfolio/evidence/desktop-after-empty.png), [dialog keyboard focus](../../tests/portfolio/evidence/desktop-after-property-focus.png), [phone dialog](../../tests/portfolio/evidence/phone-after-add-property.png) and [phone validation errors](../../tests/portfolio/evidence/phone-after-property-errors.png).
- Property [unit table before](../../tests/portfolio/evidence/desktop-before-property-units.png), [after](../../tests/portfolio/evidence/desktop-after-property-units.png), [Add unit](../../tests/portfolio/evidence/desktop-after-add-unit.png) and [keyboard unit switch](../../tests/portfolio/evidence/desktop-keyboard-unit-switch.png).
- Inline editor [native finding](../../tests/portfolio/evidence/desktop-unit-editor-before-fix.png) and [corrected controls](../../tests/portfolio/evidence/desktop-after-unit-editor.png), [phone keyboard focus](../../tests/portfolio/evidence/phone-after-unit-editor.png) and [phone actions](../../tests/portfolio/evidence/phone-after-unit-editor-actions.png).
- Comparison [summary](../../tests/portfolio/evidence/desktop-after-comps-summary.png), [rows](../../tests/portfolio/evidence/desktop-after-comparison-rows.png), [all excluded](../../tests/portfolio/evidence/desktop-after-comps-empty.png), [phone map](../../tests/portfolio/evidence/phone-after-comps-map.png), [phone market summary](../../tests/portfolio/evidence/phone-after-comps-summary.png) and [phone listing actions after horizontal scroll](../../tests/portfolio/evidence/phone-after-listing-scroll.png).
- Restored original manager view after [batch 2](../../tests/portfolio/evidence/desktop-restored-batch2.png) [batch 3](../../tests/portfolio/evidence/desktop-restored-batch3.png) and [final batch](../../tests/portfolio/evidence/desktop-restored-batch4.png).

- Compatibility: [legacy unit redirect](../../tests/portfolio/evidence/desktop-legacy-unit-redirect.png), [rent-comps landing](../../tests/portfolio/evidence/desktop-comps-compatibility.png), [cross-property selector](../../tests/portfolio/evidence/desktop-cross-property-selector.png) and [invalid unit](../../tests/portfolio/evidence/desktop-invalid-unit.png).
- Linked workspace entries: [Leases](../../tests/portfolio/evidence/desktop-linked-leases.png), [Payments with keyboard focus](../../tests/portfolio/evidence/desktop-linked-payments.png), [Applications](../../tests/portfolio/evidence/desktop-linked-applications.png) and [Maintenance](../../tests/portfolio/evidence/desktop-linked-maintenance.png).

The desktop before captures use the existing **http://localhost:3100** reference runtime. Its source/build was not independently pinned, so these are observed reference views, not a reconstructed historical commit. No baseline process or build output was changed. Later phone-before navigation to port 3100 was rejected by automatic approval review: it interpreted preserving baseline runtimes as prohibiting access. No rejected navigation executed and no alternate method bypassed it. **There are desktop before/after and phone after captures; no phone-before capture is claimed.**

Native unit switching completed with the correct URL, title, status and lease data. All units navigation was slower during one batch; an immediate snapshot still showed the previous unit, then the canonical property overview appeared. Only the settled result is counted. The final batch requested sign-in again and used the existing public local demo account; the reason for the expired session was not established, and no account details were changed.

## Specific unresolved navigation finding

At approximately **06:33–06:36 UTC**, selecting the Returns tab from Unit 1B Payments did not settle: keyboard Tab/Enter followed by a 15-second wait, then a click with a 20-second wait left the Payments URL/content in place. The visible target was `/properties/seed-property-maple/returns?unit=seed-unit-maple-2`. A later click from Maintenance also left that page in place after a 10-second wait. These are failed client transitions, not passed checks.

Opening that exact Returns URL directly loaded the correct Unit 1B income/expense view immediately. The other scoped tabs and compatibility routes worked. Native DevTools showed no console error during the failed transition. The server emitted no error in the reviewed output. Source inspection confirmed a normal Next Link and correct scoped href; neither the shared WorkspaceTabs component nor the Returns destination is owned or modified by this task. The cause is **unresolved**, and no speculative cross-area fix was made.

Evidence: [stalled from Payments](../../tests/portfolio/evidence/desktop-returns-tab-stalled.png), [stalled from Maintenance](../../tests/portfolio/evidence/desktop-returns-tab-from-maintenance.png), [direct Returns succeeds](../../tests/portfolio/evidence/desktop-returns-direct.png). This needs shared navigation/Returns follow-up; the portfolio result does not claim this transition passed.

## Behavior and data preserved

- Rent calculation and apply action are unchanged. Copy distinguishes saved market estimates from lease/listed rent. Rejected rent identifies the field. Vacant/turnover continuation says Create lease; occupied continuation says Use for renewal.
- Automatic select/radio filter submission and Update comps remain. No-match reset preserves selected-unit context; excluding every comp removes suggestion/apply and explains recovery.
- Provider-error/Integrations recovery and cached/last-synced indicators remain. No live provider failure was induced.
- Existing uploaded imagery and illustrated/gradient fallbacks, cover/order/remove controls and document/upload modes remain. Captions wrap and coarse-pointer controls are 44px. Storage and image data were preserved.
- Native property and unit views showed missing facts, empty photo/document states and occupied-unit restrictions. Archived/no-unit and permission branches remain server checked and were source reviewed rather than created by changing shared data.
- The map explicitly says it is schematic. No geographic accuracy, provider freshness or financial outcome is inferred from visual examples.

## Design revisions and inspection

All six owned screens were read/written individually with revision guards and visually inspected. Last area save was revision **300**; later shared revisions do not invalidate these earlier observed renders.

| Screen | Area save | Inspected render |
| --- | --- | --- |
| properties | 297 | [r300](../../tests/portfolio/evidence/design-properties-r300.png) |
| property-detail | 298 | [r300](../../tests/portfolio/evidence/design-property-detail-r300.png) |
| unit-detail | 294 | [r300](../../tests/portfolio/evidence/design-unit-detail-r300.png) |
| property-listing | 292 | [r292](../../tests/portfolio/evidence/design-property-listing-r292.png) |
| rent-comps | 299 | [r300](../../tests/portfolio/evidence/design-rent-comps-r300.png) |
| sfh-listing | 300 | [r300](../../tests/portfolio/evidence/design-sfh-listing-r300.png) |

Iteration corrected detached Search, oversized workspace headings, missing property media, repeated comparison headings and tall facts layouts. The design size ceiling was resolved within owned markup/styles; no other screen was removed. Static design fixtures are distinct from actual runtime records and native evidence. The later inline-input CSS fix uses the same control styling without changing these read-only screen structures.

## Candidate and runtime identity

Main implementation: `6259ab8212cb0ce040260d222fdc64f04595758b`. Runtime helper/report: `a05b495422d8fa57d7b2a5e5f263d4446e043f09`; queue history/report: `783bc8082a76fcc332bb067a95fb8c1a94a129f5`. Native editor correction and versioned runtime helper: **`dd01785856b60c1ec2d0ad4b8c28f0ce6046d184`**.

Ready URL: **http://localhost:3115**. The currently served snapshot is an archive of the last commit above, not an uncommitted tree or a different checkout.

- Build ID: `portfolio-dd01785856b6-20261019060646`
- Source archive SHA-256: `91de3ce986d60f84f95bfd5c7ab8fbd49a6018454910fda6e072f49584d29ab8`
- Snapshot/output: `tests/portfolio/.runtime/facts/app/.next-portfolio`
- Worker-visible config SHA-256: `0ed0e335b9d805756aa13719b4dd66684750537130c7852370d95436c1defe01`
- Health at **2026-10-19T06:07:47.216Z**: HTTP 200 at `/sign-in`, read-only database `SELECT 1` succeeded, served HTML/build file matched the expected build ID.
- Local database port 5433 and existing storage were reused. No database preparation or cleanup ran.

The [review helper](../../tests/portfolio/review-runtime.cjs) keeps all generated files beneath the ignored owned runtime directory. Only snapshot config adds isolated `distDir` and build identity. The original 6259ab8 snapshot/build `portfolio-6259ab8212cb-20261019052420` remains on disk; its owned server was stopped after the corrected build succeeded, then the corrected snapshot was started on the same port. Unrelated processes, ports 3100/3101 and shared `.next` were untouched.

Desktop batch 2 (approximately 05:58–06:05 UTC) reviewed the earlier 6259ab8 application. Batches 3 (06:13–06:22 UTC) and 4 (06:30–06:37 UTC) reviewed the corrected dd01785 build. The only owned application delta between them is the inline facts CSS; unchanged screen captures are reused.

To recheck the existing current runtime without preparing/rebuilding:

```powershell
$env:PORTFOLIO_REVIEW_REVISION='facts'
node --env-file=C:/Users/nkgol/RocketRental/.env --import file:///C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6fmicph499j20nbevsv/repository/prisma/os-userinfo.mjs tests/portfolio/review-runtime.cjs health
```

## Checks and limitations

| Check | Observed result |
| --- | --- |
| Scoped portfolio/property/comps/media/timeline tests | **Passed:** 25 tests in 6 files. Reused successful unchanged checks. |
| Follow-up routing/comps/scoped-tabs tests | **Passed:** all 7 new/updated portfolio/comps tests and both scoped-tab tests. |
| Shared workspace test included in follow-up | Historical **failure** outside scope: 4/5 passed; Returns chart label expected older wording. No unrelated test/source edit was made. |
| Changed TypeScript ESLint with max warnings 0 | **Passed.** |
| Initial shared-tree typecheck | **Passed** at 21:32 PDT; later shared build encountered another area's concurrent UnitPicker type mismatch. |
| Isolated production build, original and corrected candidates | **Passed:** source compilation, lint/types, data collection, 22 static pages and tracing. Corrected build supersedes the initial shared-build type failure for the reviewed snapshot. |
| Corrected runtime helper syntax / scoped whitespace | **Passed:** node syntax check and git diff check. |
| Runtime health/build identity | **Passed** for both snapshots; current identity above. |
| Native desktop/phone/keyboard | **Passed for owned screen review:** six main screens, directory/dialog errors, empty media/comparisons, keyboard focus/selectors/checkboxes, phone editor and compatibility routes observed. Scoped Returns client transition failed separately below. |
| Scoped Returns client transition | **Failed** from Payments and Maintenance despite correct href; direct destination passed. Cause unresolved, outside the files modified by this task. |
| Financial/destructive and successful shared-data mutations | **Not run live.** Mocked rejection tests passed. Existing confirmations/permissions preserved. |
| Live provider failure, archived/no-unit fixture, full screen-reader audit | **Not run live.** Existing branches source reviewed; no new data or provider failure was manufactured. |
| Phone-before reference screenshots | **Not run:** automatic approval review rejected baseline navigation. Existing desktop before captures and phone after captures retained. |

The scoped test commands were `npm.cmd run test -- tests/portfolio tests/properties tests/rent-comps tests/workspace/media.test.tsx tests/workspace/timeline.test.ts` and the follow-up `npm.cmd run test -- tests/portfolio/routing.test.ts tests/rent-comps/workbench.test.tsx tests/workspace/workspace.test.tsx tests/workspace/scoped-tabs.test.tsx`. Successful checks were reused rather than rerunning unrelated suites. The final CSS/helper change was checked by `node --check tests/portfolio/review-runtime.cjs`, scoped whitespace validation and the corrected isolated production build.

Earlier desktop access failures are historical, not a current blocker. The [12 timestamped queue receipts](../../tests/portfolio/evidence/desktop-queue.json) document the earlier 05:30–05:40 UTC wait. After the manager verified availability, this task obtained its own leases and gathered the native evidence above. Approval-capacity and external Git-index errors from the first attempt were resolved before the scoped commits.

Changed source covers directory/forms, compatibility routing, listing/comparison components, overview/media/timeline styles, and focused regression tests. The final candidate/report commit is submitted separately from runtime identity. No integration into the root target branch, remote push, Preview publication or independent acceptance is claimed.

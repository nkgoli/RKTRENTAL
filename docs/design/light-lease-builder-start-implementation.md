# Light lease builder: Term and Rent — implementation

Implements `Designs/rocketrental-light-lease-builder` revision 14 (`term`, `term-phone`, `rent`, `rent-phone`) against `Designs/rocketrental-light-system` revision 7, following the handoff in [light-lease-builder-start.md](light-lease-builder-start.md). The ten-step order, validation, charge calculations, draft save/resume, renewal context and navigation semantics are unchanged; shared presentation and the first two steps changed, followed by the Save and exit correction documented below.

## Current manager-review runtime

**Final state, observed October 20, 2026 at 05:38:27 UTC: the focused existing-Edge recheck passed the flows below, and the task-owned app/database have been guardedly stopped and their processes/listeners released.** This section supersedes all historical ready/stopped statements below, including the 04:49 readiness record and the 00:50 release proof. The completion policy remains **managerReview**; there has been no independent merge, push, deployment or desktop acquisition.

| Identity / readiness                        | Current observation                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Committed application and regression source | `1502c3388d63b4689320433100383e959c81365e`                                                                                                   |
| Production BUILD_ID                         | `0LcCyQCj3cDQ-dgX0Xcut`                                                                                                                      |
| App                                         | `127.0.0.1:3308`, former PID `26220`; released                                                                                               |
| Database                                    | `127.0.0.1:55508`, former PID `26400`; released; original `tests/lease-builder/.runtime-db/data` retained                                    |
| Ownership and identity                      | Guarded start/status passed; HTTP identity matches checkout, source and build; application `src`/`public` matches the committed build source |
| HTTP and browser readiness                  | Sign-in HTTP 200; authenticated fresh/resumed routes and exit destination passed the production regression                                   |
| Current release proof                       | `tests/lease-builder/.runtime-db/final-review-release.json`                                                                                  |

Reviewed routes (runtime is now stopped):

- [Fresh lease](http://127.0.0.1:3308/leases/new?unit=seed-unit-maple-7&fresh=1)
- [Original manager-review draft](http://127.0.0.1:3308/leases/new?draft=cmvg7ht010001b9xcatch4kbh)
- [Draft list](http://127.0.0.1:3308/leases?tab=drafts)
- [Renewal context](http://127.0.0.1:3308/leases/new?renew=seed-lease-maple-1)

The manager completed the focused review on October 20, 2026 at approximately 05:26:07–05:29:07 UTC and explicitly authorized release in response `25beb1cf82c60706e49b84d3b23778a2cef7cb2963e9364c229dbc7cd13d1739`. Native validation correction/retry passed. The manager's browser interface does not expose network fault injection, so injected save-failure coverage remains the separate nine production regression runs; no native injected-failure pass is claimed. No further native review or human approval was requested.

The guarded stop completed successfully at 05:38:27 UTC. Follow-up queries found neither app PID 26220 nor database PID 26400 and no listeners on ports 3308/55508. `tests/lease-builder/.runtime-db/final-review-release.json` records that release, authorization message, data directory and preserved build identities. Fixture data, dependencies, caches, test evidence and source history remain present. No sibling service was targeted. The final submission changes only this handoff after the reviewed source commit, so its application `src`/`public` remains identical to the reviewed production build.

## Existing-Edge review and exit correction

The manager observed the prior build `U1-oHBAp3sYAPZS_AuAwD` in existing Edge at approximately 04:51–04:55 UTC on October 20. The manager then reset the viewport override and released the desktop. These are manager-reported native observations, separate from the configured Chromium results below:

- ArrowDown selected month-to-month. Native segmented typing set custom end `2034-12-31` before start `2035-01-15`; Next showed the correct error, focused the summary, and associated `custom-end-date-error`. Custom `2035-11-20` survived Full year → Custom.
- Term → Rent → Tenants and heading focus passed. At 390px, due day 5 recalculated 1083.87. Fee 0, pet 0, grace 40 and malformed late fee produced visible associated errors and summary focus; corrected 150/250/5/75 were retained, including move-in toggle retention of 150.
- Four fee controls measured 16px text, 45.33px height and 246px width; viewport/page width was 390. Preview total 3083.87 and the preview-only disclosure were visible.
- Save and exit failed from fresh Tenants and resumed Rent: the URL stayed in the wizard with Saving… and disabled controls. App/database and source/build identity remained present. The draft persisted, resumed Tenants, and retained rent 1600, due day 5, deposit 1600 and fees 150/250/5/75. No console errors were captured.

The first review's screenshots were observed in browser tool output; no filesystem screenshot paths were supplied. Renewal, complete phone Term/footer captures and failure-injection recheck were incomplete at that time. The focused recheck below supersedes the outstanding native observations; network fault injection remains explicitly automated-only.

### Focused existing-Edge recheck: observed passes

The manager rechecked source `1502c3388d63b4689320433100383e959c81365e` / build `0LcCyQCj3cDQ-dgX0Xcut` at approximately 05:26:07–05:29:07 UTC on October 20. The previous preserved tab was gone, so a new tab `712378567` was opened in the same existing Edge session. It authenticated to the retained synthetic fixture and used `localhost:3308` after the normal auth redirect, at 390×844 and 1280×900. The manager confirmed viewport reset, tab closure and desktop release afterward.

- **Fresh exit and correction/retry:** Term → Rent → Save and exit promptly reached `/leases?tab=drafts`. Draft `cmvg8qzp5000sb98cwtkehsb0` resumed Rent with entered rent 0. Saving an incomplete draft is permitted; this was not a validation failure. Next correctly rejected 0 with a focused summary and field error. Correcting to 1653 advanced to Tenants with heading focus; keyboard Enter on Save and exit reached the list showing 1653.
- **Previously stuck resumed draft:** `cmvg7ht010001b9xcatch4kbh` resumed desktop Rent with 1600 / due day 5 / deposit 1600 / fees 150, 250, 5, 75 and preview 3083.87 intact. Save and exit promptly reached the real draft-list URL and Lease portfolio heading.
- **Exact fresh-Tenants trigger:** A separate fresh=1 flow advanced Term → Rent → Tenants while its URL still contained fresh=1. Save and exit reached the list showing new draft `cmvg8tiie000vb98cnq2p1fyz` at 1600. The exit defect did not recur in these native flows.
- **Phone layout:** Term top, modes, custom-date area and lower footer were captured, along with Rent preview/disclosure and lower footer. Back/Next, next-step labels, disclaimer and Save and exit were readable and reachable without overlap; document and viewport widths were both 390px.
- **Renewal:** Existing renewal draft `cmvfxickh0004b9goefu8p9f8` showed Renewal context and start/end 2027-01-01 / 2027-12-31. Setting start 2026-12-31 and clicking Next produced the focused server error "Renewal must begin after the current lease ends." Correcting to 2027-01-01 advanced through Rent to Tenants; Dana Kim remained checked and carry-over context was visible. Renewal Save and exit reached the list. No lease was sent or activated.
- **Console:** No error or warning records were captured in these reviewed flows.

The earlier native term modes, custom-date, keyboard and fee observations remain valid for unchanged code. Native validation correction/retry and the automated aborted-save/pending/retry tests are distinct evidence; native network fault injection was not performed because the interface does not expose it.

Native captures are conversation images from the manager turn triggered by `94637876e0f2eecbf7d991c652e067a573a6f4a1ad9d172b3eb06b0dc7c01a84`. Exact tool titles:

- `Capture phone Term and reachable footer, then advance` (two images)
- `Verify invalid-rent feedback before retrying Next`
- `Capture phone Rent footer and verify corrected progression`
- `Verify exit from Tenants and retained rent in the draft list`
- `Verify original-draft exit and open renewal context`
- `Verify renewal boundary rejection`
- `Verify carried renewal tenant and successful exit`
- `Verify fresh Tenants exit reaches the draft list and finish review`

No local native screenshot paths were produced or invented. These manager-reported observations are recorded for the required managerReview decision, not presented as an independent owner-run native test.

### Cause and change

The exact reviewed build reproduced both exits in configured Chromium before source edits. The save POST returned 200 and the draft-list RSC response completed, but the client navigation transition remained pending; a standalone navigation to the same destination succeeded. The previous `startTransition → save → router.push` sequence depended on the server-action/router transition finishing together. The installed Next action queue can discard a pending action when navigation takes priority. Deferring the push to an effect still reproduced an intermittent fresh-exit failure, so that intermediate build is not the review candidate.

`LeaseBuilder.saveAndExit` now calls `window.location.assign(exitHref)` only after the real save reports success. This performs a document navigation to the existing draft-list destination, with a fresh server render. The existing pending controls, save-error focus, retained values and retry behavior remain in place. No service, ledger, validation or later-step body changed. No path expansion was needed.

### Focused production regression and evidence

`tests/leases/light-lease-builder.spec.ts` opts in only with explicit expected build/source identity and requires this checkout on ports 3308/55508. It uses the retained synthetic fixture, creates its own drafts through real UI actions, and never reseeds or sends a lease. It asserts the actual exit URL and list heading, follows the persisted draft's Continue setup link, verifies saved-step/value/visited-step context, and holds/aborts a save POST to verify pending controls, focused failure, value retention and successful retry.

| Check                              | Observed result                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Original reviewed production build | Fresh and resumed exit tests both failed the destination URL assertion after 15 seconds, matching the manager's finding. Trace/error evidence remains under `.runtime-db/save-exit-before`; configured-browser capture is `.runtime-db/builder-baseline-save-exit-stuck.png`.                    |
| Final production regression        | **9 passed in 24.2 seconds**: fresh exit, resumed exit and failed-save retry, each repeated three times because the navigation failure was intermittent. Log: `.runtime-db/save-exit-final.log`; traces and `.last-run.json`: `.runtime-db/save-exit-final`.                                     |
| Affected workflow unit tests       | `tests/lease-create/workflow-ux.test.tsx`: **6 passed** after the final source change.                                                                                                                                                                                                           |
| Production build                   | `node --import ./prisma/os-userinfo.mjs node_modules/next/dist/bin/next build`: passed compilation, lint/type checks, page generation and tracing. Log: `.runtime-db/exit-document-build.log`. The existing tracing-root warning remains; dependencies, Prisma client and output are task-local. |
| Scoped lint and formatting         | ESLint on the changed component/spec passed with zero warnings. Prettier and scoped patch hygiene passed.                                                                                                                                                                                        |

Here `.runtime-db` means `tests/lease-builder/.runtime-db`. To run the focused regression against the guarded runtime:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3308'
$env:LEASE_BUILDER_EXPECTED_BUILD = '0LcCyQCj3cDQ-dgX0Xcut'
$env:LEASE_BUILDER_EXPECTED_SOURCE = '1502c3388d63b4689320433100383e959c81365e'
node node_modules/@playwright/test/cli.js test tests/leases/light-lease-builder.spec.ts --project=leases --workers=1 --output tests/lease-builder/.runtime-db/recheck --trace retain-on-failure
```

The configured browser was used first to reproduce the failure. Its intermittent `MCP_SESSION_NOT_FOUND` resets were reported; the retained regression then ran through the installed Playwright runner in isolated Chromium contexts. Two test-harness issues (response-body retrieval and the route-announcer sharing role=alert) were corrected; final assertions use the subsequent save request's draft ID and the wizard's scoped error summary. The superseded intermediate attempt and failures remain local, rather than being reported as passes.

The original app PID 53040 and database PID 38596 were released at 05:12:03 UTC using the guarded stop; subsequent process/listener checks found neither. Proof: `.runtime-db/pre-exit-fix-release.json`. The intermediate build was also guardedly released before replacement (`.runtime-db/deferred-exit-release.json`). No sibling service was targeted. The reviewed original build is preserved under `.runtime-db/node_modules/before-exit-fix/.next`; the design baseline remains under `.runtime-db/node_modules/baseline/.next`. The fixture, previous captures, caches and untracked saved work remain on disk; no reseed or dependency/client regeneration occurred.

Prior passing checks for unchanged term modes, fees, validation, renewal and responsive presentation are reused below. The historical Save/exit success row is superseded by the manager's reproducible finding and the focused final-build regression above. The focused native recheck above completed those observations; finalization retains the explicitly authorized guarded release proof and the network-injection limitation.

## Source-to-design mapping

| Design element                                                                | Implementation                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Light top bar, back control, Save and exit                                    | `lease-builder.module.css` `.topbar` / `.back` / `.exit`; caption in `LeaseBuilder.tsx` and `UnitPicker.tsx`               |
| Draft status badges (Not saved yet / Unsaved changes / Saving… / Draft saved) | `.introDraft` with `.draftNeutral` / `.draftUnsaved` and `.spinner` in `LeaseBuilder.tsx`                                  |
| 1152px wrap, 208px step column, panel head band and icon                      | `.layout`, `.cardHead`, `.panelIcon`                                                                                       |
| Ten-step list, visited/current markers, phone horizontal scroll               | `.steps` with `tabIndex`/`aria-label`, `.phoneHint`; 700px media query                                                     |
| Term choice cards with computed end dates and hint bars                       | `TermStep` in `steps.tsx` using `endOptionDates`; no specimen dates hard-coded                                             |
| Rent fields, optional-fee grid, proration and scheduled charges preview       | `RentStep` / `ChargesPreview` with `.fees` and `.ledger` styles; calculations still come from `fees.ts` / `lease-setup.ts` |
| In-flow panel footer, Next destination, focus and disabled states             | `.footer` (static), `data-next-step` on Next, 3px focus outline, readable disabled controls                                |

Supporting-state specimens in the design (validation, saving, failure, unit entry, resume/renewal, proration options) remain references; the application renders the equivalent real states through the existing handlers, error summary and pending fieldset, not as a static gallery.

## Review corrections (assignment generation 2)

- Optional fees are now card containers (`div`) with a separate checkbox label and visibly labelled amount/grace fields built with `Field`, so each enabled field carries `aria-invalid` and an `aria-describedby` error with a stable generated ID. Toggles, entered values, validation and fee logic are unchanged.
- Fee amount/grace inputs are now `.field` controls, so the phone 16px/44px rules apply at 390px; the late-fee card spans the fee grid and its fields stack on phone.
- The custom end-date error renders with `id="custom-end-date-error"` and the date control points to it with `aria-describedby` alongside `aria-invalid`.
- `ChargesPreview` now states: "Preview only. Charges are created when the lease is sent or activated." Charge generation behavior is unchanged.
- Two new interaction tests cover the custom-date error link, the preview disclosure, fee toggles, and labelled invalid fee/grace fields.

## Integration versus acceptance

Candidate `69c4bf7` is contained in root `main` by merge `2c6768f`. That containment is integration history only; it is not manager acceptance. This correction round belongs in the retained checkout for manager review and must not be independently merged, pushed or deployed.

## Source, build and isolated runtime identity

Verification on October 19, 2026 used the assigned retained checkout only:
`C:\Users\nkgol\RocketRental\.orchestra\workspaces\@2due1loxaym80pkgjay\repository`,
branch `orchestra/work-2gcjdifqik3o7helc0b-63ycdqt1xw8g8v3u40l`.

| Variant                   | Exact application source                   | Production BUILD_ID     |
| ------------------------- | ------------------------------------------ | ----------------------- |
| Before review corrections | `69c4bf7eb34266f067df3826b7a3b5928f915c64` | `IsQIJtf3s4Z9L7yudBSI3` |
| Corrected candidate       | `66c1d48eeb4ff91c397bccbbc619c89053b9a1e6` | `U1-oHBAp3sYAPZS_AuAwD` |

The earlier submission `28014024adaae1f36120a8abb42262ee2eef7f0a` added this evidence and refined the test runtime guards; its application matched the then-corrected source `66c1d48eeb4ff91c397bccbbc619c89053b9a1e6`. The final exit correction uses the newer source/build mapping at the top of this handoff. Both builds completed with Next 15.5.27 in production mode. The baseline was a `git archive` of the exact before commit, built inside this Task's test fixture, not another owner's checkout. Its preserved build is now under `tests/lease-builder/.runtime-db/node_modules/baseline`; placing the archive under node_modules prevents accidental duplicate test/type discovery. The source archive remains at `.runtime-db/baseline.tar`.

Dependencies were installed with `npm.cmd ci --ignore-scripts` into this checkout's real `node_modules`; Prisma 6.19.3 was generated here only. The baseline uses a junction to those same task-owned dependencies. No shared dependency or client was regenerated. Embedded PostgreSQL 16.14 is installed separately in `tests/lease-builder/.runtime-db/node_modules`. Build output, dependencies, fixture data and screenshots remain local, excluded from the Git candidate.

The app binds `127.0.0.1:3308`, the database binds `127.0.0.1:55508`; listeners were checked before initialization. These are this Task's services, not an inferred reservation from prior observations. SQL `SELECT current_database(), current_setting('data_directory'), current_setting('port')` returned database `rocketrental`, port `55508`, and this checkout's `tests/lease-builder/.runtime-db/data`. All 19 migrations applied successfully; `prisma/seed.ts` seeded 4 properties, 45 units and 41 occupied leases into that isolated database. No external provider or shared database was used.

## Observed checks

| Check                                                                                                                                                                  | Result                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --import ./prisma/os-userinfo.mjs node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/lease-builder tests/lease-create` before archiving baseline | 40 passed; 3 database tests initially skipped. Includes existing date, rent, template, workflow/focus/failure tests and 5 light-step tests.                                                                                                                   |
| `RUN_DB_INTEGRATION=1`, task DATABASE_URL, Vitest `--exclude '**/.runtime-db/**' tests/lease-create/drafts.test.ts`                                                    | All 3 persistence/activation tests passed against the isolated fixture. The first integration attempt discovered archived duplicate tests and collided; excluding the archive fixed discovery, and its final location under node_modules prevents recurrence. |
| `node node_modules/typescript/bin/tsc --noEmit`                                                                                                                        | Passed, including a final check after archive isolation.                                                                                                                                                                                                      |
| ESLint on `steps.tsx`, the light-step test and `runtime-server.mjs`, `--max-warnings=0`                                                                                | Passed.                                                                                                                                                                                                                                                       |
| Prettier on changed TSX/CSS/MJS and this document; `git diff --check`                                                                                                  | Passed.                                                                                                                                                                                                                                                       |
| `node --import ./prisma/os-userinfo.mjs node_modules/next/dist/bin/next build` in candidate and exact baseline snapshot                                                | Both passed compilation, build lint/type validation, page generation and tracing. Next warned that the root lockfile influenced tracing-root inference; dependencies/client/builds were task-local.                                                           |

### Configured production-browser observations

These are automated observations in the configured Playwright MCP Chromium profile, not native Edge acceptance. All interactions used the production runtime above.

| Flow                                 | Observed result                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create / Term → Rent → Tenants       | Passed through real server actions and persisted draft saves. No step order or later step body was changed.                                                                                                                                                                                                                   |
| All end modes                        | Full-year `2035-01-15` → `2036-01-14`; month-to-month first period → `2035-01-31`; month/custom modes also saved through Next. A custom `2035-10-20` survived switching modes and changing start date.                                                                                                                        |
| Custom-date validation               | Earlier end date set `aria-invalid`, the described error existed and was visible, and the alert summary received focus. Input values remained present.                                                                                                                                                                        |
| Rent / fees                          | Invalid rent, malformed deposit, zero move-in/pet amounts, malformed late fee and out-of-range grace produced invalid controls and associated errors. Amount clicks did not toggle checkboxes; turning a fee off hid its field, and turning it back on restored its value. All four enabled fee fields were visibly labelled. |
| Real preview arithmetic              | Rent 1600, January 15 start, due day 5: 21/31 days = 1083.87; deposit 1600 + fees 150/250 gave 3083.87 at move-in. Unchecking proration changed that total to 2000.00. The preview-only disclosure was present. Zero deposit was subsequently saved successfully.                                                             |
| Pending controls                     | Held one POST, observed disabled fields, Back, Save and exit and visited-step buttons; released it, reached Tenants and observed focus on `step-title`.                                                                                                                                                                       |
| Failure / retry                      | Aborted a save POST: focused error alert, stayed on the same step, retained edited fee 151. A separate single-session failure/retry check retained rent 1701 and successfully saved/exited on retry. Expected failed-request console errors came from this injection.                                                         |
| Save / exit / resume / visited steps | Saved to `/leases?tab=drafts`; unit entry redirected to draft `cmvfxc0h40001b9go2jxb92n2` at saved Tenants step. Visited Rent and Back to Term retained rent 1600, fee 150 and start `2035-01-15`. Later checks deliberately changed that fixture to custom term, zero deposit and fee 151.                                   |
| Keyboard                             | ArrowDown from Full year selected Month-to-month. Back/Next and visited-step actions retained context; successful Next focused the new heading.                                                                                                                                                                               |
| Renewal                              | Synthetic source `seed-lease-maple-1` ends `2026-12-31`; default renewal began `2027-01-01`. A start on the old end date produced the server's renewal-boundary error, then the corrected date advanced through Rent to Tenants with one carried tenant. Due-day start had no proration checkbox.                             |
| 390px rendering                      | Four enabled fee fields measured 16px text, 45.33px height, 246px width, right edge 325.33px inside 390px viewport. Late-fee fields stack after the two fee cards; footer/disclosure remain reachable without overlap.                                                                                                        |

The configured MCP session was lost intermittently (`MCP_SESSION_NOT_FOUND`), including during an initial delayed-route check. Those partial attempts were not treated as complete passes. Reauthentication and shorter single-session checks completed the flows above; the pending check held/released a request directly, and the failure/retry check completed in one call. No native Edge profile was acquired.

## Rendered evidence

Images are actual production-browser captures in `.playwright-mcp/`, not design specimens. The builder scrolls internally, so the viewport captures intentionally cover top, fields and lower actions separately.

| Screen / state      | Before                              | Corrected candidate                                                                                                                                                |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Term desktop        | `builder-baseline-term-desktop.png` | `builder-candidate-term-desktop.png`, `builder-candidate-term-desktop-top.png`                                                                                     |
| Term 390px          | `builder-baseline-term-phone.png`   | `builder-candidate-term-phone.png`, `builder-candidate-term-phone-top.png`, `builder-candidate-term-phone-lower.png`                                               |
| Rent desktop        | `builder-baseline-rent-desktop.png` | `builder-candidate-rent-desktop.png`, `builder-candidate-rent-desktop-top.png`                                                                                     |
| Rent 390px          | `builder-baseline-rent-phone.png`   | `builder-candidate-rent-phone.png`, `builder-candidate-rent-phone-top.png`, `builder-candidate-rent-phone-late-fee.png`, `builder-candidate-rent-phone-footer.png` |
| Supporting behavior | —                                   | `builder-candidate-pending.png`, `builder-candidate-save-failure.png`, `builder-candidate-renewal-boundary.png`                                                    |

Inspected candidate term, rent fee and lower-phone captures: readable labels/controls, ordered fee fields, scrollable step list, reachable footer and preview disclosure; no observed field/action overlap. Baseline fee capture shows the previously unlabelled compact amount inputs corrected by this change.

## Guarded runtime handoff and completed native review

From the assigned checkout, in the manager's normal Windows user context:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/light-lease-builder-runtime.ps1 -Action start -Variant candidate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/light-lease-builder-runtime.ps1 -Action status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/light-lease-builder-runtime.ps1 -Action stop
```

Start launches hidden processes, reads the preserved fixture/build mapping, and refuses occupied app ports or an unknown database owner. Status/stop verify the checkout, build ID, process command line, listener PIDs, postmaster data-directory/port and HTTP identity before reuse/shutdown. There is no reseed, port substitution or port-based killing. Start while already running was observed to refuse; status, guarded stop, baseline restart, and candidate restart passed. The original automated-verification session left the candidate ready on 3308; see **Current manager-review runtime** above for the superseding current state. `.runtime-db/builds.json` records the preserved source/build mappings; `.runtime-db/runtime.json` records the last launched process identity; `final-review-release.json` records its stopped state. Rebuilds require a new mapping. Use `-Variant baseline` only after stopping the candidate; both variants intentionally use the same app port.

The manager-coordinated native Edge recheck is **finished**. The observed passes above cover fresh Rent and fresh Tenants exit, the previously stuck resumed Rent exit, saved-step/value retention, native validation correction/retry, phone Term/Rent/footer clearance, and renewal boundary/carry-over/exit. Earlier native keyboard, custom-date and fee observations are retained for unchanged code. The runtime was explicitly released and release proof is recorded above. The final candidate is submitted through the recorded **managerReview** policy; observed native checks do not imply an independent merge or a separate formal acceptance action by this task owner.

Native network fault injection was not exposed by the manager browser interface and was not performed. The nine automated production runs, including aborted-save retry and pending controls, remain separate evidence. No further native review or human approval is required unless finalization exposes a new material issue.

Synthetic manager sign-in uses the repository seed account and demo password from `prisma/seed.ts`. Start at `/leases/new?unit=seed-unit-maple-7&fresh=1` for a clean form or omit `fresh=1` to resume. No push, deployment or independent merge was performed. Root main was observed at `adcf39baaeae761058ed25b452d237a45488f567`; ancestry confirmed it contains the earlier `69c4bf7` candidate. That integration history remains separate from acceptance of this corrected submission.

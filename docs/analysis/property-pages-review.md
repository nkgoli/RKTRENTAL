# Dedicated property pages and automatic ROI — review correction

“Collect optional ROI details and calculate from saved properties” now includes
full Add/Edit pages, removable financial details, and calculations that require
only applicable financing and cost assumptions. The admitted review corrections
are complete. This report identifies a submitted Git candidate and self-checks;
it does not claim integration, publication, push or acceptance.

## Changes

- `/properties/new` and `/properties/[id]/edit` combine basic details and clearly
  optional financial groups in the existing light shell. Edit prefills current
  values, validation retains drafts and focuses the invalid control, and Save
  returns to the overview. Cancel and Back use ordinary document navigation and
  write nothing. Directory create links use the new page; legacy `?add=1` links
  redirect there while retaining directory filters.
- The Property details **Edit** link now opens the same dedicated editor. Unit
  editing remains inline. No maintenance-subtree file was changed.
- A new blank financial field is omitted; erasing a saved value sends an explicit
  allowlisted `cleared` marker. The row-locked patch removes that leaf, nulls
  canonical price/debt when selected, and preserves unrelated concurrent changes.
  Explicit zero stays zero. Cleared rent remains unknown in new ROI drafts even
  if a lease schedule exists. Saved analysis snapshots keep their own inputs.
- Explicit loan amount 0, or 100% down payment without a loan override, means no
  debt. Loan-only fields may remain absent, no loan payments or lender costs are
  charged, and irrelevant loan warnings are omitted. Previously supplied loan
  terms remain stored. Both property and ROI cash controls set only loan amount 0.
- Fixed annual maintenance, capital reserves and management override their
  percentages, including fixed zero. Calculation requires either basis, not both.
  Removing both produces actionable field guidance and immediately removes stale
  results. Other genuinely unknown assumptions remain missing.
- The public facade and core pipeline share conditional validation. Partial
  property persistence stays valid; automatic calculations, READY saves and
  reload use the same sufficiency rules. No financial defaults are invented.

The additional shared component and six engine files were admitted by the Agent
before editing. The earlier ownership blocker is resolved.

## Actual browser flows

Configured Orchestra Playwright drove the real production Next application and
isolated PostgreSQL database. Properties were created through the Add page,
not database inserts. Desktop was 1440 × 1000; phone was 390 × 844. The forms,
summary and selector implement the cited light-portfolio and analysis screens.
Full-page captures retain sticky controls at the captured scroll position;
viewport captures show the final phone actions at their actual size.

| Flow                                 | Observed result                                                                                                                                                                                                                                                                                                                 | Screenshots                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No ROI data                          | PASS: Add accepted all financial fields blank; Edit saved year built; unknown inputs and DRAFT revision 1 survived reload. Reselection after the engine change still showed unavailable results and blank price/rent.                                                                                                           | [Add desktop](evidence/pages-add-none-final-desktop.png), [Add phone](evidence/pages-add-none-final-phone.png), [current ROI phone](evidence/pages-engine-none-phone.png)                                                          |
| Partial inputs and prefill           | PASS: Add accepted price 250000, loan 0, rate 5.5, rent 0, other income 0 and insurance 500. Edit prefilled the supplied values.                                                                                                                                                                                                | [Add phone](evidence/pages-add-partial-complete-phone.png), [Edit prefill desktop](evidence/pages-edit-partial-prefill-final-desktop.png)                                                                                          |
| Explicit clear versus zero           | PASS: erased price, debt, rent and insurance, including saved zeros. Edit reload and a fresh ROI draft showed blanks; other income 0 and rate 5.5 survived. Canonical price/debt were null. A later basic-only edit retained the clears.                                                                                        | [Clear phone](evidence/pages-edit-explicit-clears-phone.png), [Edit reload](evidence/pages-edit-final-desktop.png), [current ROI phone](evidence/pages-engine-partial-phone.png)                                                   |
| Sufficient financed property         | PASS: Add accepted full explicit financed inputs. Its overview link selected the property in ROI, which calculated annual cash flow $6,935 automatically. READY revision 1 survived reload.                                                                                                                                     | [Add desktop](evidence/pages-add-financed-final-desktop.png), [automatic ROI](evidence/pages-financed-roi-desktop.png)                                                                                                             |
| Saved overrides                      | PASS: saved analysis rent 0 at READY revision 2; property editing changed source rent to 1400 and cleared source insurance. Reload and selection retained saved analysis rent 0 and insurance 0, with annual cash flow -$5,065, including after the engine correction.                                                          | [Source edit phone](evidence/pages-edit-financed-clear-zero-phone.png), [current financed ROI desktop](evidence/pages-engine-financed-regression-desktop.png)                                                                      |
| Cash without loan terms              | PASS: the previously blocked cash property immediately calculated $10,800 and saved/resumed READY revision 1 with loan 0 and all unused loan terms/percentages absent.                                                                                                                                                          | [Resolved cash desktop](evidence/pages-cash-resolved-desktop.png), [resolved cash phone](evidence/pages-cash-resolved-phone.png)                                                                                                   |
| Fresh cash Add → Edit → ROI          | PASS: new cash property supplied only loan 0, fixed costs 0 and other applicable inputs. Keyboard activation of the shared Edit link opened the full page with correct prefill. Changing fixed maintenance to 400 yielded automatic annual cash flow $10,400; READY revision 1 reloaded with percentage/loan terms still blank. | [Add desktop](evidence/pages-cash-new-add-desktop.png), [Add phone](evidence/pages-cash-new-add-phone.png), [prefill phone](evidence/pages-cash-edit-prefill-phone.png), [automatic ROI](evidence/pages-cash-new-auto-desktop.png) |
| Applicable basis guidance            | PASS: clearing maintenance 400 when its percentage was blank removed the old result. Keyboard Enter on the missing-input link focused the percentage. Entering explicit 0 restored $10,800 and saved/reloaded READY revision 2 without restoring the fixed amount.                                                              | [Missing basis phone](evidence/pages-cash-missing-basis-phone.png), [saved zero basis phone](evidence/pages-cash-basis-zero-resumed-phone.png)                                                                                     |
| Final ROI cash control               | PASS: entering a nonzero loan required applicable loan details and removed the cash result. Keyboard activation of **Pay in cash · No loan** restored the result and set only loan 0. Down payment, rate, term, type, points and fees stayed blank. READY revision 3 resumed at $10,800.                                        | [Final ROI desktop](evidence/pages-cash-final-roi-desktop.png), [final ROI phone](evidence/pages-cash-final-roi-phone.png)                                                                                                         |
| Dedicated editor and unit regression | PASS: the final shared property Edit link opens the combined form. Property source maintenance remains 400 while the saved ROI override uses percentage 0. Unit Edit/Cancel still runs inline, without navigation or writes.                                                                                                    | [Edit desktop](evidence/pages-edit-approved-desktop.png), [Edit phone actions](evidence/pages-edit-approved-phone.png), [unit editor phone](evidence/pages-unit-edit-unchanged-phone.png)                                          |
| Validation correction                | PASS: an invalid interest-rate draft retained its text and other values; validation focused the rate field. Correcting it to 5 allowed the financed creation and return navigation.                                                                                                                                             | [Validation phone](evidence/pages-validation-corrected-phone.png), [corrected financed form](evidence/pages-add-financed-final-desktop.png)                                                                                        |

Edit Cancel discarded proposed maintenance 900; reopening still showed 400.
Earlier admitted-page checks also verified insurance Cancel, Add Cancel with zero
database rows created, preserved directory filters, Save/Cancel keyboard order,
and Enter on the missing-price link. Switching financed → no-data → cleared
partial → cash preserved each property's inputs and results. No horizontal
page overflow was found at 390px; final ROI client/scroll widths were both 375px
(the remaining width is the browser scrollbar).

Axe WCAG 2 A/AA and 2.1 AA found zero violations in the expanded Edit main region
(16 passing rules) and final ROI main region (22 passing rules), alongside the
keyboard checks above. This is scoped automated coverage, not a full audit.

Read-only database inspection confirmed the fresh cash property's canonical loan
is 0 and its stored financing JSON contains no loan terms. Its property fixed
maintenance stays 400. Saved analysis financing contains only loanAmount 0;
maintenance is absent and maintenancePercent is explicit 0. Saved snapshots and
property source values therefore remain independent.

## Automated verification

- PASS: 102 tests in eight affected engine, contract, workspace, form and
  navigation suites:
  `node node_modules/vitest/vitest.mjs run tests/roi/engine.test.ts tests/roi/maple-court.test.ts tests/analysis/applicable-assumptions.test.ts tests/analysis/contract.test.ts tests/analysis/workspace.test.tsx tests/properties/facts-navigation.test.tsx tests/properties/roi-form.test.tsx tests/properties/roi-clears.test.ts`.
  Covers independent cash budgets, absent loan terms, fixed zero/nonzero and
  percentage bases, financed transitions, saved loan assumptions, unknown data,
  scenario validation and unchanged unit editing.
- PASS: final cash-control change reran `tests/analysis/workspace.test.tsx`: all
  36 tests passed, including the additional saved-financing-preservation case.
- PASS: 41 actual database/contract tests in three suites with
  `ANALYSIS_TEST_PORT=55582` and
  `node --import ./prisma/os-userinfo.mjs tests/analysis/property-inputs-runtime.mjs`.
  Includes READY no-loan/fixed-cost save/resume and missing-basis rejection,
  canonical clears, active-lease fallback suppression, concurrent unrelated edits,
  zeros and unchanged snapshots. Isolated data remains at
  `.data/analysis-postgres-76013196-be2c-4ba1-bc70-4a113f3056f3`; server released.
- PASS: explicit TypeScript and scoped ESLint for changed source/tests; final
  `npm run build` at `f67ec4934b53b6c19f116fe21f5deebed826df35`, including both
  dedicated routes, production lint and TypeScript. Final whitespace check passed.
- Retained prior passing evidence where unchanged: 85 component/action/property
  tests, 40 database/contract tests and the dedicated-page checks in this report.
  Counts describe runs and are not a count of distinct tests across all runs.
- The legacy fixed-port Playwright specifications were updated and type/lint
  checked. Their separate fixture was not started; the actual configured-browser
  flows above exercised the corrected pages. The whole project suite was not run.

## Source and runtime identity

Accepted data dependency `24666be9bd2accded567aacd10a6c5a686ab3bf7` is an ancestor.
The review-start candidate was `fa3e82fd2717047ff03d034599a23c67998ad724`.
Dedicated pages/clears and return navigation were completed through
`a1b4f785c7c16dbe0fb839bdacbb056462fdac26`; their prior evidence was committed at
`7f77a5a85f36b52f0ba5e2c4e1223e3be2baf00a`.

Conditional engine rules, shared Edit routing and the fresh cash flow were tested
at `682ef5dbc47870e3377006f686d1ea4ef67d9954`. The final cash-control correction,
production build, final ROI screenshots and editor viewport captures use
`f67ec4934b53b6c19f116fe21f5deebed826df35`. The final handoff commit changes only
evidence/documentation after that application source.

Synthetic runtime: `property_flow`, PostgreSQL 55581, application 3181,
browser host `127.0.0.81`. Exact checkout, branch, process IDs and timestamps are
in [the final receipt](property-flow-runtime.json). Earlier phase identities and
release evidence are preserved in [engine-flow receipt](property-pages-runtime-applicable.json),
[return-links receipt](property-pages-runtime-return-links.json) and phase1–4/smoke
receipts. All owned phases, the separate test database server, browser tabs and
desktop ownership were released. Data and dependencies remain on disk.

| Synthetic property      | Identifier                  |
| ----------------------- | --------------------------- |
| No ROI final            | `cmvgdczsk0008b95kxrvyj62k` |
| Partial final           | `cmvgddon6000eb95kurfaamcg` |
| Financed final          | `cmvgdaosj0001b95kvwnvzgtf` |
| Previously blocked cash | `cmvgdgcce000ib95kkz9il277` |
| Fresh approved cash     | `cmvgekjk20003b92gbwv57nho` |

## Limitations

One unchanged directory-card client navigation stalled during the extra unit
regression check; navigating its observed href loaded the property and unit,
where inline Edit/Cancel passed. Intermittent directory navigation was already
noted in the retained baseline review fixture. The corrected dedicated Add/Edit,
Save/Cancel, shared Edit and ROI selector flows passed as described above.

Build output still reports existing multiple-lockfile and Prisma-config
warnings. No live account population, main-branch integration, deployment or push
is claimed. The original Cedar Row reproduction is retained in the
[historical report](property-roi-ux.md). Its dialog/inline-editor and fabricated-term
cash screenshots are historical only. Intermediate cash ROI captures at the
engine commit show the earlier cash-control wording; the final ROI screenshots
linked above supersede that wording and control.

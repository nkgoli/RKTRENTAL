# Dedicated property pages and explicit clears — review correction

The admitted page and persistence corrections are implemented and committed.
**This is an incomplete candidate, not a completion submission.** Two review
requirements need files outside the current ownership boundary. A typed scope
question was sent before any such edit; no outside-scope files were changed.
The independently owned `properties/[id]/maintenance` subtree was not changed.

## Implemented changes

- `/properties/new` and `/properties/[id]/edit` provide full-width, combined basic
  and optional financial forms. Edit prefills the current property. The dialog
  and inline ROI-only editor are removed. Directory create links use the new
  route; legacy `?add=1` links, including those in the shell/dashboard, redirect
  there and retain directory filters for Cancel.
- Save returns to the property overview. Validation preserves typed drafts and
  focuses the invalid control. Successful actions return a server-generated
  destination and the client navigates immediately after the response. This
  fixes the observed production action-transition stall. Dedicated Cancel and
  Back links use normal document navigation and perform no mutation.
- Edit submits changed basics and financial leaves only. A blank new field
  remains omitted; erasing a previously saved field creates an explicit
  `cleared` marker. The row-locked transaction deletes that financial leaf,
  nulls canonical price/debt when selected, and preserves sibling/concurrent
  changes. Zero remains a value. Cleared rent suppresses lease fallback for new
  ROI drafts. Re-entering a value removes its marker.
- Saved ROI analysis snapshots retain precedence and are never changed by
  property edits. The previously passing automatic-calculation and navigation
  guards remain intact. The overview ROI link now uses the correct `property`
  query parameter.

## Remaining scope decision

Admit these exact files to finish the remaining review requirements:

1. `src/components/workspace/InlineFacts.tsx` — its Property details **Edit**
   button still opens the old basic inline editor. Replace only the property
   control with the dedicated edit route; leave unit editing unchanged.
2. `src/lib/roi/index.ts`
3. `src/lib/roi/core/domain/schemas/deal-input.schema.ts`
4. `src/lib/roi/core/calculations/metrics/returns.ts`
5. `src/lib/roi/core/calculations/metrics/noi.ts`
6. `src/lib/roi/core/calculations/projections/amortization.ts`
7. `src/lib/roi/core/pipeline/warnings.ts`

The last six paths are needed for conditional no-debt/fixed-cost validation,
optional loan/cost-basis types, no-debt calculations and applicable warnings.
The public facade currently requires all loan fields and all expense
percentages; the core schema has loan defaults. Do not bypass that contract in
the UI or fill in a fictitious loan. The staged cash guidance must not be
released as completed functionality before these engine changes and focused
no-loan/override tests pass.

## Actual browser results

Configured Orchestra Playwright drove the real production Next application,
server actions and isolated PostgreSQL database. The synthetic properties below
were created through Add Property; no mocks or database writes created them.
Desktop was 1440 × 1000; phone was 390 × 844. Full-page screenshots preserve
sticky elements at the browser's captured scroll position.

| Flow                                             | Result                                                                                                                                                                                                                                                                                                        | Evidence                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No ROI data                                      | PASS: created a single-unit home with all ROI fields blank; Edit saved year built; ROI price/rent remained unknown; DRAFT revision 1 survived reload.                                                                                                                                                         | [Add desktop](evidence/pages-add-none-final-desktop.png), [Add phone](evidence/pages-add-none-final-phone.png), [ROI](evidence/pages-none-roi-final-desktop.png)                                                                                                                                 |
| Valid partial data                               | PASS: created a two-unit property with price 250000, loan 0, rate 5.5, rent 0, other income 0 and insurance 500. Edit prefilled all supplied values.                                                                                                                                                          | [Add phone](evidence/pages-add-partial-complete-phone.png), [Edit prefill](evidence/pages-edit-partial-prefill-final-desktop.png)                                                                                                                                                                |
| Clear versus zero                                | PASS: erased price, debt, rent and insurance, including saved zeros. Reloaded Edit and a fresh ROI draft showed all four blank; other income 0 and rate 5.5 survived. Canonical price/debt were null in the database. A later basic-only year-built edit retained the clears.                                 | [Explicit clears](evidence/pages-edit-explicit-clears-phone.png), [Edit desktop](evidence/pages-edit-final-desktop.png), [Edit phone](evidence/pages-edit-final-phone.png), [ROI desktop](evidence/pages-cleared-roi-final-desktop.png), [ROI phone](evidence/pages-cleared-roi-final-phone.png) |
| Sufficient financed data                         | PASS: created a three-unit property with full explicit assumptions; overview link selected it directly in ROI; automatic annual cash flow displayed $6,935 without Recalculate. READY revision 1 survived reload.                                                                                             | [Add](evidence/pages-add-financed-final-desktop.png), [Automatic ROI](evidence/pages-financed-roi-desktop.png)                                                                                                                                                                                   |
| Saved overrides                                  | PASS: saved ROI rent 0 in READY revision 2; Edit Property then changed source rent to 1400 and cleared source insurance 0. Navigation and Reload saved analysis retained analysis rent 0 and insurance 0, with annual cash flow -$5,065.                                                                      | [Saved zero](evidence/pages-financed-saved-zero-phone.png), [Source edit](evidence/pages-edit-financed-clear-zero-phone.png)                                                                                                                                                                     |
| Cash with no loan terms and fixed cost overrides | Property save PASS; calculation BLOCKED by unchanged engine. Created loan 0, fixed maintenance/capex/management 0, and other complete assumptions, leaving loan terms and overridden percentages absent. New ROI retains those blanks and asks for nine inapplicable fields. No invented terms were supplied. | [Cash Add](evidence/pages-cash-no-loan-add-phone.png), [Exact engine blocker](evidence/pages-cash-engine-blocker-phone.png)                                                                                                                                                                      |
| Validation                                       | PASS: an invalid interest-rate draft retained its text and other entered fields; correction focused the rate input. Correcting it to 5 allowed the final financed creation and navigation.                                                                                                                    | [Phone validation state](evidence/pages-validation-corrected-phone.png), [Corrected financed form](evidence/pages-add-financed-final-desktop.png)                                                                                                                                                |

Cancel on Edit discarded insurance 750: reopening the page still showed blank.
Keyboard Enter on Cancel and Back returned to the overview. Add Cancel returned
to its filtered list; a database count for the unique cancelled property name
was zero. Save → Tab → Cancel → Shift+Tab → Enter saved the financed property.
Enter on a missing-price ROI link focused `input.purchase.purchasePrice`.
Switching financed → no-data → cleared partial retained each property's own
values and results. Form and ROI checks found no horizontal overflow at 390px.

Axe WCAG 2 A/AA and 2.1 AA: zero violations in the expanded Edit page main region
(16 passing rules) and ROI main region (25 passing rules). This is automated
coverage plus the keyboard checks above, not a comprehensive accessibility audit.

## Checks and source identity

- PASS: 85 tests in 10 scoped suites:
  `node node_modules/vitest/vitest.mjs run tests/analysis/workspace.test.tsx tests/analysis/actions.test.ts tests/properties/actions.test.ts tests/properties/roi-form.test.tsx tests/properties/pages.test.tsx tests/properties/roi-clears.test.ts tests/properties/directory.test.tsx tests/portfolio/forms.test.tsx src/lib/properties/validation.test.ts src/lib/properties/data.test.ts`
- PASS: 40 actual database/contract tests in three suites using
  `node --import ./prisma/os-userinfo.mjs tests/analysis/property-inputs-runtime.mjs`.
  Includes clears, active-lease fallback suppression, concurrent sibling/basic
  edits, canonical nulls, explicit zeros and unchanged saved analysis snapshots.
  Isolated data retained at
  `.data/analysis-postgres-701da783-0a11-48d9-9b31-d73bd6deedde`; server stopped.
- PASS: affected form/page suites rerun after the final navigation changes
  (9 tests); scoped ESLint; explicit TypeScript check earlier, and TypeScript
  plus lint in each required production build. Final `npm run build` succeeded
  at `a1b4f785c7c16dbe0fb839bdacbb056462fdac26`, including both dedicated routes.
- Legacy property Playwright specifications were updated to find the dedicated
  form and use page Cancel navigation rather than modal trapping/Escape. They
  were type/lint checked, not run against their separate fixed-port fixture;
  the configured-browser checks above exercise the changed flows.
- Accepted data dependency `24666be9bd2accded567aacd10a6c5a686ab3bf7` is an
  ancestor. Review-start candidate was `fa3e82fd2717047ff03d034599a23c67998ad724`.
  Final source is `a1b4f785c7c16dbe0fb839bdacbb056462fdac26`.
- Main successful create/calculate/override/clear browser flows ran at
  `b324c0e680234035f2ab3d4bc090139cf79cdc5f`. Final Cancel/Back, Save, form
  accessibility and reload captures ran at `a1b4f785c7c16dbe0fb839bdacbb056462fdac26`.
  Its only changes from that browser source are ordinary form return links.
  Prior interim runtime receipts retain failed navigation observations; they
  are not substituted for the final passing checks.

Synthetic database `property_flow`, PostgreSQL port 55581, application port 3181,
browser host `127.0.0.81`; source checkout and exact process identities are in
[the final runtime receipt](property-flow-runtime.json). No live account data,
publication, push or main-branch integration is claimed. The fixture database
remains on disk. All six owned runtime phases were released; verification found
no owned PIDs and no listeners on either port. Playwright and desktop ownership
were released.

Final browser property identifiers:

| Property       | ID                          |
| -------------- | --------------------------- |
| No ROI final   | `cmvgdczsk0008b95kxrvyj62k` |
| Partial final  | `cmvgddon6000eb95kurfaamcg` |
| Financed final | `cmvgdaosj0001b95kvwnvzgtf` |
| Cash no terms  | `cmvgdgcce000ib95kkz9il277` |

The original Cedar Row reproduction and unchanged automatic-calculation
regressions remain in the [historical report](property-roi-ux.md). Its earlier
dialog/inline-editor and fabricated-term cash screenshots are not acceptance
evidence for these review corrections.

# Optional property details → automatic ROI

“Collect optional ROI details and calculate from saved properties” adds optional,
grouped financial inputs to Add Property, a later ROI details editor on the property
overview, and automatic calculation in the selected property's ROI workspace.
Basic property creation still works with no financial inputs or any valid subset.

Before this change, Cedar Row at Revision 0 showed raw schema paths and section
errors such as `input.financing.pointsPaid: Required`. Add Property collected no
ROI details, and an edited analysis required Recalculate. The browser reproduced
that supplied state in the isolated seeded database before implementation.

After the change, saved source details populate a new analysis, sufficient inputs
calculate on load or edit, and incomplete/invalid inputs remove the previous
projection. Missing sections expand into labeled, keyboard-focusable fields.
The existing request token, navigation guard and saved-analysis-first precedence
remain in effect. An intentionally missing saved assumption or a saved zero is
never filled from a later property update.

The new editor submits only changed, nonblank financial fields through a
tenant-scoped transaction. It locks and patches the property row without writing
basic details, units, leases or saved analyses. Blank property edits keep saved
values. See [the accepted input contract](property-roi-inputs.md).

## Browser evidence

All rows below were exercised in the configured Orchestra Playwright browser
against the actual Next app, server actions and isolated PostgreSQL database.
No server-action mocks or direct database inserts were used for these four new
properties. Viewports included desktop and 390 × 844. The supplied light shell,
dialog styling and field grouping were retained.

| Flow                            | Observed result                                                                                                                                                                                                                                                                                                                                                                      | Screenshots                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cedar Row baseline and recovery | Revision 0 reproduced with the original raw-path errors. The same record now retains its recorded facts and presents friendly missing-field links.                                                                                                                                                                                                                                   | [Before](evidence/cedar-before-desktop.png), [after desktop](evidence/cedar-after-desktop.png), [after phone](evidence/cedar-after-phone.png)                                                          |
| No ROI details                  | Created a single-unit property with every ROI field blank; selected it in ROI; unknown price/rate/income remained blank. Saved and resumed draft revision 1. Keyboard Enter on the purchase-price guidance focused the actual input.                                                                                                                                                 | [Add](evidence/no-data-add-desktop.png), [ROI desktop](evidence/no-data-roi-desktop.png), [ROI phone](evidence/no-data-roi-phone.png)                                                                  |
| Partial inputs                  | Created a three-unit property with price $250,000 and explicit monthly rent $0. Reloaded the property, added annual insurance $200, and left the price edit blank. Price was preserved. ROI selection filled these three values without inventing loan terms; draft revision 1 survived reload.                                                                                      | [Add phone](evidence/partial-add-phone.png), [ROI desktop](evidence/partial-roi-desktop.png), [ROI phone](evidence/partial-roi-phone.png)                                                              |
| Sufficient financed inputs      | Created a three-unit property with explicit whole-property assumptions. It automatically calculated $6,935 annual cash flow without Recalculate. Saved READY revision 1 and reloaded. Then saved a rent override of $0 in revision 2, changed the property's forecast rent to $2,000, and verified the saved analysis still used $0 after both navigation and Reload saved analysis. | [Add desktop](evidence/financed-add-desktop.png), [ROI desktop](evidence/financed-roi-desktop.png), [ROI phone](evidence/financed-roi-phone.png), [saved zero](evidence/financed-saved-zero-phone.png) |
| Sufficient cash inputs          | The explicit cash choice set only loan $0 and down payment 100%; rate remained blank until entered. Completed the remaining assumptions; ROI automatically calculated $10,800. Clearing insurance removed the result; entering 0 restored it without Recalculate. READY revision 1 survived reload.                                                                                  | [Add phone](evidence/cash-add-phone.png), [ROI desktop](evidence/cash-roi-desktop.png), [ROI phone](evidence/cash-roi-phone.png)                                                                       |
| Switching and keyboard          | Changed cash rent to $1,200, used the unsaved-changes dialog, verified Shift+Tab focus containment and discarded. Switched through no-data, partial, financed and cash properties; each retained its own values/results. Cash returned to saved $1,000 rent. Optional form summaries, cash action, dialog Tab wrap and Escape were keyboard reachable.                               | [Switch back to cash](evidence/switch-back-cash-desktop.png), [optional details keyboard](evidence/optional-details-keyboard-phone.png)                                                                |

The financed and cash examples explicitly used a $100,000 price, $1,000 monthly
whole-property rent, $1,200 annual property tax and zero other required costs,
vacancy, growth and selling assumptions. Both use a one-year hold, projection
start 2026-01-31 and discount fraction 0.08. The financed property uses a $60,000
loan, 40% down, 5% interest and 30-year term; the cash property uses a $0 loan,
100% down, 0% interest and a 30-year term. Both explicitly select conventional.
Optional after-repair value, amortization override and tax modeling are absent.

The independent financed annuity check is:
`10800 - 12 × 60000 × (0.05/12) / (1 - (1 + 0.05/12)^-360)`
= $6,934.8843, displayed as $6,935. The cash budget is $12,000 − $1,200 =
$10,800. Three units did not multiply the entered whole-property rent.

No horizontal page overflow was observed at 390px in any of the four ROI flows.
Axe WCAG 2 A/AA and 2.1 AA scans reported zero violations in the expanded Add
Property dialog at 390px and the Cedar Row ROI main region at desktop width.
These are scoped automated accessibility observations, supplemented by the
keyboard and visual checks above, not a full accessibility certification.

## Automated checks

- `node node_modules/vitest/vitest.mjs run tests/analysis/workspace.test.tsx tests/properties/roi-form.test.tsx tests/properties/dialog.test.tsx tests/analysis/actions.test.ts src/lib/properties/validation.test.ts src/lib/properties/data.test.ts` — **67 passed across 6 suites**. Covers optional creation, partial/zero serialization, invalid supplied text, cash choice, later editing, automatic sufficiency transitions, saved overrides, request races, navigation, scenario/benchmark regressions and focus recovery.
- `node --import ./prisma/os-userinfo.mjs tests/analysis/property-inputs-runtime.mjs` — **39 passed across 3 suites**. Includes actual migration, property/default/saved-analysis persistence, financial-only patches, sibling patch concurrency, organization isolation and preserved canonical values. Test PostgreSQL stopped; database files remain under `.data/analysis-postgres-810f30d1-3be5-4968-9369-1185272d28eb`.
- `node node_modules/typescript/bin/tsc --noEmit` — **passed**.
- Scoped ESLint over the changed TypeScript/TSX and runtime files, with `--max-warnings=0` — **passed**.
- `git diff --check` and accepted dependency ancestry — **passed**.

The first component run exposed old expectations that invalid inputs retained
prior projections. Tests now require those results to disappear. A validation
message also changed a custom benchmark control's accessible name; explicit
stable labels fixed that regression. Final checks above passed.

## Source and runtime identity

- Accepted dependency and initial HEAD:
  `24666be9bd2accded567aacd10a6c5a686ab3bf7`.
- Implemented source commit:
  `3d9da42ce7f19d187597d807958f5eecb117c1be`.
- Fixture launcher: `tests/analysis/property-flow-runtime.mjs`.
- Bound checkout:
  `C:\Users\nkgol\RocketRental\.orchestra\workspaces\@5vofg25owpkjrwhuulg\repository`.
- Branch: `orchestra/work-2gcjdifqik3o7helc0b-52amd99m9z4htmyegcb`.
- Dedicated database `property_flow`, loopback PostgreSQL port 55581, files
  `.data/optional-property-roi/postgres`; dedicated Next development app port 3181.
  Browser origin `http://127.0.0.81:3181` isolated its authentication cookies.
- Created property IDs: no-data `cmvgbeok90001b9lk2ct61k6b`; partial
  `cmvgbghss0007b9lkjb1ncgox`; financed `cmvgbhjv5000eb9lk5dsvk0g2`; cash
  `cmvgbic7z000lb9lk9iv0o8hb`. All are synthetic records in the fixture database.
- [Runtime receipt](property-flow-runtime.json) records startup/source coordinates,
  app/fixture PIDs and the successful shutdown time.

PostgreSQL initialization failed under the restricted Windows token; the
authorized isolated run outside that token succeeded. The first browser attempts
also encountered a reset Playwright session and an exact-label selector that
included select option text. Reconnected and signed in to the same fixture, then
used its observed combobox role/name; all recorded flows completed.

The exec tool closed the launcher's stdin, so sending `q` was unavailable.
The app's PID, command and parent fixture PID were verified before stopping its
owned tree. The fixture's exit handler then stopped PostgreSQL and wrote
`released: true` at 2026-10-20T06:50:03.600Z. No application, parent fixture or
PostgreSQL process remained in the subsequent process check.

## Limits

Property input clearing is intentionally outside the accepted patch contract:
blank means no change; explicit zero is a stored value. Cash still requires the
engine's explicit loan rate, term/type and fees, although a zero loan produces no
debt service. No values were invented to satisfy the engine. Saved analyses
remain independent snapshots; later property edits do not overwrite them.

The full project suite, production build, live database, Preview publication,
integration and push were not part of this task's observed result.

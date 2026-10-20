# Returns & ROI: one actual-versus-projected workspace

Property returns and ROI projections now live in one workspace at `/roi-analysis`. Recorded
rent and expenses sit beside the projection for the same property, period and scope.

## Routes and navigation

| Entry                                       | Behaviour                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar **Returns & ROI** → `/roi-analysis` | Replaces the separate "ROI Analysis" and "Returns" entries. It stays current on `/returns`.                                        |
| `/roi-analysis?property=ID&view=actual`     | **Actual vs projected** tab. `period` (`MTD…5Y`, or `CUSTOM` with `from`/`to` YYYY-MM) is kept in the URL on every tab.            |
| `/properties/ID/returns[?period…]`          | Redirects to the workspace above with its period. With `?unit=` it keeps the unit-allocated report, which links to the comparison. |
| `/returns` (Portfolio returns)              | Kept for portfolio totals, the expense form and the CSV export. Property links open the property's comparison.                     |
| `/returns/export`                           | Unchanged CSV export, also linked from the comparison as "Export returns summary".                                                 |

Switching property keeps the Actual vs projected view and its period. Other tabs reset to
Summary as before. Saved analyses, scenarios, benchmarks and the unsaved-changes guard are unchanged.

## Data and labels

- Actuals come from `loadActualReturnsAction` → `actualReturnsService` (docs/returns/actual-returns.md):
  cash basis, USD, whole property. Rolling windows stop at today, so days that haven't happened
  aren't reported as gaps.
- The projection is the ROI engine's Year-1 figures, scaled by the contract's own rule (whole months ÷ 12, otherwise days ÷ 365), and
  is always labelled "Projected". With incomplete assumptions it shows "No projection".
- A difference is shown only when the actual is complete. Partial actuals show their value and
  the reason. Unavailable actuals show "Not recorded", never $0.
- Scheduled billed rent, scheduled debt service and annualized NOI appear only under
  "Scheduled and estimated".
- "Needed to complete this comparison" links to the place to supply each input: assumptions,
  lease, payments, expense form or property financing.
- Logic: `src/lib/analysis/actuals.ts`. UI: `src/components/analysis/RoiActuals.tsx`.

## Verification (isolated runtime, not the user's app)

`tests/analysis/combined-review-runtime.mjs` was run against a build of this checkout:
embedded PostgreSQL on 55568, app on 3168, seed data plus one labelled `TEST No Records` property.

- Maple Court YTD: $214,000 recorded rent from 110 settled payments and $80,000 expenses from
  60 rows. Both match direct database sums. Expense coverage is partial (records start 2026-01-15).
- Harbor (no ROI inputs): actuals shown, projection "No projection", 19 assumptions requested.
  A saved rent of 41000 survived reload.
- TEST No Records: every line is "Not recorded", with lease, expense and financing steps.
- At 390px nothing overflows horizontally; rows stack.

Screenshots: `merged-maple-actual-ytd-desktop.png`, `merged-harbor-switch-no-projection.png`,
`merged-no-data-desktop.png`, `merged-maple-actual-390.png`, `merged-summary-card-390.png`.

The user's app on localhost:3100 still runs the earlier build. It was not rebuilt or restarted
here. The data-population task it depends on (TASK-839819CD, commit 32d2da6) was still
verifying and is not in this branch.

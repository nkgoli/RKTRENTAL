# Returns & ROI: one actual-versus-projected workspace

Property returns and ROI projections now live in one workspace at `/roi-analysis`. Recorded
rent and expenses sit beside the projection for the same property, period and scope.

## Routes and navigation

| Entry                                       | Behaviour                                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar **Returns & ROI** → `/roi-analysis` | Replaces the separate "ROI Analysis" and "Returns" entries. It stays current on `/returns`.                                             |
| `/roi-analysis?property=ID&view=actual`     | **Actual vs projected** tab. `period` (`MTD…5Y`, or `CUSTOM` with `from`/`to` YYYY-MM) is kept in the URL on every tab.                 |
| `/properties/ID/returns[?period…]`          | Redirects to the workspace above with its period. With `?unit=` it keeps the unit-allocated report, which links to the comparison.      |
| `/returns` (Portfolio returns)              | Kept for portfolio totals, the expense form and the CSV export. Property links open the property's comparison.                          |
| `/returns/export`                           | Portfolio CSV export. Estimate columns are labelled (scheduled debt, assumed appreciation, scheduled rent). Not used by the comparison. |

Switching property keeps the Actual vs projected view and its period by writing them into the
new property's URL. Other tabs reset to Summary as before. Browser Back/Forward restore view and
period from the complete address: a plain `?property=ID` means Summary and the default 12M
period, whatever was showing before. If unsaved changes block a Back to another property, the
target's view and period are applied only once you continue. Saved analyses, scenarios,
benchmarks and the unsaved-changes guard are unchanged.

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
- Coverage only counts evidenced days (lease months with a rent charge; months with a recorded
  expense). Gaps, undated receipts and old-only history show as partial or unavailable, never as
  complete or $0.
- **Export this comparison (CSV)** builds the file in the browser from the same contract and
  comparison the table renders: property name and ID, the exact inclusive days, as-of time,
  projection basis (saved revision, saved property details or unsaved edits), each row's actual
  and projected status and amount, coverage and the separately labelled scheduled/estimated
  figures. Unavailable values are blank with their status, never 0.
- **Portfolio returns (estimates)** links to `/returns` for the same property and period. That
  page now states that its cash flow, cash-on-cash, ROI and yield use scheduled debt, 3%/yr
  assumed appreciation and scheduled rent, and keeps the expense form and its CSV.
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

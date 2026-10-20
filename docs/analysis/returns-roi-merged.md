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

## Live verification on localhost:3100 (2026-10-20)

The user's app at `http://localhost:3100` now serves this code. It was started the same way as
before (`scripts/start.ps1 -Port 3100 -DbPort 5433` from the project root, embedded PostgreSQL
on 5433, database `rocketrental`). The old copy was stopped by ending its Next.js process, so the
launcher shut PostgreSQL down cleanly. The relaunch rebuilt the app, applied migrations
(none were pending) and skipped the demo seed ("Demo seed is up to date"). It runs in a new
minimized PowerShell window; Ctrl+C there stops the app and its database.

- Source: project `main` fast-forwarded to the submitted candidate, then the build ran from it.
  It contains the accepted actual-returns, merged UI and demo-provenance commits.
- Account: the demo manager `jordan.mills@rocketrental.example`.
- Database preserved: a snapshot taken before and after both restarts was identical. It covered
  7 properties, the 4 `seed-roi-inputs-v1` provenance sets with their timestamps, no saved
  analyses, 123 payments, 72 expenses, 133 charges and 47 leases. Nothing was reseeded.

What was checked in the browser:

- **Maple Court, YTD (Jan 1 – Oct 20, 2026)**: operating income $77,150 is complete and
  recorded. Rent records cover 293 of 293 days. Expenses are $24,000, but only Aug–Oct have
  records, so they cover 81 of 293 days and show as partial, with Jan–Jul listed as
  unverified. NOI ($53,150) is partial and has no difference. Debt service and cash flow show
  "Not recorded".
- **CSV export**: the file is `actual-vs-projected-maple-court-2026-01-01-to-2026-10-20.csv`
  (`live-final-maple-ytd-comparison.csv`). It reconciles to direct database sums: 40 settled
  payments total $77,150.00 and 18 expenses total $24,000.00, in months 2026-08 to 2026-10.
  Partial and unavailable cells keep their status, and unavailable cells are blank.
- **Demo provenance**: the Summary tab says 28 assumptions are fictional demo values
  (`seed-roi-inputs-v1`), and each field is labelled. A property with no records shows no demo
  notice.
- **History and URLs**: these were all restored correctly:
  - switching Maple (actual, YTD) to Harbor kept the actual view and YTD;
  - Back and Forward each restored their property, view and period;
  - Back to a plain `?property=seed-property-harbor` entry returned to Summary and 12M;
  - a custom Feb–Apr 2026 address survived reload, Back and Forward.

  The legacy link `/properties/seed-property-maple/returns?period=YTD` opens the actual view for
  YTD.

- **No data** (`TEST No-ROI Verification (fictional)`): every line is "Not recorded". The page
  lists steps to add assumptions, a lease, an expense and financing.
- **Portfolio returns**: the page states which figures are estimates. Its column headers and
  CSV headers label scheduled debt, assumed appreciation and scheduled rent. "+ Add expense"
  is still there.
- At 390px nothing overflows horizontally.

Screenshots: `live-final-maple-actual-ytd-desktop.png`, `live-final-maple-summary-demo-desktop.png`,
`live-final-harbor-switch-actual-ytd.png`, `live-final-no-data-desktop.png`,
`live-final-portfolio-estimates-desktop.png`, `live-final-maple-actual-390.png`,
`live-final-maple-summary-390.png`. The older `merged-*.png` captures came from an isolated
runtime before this change.

Temporary resources were removed: the throwaway PostgreSQL used for the database tests, the
snapshot scripts and the worktree build output.

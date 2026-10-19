# ROI projection views and extension contract

The selected property's ROI workspace now has Summary and Charts, with six functioning projection panels. This implements Designs/rocketrental-analysis revision 36, screens roi-projections and analysis-phone, using the existing compact manager shell and scoped design variables. Design numbers are illustrations; the application only renders authorized saved/entered assumptions and public calculation results.

## Route, state and panel boundary

The route remains `/roi-analysis?property=<authorized property id>`. A bare route opens selection; foreign, archived and unavailable IDs do not fall back to another property. Tab selection is local UI state, not a URL parameter or persisted analysis field. Accepted property/history changes reset to Summary/Cash Flow and invalidate prior requests/results. Browser guards and server action authorization remain owned by `RoiWorkspace` and the existing actions.

`RoiWorkspace` retains the single state owner for entered strings, payload, dirty/stale flags, revision conflicts, facts and request tokens. Both top-level panels remain mounted behind `hidden`, so navigation does not erase invalid text or draft assumptions. The component-local `[hidden]` rule also hides grid panels. The tabs support Left/Right, Home/End and normal Tab focus; selection uses `aria-selected`, roving tab indices and associated tabpanel IDs.

| Interface                                    | Meaning                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `result: ProjectionResult \| null`           | The last successfully calculated public base result.                                                                                    |
| `calculatedPayload: AnalysisPayload \| null` | The exact successful input snapshot belonging to that result, never the current partially edited strings.                               |
| `calculationVersion: number`                 | Increments on successful installation/recalculation; remounts probe controls and loan-year selection against the fresh base.            |
| `stale: boolean`                             | Prior base outputs are explicitly out of date. Temporary outputs are hidden and probe controls disabled until successful recalculation. |
| `saving: boolean`                            | Disables probe submission while a save is pending; existing save/property guards remain in force.                                       |
| `onEdit(path?: string)`                      | Opens Summary, expands the relevant assumption disclosure and focuses its input; an unspecified/global error focuses purchase price.    |

`RoiProjections` is keyed by selected property and retains its selected panel across ordinary tab changes and successful recalculation/save/reload within that property. Temporary controls reset on a new `calculationVersion`; they are intentionally not saved. A property reset cannot reuse another property's probes. Failed calculation installation exposes missing-field or overflow errors with a correction path; no-result panels still have working navigation and Review assumptions.

`AnalysisTabs` is exported for subsequent panels. Its props are `id`, `label`, `choices: readonly { id, label }[]`, `value`, and `onChange`. The current ID roots are `roi-section` (summary/charts) and `roi-chart`. Each choice uses `<root>-tab-<choice>` and `<root>-panel-<choice>`. `projectionPanels` exports these stable IDs:

| ID             | Visible label | Data and meaning                                                                                                                                                                  |
| -------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cash-flow`    | Cash Flow     | Annual/cumulative public `annualCashflows`, income bridge, initial cash, cash-only recovery and payback. Sale proceeds excluded.                                                  |
| `equity`       | Equity        | Year-end `equityTimeline`: property value, debt, purchase equity, principal and appreciation/repair value change. Equity plus operating cash is explicitly before sale costs/tax. |
| `expenses`     | Expenses      | Public year-one category breakdown and annual expense/reserve schedules. Zero categories remain visible; reserves are below NOI.                                                  |
| `amortization` | Amortization  | Full public monthly loan schedule grouped by year, with a selectable monthly year. Includes years beyond the hold, actual final maturity payment and all-cash/no-loan state.      |
| `exit`         | Exit          | Public recalculation at each exit horizon: gross sale, costs, payoff, net proceeds, cash returned, initial cash, profit, ROI and IRR.                                             |
| `sensitivity`  | Sensitivity   | Public recalculation for each editable rent/vacancy cell; Year 1 cash-on-cash or hold-period leveraged IRR.                                                                       |

Future scenario/benchmark builders should add their own functioning panels against this state contract. Preserve the saved scenarios, benchmarks, source evidence and engine/version identity. Do not write calculated snapshots back over lossless entered strings or clear stale flags merely because a panel is selected.

## Numerical and interaction behavior

`src/lib/analysis/projections.ts` imports only the public analysis contract. It consumes public engine output; no internal engine modules or copied forecast formulas are used. Annual reserve presentation reconciles `NOI - debt service - cash flow`, rounded to cents, because the public annual row does not expose reserves separately. Loan-year totals sum the actual public monthly rows, preserving the engine's final balloon payment. These are output aggregation/reconciliation, not separate loan or cash-flow calculations.

Tables display USD to cents and rates to four decimal places without requiring hover. Captions, column/row headers and focusable horizontal scroll regions accompany charts. Null/non-finite display values are unavailable, not zero. Sensitivity gives the public reason or a caught calculation error for unavailable cells. Negative series share a real zero baseline; signed dollar values remain visible. Responsive SVG dimensions keep labels readable at 390px. Tables can scroll without widening the page.

Capital reserves reduce spendable cash after NOI and debt. Equity excludes selling costs. Cash-only recovery divides accumulated operating cash by initial cash; it is not profit. Exit cash returned includes net sale proceeds and accumulated operating cash, while profit also deducts initial cash. Charts/exit comparisons are before tax even when optional tax estimates are enabled in Summary. The expenses panel describes the public model's fixed-dollar precedence and growth of year-one percentage-derived expenses.

Each temporary probe clones the calculated base, validates with `PayloadSchema`, and calls `calculatePayload`. Its temporary calculation excludes unrelated scenarios/benchmarks; the saved envelope is unchanged. Controls retain invalid strings, show actionable errors, and hide previous outputs immediately on editing. A failed/overflowing base calculation has a recovery route to Summary. A failed exit comparison can be corrected and rerun; one failing sensitivity cell does not remove the rest of the grid.

- Exit year: whole years 1–50. Selling costs: 0–30 percent. Optional sale price: $0.01–$10 billion, blank for appreciated value. The explicit override applies to every compared horizon. Comparison includes selected earlier checkpoints from 5/10/15/20/25/30/40/50 plus the selected year, each publicly recalculated. Edit saved exit assumptions opens the actual base inputs; probe edits alone do not change them.
- Sensitivity: rent $0–$10 billion per month; vacancy 0–100 percent; 1–7 whole steps per dimension, at most 49 cells. Bounds must be ordered. A one-step dimension requires equal endpoints, and equal endpoints require one step. Initial exploration ranges are derived from the calculated base (rent ±10%, vacancy ±2 points within bounds); they are not property facts or saved assumptions. A base-cell outline is shown only when the selected grid actually contains the base values.

## Isolated review runtime

Runtime `roi-projections-review` uses app port **3147**, PostgreSQL port **55447**, database **roi_projections_review**, and retained data/storage under `.data/roi-projections-review`. It does not read the default application database URL or application `.env`. The dedicated launcher and explicit fixture helper are:

```powershell
node --import ./prisma/os-userinfo.mjs tests/analysis/projections-review-runtime.mjs --database-only
node --import ./prisma/os-userinfo.mjs --import tsx tests/analysis/prepare-projections-review.ts
```

Omit `--database-only` to start the production app as well after a build. The helper seeds an explicitly annotated illustrative Maple Court draft through the authorized service only if none exists; it preserves saved review analyses. Demo manager credentials are the existing demo seed's credentials. The dedicated database applied all 19 migrations and seeded 4 properties/45 units. Data remains on disk. Earlier runtimes/configuration/data were not replaced or stopped.

In this run, the database-only launcher and production app were separate processes. Only the owned app was restarted for responsive corrections. Windows initdb required the permitted execution surface after restricted-token error 87; the initial restricted attempt did not initialize a different database. The isolated app and database remain available for review.

## Candidate and self-check evidence

Corrected baseline `6025e4fb3b699017b54d032d31cd2b4d06b2a6e6` was an ancestor of initial HEAD `d7ff58237085464758f9b816b7961611987a5009`; the baseline workspace/handoff matched. The actual retained branch was `orchestra/work-2gcjdifqik3o7helc0b-3u46zragztuukp5m5yp`. Implementation commit `1ece8b47bbb5a1296e1cd311f1292770746b9307` plus responsive correction **`64fd7779415511178572d10d2a27a8e62cea0369`** contains the final tested application source. The later handoff commit and submitted screenshot artifacts change no application behavior. Screenshots remain workspace evidence under the repository's existing PNG ignore rule. No shared sidebar, engine or persistence files were changed; no integration, push or publication is claimed.

The final production build ID is **`hXgZis_zYGu1hauQuV3Eb`**, served on localhost:3147 against the isolated database. `npm.cmd run build` passed for the initial implementation. Repeating Prisma generation while the isolated review launcher held its Windows DLL returned EPERM; after the presentation-only corrections, `node node_modules/next/dist/bin/next build` passed with the unchanged generated Prisma client, including compilation, lint/type validation and all 22 routes. The final native screenshots use that final build/source.

Final checks after responsive corrections:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/analysis/contract.test.ts tests/analysis/validation.test.ts tests/analysis/projections.test.ts tests/analysis/workspace.test.tsx
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js 'src/app/(manager)/roi-analysis' src/components/analysis src/lib/analysis tests/analysis --max-warnings=0
```

All **61 tests in 4 files**, typecheck and owned-path lint passed. Changed source/test Prettier and `git diff --check` passed. The tests include adapter-to-table reconciliation, all-cash, actual balloon maturity, negative/zero cash flow, null ratios, range bounds, per-cell overflow recovery, exit horizon recalculation, unchanged probe bases, invalid strings, incomplete/overflow drafts, stale outputs, keyboard tabs, draft/ready save and reload, revision/transport failures, property/history guards and late-response invalidation. No whole-project test run was needed for this component-only change.

### Native Windows MCP observations

One bounded desktop turn was acquired with a 600-second lease and no queued waiters. Windows MCP used a temporary tab in the existing Edge session, with no new browser process or unrelated runtime modification.

- Desktop: signed into the isolated demo, entered ROI from the existing sidebar, selected Maple, and loaded draft revision 1. Keyboard Right moved through Cash Flow, Equity, Expenses, Amortization and Exit. Each real panel and its exact amounts rendered. Cash flow showed $403,720.32 accumulated cash, $906,600.00 initial cash and 44.5313% cash recovery, distinct from profit. Expense reserves appeared separately below NOI.
- Temporary exit year 5 produced $1,385,134.46 cash returned and $478,534.46 profit while the base header remained a 10-year hold. Sensitivity rent `bad-range` hid old results and showed a validation error; correcting to 21000 restored the grid. These controls did not change saved base assumptions.
- Edge Responsive emulation was set to **390 × 844**. The first observation exposed a 544px page width from grid min-content sizing. The scoped workspace width fix and SVG resize handling were rebuilt and checked again. Final read-only browser measurement returned `innerWidth=390`, `clientWidth=390`, `scrollWidth=390`. Tabs wrap, controls remain usable, and cash-flow labels are readable. Focusing the sensitivity table and pressing Right scrolled its columns while retaining visible focus and the base-cell outline.
- At phone width, Save draft reached revision 2, Save ready reached revision 3, and Reload retained ready revision 3. The final chart-label build reloaded the same ready analysis. A foreign-property URL displayed unavailable rather than Maple data; Back recovered Maple's saved analysis.
- A subsequent read-only `analysisService.loadSaved('seed-property-maple')` query against the hardcoded isolated database confirmed READY revision 3, purchase price 2,830,000, monthly rent 23,000, vacancy 5%, hold 10 years, selling costs 6% and appreciation 3%. The temporary five-year exit and sensitivity range were absent from the saved base. The query used Node with `prisma/os-userinfo.mjs` and `tsx`, and disconnected its Prisma client; no database snapshot was exported.
- Device emulation was disabled, DevTools closed and the temporary tab closed. The final native snapshot confirmed the original RealROI GitHub tab active. `release_desktop` was called and returned `released:false`; there was no remaining lease to release after the bounded turn. No desktop reacquisition or subsequent desktop operation was performed. This is an observed restore plus a non-positive release receipt, not a claim that an early manual release succeeded.

Final native PNGs, captured with Windows MCP and retained without image editing:

- [Desktop cash flow](../../tests/analysis/evidence/roi-projections-desktop.png)
- [390px cash flow](../../tests/analysis/evidence/roi-projections-phone-cash.png)
- [390px sensitivity controls and grid](../../tests/analysis/evidence/roi-projections-phone-sensitivity.png)
- [390px keyboard table scroll and width measurement](../../tests/analysis/evidence/roi-projections-phone-table.png)

Native flows did not simulate concurrent saves, transport failures, all-cash or balloon inputs; these are automated regression cases. All six panels were visited at desktop width; phone review concentrated on charts, bounded controls, table scrolling, save/reload and property authorization recovery. Named scenarios/benchmarks remain dependent work, and temporary probe preferences intentionally reset when a new base calculation is installed.

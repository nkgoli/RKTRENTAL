# What if: route and metric coverage

One shared, temporary **What if** replaces the standalone Scenarios tab in Returns & ROI.

## Where it lives

| Surface | Before | After |
| --- | --- | --- |
| Header | Edit assumptions, Save analysis, More | **What if** trigger first (shows `· N changes` while active), then the same actions |
| Panel | none (Scenarios tab: Suggested changes card, two intro cards, examples, editors) | Side panel beside the views at ≥1100px; modal bottom sheet below (focus trapped, Escape/backdrop close, focus back to the trigger) |
| Tabs | Summary · Actual vs projected · Charts · **Scenarios** · Benchmarks · Compare | Summary · Actual vs projected · Charts · Benchmarks · Compare |
| Saved cases | edited and compared on Scenarios | selected, edited, removed in What if (`Case` select); compared on **Compare** (charts, exact figures, overrides side by side) |
| Presets / suggestions | example chips, "Start from an example", Fix My Deal card | What if → Start from (Optimistic, Conservative, Best/Worst Case), Suggested changes (engine levers, DSCR/cash-flow targets) |
| Tax estimate, advanced metrics, recorded source facts | Scenarios tab → Analysis details | Summary → Analysis details |
| Rent analysis | "See the effect in Returns & ROI →" opened the property | Same link opens What if on that property, scoped to the unit: `Unit 3A at suggested rent`, rent + the unit's suggested change |

## Links

| Address | Result |
| --- | --- |
| `/roi-analysis?property=P&view=scenarios` (old links, saved return addresses) | Compare tab, scrolled to Saved cases; address rewritten to `view=compare` |
| `/roi-analysis?property=P&whatif=rent&unit=U&rentChange=N` (Rent analysis) | What if opens with the unit label and `+$N/mo`; the entry parameters are dropped from the address after loading. The rent change applies only when `U` is a unit of property `P`: a missing, malformed, deleted or other-property unit opens an empty what-if over the unchanged baseline, with "unit not found in this property, no rent change applied" in the panel and a status message. Invalid amounts are ignored, never guessed |
| Edit assumptions return path with `view=scenarios` | Returns to `view=compare` |

## Metrics beside each view (baseline → what if → signed change)

| View | Metrics in the Simulated strip | Also | Not simulated (labelled) |
| --- | --- | --- | --- |
| Summary | Cash flow/month, Cash flow Y1, NOI, Cash-on-cash, Cap rate, DSCR, Leveraged IRR | Deal Snapshot shows the change under each figure; cash-flow years and milestones use the what-if | Recorded source facts |
| Actual vs projected | Effective income, Operating expenses, NOI, Debt service, Cash flow | Projection side uses the what-if; basis reads `What if · <case> (simulated…)` | Recorded rent payments and expenses |
| Charts · Equity / Exit | Equity end of hold, IRR, Equity multiple | Baseline (dashed) vs what-if equity line | — |
| Charts · Cash Flow | Cash flow Y1, Cumulative cash flow end of hold | Baseline (dashed) vs what-if cash-flow line | — |
| Charts · Expenses / Amortization / Sensitivity | Opex & NOI / Loan & debt service / Cash-on-cash & IRR | Charts draw the what-if | Recorded expenses |
| Benchmarks / Compare | IRR, Equity multiple, Cash-on-cash (+ Cash flow on Compare) | Compare adds the temporary case as a `(not saved)` column beside saved cases | Market reference returns |

Deltas: money `+$1,234`/`−$50`, percentages in percentage points (`+0.81 pp`), ratios `+0.07×`; `No change` when the difference rounds to zero; `Unavailable` (never $0) when either side is missing. Green and red follow the favourable direction (costs and debt: lower is better).

## Calculation and data guarantees

- One engine path: `simulate()` merges overrides per group exactly like a saved case (`analyzeWithScenario`); a unit test checks identical results.
- Temporary edits do not mark the analysis unsaved and are never included in Save draft/ready. **Save as case** adds a case that inherits the baseline (only overrides stored) and is saved with Save draft/ready.
- Scope: the what-if belongs to one property; changing property (chooser, history, address) clears it, and a stale state is discarded on read.
- Reset to baseline (temporary) and Show baseline/Exit (saved case) return every view to the baseline.
- Exit and Sensitivity follow the current simulation input even while their chart tab is hidden: each edit, preset, saved-case choice, reset or exit recalculates them and drops any exit probe or custom sensitivity range run against earlier assumptions (display choices such as metric and year stay).
- While a save is in flight, the shown saved case's assumptions, name, Remove and Use base calculation options are locked ("Saving… this case can be edited again when the save finishes."), so the saved reply cannot discard an edit. A failed save keeps every entry and the Unsaved changes state. Temporary what-if fields stay editable; they are never saved.
- Invalid text (`lots`) marks the field (`Enter a number, such as 1200.`) and pauses the simulation with views on the baseline. Incomplete baselines show `Results paused until the flagged entries are corrected`.

## Verification (production build, isolated database)

`next build` + `next start` on port 3481 against an embedded Postgres on port 5481 (fresh `prisma/seed.ts` plus `load-roi-examples.ts --seed-inputs-only`). Screenshots are in `.playwright-mcp/whatif/` (local only, not committed).

- Desktop 1440px: open (focus on the panel heading); rent 23,000 → 24,000 gives cash flow −$213 → $561/mo (+$774; ×12 = +$9,288 annual row); strip on all five tabs; Compare `What if (not saved)` column; invalid input; reset; Escape closes and focus returns to the trigger; reopen by keyboard; preset → Save as case → Save draft → full reload → case reloads with its overrides; switch to Harbor View clears the what-if; legacy `view=scenarios`; Rent analysis Unit 3A (+$240) entry.
- Phone 390px: modal sheet, focus trap over 80 Tab/Shift+Tab presses, Escape and backdrop close, strips on Summary/Actual/Charts/Compare with no horizontal scroll, reset, saved case load/edit/save (focus stays in the sheet after saving), property switch clean, invalid input.
- Database after the run (isolated 5481): Maple Court baseline rent 23,000 and vacancy 5 unchanged; only the explicit case stored overrides; unit listed/market rents unchanged (3A 1,600 / 1,675).
- Live 5434 app was only viewed for the "before" captures; no ROI row was created for Maple Court.

Before captures: `before-desktop-scenarios-tab.png`, `before-desktop-summary.png`, `before-mobile-scenarios*.png` (the existing app on port 3100), plus the attached screenshot of the Cedar Row Scenarios tab.

## Review fixes: chart sync, unit scope, save lock (production build, isolated database)

`next build` + `next start` on port 3482 against an embedded Postgres on port 5482 (fresh seed plus `--seed-inputs-only`). Screenshots in `.playwright-mcp/whatif-fix/` (local only, not committed). Maple Court baseline: rent 23,000, 10-year hold.

| Step (1440px and 390px) | Exit: last horizon (net proceeds · cash returned · IRR) | Sensitivity: Base cell |
| --- | --- | --- |
| Baseline | Year 10 · $1,896,519.50 · $1,982,103.62 · 8.3826% | $23,000 · −0.3% |
| Exit probe year 3 (desktop) | Year 3 · `Showing probe` | unchanged |
| What if rent 24,000, hold 7 (made on Exit; Sensitivity hidden) | Year 7 · $1,481,469.08 · $1,583,538.44 · 8.7424%; probe cleared | $24,000 · 0.8% (strip: cash-on-cash 0.75%) |
| Rent 25,000 (desktop) | Year 7 · cash returned $1,652,349.32 · 9.6316% | $25,000 · 1.8% |
| Reset to baseline | back to the baseline row | $23,000 · −0.3% |
| Conservative preset → Exit what if (desktop) | $1,564,202.11 · 5.9093% → baseline | −1.1% → −0.3% |

- Unit entry (`rentChange=240`): `seed-unit-maple-7` → rent 23,240 and `Unit 3A +$240/mo`; `seed-unit-harbor-21` (other property, also at 390px), an unknown ID, `<x>` and no unit → rent field empty, no strip, no change count, status "The Rent analysis unit is not part of Maple Court, so no rent change was applied. The baseline is unchanged."
- Save lock (390px sheet): case rent 24,500, Save draft with server actions delayed 3s → rent and name disabled, hint shown, typing has no effect; after the reply the field is enabled, still 24,500, and focus is back in the sheet. A reload shows the case at 24,500. With the request aborted, the 24,600 edit stays editable with Unsaved changes. Escape closes the sheet and focus returns to the trigger. While the request runs, focus leaves the disabled Save button, as before.
- Equity Outcome/ProjectionMilestones stack gap is still 24px. No horizontal overflow at 390px.
- Regression tests in `tests/analysis/workspace.test.tsx`: `applies no rent change …` (×4), `keeps Exit and Sensitivity on the current simulation …` and `locks saved-case edits while a save is in flight …`. All six fail on the earlier code and pass now.

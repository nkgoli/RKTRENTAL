# What if: route and metric coverage

One shared, temporary **What if** replaces the standalone Scenarios tab in Returns & ROI.

## Where it lives

| Surface | Before | After |
| --- | --- | --- |
| Header | Edit assumptions, Save analysis, More | **What if** trigger first (shows `· N changes` while active), then the same actions |
| Panel | none (Scenarios tab: Suggested changes card, two intro cards, examples, editors) | Side panel beside the views at ≥1100px; modal bottom sheet below (focus trapped, Escape/backdrop close, focus back to the trigger) |
| Tabs | Summary · Actual vs projected · Charts · **Scenarios** · Benchmarks · Compare | Summary · Actual vs projected · Charts · Benchmarks · Compare |
| Saved cases | edited and compared on Scenarios | added, named, edited and removed in **Compare → Saved cases** and saved with the analysis; compared on Compare (charts, exact figures, overrides side by side). What if only copies a case (Start from) |
| Presets / suggestions | example chips, "Start from an example", Fix My Deal card | What if → Start from (baseline, Optimistic, Conservative, Best/Worst Case, or a saved case copied), Suggested changes = live sliders (DSCR/cash-flow targets shown as slider notes) |
| Tax estimate, advanced metrics, recorded source facts | Scenarios tab → Analysis details | Summary → Analysis details |
| Rent analysis | "See the effect in Returns & ROI →" opened the property | Same link opens What if on that property, scoped to the unit: `Unit 3A at suggested rent`, rent + the unit's suggested change |

## Links

| Address | Result |
| --- | --- |
| `/roi-analysis?property=P&view=scenarios` (old links, saved return addresses) | Compare tab, scrolled to Saved cases; address rewritten to `view=compare` |
| `/roi-analysis?property=P&whatif=rent&unit=U&rentChange=N` (Rent analysis) | What if opens with the unit label and `+$N/mo`; the entry parameters are dropped from the address after loading. The rent change applies only when `U` is a unit of property `P`: a missing, malformed, deleted or other-property unit opens an empty what-if over the unchanged baseline, with "unit not found in this property, no rent change applied" in the panel and a status message. Invalid amounts are ignored, never guessed |
| Edit assumptions return path with `view=scenarios` | Returns to `view=compare` |

## How the views show a what-if

There is no separate comparison panel. The existing charts and metric cards draw the simulated values directly; one slim status line under the view tabs (`Active what if`) says what is simulated and offers **Edit what if** and **Reset to baseline**:

- Running: `SIMULATED What if · <start> · N changes, not saved` (a copied saved case reads `<name> (copy)`).
- Paused (an engine rejection such as `Loan exceeds purchase price`): `PAUSED What if · <case> · <reason>. Figures show the baseline.`, so baseline figures are never read as simulated.

| View | Shows the what-if in | Not simulated |
| --- | --- | --- |
| Summary | Deal Snapshot figures with their change from baseline; cash-flow years, milestones, advanced metrics | Recorded source facts |
| Actual vs projected | Projected side; basis reads `What if · <case> (simulated…)` | Recorded rent payments and expenses |
| Charts | Equity, Cash Flow, Expenses, Amortization, Exit and Sensitivity charts and their cards | Recorded expenses |
| Benchmarks / Compare | Benchmark returns; Compare adds the temporary case as a `(not saved)` column beside saved cases | Market reference returns |

The earlier strip (changed-assumption chips, baseline/what-if/change table and extra baseline-vs-what-if line chart, repeated in every view) was removed: it duplicated the views and took 540–670px at 390px wide.

Deltas (Deal Snapshot, What if panel Effect list): money `+$1,234`/`−$50`, percentages in percentage points (`+0.81 pp`), ratios `+0.07×`; `No change` when the difference rounds to zero; `Unavailable` (never $0) when either side is missing. Green and red follow the favourable direction (costs and debt: lower is better).

## Calculation and data guarantees

- One engine path: `simulate()` merges overrides per group exactly like a saved case (`analyzeWithScenario`); a unit test checks identical results.
- Temporary edits do not mark the analysis unsaved, send no request and are never included in Save draft/ready. The What if panel has no Save, Save as case or Apply action. Cases are added on Compare → Saved cases (only overrides stored) and saved with Save draft/ready; Start from a saved case copies its overrides and calculation options into the temporary what-if, and the case itself never changes.
- Scope: the what-if belongs to one property; changing property (chooser, history, address) clears it, and a stale state is discarded on read.
- Reset to baseline (panel footer or status line) and Exit what if return every view to the baseline; a reload starts from the baseline (the what-if lives only in page state).
- Exit and Sensitivity follow the current simulation input even while their chart tab is hidden: each edit, preset, saved-case choice, reset or exit recalculates them and drops any exit probe or custom sensitivity range run against earlier assumptions (display choices such as metric and year stay).
- While a save is in flight, a saved case's assumptions, name, Remove and Use base calculation options are locked ("Saving… this case can be edited again when the save finishes."), so the saved reply cannot discard an edit. A failed save keeps every entry and the Unsaved changes state. What if sliders stay usable; they are never saved.
- Sliders cannot produce invalid text. A saved-case field with invalid text (`lots`) is marked on Compare (`Enter a number, such as 1200.`). Incomplete baselines show `Results paused until the flagged entries are corrected` instead of sliders.

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

## Compact status instead of the comparison strip (production build, isolated database)

`next build` + `next start` on port 3483 against an embedded Postgres on port 5483 (fresh seed plus `--seed-inputs-only`). Before captures come from the live app on 3100 (view only, temporary what-if, nothing saved). Screenshots in `.playwright-mcp/whatif-compact/` (local only, not committed). Cedar Row Townhomes.

| Step | Deal Snapshot cash flow | Exit (IRR · net proceeds) | Sensitivity first cells | Cash Flow (cumulative Y10) |
| --- | --- | --- | --- | --- |
| Baseline | $958/mo | 10.07% · $688,112 | −4.2% −0.1% 3.9% 7.9% | $182,236 |
| Optimistic (1440px) | $1,201/mo, `+$243 vs baseline $958` | 14.20% · $1,086,665 | −5.4% −1.7% in the last row | $392,411 |
| Optimistic + rent 14,000 (390px) | $1,835/mo, `+$877` | 15.48% · $1,179,797 | −3.0% 1.2% 5.5% 9.8% | — |
| Rent `lots` (paused) | baseline | baseline | baseline | baseline |
| Reset to baseline | $958/mo | 10.07% · $688,112 | baseline | $182,236 |

- Status line: 44px tall at 1440px, 91px at 390px (two 36px buttons, no horizontal overflow); was a 540–670px strip at 390px. Exactly one status line, no chips, metric table or extra chart in any view.
- Edit what if opens the side panel (1440px) or the sheet (390px); Escape returns focus to the What if trigger. Reset removes the status and every value returns to the baseline figure above.
- Equity Outcome/ProjectionMilestones stack gap is still 24px.
- `tests/analysis/workspace.test.tsx` now checks the status text, the absence of the chips/table/extra chart, the Deal Snapshot change and its return to the baseline after reset, and the paused wording.

## Sliders in Suggested changes

The temporary text-entry form (one "Baseline …" box per assumption) is gone. Suggested changes holds one labelled range slider per assumption, with its current value and unit beside the label (`$13,200/mo`, `5%`, `6.25%/yr`, `10 years`) and the baseline below it. Every input event (mouse drag, arrow/Page keys, touch) re-runs `simulate()` and the existing views update at once; there is no Apply step.

| Slider | Unit | Range (calculation domain, narrowed) | Step |
| --- | --- | --- | --- |
| Monthly rent | $/mo | baseline ×0.5–×1.5 (0–$5,000 when rent is $0) | 1/2/5 × 10ⁿ near rent ÷ 100 |
| Vacancy | % of gross rent | 0–max(25, baseline+10) | 0.5 |
| Rent growth, Expense growth, Appreciation | %/yr | min(−5, b−5)–max(10, b+5), within −50…100 | 0.25 |
| Interest rate | %/yr | 0–max(15, b+5) | 0.125 |
| Down payment, or Loan amount when a fixed loan is set | % of price / $ | 0–100 / 0–purchase price | 1 / price ÷ 200 |
| Purchase price | $ | baseline ×0.5–×1.5 | price ÷ 200 |
| Maintenance, Capital reserve, Management | % (or $/yr when a fixed annual amount is set) | 0–20 (15 for management) / 0–max(2×, 15% of rent) | 0.5 / rounded |
| Hold period | years | 1–50 | 1 |

- Each range is laid on a grid through the exact baseline, so the baseline is always reachable; a value back at the baseline drops the override (inherits). Values keep the baseline's and step's decimals.
- Fixed-amount precedence follows the engine: when a fixed annual maintenance, capital-reserve, management or loan amount is in effect, that slider replaces the percentage slider and says so. A percentage from a preset or copied case that a fixed amount overrides is named in a warning.
- An assumption the baseline leaves unset gets no slider and no invented value (`Not set: the baseline has no loan.` / `Not set in the baseline…`).
- Preset or copied-case overrides with no slider stay applied and are listed under the sliders.

## Sliders verification (production build, isolated database)

`next build` + `next start` on port 3484 against an embedded Postgres on port 5484 (fresh `prisma/seed.ts` plus `load-roi-examples.ts --seed-inputs-only`). Cedar Row Townhomes (rent $13,200/mo, 6.25%, fixed loan $1,030,000, 10-year hold). Screenshots in `.playwright-mcp/whatif-sliders/` (local only, not committed).

| Step | Slider | Deal Snapshot cash flow | Exit (best IRR · profit) |
| --- | --- | --- | --- |
| Baseline | — | $958/mo | Year 10 · 10.07% · $688,112 |
| Mouse drag, 1440px | rent $13,700 → $14,300 → $14,800 → $15,300/mo | $1,345 → $1,810 → $2,197 → $2,584/mo | — |
| Keyboard ← ×4 | interest 6.125 → 6 → 5.875 → 5.75%/yr | $2,667 → $2,750 → $2,833 → $2,915/mo | Year 10 · 14.08% · $951,800 |
| Keyboard ← ×2 (on Sensitivity) | hold 8 years | — | Year 8 · 14.05% · $699,560; Sensitivity rent axis $10,710–$19,890 follows rent |
| Reset to baseline (status line) | rent `$13,200/mo, baseline` | $958/mo | Year 10 · 10.07% · $688,112 |
| Touch drag, 390px sheet | rent $14,500 → $15,100 → $15,800/mo | Effect $2,971/mo (+$2,012) | — |

- Panel: 12 sliders, 0 text boxes; buttons only Close, Reset to baseline, Exit what if, Manage saved cases on Compare. One status line on every view; no horizontal overflow at 390px on Summary, Actual vs projected, Charts, Benchmarks or Compare. Equity Outcome/ProjectionMilestones gap measured 24px with and without a simulation.
- Saved cases: added `Rent 14k` (rent 14,000) on Compare and saved (revision 1). Start from `Rent 14k` → `What if · Rent 14k (copy) · 1 change, not saved`, rent slider 14,000 → 14,500: the case field stays 14,000, no Unsaved changes, and no POST request while moving sliders. Exit, then reload: no status line, trigger reads `What if`.
- Database after the run: one Cedar Row analysis, revision 1, baseline rent 13,200, interest 6.25, hold 10; one case `Rent 14k` with only `income.monthlyRent: 14000`.
- Tests: `tests/analysis/workspace.test.tsx` (slider attributes, aria-valuetext, live Deal Snapshot change, baseline inherit, reset, copied saved case unchanged, no extra save request, paused wording, saved-case editing/recovery/lock on Compare) and `tests/analysis/what-if.test.ts` (grid through the exact baseline, precision, fixed-amount precedence, unset fields).
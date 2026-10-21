# ROI UX polish: coverage map, overview slice and shared patterns

This is the first polish slice of Returns & ROI. It reviewed every ROI screen and state on a
production build. It then reworked the Summary (overview), the Actual vs projected tab and the
shared chart-card pattern. Findings outside that scope are assigned to later slices below.
Calculations, the 25 chart types, draft guards, one-decimal sensitivity, Property-based
assumption editing, the compact header and the tab-preserving round trip are unchanged.

Base: `cddc22a` (contains the compact-mobile/tab-return work at `577e040`).

## 1. Coverage map

Reviewed at 1440 and 390 px on an isolated runtime (port 3193, `.data/postgres-5543`, demo
seed), for 18 Elm Street, Cedar Row, Harbor View and Maple Court.

| Screen / state                      | Finding (before)                                                                                                                                                | Outcome / owner                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Chooser (no property)               | Clear; cards fit at 390.                                                                                                                                        | No change needed                                                                        |
| Header + Assumptions band           | Compact, actions reachable (from `577e040`). The "New analysis…" status repeats the band's source.                                                              | Kept. Status repetition → **final slice** (copy only)                                   |
| Summary: Year 1 at a glance         | Repeated Deal Snapshot (cash flow, cap rate, CoC) at a different precision (1.8% vs 1.75%).                                                                     | **Done**: Year-1 flow figures with basis tags; the statement moved inside               |
| Summary: From income to cash flow   | A separate long card that repeats the C1 tooltip and C5 table.                                                                                                  | **Done**: "How Year 1 adds up" disclosure in the glance card, with −/= operators        |
| Summary: Actual vs projected card   | Stacked "Actual … / Projected …" text was hard to scan; there was no unit or kind cue.                                                                          | **Done**: three-row Actual/Projected table, tinted basis tags, partial note             |
| Summary: Exact annual cash flow     | A detached card far from the chart it explains.                                                                                                                 | **Done**: "Exact annual cash flow, all N years" disclosure inside C1                    |
| Summary: tail cards                 | Advanced metrics, tax and source facts were three unrelated cards; the source facts were run-on prose.                                                          | **Done**: one "More detail" card with three disclosures; facts as a statement           |
| Summary: order                      | The Fix My Deal tool split the results.                                                                                                                         | **Done**: results first (Snapshot, glance + actuals, C1, Outcome, C5), then the tool    |
| Summary: incomplete                 | The glance showed "Unavailable" ×4 and the rest disappeared without explanation.                                                                                | **Done**: "No projection yet" card; metrics read "Not calculated"                       |
| Summary: stale                      | Only the glance footnote said "out of date".                                                                                                                    | **Done**: "Out of date" basis tag; the Assumptions band keeps the instruction           |
| Deal Snapshot (C3)                  | Dense but correct. The "5-Yr Returns"/"k" suffix units are terse.                                                                                               | → **Charts slice** (unit labels)                                                        |
| Fix My Deal (C4)                    | The subtitle was a fragment.                                                                                                                                    | **Done**: one sentence + What-if/USD per year/Never saved tags                          |
| C1, C2, C5 headers                  | Subtitles packed basis words with "·" ("projected · before tax …").                                                                                             | **Done**: one sentence + basis tags (pattern §3)                                        |
| Actual vs projected: header         | A long basis paragraph sat above the table, the projection source was missing, and the status line repeated the obvious.                                        | **Done**: basis tags, "Projection source", status only for load/error/stale             |
| Actual vs projected: method         | The full method was always shown.                                                                                                                               | **Done**: "How actual and projected are compared" disclosure (adds the Difference sign) |
| Actual vs projected: table          | Each cell repeats coverage notes that the Needed box also explains; there is a "Projected" tag under every projected value.                                     | Kept: tests pin the tags, and notes are row-specific → **final slice** may merge        |
| Actual vs projected: sources        | Expenses by category was one run-on line.                                                                                                                       | **Done**: aligned category list                                                         |
| Actual vs projected: fine print     | The export/portfolio paragraph was always shown.                                                                                                                | **Done**: "About the export and portfolio returns" disclosure                           |
| Actual vs projected: incomplete     | Correct: "No projection" in every projected cell; Needed lists inputs.                                                                                          | Verified; adds "Projection source: none until assumptions are complete"                 |
| Actual vs projected: error/retry    | Message + Retry; projection stays usable.                                                                                                                       | Verified by component test (not reproducible on the seed)                               |
| Charts tab: 6 sub-tabs, C6–C17, C25 | Consistent cards; long subtitles with "·" basis lists; Equity tiles are fine.                                                                                   | → **Charts slice**: adopt `basis`, keep subtitles to one sentence                       |
| Charts: Sensitivity                 | One-decimal cells confirmed.                                                                                                                                    | No change needed                                                                        |
| Scenarios (C18)                     | Dense intro prose, and the example picker text wraps heavily at 390. On phones the section tabs scroll and selected tabs left of view are hidden without a cue. | → **Scenarios slice** (copy + disclosure); tab scroll cue → **final slice**             |
| Benchmarks (C19, C20)               | Long provenance prose before the chart.                                                                                                                         | → **Benchmarks/Compare slice**: move provenance into `MoreDetail`                       |
| Compare (C21–C24) empty             | "Choose at least one reference asset and recalculate" sits outside the card, but recalculation is automatic.                                                    | → **Benchmarks/Compare slice** (empty-state card + copy)                                |
| Edit Property round trip            | Cancel/Save return to the same tab, sub-tab and period; guard dialog works.                                                                                     | Verified (no change)                                                                    |
| Keyboard / touch                    | Tabs use arrow keys; disclosures use Enter/Space; taps work at 390.                                                                                             | Verified; new disclosures are native `<details>`                                        |
| Loading                             | "Loading analysis..." text only.                                                                                                                                | → **final slice** (skeleton optional)                                                   |
| Source code                         | `RoiChart.tsx` had control characters (TAB/LF/BEL) in a comment.                                                                                                | **Done**: repaired                                                                      |

## 2. What changed

- `RoiWorkspace.tsx`: the Summary is ordered results first.
  - **Year 1 at a glance** shows Effective income, NOI, Annual cash flow (red when negative)
    and Leveraged IRR with its hold length. It carries the tags `Projected · USD per year ·
Before tax` and a **How Year 1 adds up** statement.
  - Beside it is the **Actual vs projected** snapshot, then C1 (with exact years), Outcome,
    C5, Fix My Deal and one **More detail** card.
  - With no projection, a single **No projection yet** card explains why, and the metrics read
    "Not calculated".
- `RoiActuals.tsx`:
  - The header gains basis tags (`Recorded cash`, `Projected Year 1, scaled`/`No projection`,
    `USD`, the scale) and a **Projection source** line.
  - The status line is empty when there is nothing to say.
  - The method, export and portfolio fine print move into disclosures.
  - Expense categories are a list.
  - The Summary snapshot is a small table.
- `RoiSummaryCharts.tsx`, `RoiDealPanels.tsx`: C1, C2, C5 and C4 use one-sentence subtitles +
  basis tags. C1 holds the exact annual table.
- CSS: `analysis.module.css` (glance metrics, statement totals, empty and detail cards),
  `actuals.module.css` (snapshot table, categories) and `roi-chart.module.css` (basis tags,
  disclosure row).

## 3. Reusable presentation decisions (for later slices)

1. **Card header** = `ChartCard({ title, subtitle, basis, controls })`. The subtitle is one plain
   sentence about what the chart answers. Basis facts go in `basis`, never in the subtitle.
2. **Basis tags** (`Basis` in `RoiChart.tsx`): order them as kind, unit, period/horizon, tax.
   Tags starting with `Projected` get the primary tint, and `Recorded…`/`Actual…` the ok tint.
   Others are muted. Use them for every figure group, so actual and projected never look alike.
3. **Missing values**: projection absent → "Not calculated" (summary) or "No projection"
   (comparisons). Actual absent → "Not recorded". Partial → "(partial)" in warn colour. A value
   is never shown as $0 unless it is recorded zero.
4. **Progressive disclosure** (`MoreDetail`): use it for exact tables, method notes and fine
   print. The summary names what opens ("Exact annual cash flow, all 10 years"). It is native
   `<details>`, so the keyboard and `focusField` ancestor-opening keep working.
5. **Controls** stay right-aligned in the header and stack below the title under 640 px. Use
   `Segmented` for ranges and views (chip style) and `Check` for toggles.
6. **Legend and tooltip**: keep the existing `ComboChart` legend (centred, 12 px, swatch kinds)
   and the equation tooltip (`op` −/=, `total` rows). The statement uses the same −/= operators.
7. **Numbers**: tabular figures; whole dollars in cards; exact cents only in disclosures. One
   precision per metric across a screen: avoid restating a Deal Snapshot metric elsewhere.

## 4. Evidence and verification

Untracked evidence lives in `evidence/roi-ux-overview/` (about 7.6 MB of JPEGs):

- `before/`, from build `cjB0AhglfC7Gr7VEB0WPs` at `cddc22a`: the chooser; Summary and Actual
  for four properties at 1440/390 (Elm full page); every tab and Charts sub-tab; expanded
  disclosures.
- `after/`: the same set from this change, plus `incomplete-*` (Cedar Row with vacancy
  cleared through Edit Property) and `incomplete-check.json`.
- `roundtrip/`: `compact-roundtrip-runtime.mjs` capture + flow reports.

Harness: `node tests/analysis/ux-overview-runtime.mjs <baseUrl> <outDir> [maxProperties]`.
It is read-only and refuses port 3100. It checks:

- no horizontal overflow on every tab and sub-tab;
- arrow-key (1440) and tap (390) tab selection;
- that every Summary disclosure opens from the keyboard or a tap;
- no console errors.

Results:

- **Before**: all checks passed. Summary panel 3634 px (1440) and 4836 px (390).
- **After**: all checks passed, with 14 disclosures opened at each width. Summary panel
  3173 px (1440) and 4364 px (390). Results still start 339 / 547 px down.
- **Compact round trip** on the isolated runtime: `capture` passed for Maple, Harbor and Cedar
  at both widths. `flow` passed:
  - Show details Enter/Space;
  - More actions Enter/Tab/Escape;
  - Sensitivity Cancel/Save return with one-decimal cells;
  - Scenarios/Benchmarks/Compare Cancel;
  - Keep editing / Save draft and continue / Discard and continue.
- **Incomplete state** at 1440/390:
  - "No projection yet" appears, and the four metrics read "Not calculated".
  - Actual vs projected shows 8 × "No projection", the stale status and
    "Projection source: none until assumptions are complete".
  - No overflow and no console errors.
- **Focused checks**:
  - `tsc --noEmit` passed.
  - ESLint and Prettier passed on the changed files.
  - Vitest passed: `workspace`, `actuals-workspace`, `property-baseline`, `realroi-charts`,
    `chart-data` and `comparison-charts`.

The isolated runtime's Cedar Row now has an empty vacancy (left from the incomplete check).
This was not pushed, and the live app was not restarted; the final slice delivers.

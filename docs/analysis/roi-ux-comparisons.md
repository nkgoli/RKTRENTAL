# ROI UX polish: Benchmarks, Compare and Rental Distribution

The comparisons slice of the ROI UX polish (see `roi-ux-polish.md` for the coverage map and the
shared patterns). Calculations, chart types, controls, tables, selection/save behaviour and
precision are unchanged.

## What changed

- **Intro card (Benchmarks and Compare).** One plain sentence, basis tags (`Projected property`,
  `Hypothetical markets`, `USD`, `Lump sum`, `Before tax`) and one short caveat ("fixed
  historical assumptions supplied by RealROI, not live or verified data"). The provenance table,
  method and custom-reference notes move into a `MoreDetail` disclosure, rewritten as a short
  list: same start/hold, property wealth, before tax and no fees on the market side, yield not
  added, risk not measured for the property, custom references.
- **Picker.** The legend reads "Reference assets · N of 2 selected"; one hint line follows. The
  limit feedback is styled as a warning and hidden when empty. Checkbox names are unchanged.
- **Missing states.** Bare status lines became cards: "No projection to compare" (incomplete or
  invalid assumptions, says recalculation is automatic), "No reference selected" (keeps the
  "Choose at least one reference asset" wording) and "Comparison unavailable" (library error).
- **Chart cards.** Every Benchmarks/Compare card has a one-sentence subtitle and basis tags with
  hold, unit and tax basis. The market focus cards now sit inside the growth chart with a
  "Select a market to highlight it" hint; their volatility reads "Not measured" instead of
  `null%`. The duplicate Hold/Method/Taxes footer was removed (the tags carry it).
- **Compare.** The "vs Property" view shows percentage differences in percentage points (pp).
  Radar scores and their method are in a disclosure; Exact comparison is a chart card, and its
  method note is in a disclosure. C22's subtitle now says "average yearly growth" (it was
  "year-over-year").
- **Charts (`RoiCompareCharts`).** Radar ring labels now match the 20-point rings (were
  0/25/50/75/100) and sit between the first two axes. On wide screens, the scatter points have
  direct labels.
- **Rental Distribution (C25).** Basis tags (`Comparable rents`, `USD per month`, `N included`,
  `Yours not in the statistics`), a "Yours vs average" stat, an Average legend item and the
  suggested range shown in dollars. The note gives the standard deviation. With no included
  comps, the card explains this instead of disappearing. With one comp (or identical rents),
  the note says the curve width is an assumed ±10% spread.

## Shared follow-ups (outside this slice)

- `ComboChart` `unit` is only `USD | Index`, so the C22 percent bar chart's SVG title says
  "(index)". It needs a percent unit in the shared primitive.
- `CompsWorkbench.tsx` comps header shows mojibake (`Â·`).
- `benchmarkComparison` messages still say "and recalculate" (recalculation is automatic). The
  UI no longer shows them for empty selection or missing projection.
- `Basis` could tint "Hypothetical…" tags distinctly from muted tags.
- The workspace `stale` flag is true for both incomplete assumptions and request errors. The
  cards distinguish them by `snapshot`.

## Verification

- Harness: `node tests/analysis/ux-comparison-runtime.mjs <baseUrl> <outDir>` (isolated only;
  refuses 3100; Compare changes stay in an unsaved draft). It covers:
  - Benchmarks and Compare at 1440 and 390, keyboard on desktop and touch on mobile: scale
    toggle, focus cards, scatter and radar keys, the empty state, two selections, the
    selection limit, removal and re-selection, and the vs Property view.
  - The incomplete property (Cedar Row).
  - The C25 keyboard and tap.
  - Every disclosure, horizontal overflow and console errors.
- Before (`evidence/roi-ux-comparisons/before/`, untracked): all checks passed.
- Vitest: `comparison-charts` + `benchmarks` 20 passed. `workspace`, `actuals-workspace`,
  `rent-comps/workbench`, `realroi-charts` and `chart-data` passed 87 tests. `tsc --noEmit`,
  ESLint and Prettier passed on the changed files.
- After captures are pending a buildable shared tree (see the Task report).

# ROI UX polish: decision views (Exit, Sensitivity, Scenarios)

This slice applies the overview patterns in `roi-ux-polish.md` §3 to the three views managers use
to compare outcomes: Charts → Exit Analysis (C14), Charts → Sensitivity (C15/C16) and the
Scenarios tab (C18). No calculation, mode, range, horizon, rounding, save path or
Property-based editing changed.

Base: `bd08b8d` (contains the core-charts slice `3c38069`). Owned files: `RoiExit.tsx`,
`RoiSensitivity.tsx`, `RoiScenarios.tsx`, `RoiScenarioCharts.tsx`, `detail-charts.module.css`
(new classes only; the core classes are unchanged), `scenario-charts.module.css` (new,
scenario-only classes; the classes Benchmarks uses are unchanged), `scenarios.module.css` and
their tests.

## 1. What changed

**Exit Analysis**

- **Probe controls come first.** The "Holding period comparison" form used to sit below the
  chart, beside the exact statement. It is now an **Exit probe** card above the comparison, with
  the three fields in one row on desktop and stacked on phones.
- **Baseline vs probe is stated.** A status line reads `Saved: exit year 10 · selling costs 6% ·
sale price from appreciated value`. After a probe it adds `Showing probe: …`. The basis tags
  change from `Saved assumptions` to `Temporary probe`, and the comparison's from `Projected` to
  `Projected with probe`.
- **Reset to saved** appears only while a probe or an unapplied edit exists. It restores the
  saved controls and recalculates. Edit saved exit assumptions still opens the Property.
- **Pending and paused states are explained in place.** Edited but not applied: "Not applied
  yet. Press Update exit comparison…". Request errors: "Exit comparison is paused until the
  assumptions flagged above are corrected." A failed probe: "No exit comparison for these
  values…". The alert is unchanged.
- **No invented recommendation.** "Year 10 is optimal" became "Year 10 has both the highest IRR
  and the highest profit of the compared years". When every compared year loses money, the
  insight adds "No compared exit year gets back the cash you put in; these are the smallest
  losses", including when IRR is unavailable everywhere. Insight figures are red when
  negative; before, a −2.07% IRR was teal.
- **Exact figures are disclosed.** The cent-exact sale statement and the horizon table moved
  from two separate cards into two disclosures at the foot of the comparison: "Exact sale
  statement, year N" and "Exact exit comparison, N exit years". Captions, cents and the
  IRR-unavailable reason are unchanged.
- **Unchanged:** Profit/Total Cash Back view, landmark chips, year buttons, Clear, hover/keyboard
  tooltip, selected-year summary, the whole-dollar comparison table with eye buttons, and the
  probe field names and validation.

**Sensitivity**

- The subtitle is one sentence ("How cash-on-cash return would change if rent or vacancy
  differed from your saved assumptions."). Basis tags: `Projected`, the period (`Year 1`,
  `Year 3 (stabilized)`, `Year 5` or `N-year hold, including the sale`), `Percent`,
  `Default ranges`/`Temporary custom ranges`, `Before tax`.
- **Controls are grouped.** What to show (Sensitivity metric, Year) sits on the left; display
  options (Show values, Colorblind-safe, Customize Ranges) sit on the right. The Year buttons now
  have a visible label. Under IRR they explain on hover why they are disabled ("IRR always covers
  the whole hold").
- **The current ranges are visible without opening the panel**, for example
  `Rent $1,960–$3,640/mo (5 values) · vacancy 0%–15% (7 values)`.
- The range panel is titled "Rent and vacancy ranges". It says ranges are temporary probes that
  leave saved rent and vacancy unchanged, labels "Saved assumption: …" ("Not set" instead of
  "Unavailable%"), and has a **Reset to defaults** button.
- **Base marker:** the legend reads "Your saved assumptions". When custom ranges exclude the
  saved rent or vacancy, it says "Your saved rent or vacancy is outside these ranges, so no cell
  is marked" instead of silently dropping the ★.
- The readout hint covers every input: "Hover, tap or use the arrow keys on a cell…".
- The scale's end labels are coloured by sign. Before, an all-negative grid showed its −5.9%
  maximum in green.
- **The one-decimal grid** moved into "Exact grid to one decimal, R rents × V vacancy rates".
  Its caption, `Base` tag and unavailable-cell reasons are unchanged. Pending and paused states
  are worded as for Exit.
- **Unchanged:** heatmap cells, base ★ and outline, break-even contour, Show values,
  colourblind palette, all three timeframes and IRR, arrow/Home/End/Escape keys, touch, the
  range limits and the 100-cell cap. There is no tornado chart in this app, so no tornado mode
  exists to preserve. The heatmap is the only sensitivity visual.

**Scenarios**

- **Order: intro and actions, results, then editors.** Before, the example picker, the editors
  and the overrides table all came before any result.
- **Intro card:** one sentence ("Compare your saved base case with what-if cases. A case
  changes only the assumptions you override; everything else follows the base."), basis tags,
  Create scenario with "N of 20 scenarios", and two disclosures:
  - "How scenarios inherit the base": the inheritance rules as a list, including that the base
    is edited on the Property and that Save draft/Save ready keeps scenarios.
  - "Start from an example": the example picker and its review, which wrapped heavily at 390 px.
- **Results:**
  - The selection card says the Base Case is the saved assumptions. Show/hide chips are
    separate from the dashed "Add an example:" chips. Before, they were one mixed row.
  - A hint above the KPI tiles says what they show, and that selecting one highlights its
    lines.
  - Key Metrics has basis tags and a key for the best/worst tint, the impact dots and Δ view.
    At 390 px the impact column is hidden and labels wrap, so the Base and one comparison case
    fit without the cut-off column seen before.
  - Equity Growth: the "breakeven" pills in the header used the first word of each name, so
    "Custom case 1" and "Custom case 2" both read "Custom:" and `>10y`. They now sit in the card
    body under "Initial cash recovered:" with full names and "Not within 10 years". The insight
    calls the IRR difference a "percentage-point" spread.
- **Exact figures card:** the cent-exact metrics table (`Scenario metrics` region), the exact
  equity table and the exact cash-flow table are three disclosures in one card.
- **Your scenarios (editors):**
  - Name and Remove sit on one row.
  - "Assumptions and overrides · N overridden" (or "· inherits every base assumption") shows
    what changed before you open it.
  - Fields are grouped under the Property's section titles. Each shows "· Base: value", and
    overridden labels are bold primary.
  - "Overrides side by side" (the former always-open table) is a disclosure.
- **Missing results are explained:**
  - "No scenario results yet / No projection yet. Complete or correct the base assumptions
    flagged above…" (incomplete base).
  - "Scenario results paused / A scenario has an invalid assumption…" (scenario error).
  - "Scenario results are out of date…" (request errors).
  - Before, a single "out of date or unavailable. Recalculate…" line covered all three, but
    recalculation is automatic.
- **Unchanged:** draft ids and field ids (focus/recovery targets), validation messages, the
  20-scenario limit, example values and their maintenance warning, explicit options and "Use
  base calculation options", Absolute/Δ view, KPI focus, horizon, gaps past shorter holds, and
  save/reload behaviour.

## 2. Shared follow-ups (for the final slice, not changed here)

1. `MoreDetail` content is invisible to Playwright `getByRole` until opened. Harnesses that look
   up exact tables must pass `includeHidden: true`, as `ux-decisions-runtime.mjs` does.
   `compact-roundtrip-runtime.mjs` reads `td` text with a CSS locator, so it is unaffected.
2. A "Skip to main content" link appears on top of the page in some 390 px captures after taps
   (app shell, not ROI). Worth checking that it only shows on keyboard focus.
3. `useHorizon` still cannot carry a visible label (core follow-up 3). Exit/Scenario horizon
   labels are local text.
4. `scenario-charts.module.css` is shared by Benchmarks and Scenarios. The scenario-only classes
   are grouped under one comment. A split into two modules would make ownership clearer.
5. The workspace `stale` flag cannot tell a request error from a pending recalculation, so
   Exit/Sensitivity say "paused until the assumptions flagged above are corrected".

## 3. Evidence and verification

Evidence is in the untracked `evidence/roi-ux-decisions/` (149 files, about 10.6 MB):

- `before/`: build of `bd08b8d`.
- `after/`: this change.
- `before-missing/`: `bd08b8d` with Cedar Row's vacancy cleared.
- Each set has `<view>-<property>-<1440|390>.jpg` for 7 properties, the `*-expanded` captures
  with every disclosure open, the control captures (`exit-probe-invalid|pending|applied`,
  `sensitivity-readout|irr-values|invalid`, `scenarios-compare`) and `ux-decisions-report.json`.
- `after/` adds `write-edited-1440.jpg` and the `missing-<view>-<width>.jpg` captures.
- Logs: `before.log`, `after.log`, `before-missing.log`.

Runtime: fully isolated.

- A fresh embedded Postgres on 5546 was created and seeded by `scripts/start.ps1`, plus
  `demo:roi` for the fictional all-cash, financed and tight examples.
- The app ran on port 3198: `bd08b8d` for before, then this change (`-Rebuild`).
- The before-missing build was a `git archive` of `bd08b8d` in `.data/decisions-before`, served on
  3199 against the same database.
- The live 3100/5434 app was not touched or restarted, and nothing was pushed.

Harness: `node tests/analysis/ux-decisions-runtime.mjs <baseUrl> <outDir> [namePattern]`. It
refuses port 3100. It checks:

- For every view, property and width: horizontal overflow, layout width (catches zoomed-out
  phone layouts) and overlapping SVG labels.
- Keyboard at 1440 and touch at 390:
  - Exit: year select, Best IRR chip, Total Cash Back view, an invalid probe (alert), a pending
    probe, an applied probe (year 12 added; Year 10 still selected) and reset.
  - Sensitivity: base ★ present, keyboard readout "(your assumptions)", tap readout, one-decimal
    cells, colourblind fill change, Show values, Year 5, IRR, Customize Ranges, an invalid range
    (alert) and reset.
  - Scenarios: add the Best Case example chip (unsaved), Δ vs Base, focus a KPI tile, horizon Y5.
- Every disclosure opens by Enter or tap.
- Console errors and HTTP ≥ 400 responses.
- Opt-in writes (isolated databases only):
  - `UX_DECISIONS_WRITE=<propertyId>`: create a scenario with a rent override, Save draft,
    reload, confirm the name and override, clear the override (inherits), remove it, Save draft,
    reload, confirm the count is back.
  - `UX_DECISIONS_MISSING=<propertyId>`: clear vacancy through Edit Property, then check each
    view's incomplete state and that no `$0.00`/`NaN` appears.

Results:

- **Before:** 182 checks, 0 failures; 2 disclosures per width.
- **After:** 208 checks, 0 failures; 8 disclosures opened at each width.
  - Write round trip passed on Harbor View (revisions 3 and 4).
  - Missing state passed on Cedar Row at both widths.
  - No console errors.
  - A first after run found the Exact figures card widening the page at 390 px when expanded.
    Fixed with `minmax(0, 1fr)` grid columns and re-verified.
- **Before-missing:** every missing-state check passed. The two "exit property found" checks
  failed by design, because Cedar is the only property sampled and has no projection.
- **Panel height**, mean of the 6 complete properties:

  | View        | 1440 px     | 390 px      |
  | ----------- | ----------- | ----------- |
  | Exit        | 1833 → 1545 | 2718 → 2140 |
  | Sensitivity | 1161 → 990  | 1281 → 1158 |
  | Scenarios   | 2722 → 2674 | 3005 → 3036 |

  At 390 px Scenarios is slightly taller because of the new hints, key and split chip rows.
  Results now start right after the intro card instead of after the editors.

- Cases covered:
  - Negative: 18 Elm Street (every exit year loses money, all-negative sensitivity grid,
    DSCR 0.33).
  - Positive: Harbor View and the fictional Financed rental.
  - All-cash: the fictional Cash Purchase (DSCR "No debt").
  - Tight: the fictional Tight Cash Flow.
  - Missing: Cedar Row.
- **Focused checks:**
  - `tsc --noEmit` passed.
  - ESLint (`--max-warnings=0`) and Prettier passed on the changed files.
  - The production build compiled without warnings.
  - Vitest: `realroi-charts`, `workspace`, `scenarios`, `chart-data`, `comparison-charts` and
    `property-baseline` passed. That includes four new presentation tests:
    - probe labelling, reset, the all-loss insight and the disclosed exact exit tables;
    - range naming, the base-outside-range note, reset to defaults and the disclosed
      one-decimal grid;
    - the scenario intro disclosures, the split chips and the disclosed exact metrics;
    - the scenario missing and paused states with override counts.

The isolated database on 5546 keeps Cedar Row with an empty vacancy. Harbor View's saved ROI
draft is at revision 4, with the test scenario removed.

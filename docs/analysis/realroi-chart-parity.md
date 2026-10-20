# RealROI rendered-chart parity guide

This guide compares every chart the RealROI reference actually renders with the
RocketRental view that should match it. It replaces the visual exclusions in
`roi-graphs.md` (indexed view, custom slider, donuts, risk scoring, etc.). Those
are now in scope and owned below.

Evidence: 105 reference screenshots in `docs/analysis/realroi-chart-parity/`
(`ref-*.png`), taken in Playwright from the running reference on 2026-10-20.
Full-page overviews are `ref-summary-full-1440.png` and `ref-charts-full-1440.png`
(Charts → Equity).
RocketRental's current renders are the existing captures in
`docs/analysis/roi-graphs/fix/` (1440 and 390 px, Maple Court).

## 1. Reference runtime (reproducible)

| Item       | Value                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Repository | `https://github.com/nkgoli/RealROI` (`main`)                                     |
| Commit     | `0b12c76fea3958b98f4a722f5acf3336f1fd7d45` (2026-02-18, "Remove .env.example …") |
| Checkout   | `.data/reference/RealROI` in this checkout (git-ignored, detached at the commit) |
| Toolchain  | Node 22.23.1, pnpm 9.15.0 via `npx`, Vite 6.4.1, Recharts 2.x, visx (heatmap)    |
| URL        | `http://127.0.0.1:3300/demo` (public route, no sign-in)                          |
| Viewports  | 1440×900 desktop and 390×844 mobile                                              |

Launch it (clones if missing, installs, builds the packages, starts Vite):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-realroi-reference.ps1
# later runs: add -SkipInstall; use -Port to pick another isolated port
```

What the script runs:

1. `git clone` into `.data/reference/RealROI`, then `git checkout --detach <commit>`.
2. `npx -y pnpm@9.15.0 install --frozen-lockfile`.
3. `npx -y pnpm@9.15.0 turbo build --filter="@roi/web^..."`. The packages export
   `dist/`, so they must be built first.
4. `VITE_DEV_AUTH_BYPASS=true`, then
   `npx -y pnpm@9.15.0 --filter @roi/web exec vite --host 127.0.0.1 --port 3300 --strictPort`.

On 2026-10-20 the launcher was verified on port 3301 (HTTP 200 for `/demo`) and
then stopped.

**Running without Supabase.** Supabase is not configured, so the console warns
"Supabase credentials not configured" and uses a mock dev user. `/analysis` and
`/library` need the bypass; `/demo` does not. Port 3300 is used only by the
reference. The script never touches `localhost:3100`, Postgres 5433/5434 or
`.data/postgres-*`.

**Sample inputs.** `/demo` loads the locked `sampleDealInput` from
`apps/web/src/stores/analysis.store.ts`:

| Group     | Values                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Property  | Sample Investment Property, 123 Main Street, Austin TX 78701                                                                   |
| Purchase  | price $350,000; ARV $380,000; closing $8,000; rehab $5,000; furnishing $0                                                      |
| Financing | 25% down; 7.25%; 30 years; points 0; lender fees $1,500                                                                        |
| Income    | rent $2,800/mo; other income $100/mo; vacancy 5%; rent growth 3%                                                               |
| Expenses  | tax $4,200; insurance $1,800; HOA 0; maintenance 5%; CapEx 5%; management 8%; utilities 0; leasing $500; other $200; growth 2% |
| Exit      | appreciation 3%; hold 30 years; selling costs 6%                                                                               |
| Taxes     | 24% marginal; 5% state; 15% capital gains; depreciation over 27.5 years; land 20%                                              |

Headline outputs, for cross-checking a successor's run:

- Year 1 NOI $20,355 and cash flow −$1,133.
- DSCR 0.95, CoC −1.11%, cap rate 5.82%.
- Total cash in $102,000.
- Year 30 equity $922,356.
- Year 10 exit profit $176,478 at 10.57%.

"Inputs are locked" applies to the form only. Fix My Deal's Best Fix still
changes the analysis, so reload `/demo` to return to the defaults.

**Browser states.** Hover tooltips were captured as **viewport** screenshots.
Recharts tooltips disappear from element screenshots, so those files show the
whole viewport. Without `VITE_GOOGLE_MAPS_API_KEY`/`VITE_RENTCAST_API_KEY` the
Search tab shows "Manual Entry Mode" (`ref-search-manual-entry-no-chart-1440.png`),
and its Rental Distribution chart cannot render (see C25).

## 2. RocketRental counterpart surface

All ROI charts live at `/roi-analysis?property=<id>` in `src/components/analysis/`:

| Tab                    | Component            |
| ---------------------- | -------------------- |
| Summary                | `RoiWorkspace.tsx`   |
| Charts                 | `RoiProjections.tsx` |
| Scenarios              | `RoiScenarios.tsx`   |
| Benchmarks and Compare | `RoiBenchmarks.tsx`  |

They draw with the custom-SVG `ComboChart` in `RoiChart.tsx` and the helpers in
`chart-data.ts`. Only `view=actual` lives in the URL; every other tab and Charts
sub-tab is component state.

**Tab order differs:**

- Reference sub-tabs: **Equity** (default), Cash Flow, Expenses, Amortization,
  Exit Analysis, Sensitivity.
- RocketRental sub-tabs: **Cash Flow** (default), Equity, Expenses, Amortization,
  Exit, Sensitivity.
- Reference main tabs: Search (default), Summary, Charts, Scenarios, Benchmarks,
  Compare.
- RocketRental main tabs: Summary (default), Actual vs projected, Charts,
  Scenarios, Benchmarks, Compare.

Keep RocketRental's tab set: there is no Search tab, and Actual vs projected
stays. **Done (TASK-8C409E13):** the Charts sub-tabs follow the reference order and
open on Equity; Exit is labelled "Exit Analysis".

## 3. Ownership

| Owner Task                                                    | Charts                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TASK-8C409E13** cash-flow and equity                        | C1–C2 (Net Cash Flow by Year, Outcome donut), C5 (projection-table mini bars), C6–C9 (Equity Composition, Value vs Mortgage, Cash Flow & Cumulative, Income Bridge), the shared chart primitives (§5) and the sub-tab order         |
| **TASK-2F1D1EFB** expense, amortization, exit and sensitivity | C10–C17 (Operating Expenses bars, Amortization area, payoff bar and schedule bars, Exit chart, Sensitivity heatmap)                                                                                                                 |
| **TASK-DFDAA085** comparison and live parity                  | C3–C4 (Deal Snapshot risk ring, gauge and factor bars; Fix My Deal lever bars), C18–C25 (Scenario lines, Benchmark lines and scatter, Compare lines, bars and radar, Search distribution), and the final 1440/390 live verification |

## 4. Inventory

"Ref shots" are the screenshot files without the `ref-` prefix and `.png` suffix.

| #   | Reference chart (route → tab)                                             | Type                                         | Ref shots                                                                                                                                             | RocketRental now                                                            | Gap                                                |
| --- | ------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| C1  | Net Cash Flow by Year (Summary)                                           | Bar, positive/negative cells                 | summary-net-cashflow-{y1,y5,y30,custom,y30-tooltip,y5-tooltip-negative}-1440; mobile-390-viewport-summary-net-cashflow                                | `NetCashFlowCard` (`RoiSummaryCharts.tsx`)                                  | **Delivered** (§9.3)                               |
| C2  | Outcome: Wealth Created donut (Summary)                                   | Pie / donut                                  | summary-outcome-donut-{y1,y30,y30-tooltip}-1440, summary-outcome-custom-1440, summary-outcome-after-best-fix-1440                                     | `OutcomeCard` (`RoiSummaryCharts.tsx`)                                      | **Delivered** (§9.3); after-best-fix belongs to C4 |
| C3  | Deal Snapshot risk ring, gauge and factor bars (Summary)                  | SVG ring + semicircle gauge + segmented bars | summary-deal-snapshot{,-monthly,-cashflow-popover}-1440, summary-risk-meter-expanded-gauge-1440, mobile-390-viewport-summary-deal-snapshot            | `DealSnapshot` (`RoiDealPanels.tsx`)                                        | **Delivered** (§11.2)                              |
| C4  | Fix My Deal lever bars (Summary)                                          | Segmented gradient bars + pills              | summary-fix-my-deal{,-expanded,-best-fix-applied}-1440                                                                                                | `FixMyDeal` (`RoiDealPanels.tsx`)                                           | **Delivered** (§11.2)                              |
| C5  | Cash Flow & Equity Projections mini bars (Summary)                        | Table + inline % bars                        | summary-projection-table-{keyrows,full}-1440                                                                                                          | `ProjectionMilestones` (`RoiSummaryCharts.tsx`); exact table kept           | **Delivered** (§9.3)                               |
| C6  | Equity Composition vs Debt Paydown (Charts → Equity)                      | Stacked bars + line, dual axis, overlays     | charts-equity-composition-{y1,y5,y30,custom,incl-down,indexed,y30-tooltip,indexed-tooltip}-1440; mobile-390-viewport-equity-{composition,tap-tooltip} | `EquityComposition` (`RoiProjections.tsx`)                                  | **Delivered** (§9.3)                               |
| C7  | Value vs Mortgage Balance (Charts → Equity)                               | Area band + 2 lines                          | charts-value-vs-mortgage-{y10,y30-tooltip}-1440; charts-full-1440                                                                                     | `ValueVsMortgage` (`RoiProjections.tsx`)                                    | **Delivered** (§9.3)                               |
| C8  | Cash Flow & Cumulative (Charts → Cash Flow)                               | Bars + line + pre/post shading               | charts-cashflow-cumulative-{y10-default,y1,y30,custom,custom-y20,y10-tooltip}-1440                                                                    | `CashFlowCumulative` (`RoiProjections.tsx`)                                 | **Delivered** (§9.3)                               |
| C9  | Income to Cash Flow Bridge (Charts → Cash Flow)                           | 3 lines + bars                               | charts-cashflow-bridge-{y10-default,y1,y30,y10-tooltip}-1440                                                                                          | `IncomeBridge` (`RoiProjections.tsx`); Year-1 list kept                     | **Delivered** (§9.3)                               |
| C10 | Operating Expenses ranked bars (Charts → Expenses)                        | CSS horizontal bars                          | charts-expenses-{y1,y10,y30,custom,y30-sort-delta,simulate-tax,info-tooltip}-1440                                                                     | `OperatingExpenses` (`RoiExpenses.tsx`); growth lines and exact tables kept | **Delivered** (§10.3)                              |
| C11 | Principal vs Interest Over Time (Charts → Amortization)                   | Overlapping areas                            | charts-amortization-area-{default,tooltip}-1440                                                                                                       | `PrincipalVsInterest` (`RoiAmortization.tsx`)                               | **Delivered** (§10.3)                              |
| C12 | Loan Payoff Breakdown bar (Charts → Amortization)                         | Two-segment progress bar                     | charts-amortization-schedule-summary-1440                                                                                                             | `Schedule` payoff bar (`RoiAmortization.tsx`)                               | **Delivered** (§10.3)                              |
| C13 | Schedule "Paid Off" mini bars and milestone chips (Charts → Amortization) | Table + inline bars                          | charts-amortization-schedule-{summary,detailed}-1440, charts-amortization-insights-10y-y20-1440                                                       | `Schedule` table, chips, Summary/Detailed; exact tables kept                | **Delivered** (§10.3)                              |
| C14 | Exit Analysis & Comparison (Charts → Exit Analysis)                       | Stacked bars + reference lines               | charts-exit-{default-y10-selected,total-cash-back,cleared-hover-tooltip,y30-selected,breakeven-chip-selected}-1440                                    | `Comparison` (`RoiExit.tsx`); exact statement, probes and table kept        | **Delivered** (§10.3)                              |
| C15 | Sensitivity heatmap (Charts → Sensitivity)                                | visx heatmap + contour + gradient legend     | charts-sensitivity-{year1-default,stabilized,year5,show-values,colorblind-values,customize-ranges,hover-cell}-1440                                    | `Heatmap` (`RoiSensitivity.tsx`); exact grid kept                           | **Delivered** (§10.3)                              |
| C16 | Sensitivity gradient legend (inside C15)                                  | Gradient bar                                 | same as C15                                                                                                                                           | Gradient legend in `Heatmap`                                                | **Delivered** (§10.3)                              |
| C17 | Amortization "Interest (First Ny)" and "Balance at YN" cards              | KPI cards with selects                       | charts-amortization-insights-10y-y20-1440                                                                                                             | Insight cards in `Schedule`                                                 | **Delivered** (§10.3)                              |
| C18 | Equity Growth by Scenario (Scenarios)                                     | Multi-line                                   | scenarios-equity-growth-{30y,10y,tooltip,with-worst,focused-optimistic}-1440, scenarios-tab-full-1440, scenarios-delta-vs-base-1440                   | `ScenarioCharts` (`RoiScenarioCharts.tsx`)                                  | **Delivered** (§11.2)                              |
| C19 | Investment Growth Over Time (Benchmarks)                                  | Multi-line, Index/Dollars                    | benchmarks-growth-{indexed,dollars,indexed-tooltip,dollars-tooltip,focused-sp500}-1440                                                                | `BenchmarksView` growth chart (`RoiBenchmarks.tsx`)                         | **Delivered** (§11.2)                              |
| C20 | Risk vs Return scatter (Benchmarks)                                       | Recharts scatter                             | benchmarks-risk-return-{scatter,tooltip}-1440                                                                                                         | `ScatterChart` (`RoiCompareCharts.tsx`)                                     | **Delivered** (§11.2)                              |
| C21 | Investment Growth Over Time (Compare)                                     | Multi-line, USD                              | compare-growth-{default,tooltip,reits-selected}-1440                                                                                                  | `CompareView` growth chart (`RoiBenchmarks.tsx`)                            | **Delivered** (§11.2)                              |
| C22 | Annualized Returns Comparison (Compare)                                   | Bar per asset                                | compare-annualized-bars-{default,tooltip}-1440                                                                                                        | `CompareView` bar chart (`ComboChart` with per-bar `colors`)                | **Delivered** (§11.2)                              |
| C23 | Multi-Dimensional Comparison (Compare)                                    | Radar                                        | compare-radar-{default,hover-no-tooltip}-1440                                                                                                         | `RadarChart` (`RoiCompareCharts.tsx`)                                       | **Delivered** (§11.2)                              |
| C24 | Compare side-by-side table (Compare)                                      | Table, Best/Worst badges                     | compare-side-by-side-vs-property-1440, compare-tab-full-1440                                                                                          | `CompareView` side-by-side table, winners, asset cards                      | **Delivered** (§11.2)                              |
| C25 | Rental Distribution bell curve (Search)                                   | Area + reference dots                        | live keys absent (search-manual-entry-no-chart-1440); **fixture render** in `final/c25/` (§12.3)                                                      | `RentDistribution` on the comps workbench                                   | **Delivered** (§11.2), fixture-paired (§12.3)      |

**Not rendered anywhere in the reference** (dead code, so no parity is needed):

- `CashflowChart`, `IncomeNOICashflowChart`, `TotalReturnsDonut` in `apps/web/src/components/charts`.
- `CumulativeCashflowChart`, `ExitAnalysisChart`, `ExpenseBreakdownChart` in `packages/charts`.
- The non-compact RiskMeter.

The landing page shows only a static `hero-chart.jpg`. Library, Blog, About and
Pricing have no charts.

**Mobile reference** (whole tab): `ref-mobile-390-{summary,charts-equity,charts-cashflow,charts-expenses,charts-amortization,charts-exit,charts-sensitivity,scenarios,benchmarks,compare}.png`.

## 5. Shared chart system (owner: TASK-8C409E13; consumed by all)

**Status: delivered.** The table below is the original audit. §9.2 lists what was
built and the deliberate deviations.

The reference uses Recharts with Tailwind. RocketRental can keep its SVG
`ComboChart` but must reproduce these rendered conventions.

| Aspect          | Reference (observed)                                                                                                                                                                                                           | RocketRental now                                                                            | Action                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Card            | `rounded-lg bg-white border border-slate-200 overflow-hidden`; header `bg-slate-100 border-b px-4 py-3`; title 14px/600 `#1e293b`; subtitle **10px** `#64748b`                                                                 | `ChartCard`: header `#f1f5f9`, title 15px, subtitle 12px                                    | Title 14px, subtitle 10px                                                                                                                                                            |
| Year selector   | `Y1 Y5 Y10 Y30 Custom`. Pill group `rounded-lg border p-0.5`; buttons `px-2.5 py-1` 10px/500; active `bg-teal-500` (`#14b8a6`) white. Custom shows a range slider (min 2, max = data years, default 7) and a `Y{n}` mono label | `Y5 Y10 Y30 All Ny`, 12px/600, active `#0f766e`; no Y1, no Custom                           | Add Y1 and Custom with slider + `Y{n}`. Keep a 50-year "All" only when the hold is longer than 30                                                                                    |
| Defaults        | Net CF **Y5**; Outcome **Y1**; Equity, Value/Mortgage **Y30**; Cash Flow, Bridge **Y10**; Expenses **Y1**; Exit selected **Year 10**                                                                                           | Full hold (`null`) everywhere                                                               | Per-chart defaults as listed                                                                                                                                                         |
| KPI tiles       | `rounded-lg px-3 py-2..2.5`, label 10px/600, value **JetBrains Mono** 18px/700; teal-50 / teal-50/50 / slate-100 tones                                                                                                         | Tiles 20px/700 sans, 11px label                                                             | Mono values, 10px labels, reference tones                                                                                                                                            |
| Chips           | `rounded-full px-3 py-1(.5) text-xs` with lucide icon or 6px dot; teal-100/700, red-100/700, teal-50/600, slate-100/700                                                                                                        | `Chips` 12px with dot                                                                       | Add icons (Target, TrendingDown, TrendingUp) on C8                                                                                                                                   |
| Insight row     | `rounded-lg bg-slate-50 px-4 py-2.5 text-xs`, bold "Insight:" lead, mono teal/red figures                                                                                                                                      | `Insight` 12px, "Reading:" lead                                                             | Use "Insight:" and mono figures                                                                                                                                                      |
| Grid            | `3 3` dashes `#e2e8f0`, **horizontal and vertical** lines                                                                                                                                                                      | Horizontal only; solid zero line `#94a3b8`                                                  | Add vertical lines; keep the zero line                                                                                                                                               |
| Y ticks         | `$${(v/1000).toFixed(0)}k`: `$0k`, `$-9k`, `$1050k`, `$1400k`; 11px `#64748b`. Domains are Recharts auto (or `ceil(max×1.1/50k)×50k` on C6)                                                                                    | `compactUsd`: `$12.5K`, `$1.2M`; nice 1/2/2.5/5 steps                                       | Use the `$Nk` style (lowercase k, no M). **Do not** copy the reference Y1 defect, where the ticks read `$-1k` ×5 (`ref-charts-cashflow-cumulative-y1-1440.png`); keep distinct ticks |
| X ticks         | Year numbers; every year up to 10, otherwise `1,5,10,…,30`; Summary uses `Y1…Y5` with `interval=0`; Amortization `Year 1, Year 3, …`                                                                                           | Raw years, `xTickIndexes` thinning, axis title "Year"                                       | Match per-chart tick sets; drop the "Year" axis title where the reference has none                                                                                                   |
| Tooltip         | White `rounded-lg border-slate-200 shadow-lg p-3`, `min-w-[180–260px]`, header "Year N", equation rows (`− x`, `= y`), mono whole-dollar values, teal/red sign colours; follows the cursor                                     | Readout box, cents, swatch rows, `details()` rows                                           | Equation-style rows and whole dollars in tooltips. Tables keep cents                                                                                                                 |
| Legend          | Custom, bottom-centred, 12px; line swatch `h-0.5 w-4`, bar swatch square                                                                                                                                                       | Same idea                                                                                   | Match labels and order per chart                                                                                                                                                     |
| Colours         | teal-500 `#14b8a6`, teal-300 `#5eead4`, teal-600 `#0d9488`, slate-600 `#475569`, slate-500 `#64748b`, slate-400 `#94a3b8`, red-500 `#ef4444`, green-600 `#16a34a`                                                              | teal `#0d9488`, tealLight `#5eead4`, slate `#475569`, red `#dc2626`                         | Primary teal becomes `#14b8a6`, negatives `#ef4444`                                                                                                                                  |
| Bars            | `radius [4,4,0,0]` (Summary `[4,4,4,4]`); stacked bars with thin darker stroke                                                                                                                                                 | `rx ≤ 3`, white 0.5 stroke, stacks square                                                   | Radius 4 on top; teal strokes on stacks                                                                                                                                              |
| Lines           | Monotone curves, width 3 (mortgage, cumulative) or 2.5; dot r 2–3; active r 6                                                                                                                                                  | Straight polyline 2.5, dot 2.5/1.5, active 5                                                | Monotone interpolation and reference widths                                                                                                                                          |
| Animation       | Recharts default mount/update animation (≈1.5 s ease) on every chart; tooltip slides (`transition: transform 400ms`); CSS bars `transition-all duration-300/500`                                                               | 120 ms opacity/fill only                                                                    | Add an entry animation and a tooltip slide, both gated by `prefers-reduced-motion`. The reference ignores reduced motion for Recharts; RocketRental must not                         |
| Typography      | Inter; numbers in **JetBrains Mono** (tiles, tooltips, tables, chips)                                                                                                                                                          | `var(--design-font)`, tabular numerals                                                      | Load a mono numeric face for chart numbers                                                                                                                                           |
| Keyboard / a11y | No keyboard access to charts; no live region                                                                                                                                                                                   | Arrow, Home, End and Escape on the plot; polite live region                                 | **Keep RocketRental's**. This is a deliberate improvement                                                                                                                            |
| Responsive      | **Not responsive.** At 390 px the results column measures 567–952 px (`scrollWidth` 583/635/655/699/803/968), so charts clip and the page scrolls sideways                                                                     | Cards fit at 390 (`scrollWidth == clientWidth`); readout moves under the chart below 480 px | **Do not copy.** Match the desktop look and keep RocketRental's 390 px fit. Stack header controls under the title, and use 2-column tiles                                            |

Keep RocketRental's meaning rules from `roi-graphs.md`:

- "Projected · before tax" subtitles.
- `null` gaps, never `$0`.
- Exact tables in cents.
- The demo-provenance notices.

## 6. Chart-by-chart mismatches

### C1 Net Cash Flow by Year: TASK-8C409E13

**Reference**

- Bars only, 256 px tall; cells `#14b8a6` (≥0) or `#ef4444`; radius 4 on every corner.
- x labels `Y1…Y5` with every label shown.
- Zero line `#94a3b8`; dashed teal vertical marker labelled "Positive Y3" at the first non-negative year after a negative one.
- Year selector defaults to **Y5**; Custom shows a 2–30 slider.
- Legend outside the plot: "Positive Cash Flow" / "Negative Cash Flow" squares, each shown only when it occurs.
- Tooltip: "Year 15 | Gross Rent $50,823 | − Expenses $16,764 | = NOI $33,242 | − Debt Service $21,489 | Cash Flow $11,754". The cash-flow figure is bold teal or red.

**RocketRental (Summary)**

- One teal bar series at 200 px, full hold, no selector, no marker.
- Tooltip shows cumulative cash flow, in whole dollars.

**To build**

- Add the selector (Y1/Y5/Y10/Y30/Custom, default Y5) and the "Positive Yn" marker.
- Add the external legend and the reference tooltip rows; x labels become `Y{n}`.
- Use RocketRental's own reconciled figures (EGI, operating costs, NOI, debt service, reserves, cash flow).
- The reference's "Gross Rent − Expenses = NOI" does not add up: $33,600 − $12,705 ≠ $20,355, because vacancy and other income are hidden. Label the first row "Effective income" so the equation holds.

### C2 Outcome donut: TASK-8C409E13

**Reference** (`ref-summary-outcome-*`)

- Card titled "Outcome", subtitle "Wealth Created (Year N)". Hovering the subtitle opens the included/excluded popover.
- Big number in 30px/700 `#0284c7` (Y1 $37,807; Y30 $1,242,634; Y7 $143,124).
- 112 px donut: inner radius 30, outer radius 50, padding 2°. Segments Cash Flow `#14b8a6`, Principal `#5eead4`, Appreciation `#99f6e4`; negatives clamp to 0.
- Tooltip: "Cash Flow: $412,778".
- Right-hand "Deal Quality" list: DSCR 0.95 (red), GRM 10.1, Rent/Price 0.80%, Profit Index 1.69 (green).
- Legend with mono values. Year selector centred at the bottom (default Y1).
- At Y30 the tooltip overlaps the Deal Quality list (reference defect; keep it clear).

**RocketRental:** nothing.

**To build**

- A donut from the engine's cumulative cash flow, principal paid and appreciation at the selected year.
- Keep the same "before sale, before tax" caveat in the popover.
- Show a negative cumulative cash flow as text, not as a hidden 0 slice.

### C3 Deal Snapshot risk visuals: TASK-DFDAA085

**Reference**

- Dark `from-slate-900` band with a Monthly/Annual toggle and 5 KPI tiles. Each tile opens a popover; the Cash Flow popover shows the NOI − debt service breakdown.
- A 44 px score ring ("27 Deal Score", arc in the risk colour).
- Three factor rows on a 5-segment bar (`#f87171 #fb923c #facc15 #a3e635 #10b981`) with a pill marker.
- Expanded view: a 160×72 semicircle gauge (needle, "Low"/"High", score "73 / 100"), all six factors with Good/Watch/Risk badges, and "How to Improve" ("Increase rent to $3,364/mo → DSCR 1.25x").

**Reference defect:** the ring shows `100 − score` (27) as "Deal Score", while the gauge shows the risk score (73) in the same card. Show one score with one meaning.

**RocketRental:** none; "Year 1 at a glance" is text and "Property risk context" is a text list.

**To build**

- Ring, gauge and factor bars computed from RocketRental metrics (DSCR, CoC, break-even ratio, cap spread, LTV, OER) with the reference weights and thresholds (spec in the reference `RiskMeter.tsx`).
- Label it as a heuristic and not advice. Show "Unavailable" factors when an input is missing.

### C4 Fix My Deal lever bars: TASK-DFDAA085

**Reference**

- Six levers, each on the same 5-segment bar with a 16 px pill:
  - Rent +$100/mo (+$1,140/yr)
  - Vacancy −1% (+$336)
  - Interest Rate −1% (+$2,625)
  - Maintenance −1% (+$336)
  - CapEx −1% (+$336)
  - Mgmt −1% (+$331)
- Collapsible "Targets to Hit" (Rent $2,800 → $3,000 for DSCR ≥ 1.0; Rate 7.25% → 6.52% for cash flow ≥ $0).
- "If you apply all fixes" grid (CF −$94 → $331, DSCR 0.95 → 1.18, CoC −1.1% → 3.9%).
- Best Fix applies a what-if and turns the header button into Reset.

**Reference defects**

- Best Fix always picks Rent.
- Best Fix mutates the "locked" demo.

**To build:** a what-if overlay that never writes the saved assumptions, recomputed by the engine, with an explicit Reset.

### C5 Projection-table mini bars: TASK-8C409E13

**Reference**

- "Cash Flow & Equity Projections" with a Key Rows / Full Table toggle.
- Milestone columns Year 1/5/10/20/30, with calendar years 2027…2056 under them.
- Coloured section icons.
- 48 px mini bars on Cash on Cash and Equity % (teal, or red when negative; width = |v|×500%, capped at 100%).

**RocketRental:** the Summary exact table has none of this.

**To build:** add the milestone table with mini bars beside the existing exact table, and keep the exact table.

### C6 Equity Composition vs Debt Paydown: TASK-8C409E13

**Reference**

- Default Y30.
- Controls: year selector; "Include down payment" checkbox; "$ Value / Indexed" toggle on a second row.
- Tiles:
  - "Equity (Year 30) $922,356": "Mortgage paid off — 100% equity" or "Property Value − Mortgage".
  - "Equity Growth $829,856": "+814% of initial investment".
  - "Mortgage (Year 30) Paid off": "Congratulations!" or "Remaining balance".
- Chips:
  - "Equity gain exceeds debt in Year 12"; with down payment, "Total equity exceeds debt in Year 8".
  - "Mortgage paid off in Year 30".
  - "Growth picks up momentum in later years".
- Chart: 320 px with **dual Y axes** (left teal "Equity Growth", right slate "Debt"; one shared domain, $950k max).
  - Stacked Principal Paid `#14b8a6` (stroke `#0d9488`) and Appreciation `#5eead4` (stroke `#2dd4bf`, top radius 4).
  - Optional Down Payment `#e2e8f0` at 50% opacity.
  - Monotone Mortgage line `#64748b`, width 3.
  - From the crossover year, a shaded `#14b8a6` area at 0.08 opacity, a dashed `#0d9488` vertical labelled "Gain > Debt" (or "Equity > Debt"), and a 6 px teal dot on the mortgage line.
- Indexed mode: subtitle "Indexed view (Y1 = 100)", axes titled "Index" with ticks 0/600/1200/2350, footer "Y1 = 100 …".
- Tooltip: "Year 21 | Property Value $706,912 | − Mortgage Balance $141,747 | = Equity $565,165 | Equity Composition: Down payment $102,000 | Principal paid $120,753 | Appreciation $351,912".

**RocketRental**

- Single USD axis; no shading or dot; "Equity > loan" marker only.
- Toggle "Equity gain / Incl. purchase equity" (segmented, not a checkbox); no Indexed view.
- No momentum or payoff chips.
- Tooltip: series rows plus "Property value" and "= Equity".

**To build**

- Indexed view; dual axes; crossover area and dot; reference chip wording; equation tooltip with a composition block.
- Show the down-payment row only when the toggle is on (the reference always shows it, which is a defect).

### C7 Value vs Mortgage Balance: TASK-8C409E13

**Reference**

- Own selector (default Y30).
- Subtitle "Equity = Property Value − Mortgage Balance (shaded area) · Equity grew +$820,356 (804%)".
- Three mini tiles: Property Value $922,360, Mortgage "Paid off", Equity $922,356.
- 288 px chart starting at a "0" (Start) point:
  - Property Value line `#334155` w2.5 and Mortgage line `#94a3b8` w2.5, dots r3.
  - Teal gradient band (0.4 → 0.1) between the two lines.
- Tooltip: "End of Year 12 | Property Value $541,789 | − Mortgage Balance $215,704 | = Equity $326,085 | Equity is 60% of property value".
- Footer: "The ▢ teal band between the lines represents your equity".

**RocketRental:** none. "Equity growth at year N" is a CSS bar list; "Equity & cash flow" is a single number.

**To build:** a new card under C6, using engine property values and loan balances. Keep the bar list and the single number below it.

### C8 Cash Flow & Cumulative: TASK-8C409E13

**Reference**

- Default Y10.
- Chips (with icons):
  - "Breakeven: Year 5 ⓘ" (tooltip "First year cumulative cash flow turns positive")
  - "Worst: −$1,133 (Year 1)"
  - "Best: $6,464 (Year 10)"
  - "Cumulative at Year 10: $24,997"
- 320 px chart: bars `#14b8a6`/`#ef4444` (top radius 4) and a monotone cumulative line `#475569` w3 with r3 dots.
- Shading: red `#ef4444` at 0.06 before breakeven, green `#10b981` at 0.06 after. A green `#16a34a` dashed "Breakeven" vertical with a 6 px dot.
- Legend: Cash Flow, Cumulative, Pre-breakeven, Post-breakeven.
- Tooltip: "Year 7 | Annual Cash Flow $3,679 | Cumulative $8,450".
- Insight: "At Year 10, cumulative cash flow covers 24.5% of your initial investment ($102,000)". At ≥100% it switches to "has fully recovered … plus N% additional return".
- No KPI tiles.

**RocketRental**

- Four tiles: cumulative, initial cash, recovered ratio, payoff.
- Chips "Cumulative turns positive · year N", Lowest, Highest.
- Marker "Cumulative > $0"; no shading.
- Insight starts "Reading:".

**To build**

- Shading and the Breakeven line/dot; reference chip text and icons; Y10 default; Insight wording.
- The existing tiles may stay under the chart, or be dropped to match. The cash-only caveat must stay.

### C9 Income to Cash Flow Bridge: TASK-8C409E13

**Reference**

- Default Y10.
- Tiles: GOI (Y1) $33,060, NOI (Y1) $20,355, OpEx Ratio 38.4%, NOI Margin 61.6%, each with an ⓘ.
- 320 px time-series chart:
  - GOI line `#2dd4bf`
  - NOI line `#0d9488`
  - dashed Debt Service `#94a3b8` (`5 5`)
  - cash-flow bars `#14b8a6`/`#ef4444`
- Tooltip waterfall: "Year 5 | Gross Operating Income $37,209 | − Operating Expenses $13,752 | = NOI $23,457 | − Debt Service $21,489 | = Cash Flow $1,969 | OpEx Ratio: 37.0% | NOI Margin: 63.0%".
- Insight: "By Year 10, NOI exceeds Debt Service by $6,464/year, yielding a 15.0% cash flow margin on gross income. NOI grew 37% over this period."

**RocketRental:** a Year-1-only CSS bar list. It is not a time series.

**To build**

- This chart, from the engine's annual EGI, operating expenses, NOI, debt service and cash flow.
- RocketRental also deducts capital reserves below NOI: show them as a tooltip row so "= Cash Flow" reconciles.
- Keep the Year-1 list as the exact breakdown.

### C10 Operating Expenses: TASK-2F1D1EFB

**Reference**

- Default Y1. Subtitle "Breakdown by category · Year 10 (+20% vs Y1)".
- Tiles:
  - Operating Expenses $12,705 ($1,059/mo)
  - OpEx Ratio 38.4% (green/amber/red, "Typical: 35–50%", blue-50 tile)
  - Top Driver "Property Tax" ($4,200 (33%), amber tile)
  - Reserves $1,680 (13% of OpEx)
- Ranked rows, each with:
  - a colour square;
  - the name with an ⓘ;
  - a mono value and "(x%)";
  - a 16 px bar on a slate-50 track; when the share is > 40% of the max, the value also appears inside the bar.
- Category colours: Tax `#ef4444`, Management `#f97316`, Insurance `#f59e0b`, Maintenance `#10b981`, CapEx `#14b8a6`, HOA `#3b82f6`, Misc `#94a3b8`.
- Sort menu: Amount / % Share / Biggest Δ vs Y1. Δ mode shows "+$3,259" chips.
- Insight plus a "Simulate −10% Tax" CTA. While simulating: the total turns green, "Simulating 10% tax reduction saves $420/year ($35/mo)", and the top driver switches.
- Footnote: "Maintenance = small/medium repairs …"

**RocketRental**

- Year-1 bar list, all teal, unsorted; two slate tiles.
- A separate "Expense growth" line chart (keep it; it has no reference counterpart).

**To build**

- Year selector with scaling by the engine's per-year operating expenses (not a flat ratio, if real per-category projections exist).
- Category colours, sort menu, Δ chips, top-driver tile, and a simulate what-if that never saves.

### C11 Principal vs Interest Over Time: TASK-2F1D1EFB

**Reference**

- 300 px AreaChart of three overlapping monotone areas at 0.6 opacity:
  - Loan Balance `#ef4444`
  - Principal Paid `#22c55e`
  - Interest Paid `#f97316`
- x labels "Year 1, Year 3 …"; default Recharts legend.
- Tooltip: "Year 9 | Remaining Balance $231,434 | Principal Paid $31,066 | Interest Paid $162,331".

**RocketRental**

- Lines: slate balance, teal principal, amber dashed interest.
- Tiles: loan amount, payment, term interest. Balloon notice; all-cash state.

**To build**

- Areas with the reference palette. Keep the tiles and the all-cash and balloon states, which the reference lacks.

### C12 / C13 / C17 Amortization schedule visuals: TASK-2F1D1EFB

**Reference**

- KPI cards: Loan Amount $262,500, Monthly Payment $1,791, Total Interest $382,159 ("146% of principal"), Total Paid $644,659.
- 24 px "Loan Payoff Breakdown" bar: teal 41% principal / amber 59% interest, centred label.
- Milestone chips: 25% by Y15, 50% by Y22, 75% by Y27, "Principal > Interest from Y21".
- Summary/Detailed toggle. Detailed adds Expand All / Collapse All and monthly rows.
- Table "Paid Off" column with 56 px mini bars.
- Insight cards:
  - "Interest (First 5y) $92,687 — 24% of total", with a 1y/5y/10y select
  - "Principal > Interest Y21"
  - "Balance at Y10 $226,565 — Interest saved $203,209", with a Y5–Y20 select

**RocketRental:** annual table plus a monthly disclosure with a year select only.

**To build:** all of the above around the existing schedule.

### C14 Exit Analysis & Comparison: TASK-2F1D1EFB

**Reference**

- Profit / Total Cash Back view toggle.
- Clickable chips: "Best IRR: Year 10 (10.57%)", "Best Profit: Year 30 ($1,177,793)", "Breakeven: Year 5".
- "Initial Cash Invested: $102,000" strip.
- Exit-year buttons 5y–30y plus Clear; **Year 10 is selected by default**.
- "Year 10 Exit Summary" tiles: Net Proceeds $253,482, Cash Flow $24,997, Total Cash Back $278,478, Profit $176,478, IRR 10.57%.
- 320 px chart:
  - stacked net proceeds `#10b981` and cash flow `#0ea5e9`; the selected bar is darker with a stroke, the others at 0.5 opacity;
  - violet `#8b5cf6` dashed "Initial: $102,000" line;
  - violet dashed vertical at the selected year;
  - x labels "Year 5 … Year 30"; ticks $0k…$1400k.
- Tooltip (shown only when nothing is selected): "Year 20 Exit | Sale Price $686,322 | − Selling Costs $41,179 | − Loan Payoff $152,531 | = Net Proceeds $492,612 | + Cash Flow Received $149,871 | = Total Cash Back $642,483 | − Initial Cash Invested $102,000 | = Profit $540,483 | ROI 529.9% | IRR (Annualized) 9.64%".
- Exit table with badges; trade-off insight.

**RocketRental**

- Exit statement and tiles; a probe form.
- "Profit by exit year" grouped bars (cash returned slate-light, profit teal).

**To build**

- Stacked composition bars, the initial-investment line, selection, chips and tooltip waterfall.
- Use RocketRental's real IRR (the reference "IRR" is an annualised multiple). Label it "IRR" only if it is a true IRR.
- Show the tooltip on hover even while a year is selected (fixes the reference defect).

### C15 / C16 Sensitivity heatmap: TASK-2F1D1EFB

**Reference**

- Year 1 / Stabilized / Year 5 segmented control; "Show values" and "Colorblind-safe" checkboxes; "Customize Ranges" panel.
  - Rent min/max ($1,960–$3,640, base ×0.7–1.3), 3–9 steps (default 5).
  - Vacancy 0–15%, default 6 steps.
  - Base values are inserted into each axis, so the rows read 0/3/5/6/9/12/15%.
- visx SVG heatmap, fixed **650×420**:
  - cells `rx 2`, colour scale red `#ef4444` → amber `#fbbf24` → green `#22c55e` (colour-blind palette `#2166ac` → `#f7f7f7` → `#b2182b`);
  - base cell outlined `#1e40af` 3px with a ★ corner;
  - dashed black break-even contour;
  - axis titles "Monthly Rent" ($2.0k…) and "Vacancy Rate".
- Gradient legend: "−8.0%" to "6.9%", a "0% Break-even" marker, "Range: …".
- Hover panel: "Monthly Rent: $3.6k | Vacancy Rate: 0% | Cash-on-Cash: 6.9%".

**RocketRental**

- An HTML table: two-tone teal/red, base cell outlined, rows = rent, columns = vacancy.
- Metric select (CoC / IRR) and a "Values + accessible palette / Values only" select; range form 1–7 steps.

**To build**

- A continuous 3-stop scale, the colour-blind toggle, the break-even contour, the gradient legend, the hover panel, the ★ base marker and the timeframe toggle.
- Keep the IRR metric option and the table semantics for screen readers.
- Must stay responsive (the reference's fixed 650 px clips at 390).

**Reference defects**

- Year-1 base CoC is −0.5% in the heatmap but −1.11% in the engine.
- Its "Year 5" does not grow rent.

RocketRental cells must come from the engine.

### C18 Equity Growth by Scenario: TASK-DFDAA085

**Reference**

- Chips for Base `#3b82f6`, Optimistic `#22c55e`, Conservative `#f97316`, Best `#10b981`, Worst `#ef4444`. Base is fixed; the others toggle with ×/+.
- "Key Differences vs Base" pills.
- Bordered KPI tiles per scenario (DSCR, Year 1 CF, IRR, Worst Year). Clicking a tile focuses that scenario (others drop to 0.3 opacity).
- Absolute / Δ vs Base view.
- Metrics table with a Y1/5Y/10Y/30Y horizon.
- 320 px LineChart: one line per scenario, w2 (w3 when focused), no dots; x labels `Y1…Y30`; dashed zero line.
- Header breakeven pills: "Base: Yr 18 breakeven", "Worst: >30y".
- Default tooltip: "Year 16 | Base Case : $421,136 | Optimistic : $523,080 | …".
- Insight: "IRR ranges from 7.4% (Conservative) to 13.0% (Optimistic) — a 5.6% spread. Warning: …"

**Reference layout defect:** at 1440 the third KPI tile overflows the card to the right (`ref-scenarios-tab-full-1440.png`).

**RocketRental**

- `seriesPalette` teal/slate/amber/violet, with odd cases dashed.
- A `<select>` horizon from 1 to N years.
- A second "Cash flow by scenario" chart.

**To build**

- Scenario colours, chips, focus and opacity, breakeven pills and the insight.
- Keep the null-gap semantics and the second chart.

### C19 / C20 Benchmarks: TASK-DFDAA085

**Reference C19**

- "Scale: Index (100) | Dollars", default Index.
- Property `#14b8a6` w3 solid; S&P 500 `#3b82f6`, Nasdaq 100 `#8b5cf6`, US Bonds `#22c55e` w2 dashed `5 5`.
- Dashed y=100 line; x ticks Y5…Y30.
- Tooltip: "Year 18 | Property : 578.7 (478.7%) | S&P 500 : 603.3 (503.3%) …" or dollars.
- Clicking a benchmark card focuses it.
- Milestone table below.

**Reference C20**

- 256 px scatter: X "Volatility (%)", Y "Annualized Return (%)".
- Property bubble size 400, benchmarks 300, in asset colours.
- Tooltip "Volatility : 2.0% | Return : 8.95% | size : 400.0%". Drop the bogus `size` row.

**RocketRental**

- I1 indexed, references only (the property is excluded).
- I2 USD lines for all.
- I3 hand-made SVG scatter without the property or a tooltip; at most 2 references.

**To build**

- One chart with an Index/Dollars toggle that includes the property.
- Reference colours and dashing; benchmark focus.
- Scatter with the property and a tooltip. RocketRental's volatility is "Not measured", so plot the property only with an explicit "proxy" label, or omit it with a note. Decide this and document it.

### C21–C24 Compare: TASK-DFDAA085

**Reference C21**

- Assets: S&P 500, Nasdaq 100, US Bonds, REITs `#f97316`, Savings `#64748b`. At most 2 are selected; adding a third drops the oldest.
- USD lines, the property solid w3.
- Tooltip "Year 18 | Property Investment : $590,278 | S&P 500 : $615,349 | Nasdaq 100 : $849,856".

**Reference C22:** 256 px bars per asset, colour = asset, y `x.x%`, tooltip "Annualized Return : 10.50%".

**Reference C23**

- 320 px radar: Return, Yield, Stability, Risk-Adj, each 0–100; fill opacity 0.2.
- No tooltip on hover (`ref-compare-radar-hover-no-tooltip-1440.png`).

**Reference C24:** Absolute / vs Property table with Best and Worst badges; winner cards.

**RocketRental:** the I2 USD chart and the side-by-side table only.

**To build**

- The asset picker (5 assets), C22 and C23 (add a tooltip to the radar).
- Normalised scores must say which inputs are hypothetical.

### C25 Rental Distribution (Search): TASK-DFDAA085

This chart was **not renderable**: the reference needs the RentCast and Google
Places keys, and none were available. The spec comes from source
(`apps/web/src/components/search/SearchPanel.tsx`):

- 224 px area bell curve, `#14b8a6` gradient.
- Comparables as `#94a3b8` dots; "You $x.xk" teal line and dot; "Avg" dashed line.
- Estimate-range band; Low / Average / High tiles.

RocketRental has comps data on `/rent-comps` (a range bar in `CompsWorkbench.tsx`).

Owner decision: build it on `/rent-comps` or `/rent-analysis` from real comps, or
record it as out of scope. To inspect it rendered, add `VITE_RENTCAST_API_KEY` to
`.data/reference/RealROI/apps/web/.env.local` (never commit it).

## 7. Reference behaviour not to copy

1. No mobile layout: horizontal page scroll and clipped charts at 390 px.
2. Duplicate y ticks at Y1 (`$-1k` ×5).
3. The C1 tooltip arithmetic does not reconcile.
4. The C3 "Deal Score" (27) contradicts the gauge (73).
5. The Exit tooltip is suppressed while a year is selected, and its "IRR" is a multiple.
6. Sensitivity CoC differs from the engine; its Year 5 ignores rent growth.
7. The Equity tooltip always lists the down payment.
8. Scenario tiles overflow at 1440.
9. The scatter tooltip shows "size : 400.0%".
10. Best Fix always picks Rent and edits the locked demo.
11. Recharts animations ignore `prefers-reduced-motion`.

## 8. Live-app note

RocketRental's live `http://localhost:3100` was **not running** during this
inspection:

- A connection to `/sign-in` was refused.
- Nothing was listening on 3100, 5433 or 5434.
- Scheduled task `RocketRentalLive3100` (`start.ps1 -Port 3100 -DbPort 5433`) last ran
  2026-10-20 12:18 with result 1, before this inspection started.

This inspection did not start, stop or reseed the app, and did not touch any
`.data/postgres-*` directory. `roi-dataset-repair.md` names
`scripts/start-live.ps1 -SkipInstall` (database 5434) as the launcher for the
preserved dataset; the scheduled task still targets 5433. Restore it with
`start-live.ps1` before TASK-DFDAA085's live verification. The reference stays
on 3300 or another free port.

## 9. TASK-8C409E13 delivery: cash-flow and equity charts

Charts C1, C2, C5, C6, C7, C8 and C9, the shared chart primitives and the
sub-tab order are built. Each chart was checked in a browser against the running
reference at 1440×900 and 390×844 on 2026-10-20.

### 9.1 Runtime used (reproducible)

| App                        | How it ran                                                                                                                                                                                                               | Data                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Reference                  | `scripts/start-realroi-reference.ps1 -SkipInstall` → `http://127.0.0.1:3300/demo`                                                                                                                                        | locked `sampleDealInput`                                                                            |
| RocketRental live (`main`) | root checkout `scripts/start-live.ps1 -SkipInstall` → `http://localhost:3100`                                                                                                                                            | preserved `.data/postgres-5434`. The seed step reported "up to date"; nothing was reseeded or reset |
| RocketRental, this branch  | `npx next dev -p 3110` in the task checkout. The environment comes from the root `.env`, with `ROCKETRENTAL_AUTH_SECRET` set to `start.ps1`'s built-in local-dev secret, because the `.env` value is under 32 characters | the same 5434 database, read only                                                                   |

- §8's note is out of date: the live app on 3100 was restored with
  `start-live.ps1` during this Task.
- **Matched data without touching the live dataset.** Maple Court was opened on
  3110 and the reference inputs were typed into its assumptions form. Recalculate
  ran, the screenshots were taken, and "Reload saved analysis" discarded the
  edits. Nothing was saved: after the reload the purchase price was $2,830,000
  and the table read Y1 −$2,555.40 and Y2 −$175.80 / −$2,731.20, as before.
- For tests, the same inputs live in the isolated fixture
  `tests/analysis/realroi-sample.ts`.
- With these inputs RocketRental's engine reproduces the reference headline
  figures:
  - Y1 cash flow −$1,133
  - Breakeven in year 5
  - Cumulative $24,997 at Y10
  - Y30 equity ≈ $922,360
  - $102,000 cash in

### 9.2 Shared primitives (for TASK-2F1D1EFB and TASK-DFDAA085)

All exported from `src/components/analysis/RoiChart.tsx`, with helpers in
`src/lib/analysis/chart-data.ts`.

| Primitive                                          | Use                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chartColors`                                      | Reference palette: `teal` #14b8a6, `tealDark` #0d9488, `tealLight` #5eead4, `tealPale` #99f6e4, `slateMid` #64748b, `red` #ef4444, `green` #16a34a, `emerald` #10b981, `sky` #0284c7. `seriesPalette` keeps 3:1 line colours for multi-series charts                                                                                                                                                                                                                                                                    |
| `ChartCard`                                        | Slate-100 header strip, 14 px title, 10 px subtitle, right-aligned control column (pass several `<div>` rows for C6-style two-row controls). It stacks below 640 px                                                                                                                                                                                                                                                                                                                                                     |
| `useHorizon(length, label, preferred)`             | `Y1 Y5 Y10 Y30` within the hold, `All Ny` only above 30, and **Custom** with a 2…N slider and a mono `Y{n}` label (default 7). A preset the hold cannot reach shows as Custom at the hold length                                                                                                                                                                                                                                                                                                                        |
| `Segmented`, `Check`                               | Teal-500 pill group (`size="md"` for `$ Value / Indexed`) and the header checkbox                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Tiles`                                            | Mono 18 px values (`size="sm"` gives 14 px), 10 px labels, tones `teal`, `tealSoft`, `slate`, `red`, `amber`, plus `info` (ⓘ) and `valueTone`                                                                                                                                                                                                                                                                                                                                                                           |
| `Chips`                                            | Pill chips with a dot or a lucide-style `icon` (`target`, `down`, `up`) and an optional `info` tip                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `InfoTip`, `Insight`, `Figure`, `MiniBar`, `Donut` | ⓘ hover/focus tip (`aria-describedby`); "Insight:" row with mono teal/red figures; 48 px rate bar (\|v\|×500%); 2°-padded donut with hover tip                                                                                                                                                                                                                                                                                                                                                                          |
| `ComboChart`                                       | Dashed grid both ways and a solid zero line. Monotone lines (`width`, `dot`, `dash`). Bars rounded at the far end (`barRadius="all"` for C1). Stacks with darker outlines and `opacity`. `bands` (fractional index edges), `areas` (gradient between two series), `markers` (`dot`, `align: start\|end\|center`), `axes` (rotated left/right titles, mirrored right ticks), `xFormat`, `legend` override, and `tooltip(i) → {title, rows}` with `op` (−/+/=), `total`, `tone: auto`, `section`, `note` and `money` rows |
| Helpers                                            | `thousands` (`$950k`, exact decimals so a $2,500 step reads `$2.5k`), `wholeDollars`, `monotonePath`, `referenceTickIndexes` (all years ≤10, else 1, 5, 10, …), `horizonChoices`, `breakevenYear`, `firstPositiveAfterNegative`, `equityYears`, `equityLandmarks`, `indexAgainst`, `wealthAt`, `milestoneYears`, `calendarYear`, `miniBarWidth`, `PAID_OFF_BELOW`                                                                                                                                                       |

**Rules that hold for every chart:**

- Hover, tap and keyboard (arrows, Home, End, Escape) all drive the same readout.
- The visual tooltip shows whole dollars and follows the pointer. Below 480 px it
  sits under the plot instead.
- The polite live region reads the exact cents from the adjacent table.
- `null` values leave a gap, and the legend says "Gap = unavailable, not $0".
- The entry clip-reveal and the tooltip slide only run with
  `prefers-reduced-motion: no-preference`.

**Inherited by other owners' charts (Scenarios, Benchmarks, Exit, Expenses,
Amortization):**

- New grid, ticks, monotone lines and teal-500 bars.
- No "Year" axis title, unless they pass `axisTitle` (Amortization and Exit
  still do).
- Whole-dollar visual tooltips.

Their composition is still theirs to change.

### 9.3 Chart results

**C6 Equity Composition vs Debt Paydown.**

- Resolved:
  - Y30 default.
  - Y1/Y5/Y10/Y30/Custom, the "Include down payment" checkbox and the `$ Value / Indexed` row.
  - Reference tiles and wording, including "Mortgage paid off — 100% equity".
  - Gain/Total crossover, payoff and momentum chips (the reference's 1.2×/1.5× rule).
  - Dual axes on one domain.
  - Stacked principal and appreciation with darker outlines, a 50% down-payment segment and a w3 monotone mortgage line.
  - Crossover shading at 0.08, the dashed "Gain > Debt" / "Equity > Debt" marker and a 6 px dot.
  - Indexed mode (Y1 = 100, the reference formula) with its footer.
  - Equation tooltip with an "Equity Composition" block.
- Deliberate:
  - The down-payment row appears only when included (reference defect 7).
  - "Paid off" only below $0.50, not $100.
  - "Loan fully repaid" instead of "Congratulations!".
  - A red "Value decline" bar and legend item if appreciation is ever negative.
  - Indexed tooltips keep dollar rows plus the index values.

**C7 Value vs Mortgage Balance.**

- Resolved:
  - New card under C6 with its own Y30 selector.
  - Subtitle with "Equity grew +$…(…%)".
  - Three mini tiles.
  - A 288 px chart from a `0` (Start) point, with property value #334155, mortgage #94a3b8 and r3 dots.
  - A 0.4 → 0.1 teal gradient band between the lines.
  - "End of Year N" / "Start" equation tooltip with "Equity is N% of property value".
  - The band footer.
- Start uses the after-repair value (or purchase price) and the original loan,
  which the footnote states.

**C8 Cash Flow & Cumulative.**

- Resolved:
  - Y10 default.
  - Chips with icons: "Breakeven: Year 5 ⓘ", "Worst: −$1,133 (Year 1)", "Best: $6,464 (Year 10)", "Cumulative at Year 10: $24,997".
  - Bars at radius 4 and a w3 monotone cumulative line.
  - Red pre-breakeven and green post-breakeven bands.
  - A green dashed "Breakeven" line with a 6 px dot.
  - The four-item legend.
  - "Year N | Annual Cash Flow | Cumulative" tooltip.
  - The reference insight wording at <100% and ≥100%.
- Deliberate:
  - "No breakeven by Year N" and an all-red band when cumulative cash never turns positive.
  - A negative-cumulative insight.
  - The cash-only caveat.
  - The four RocketRental tiles kept under the chart (allowed in §6).

**C9 Income to Cash Flow Bridge.**

- Resolved:
  - Y10 default.
  - GOI/NOI/OpEx Ratio/NOI Margin tiles with ⓘ.
  - GOI #2dd4bf, NOI #0d9488 and dashed (`5 5`) debt service #94a3b8 lines, plus cash-flow bars.
  - Waterfall tooltip with OpEx Ratio and NOI Margin.
  - The insight.
- Deliberate:
  - A "− Capital Reserves" row so "= Cash Flow" reconciles (RocketRental deducts reserves below NOI).
  - The insight names the reserves.
  - The Year-1 exact list stays below as "From income to cash flow".

**C1 Net Cash Flow by Year.**

- Resolved:
  - Y5 default with Custom.
  - 256 px bars at radius 4 on every corner.
  - `Y1…Yn` labels (all years ≤10, then every fifth).
  - The "Positive Y3" marker centred above a dashed line.
  - An external legend showing only the signs present.
- Deliberate:
  - The tooltip reconciles: Effective income − Operating costs = NOI − Debt service − Capital reserves = Cash Flow (§7 item 3).

**C2 Outcome.**

- Resolved:
  - "Wealth Created (Year N)".
  - 30 px #0284c7 total.
  - 112 px donut (inner radius 30, outer radius 50, 2° padding, three teal tones).
  - Deal Quality: DSCR red below 1.00 and green from 1.25; GRM; Rent/Price; Profit Index green from 1.00.
  - Mono legend values.
  - Centred Y1 selector.
  - "Cash Flow: $x" hover tip.
- Deliberate:
  - The included/excluded popover is an ⓘ tip.
  - A negative part is stated in text and left out of the ring.
  - The hover tip sits below the ring, so it never covers the total or Deal Quality (reference defect).
  - "No debt" replaces DSCR for all-cash deals.

**C5 Cash Flow & Equity Projections.**

- Resolved:
  - Key Rows / Full Table toggle.
  - Positive/Negative key.
  - Milestone columns Year 1/5/10/20/30 (plus the final year of shorter holds) with calendar years.
  - Coloured section icons and collapsible sections.
  - Highlighted Annual Cash Flow and Total Equity rows.
  - Signed, coloured appreciation and mortgage rows.
  - 48 px mini bars on Cash on Cash and Equity %.
  - The footer.
- Deliberate:
  - Whole dollars, with the exact-cents table kept below as "Exact annual cash flow".
  - Income Analysis and Operating Expenses sections include RocketRental's rows (Effective income, NOI, Capital reserves).
  - In the Summary column (≈640 px at 1440 because of the assumptions form) the table compacts below a 760 px container width: 24 px bars and tighter cells. All five columns fit without scrolling.

### 9.4 Paired screenshots (`docs/analysis/realroi-chart-parity/`)

The `ref-*` files are the reference captures from §4. The `rr-*` files come from
the task build, taken with the matched sample inputs at 1440×900 (element shots;
`*-tooltip-*` are viewport shots), except `rr-live-maple-*`, which use the live
saved dataset. `ref-live-*` are fresh captures from the running reference on
3300, taken at the same time.

| Chart                                                                   | Reference                                                                                                                                                                             | RocketRental                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1 default / negative tooltip / Y30 / Y30 tooltip / custom              | `ref-summary-net-cashflow-y5-1440`, `-y5-tooltip-negative-1440`, `-y30-1440`, `-y30-tooltip-1440`, `-custom-1440`, `ref-live-summary-net-cashflow-1440`                               | `rr-summary-net-cashflow-y5-1440`, `-y5-tooltip-negative-1440`, `-y30-1440`, `-y30-tooltip-1440`, `-custom-1440`, `rr-live-maple-summary-net-cashflow-1440`                                            |
| C1 390                                                                  | `ref-mobile-390-viewport-summary-net-cashflow`, `ref-live-summary-net-cashflow-390`                                                                                                   | `rr-mobile-390-summary-net-cashflow`, `rr-mobile-390-summary-net-cashflow-tap`                                                                                                                         |
| C2 Y1 / Y30 / tooltip / custom                                          | `ref-summary-outcome-donut-y1-1440`, `-y30-1440`, `-y30-tooltip-1440`, `ref-summary-outcome-custom-1440`                                                                              | `rr-summary-outcome-donut-y1-1440`, `-y30-1440`, `-y30-tooltip-1440`, `rr-summary-outcome-custom-1440`, `rr-mobile-390-summary-outcome`                                                                |
| C5 key rows / full                                                      | `ref-summary-projection-table-keyrows-1440`, `-full-1440`                                                                                                                             | `rr-summary-projection-table-keyrows-1440`, `-full-1440`, `rr-mobile-390-summary-projection-table`, `rr-live-maple-summary-projection-table-1440`                                                      |
| C6 Y30 / tooltip / incl. down / indexed / indexed tooltip / Y5 / custom | `ref-charts-equity-composition-y30-1440`, `-y30-tooltip-1440`, `-incl-down-1440`, `-indexed-1440`, `-indexed-tooltip-1440`, `-y5-1440`, `-custom-1440`, `ref-live-charts-equity-1440` | `rr-charts-equity-composition-y30-1440`, `-y30-tooltip-1440`, `-incl-down-1440`, `-indexed-1440`, `-indexed-tooltip-1440`, `-y5-1440`, `-custom-1440`, `rr-live-maple-equity-composition-1440`         |
| C6 390 / tap                                                            | `ref-mobile-390-viewport-equity-composition`, `ref-mobile-390-viewport-equity-tap-tooltip`, `ref-live-charts-equity-390`                                                              | `rr-mobile-390-equity-composition`, `rr-mobile-390-equity-tap-tooltip`                                                                                                                                 |
| C7 Y30 / tooltip / Y10                                                  | `ref-charts-value-vs-mortgage-y30-tooltip-1440`, `-y10-1440`                                                                                                                          | `rr-charts-value-vs-mortgage-y30-1440`, `-y30-tooltip-1440`, `-y10-1440`, `rr-mobile-390-value-vs-mortgage`, `rr-mobile-390-value-vs-mortgage-tap`, `rr-live-maple-value-vs-mortgage-1440`             |
| C8 Y10 / tooltip / Y1 / Y30 / custom Y20                                | `ref-charts-cashflow-cumulative-y10-default-1440`, `-y10-tooltip-1440`, `-y1-1440`, `-y30-1440`, `-custom-y20-1440`, `ref-live-charts-cashflow-1440`                                  | `rr-charts-cashflow-cumulative-y10-default-1440`, `-y10-tooltip-1440`, `-y1-1440`, `-y30-1440`, `-custom-y20-1440`, `rr-live-maple-cashflow-cumulative-1440`                                           |
| C8 390                                                                  | `ref-mobile-390-charts-cashflow`, `ref-live-charts-cashflow-390`                                                                                                                      | `rr-mobile-390-cashflow-cumulative`, `rr-mobile-390-cashflow-cumulative-tap`                                                                                                                           |
| C9 Y10 / tooltip / Y30 / Y1                                             | `ref-charts-cashflow-bridge-y10-default-1440`, `-y10-tooltip-1440`, `-y30-1440`, `-y1-1440`                                                                                           | `rr-charts-cashflow-bridge-y10-default-1440`, `-y10-tooltip-1440`, `-y30-1440`, `-y1-1440`, `rr-mobile-390-cashflow-bridge`, `rr-mobile-390-cashflow-bridge-tap`, `rr-live-maple-cashflow-bridge-1440` |

At 390 px RocketRental's `scrollWidth` equals its `clientWidth` (390) on
Summary, Charts → Equity and Charts → Cash Flow. The reference's is 583.

### 9.5 Remaining differences (known, not defects)

1. **Engine definitions.** RocketRental puts capital reserves below NOI, so with
   the same inputs:

   | Metric     | Reference | RocketRental |
   | ---------- | --------- | ------------ |
   | NOI        | $20,355   | $22,035      |
   | DSCR       | 0.95      | 1.03         |
   | OpEx ratio | 38.4%     | 33.3%        |
   | Cap rate   | 5.82%     | 6.3%         |

   Appreciation is measured from the purchase price, so the after-repair uplift
   counts:

   | Metric           | Reference        | RocketRental     |
   | ---------------- | ---------------- | ---------------- |
   | Equity growth    | $829,856         | $834,860         |
   | Y1 wealth        | $37,807          | $42,807          |
   | C7 "Equity grew" | +$820,356 (804%) | +$804,860 (685%) |

   C7 starts from after-repair value minus the original loan. Every RocketRental
   figure comes from its own projection rows.

2. **Axes.** _Superseded by §12:_ domains and ticks now follow the reference's
   Recharts rules (C6 $950k). Negative ticks still read `-$9k`, not `$-9k`,
   matching the tables.
3. **Fonts.** _Superseded by §12:_ JetBrains Mono is bundled and Inter was
   already the bundled design font (the same Google Fonts file as the reference).
4. **Contrast.**
   - Header subtitles are #526174, not #64748b, so 10 px text keeps 4.5:1.
   - Pressed teal-500 pills get a #0d9488 inset.
   - Axis titles are teal-700 and slate-500.
5. **Motion.** One clip-reveal entry animation, not Recharts' per-series growth.
6. **Narrow screens.** Below 480 px the readout sits under the plot rather than
   floating.
7. **Not checked live.** The live dataset has no incomplete-ROI property (all
   four listed properties have complete inputs). The "Complete your assumptions"
   and Summary fallbacks are covered by `tests/analysis/workspace.test.tsx`.

## 10. TASK-2F1D1EFB delivery: expense, amortization, exit and sensitivity charts

Charts C10–C17 are built. Each was checked in a browser against the running
reference at 1440×900 and 390×844 on 2026-10-20.

### 10.1 Runtime used

Same as §9.1: the reference on 3300 (`start-realroi-reference.ps1 -SkipInstall`), the
live app on 3100 (root `start-live.ps1 -SkipInstall`, preserved `.data/postgres-5434`,
seed "up to date"), and this branch on 3110 (`npx next dev -p 3110`, root `.env`,
`DATABASE_URL` pinned to 5434, the `start.ps1` local-dev auth secret).

- The matched captures typed the §1 sample inputs into Maple Court on 3110 and
  pressed Recalculate.
- **Dataset incident, repaired.** Discarding those inputs through "Reload saved
  analysis" and a loosely matched confirm button saved them as a new DRAFT
  `RoiAnalysisState` row for Maple Court (revision 1, created 21:15:51 UTC). Before this
  no row existed for any property, and `Property.roiInputs` and its provenance were
  never touched (last updated 19:15 UTC).
  - That single row was deleted by id, so `RoiAnalysisState` is empty again.
  - Afterwards both 3100 and 3110 show Maple Court at Revision 0, price $2,830,000 and
    Year 1 cash flow −$2,555, as before.
  - To discard test inputs, reload the page instead. Unsaved edits are not stored in
    the browser.
- Tests use the isolated fixture `tests/analysis/realroi-sample.ts`.

### 10.2 New and extended primitives

| Where            | What                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoiChart.tsx`   | `ComboChart`: `refLines` (labelled horizontal reference line), `emphasis`/`emphasizeHover` (selected bar darkens and others fade to 0.5), `onSelect` (click, tap, Enter or Space), `xTicks`, flat-fill `areas` (`opacity`), tooltip `color` rows, label-less markers. Long edge x labels are anchored inside the plot |
| `RoiChart.tsx`   | `Icon` (lucide outlines), `Chips` `size="sm"` and toggle-button chips, `Tiles` tones `blue`, `muted` and `card` with icon chips, value tones `green` and `amber`. `ExactTable` and `Statement` moved here                                                                                                             |
| `chart-data.ts`  | `expenseCategories`, `expenseYear`, `sortExpenses`, `loanSummaries`, `loanMilestones`, `amortizationTicks`, `exitRows`, `exitLandmarks`, `heatColor`, `heatPalette`, `colorblindPalette`, `breakevenContour`                                                                                                          |
| `projections.ts` | Sensitivity: reference default ranges, base values inserted into each axis, 1–9 steps (at most 100 calculations), and engine Year 3 / Year 5 cash-on-cash per cell                                                                                                                                                    |
| Components       | `RoiExpenses.tsx`, `RoiAmortization.tsx`, `RoiExit.tsx`, `RoiSensitivity.tsx`, `detail-charts.module.css`                                                                                                                                                                                                             |

### 10.3 Chart results

With the sample inputs the panels reproduce the reference figures:

- Amortization: loan $262,500, payment $1,791, total interest $382,159 (146% of
  principal), total paid $644,659, 41% / 59%; 25% by Y15, 50% by Y22, 75% by Y27,
  Principal > Interest from Y21; first-5-year interest $92,687 (24%); Y10 balance
  $226,565 with $203,209 interest saved.
- Year 9 tooltip: $231,434 / $31,066 / $162,331.
- Exit: Year 10 net proceeds $253,482, cash flow $24,997, total cash back $278,478,
  profit $176,478. The Year 20 waterfall matches line by line ($686,322 − $41,179 −
  $152,531 = $492,612; + $149,871 = $642,483; − $102,000 = $540,483; ROI 529.9%).
- Expenses: Y30 change chips +$3,259 on tax; the Y10 subtitle reads "+20% vs Y1".

**C10 Operating Expenses.**

- Resolved:
  - Y1 default, Y1/Y5/Y10/Y30/Custom, and the "(+N% vs Y1)" subtitle in red or teal.
  - Four tiles: Operating Expenses with /mo; OpEx Ratio on blue-50, green ≤40%, amber ≤50%, red above, "Typical: 35–50%"; Top Driver on amber; Reserves with "% of OpEx". Each has an ⓘ.
  - "Expense Breakdown" panel with the reference colours, a 12 px square, ⓘ, mono value and "(x%)", 16 px bars with the value inside when the bar is over 40% of the largest.
  - "Sort: Amount ▾" menu (Amount / % Share / Biggest Δ vs Y1) with Δ chips and trend icons.
  - Insight with the reference advice per top driver and the high-OpEx sentence.
  - "Simulate −10% Tax" / Reset, the Maintenance/CapEx footnote.
- Deliberate:
  - Categories come from the engine: every operating cost grows by one expense-growth multiplier, so each year scales Year-1 inputs by that year's operating total and they add up to the projection table. The reference uses a flat EGI-minus-NOI ratio that includes CapEx.
  - CapEx is listed last under "Below NOI", with its share as "% of OpEx", because RocketRental deducts reserves below NOI. Utilities (violet) and Leasing (sky) are RocketRental-only categories. Zero categories are hidden, as in the reference.
  - Top Driver always means the largest amount; the reference follows the current sort. While simulating, it shows the actual largest cost after the cut rather than always switching away from tax.
  - The simulation changes only the tiles and insight, says "saved assumptions are unchanged", and never saves.
  - The sort menu is a keyboard menu button (Enter, arrows, Escape returns focus).
  - New exact table "Expense categories · year N" in cents. The "Expense growth" chart and "Expense projections" table stay.

**C11 Principal vs Interest Over Time.**

- Resolved: three overlapping monotone areas at 0.6 (balance #ef4444, principal #22c55e, interest #f97316), 300 px, `Year 1, 3, 5, 7, 9, 12 … 30` labels, line-and-dot legend, and the "Remaining Balance / Principal Paid / Interest Paid" tooltip in series colours.
- Deliberate: the all-cash state and balloon notice stay. The loan tiles moved into the schedule's KPI cards, which carry the same figures.

**C12 / C13 / C17 Loan Amortization Schedule.**

- Resolved:
  - Header dot key.
  - Four bordered KPI cards with icon chips.
  - 24 px payoff bar with a centred label and an amount key.
  - Milestone chips (target and zap icons).
  - Summary/Detailed toggle with Expand All | Collapse All and inline monthly rows.
  - Year table (Beginning, teal Principal, amber Interest, Ending, 56 px Paid Off bars) with "50%" and "P> I" badges on milestone rows, sticky header and 400 px scroll.
  - Three insight cards with their 1y/5y/10y and Y5–Y20 selects.
- Deliberate:
  - "Principal > Interest" says "Not within term" when it never happens. The reference falls back to "Y1 — from the start".
  - "Interest saved" has an ⓘ explaining that it is interest avoided if the loan is repaid then.
  - Detailed rows open from a labelled button (`aria-expanded`), not only a row click.
  - The exact annual table and monthly disclosure stay below.

**C14 Exit Analysis & Comparison.**

- Resolved:
  - View: Profit / Total Cash Back with ⓘ.
  - Clickable Best IRR / Best Profit / Breakeven chips.
  - The "Initial Cash Invested" strip.
  - 5y–30y exit buttons plus Clear, with Year 10 selected by default.
  - "Year N Exit Summary" with five tiles.
  - Stacked net proceeds #10b981 and cash flow #0ea5e9: the selected bar is darker with an outline, the others at 0.5 opacity.
  - Violet dashed "Initial: $…" line and selected-year vertical.
  - "Year N" labels, the custom legend with the bar-height note, and the waterfall tooltip.
  - Exit table with badges and eye buttons; the trade-off insight.
- Deliberate:
  - **IRR is the engine's leveraged IRR**, recalculated for each exit year (10.76% at Y10). The reference's "IRR" is an annualised multiple (10.57%). Best IRR ignores unavailable IRRs.
  - The tooltip still shows on hover while a year is selected (§7 item 5).
  - Bars can be selected by click, tap, Enter or Space.
  - The exact exit statement (for the probe year), the probe form and the cents table stay. The table gains a "Leveraged IRR" column.

**C15 / C16 Sensitivity heatmap.**

- Resolved:
  - Year 1 / Stabilized (Year 3) / Year 5 toggle.
  - "Show values" and "Colorblind-safe" checkboxes.
  - "Customize Ranges" panel: Min/Max with $ and % adornments, 1–9 step sliders, "Your assumption", Reset.
  - Reference defaults (rent ×0.7–×1.3 in 5 steps, vacancy 0–15% in 6), with the base rent and vacancy inserted (rows 0/3/5/6/9/12/15%).
  - Continuous 3-stop scale over the grid's own range, cells `rx 2` with white gaps.
  - Base cell outlined #1e40af 3px with a ★ corner.
  - Dashed break-even contour.
  - "Monthly Rent" / "Vacancy Rate" axes with `$2.0k` and `5%` ticks.
  - Gradient legend with "0% Break-even" and "Range: …".
  - "★ Your assumptions / Break-even line" key and the hover panel with "(negative)".
- Deliberate:
  - Every cell is a full engine run. The base cell equals the engine (−1.11%, where the reference shows −0.5%). Year 3 and Year 5 use the probe's own projection rows, so rent growth counts (§7 item 6).
  - The colour-blind palette keeps losses on the red end. The reference maps losses to blue and the best returns to red.
  - Cell text is white or slate-900, whichever contrasts more.
  - The contour connects each row's interpolated crossing and breaks where a row has none. The reference sorts points by angle, which can zigzag.
  - Responsive: the SVG fills its column up to the reference's 650 px. At 390 it is 285 px wide.
  - The plot is one focus stop. Arrow keys, Home, End and Escape move between cells, starting at the base cell, and a polite live region reads the exact value.
  - Updates still run through "Update sensitivity" with validation, so the panel opens itself when there is an error.
  - The IRR metric select stays; it disables the timeframe toggle.
  - The exact grid table (4 dp) and the model notice stay.

### 10.4 Paired screenshots (`docs/analysis/realroi-chart-parity/`)

`rr-charts-*` use the matched sample inputs at 1440. `rr-live-maple-*` use the
saved live dataset. `ref-live-charts-{expenses,amortization,exit,sensitivity}-{1440,390}`
are fresh reference captures from the same session. To stay under the project's
64 MiB repository-tree limit, this task's captures are stored as 256-colour palette
PNGs (5.1 MB re-encoded to 1.8 MB), so gradients show slight banding.

| Chart                                                                         | Reference                                                                                                                                                                                                        | RocketRental                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C10 Y1 / Y10 / Y30 / custom / sort Δ / simulate / ⓘ                           | `ref-charts-expenses-y1-1440`, `-y10-1440`, `-y30-1440`, `-custom-1440`, `-y30-sort-delta-1440`, `-simulate-tax-1440`, `-info-tooltip-1440`, `ref-live-charts-expenses-1440`                                     | `rr-charts-expenses-y1-1440`, `-y10-1440`, `-y30-1440`, `-custom-1440`, `-y30-sort-delta-1440`, `-sort-menu-1440`, `-simulate-tax-1440`, `-info-tooltip-1440`, `rr-live-maple-expenses-1440`                         |
| C10 390                                                                       | `ref-mobile-390-charts-expenses`, `ref-live-charts-expenses-390`                                                                                                                                                 | `rr-mobile-390-expenses`, `-expenses-info-tap`, `-expenses-info-focus`                                                                                                                                               |
| C11 default / tooltip                                                         | `ref-charts-amortization-area-default-1440`, `-area-tooltip-1440`, `ref-live-charts-amortization-1440`                                                                                                           | `rr-charts-amortization-area-default-1440`, `-area-tooltip-1440`, `rr-live-maple-amortization-area-1440`                                                                                                             |
| C12/C13/C17 summary / detailed / insights                                     | `ref-charts-amortization-schedule-summary-1440`, `-schedule-detailed-1440`, `-insights-10y-y20-1440`                                                                                                             | `rr-charts-amortization-schedule-summary-1440`, `-schedule-detailed-1440`, `-insights-10y-y20-1440`, `rr-live-maple-amortization-schedule-1440`                                                                      |
| C11–C13 390                                                                   | `ref-mobile-390-charts-amortization`, `ref-live-charts-amortization-390`                                                                                                                                         | `rr-mobile-390-amortization-area`, `-amortization-area-tap`, `-amortization-schedule`                                                                                                                                |
| C14 Y10 / cash back / Y30 / breakeven / cleared hover / selected hover        | `ref-charts-exit-default-y10-selected-1440`, `-total-cash-back-1440`, `-y30-selected-1440`, `-breakeven-chip-selected-1440`, `-cleared-hover-tooltip-1440`, `ref-live-charts-exit-1440`                          | `rr-charts-exit-default-y10-selected-1440`, `-total-cash-back-1440`, `-y30-selected-1440`, `-breakeven-chip-selected-1440`, `-cleared-hover-tooltip-1440`, `-selected-hover-tooltip-1440`, `rr-live-maple-exit-1440` |
| C14 390                                                                       | `ref-mobile-390-charts-exit`, `ref-live-charts-exit-390`                                                                                                                                                         | `rr-mobile-390-exit`, `-exit-tap`                                                                                                                                                                                    |
| C15/C16 Year 1 / stabilized / Year 5 / values / colour-blind / ranges / hover | `ref-charts-sensitivity-year1-default-1440`, `-stabilized-1440`, `-year5-1440`, `-show-values-1440`, `-colorblind-values-1440`, `-customize-ranges-1440`, `-hover-cell-1440`, `ref-live-charts-sensitivity-1440` | `rr-charts-sensitivity-year1-default-1440`, `-stabilized-1440`, `-year5-1440`, `-show-values-1440`, `-colorblind-values-1440`, `-customize-ranges-1440`, `-hover-cell-1440`, `rr-live-maple-sensitivity-1440`        |
| C15 390                                                                       | `ref-mobile-390-charts-sensitivity`, `ref-live-charts-sensitivity-390`                                                                                                                                           | `rr-mobile-390-sensitivity`, `-sensitivity-tap`, `-sensitivity-ranges`                                                                                                                                               |

Browser interactions checked:

- Mouse hover on every chart.
- Click to select on Exit bars, chips, year buttons and table rows.
- Tap at 390 on the amortization, exit and heatmap plots.
- Keyboard: arrows on the heatmap; Home/arrows/End/Enter on the Exit chart; Enter, arrows and Escape in the sort menu; ⓘ focus.
- At 390 the page `scrollWidth` equals `clientWidth` on all four panels (375 = 375 once the page scrollbar appears). The reference's is 699.

### 10.5 Remaining differences

1. Engine definitions (§9.5): OpEx excludes reserves (33.3% against 38.4%), and the
   heatmap cells and IRR are true engine values, so they differ from the reference's
   shortcuts.
2. _Superseded by §12:_ the Exit axis now reads $0k…$1400k in $350k steps, as in
   the reference.
3. The "Initial: $…" label sits above the line at the right end inside the plot,
   rather than outside it.
4. The amortization x labels approximate Recharts' automatic thinning with a fixed rule.
5. The balloon notice also appears when the final scheduled payment differs from the
   regular payment by more than $1 because of rounding (sample: $1,794.25). This
   existing behaviour was not changed by this task.

## 11. TASK-DFDAA085 delivery: comparison charts and live parity

Charts C3, C4 and C18–C25 are built, and every chart in §4 now has a RocketRental
counterpart. Each new chart was checked against the running reference on 3300 at
1440×900 and 390×844 on 2026-10-20, with the §1 sample inputs typed into an unsaved
Maple Court draft on the task build (3110, database 5434 read only). The draft was
discarded by leaving the page, never through "Reload saved analysis", and no row
changed (§11.5).

### 11.1 New pieces

| Where                   | What                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `deal-insights.ts`      | Risk factors (reference weights and thresholds on engine metrics), engine-run levers, bisection-solved targets and "How to Improve"  |
| `RoiDealPanels.tsx`     | `DealSnapshot` (C3) and `FixMyDeal` (C4)                                                                                             |
| `RoiScenarioCharts.tsx` | `ScenarioCharts` (C18): preset chips, Key Differences, focusable KPI tiles, Key Metrics table, equity and cash-flow charts           |
| `RoiCompareCharts.tsx`  | `ScatterChart` (C20) and `RadarChart` (C23), both with hover, tap and arrow-key readouts and a polite live region                    |
| `RoiBenchmarks.tsx`     | `BenchmarksView` (C19/C20) and `CompareView` (C21–C24)                                                                               |
| `benchmarks.ts`         | `marketComparison` (property against S&P 500, Nasdaq 100 and US Bonds), `radarScores`, `riskAdjusted`                                |
| `scenarios.ts`          | `scenarioColors` (reference preset colours), `scenarioDifferences`                                                                   |
| `RoiChart.tsx`          | Series `colors` (per-bar fill), line `opacity` (focus), `tickFormat`. Closed ⓘ tips use `display: none` so they never widen the page |
| `RentDistribution.tsx`  | C25 on the comps workbench (`/properties/<id>/listing`), from `lib/comps/distribution.ts`                                            |

### 11.2 Chart results

With the sample inputs RocketRental reproduces these reference figures exactly:
cash flow −$94/mo (−$1,133/yr), CoC −1.11%, cash in $102,000; scenario IRRs 10.4% /
13.0% / 7.4% and the insight "7.4% (Conservative) to 13.0% (Optimistic) — a 5.6%
spread"; breakeven pills Base Yr 18, Optimistic Yr 14, Conservative Yr 27; the Year 16
equity tooltip $421,136 / $523,080; the Year 18 benchmark tooltip 578.7 (478.7%) /
603.3 (503.3%) / 833.2 / 240.7 and $590,278 / $615,349 / $849,856.

**C3 Deal Snapshot.** Resolved: dark band, "(Year 1)", status pill, assumption chip,
Monthly/Annual toggle, Snapshot sidebar (NOI, rent, price, appreciation, 5-yr returns),
five KPI tiles that open their breakdown (click, tap or Enter; Escape or an outside
click closes), the 44 px ring, level pill, top-3 factor pills and five-segment bars, the
worst-factor hint, and the expanded semicircle gauge with all six factors, Good/Watch/Risk
badges and "How to Improve". Deliberate: one score with one meaning — the ring and the
gauge both show the risk score (reference defect 4); it is labelled "Heuristic, not
advice"; a factor with a missing input is shown as not scored and left out of the
weighted average; an all-cash deal reads "No debt". "How to Improve" targets are solved
with the engine, not the reference's approximations. The cash-flow popover adds the
capital-reserves row so it reconciles.

**C4 Fix My Deal.** Resolved: six levers with +$/yr and the five-segment pill bars,
Best Fix / Reset, collapsible Targets to Hit with Apply / Apply All, the Applied
adjustments strip, and the collapsible "If you apply all fixes" Cash Flow / DSCR / CoC
grid. Deliberate: each lever is a full engine run (rent +$100 is +$929/yr, not the
reference's 1,140, because management, maintenance and CapEx scale with rent); fixed
annual costs are cut by 1% of gross rent; the combined grid runs all levers together
instead of adding them; Best Fix picks the largest engine impact (reference defect 10);
the what-if stays inside the card and never saves.

**C18 Scenarios.** Resolved: reference preset colours, Base fixed, other cases toggle
with ×/+, missing presets offered as "+" chips that add an unsaved example, Key
Differences pills (green/red by effect), bordered KPI tiles that focus a scenario
(others fade to 0.3, focused line w3), Absolute / Δ vs Base, Key Metrics with impact dots,
best/worst shading and a Y1/Y5/Y10/Y30/Custom horizon, `Y{n}` labels, breakeven pills
and the IRR-spread insight. Deliberate: the horizon runs to the longest hold so a
shorter scenario leaves a gap, never $0; tiles never overflow (reference defect 8); the
cash-flow chart and exact cents tables stay; with only Base Case the insight says so.

**C19/C20 Benchmarks.** Resolved: the out/under-performance banner, four risk tiles,
Investment Comparison table, Index (100) / Dollars chart (property solid w3, references
dashed `5 5`, y = 100 line, milestone ticks and table), focusable benchmark cards and the
insight. The Benchmarks tab always shows the three reference markets, read-only, as the
reference does; the saved selection (at most two) lives on Compare. Scatter decision: the
property's volatility is not measured, so it is drawn as a labelled return line ("8.80% ·
volatility not measured") instead of a point at an invented x; the tooltip has no `size`
row (reference defect 9).

**C21–C24 Compare.** Resolved: asset chips (property fixed), winner cards, the
Absolute / vs Property table with Best/Worst badges and impact dots, the USD growth
chart, per-asset annualized-return bars and the radar with a tooltip (the reference has
none). Deliberate: a third pick shows the existing limit message instead of silently
dropping the oldest (RocketRental's saved-selection rule); "Most Stable" only ranks
measured volatilities; property Stability and Risk-Adj are "Not measured" (open, dashed
shape) and its Yield is its Year-1 cash-on-cash, so no score is invented (the reference
uses a fixed 12% volatility and 0.3 × return yield). The exact comparison table stays.

**C25 Rental Distribution.** The reference cannot render it without RentCast/Google
keys, so it was built from source: Low/Average/High tiles, a normal curve over the
included comps with a teal gradient, comps as slate dots, the subject's rent as a teal
line and dot ("You $1.7k", "≈ Avg" when within 8%), a dashed average and the suggested
range band. Deliberate: the subject's rent is plotted but not averaged into the curve;
the subtitle counts comps, not curve points; arrow keys read each rent.

### 11.3 Paired screenshots (`docs/analysis/realroi-chart-parity/`)

| Chart | Reference                                                                                                                                                                                                                                  | RocketRental                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C3    | `ref-summary-deal-snapshot{,-monthly,-cashflow-popover}-1440`, `ref-live-summary-deal-snapshot-1440`, `ref-live-summary-risk-expanded-1440`, `ref-summary-risk-meter-expanded-gauge-1440`, `ref-mobile-390-viewport-summary-deal-snapshot` | `rr-summary-deal-snapshot-1440`, `rr-summary-risk-meter-expanded-gauge-1440`, `rr-mobile-390-deal-snapshot`, `-deal-snapshot-popover`, `-risk-expanded`                                                                              |
| C4    | `ref-summary-fix-my-deal{,-expanded,-best-fix-applied}-1440`, `ref-live-summary-fix-my-deal-1440`                                                                                                                                          | `rr-summary-fix-my-deal-1440`, `-expanded-1440`, `-best-fix-applied-1440`, `rr-mobile-390-fix-my-deal-applied`                                                                                                                       |
| C18   | `ref-scenarios-equity-growth-{30y,10y,tooltip,focused-optimistic}-1440`, `ref-scenarios-delta-vs-base-1440`, `ref-scenarios-tab-full-1440`                                                                                                 | `rr-scenarios-selection-1440`, `-kpis-1440`, `-kpis-delta-1440`, `-metrics-table-1440`, `-delta-vs-base-1440`, `-equity-growth-{30y,10y,tooltip}-1440`, `-focused-optimistic-1440`, `-cash-flow-1440`, `rr-mobile-390-scenarios-tap` |
| C19   | `ref-benchmarks-growth-{indexed,dollars,indexed-tooltip,dollars-tooltip,focused-sp500}-1440`                                                                                                                                               | `rr-benchmarks-summary-banner-1440`, `rr-benchmarks-growth-{indexed,dollars,indexed-tooltip,dollars-tooltip,focused-sp500}-1440`                                                                                                     |
| C20   | `ref-benchmarks-risk-return-{scatter,tooltip}-1440`                                                                                                                                                                                        | `rr-benchmarks-risk-return-{scatter,tooltip}-1440`                                                                                                                                                                                   |
| C21   | `ref-compare-growth-{default,tooltip,reits-selected}-1440`                                                                                                                                                                                 | `rr-compare-asset-picker-1440`, `rr-compare-growth-{default,tooltip,reits-selected}-1440`                                                                                                                                            |
| C22   | `ref-compare-annualized-bars-{default,tooltip}-1440`                                                                                                                                                                                       | `rr-compare-annualized-bars-{default,tooltip}-1440`                                                                                                                                                                                  |
| C23   | `ref-compare-radar-{default,hover-no-tooltip}-1440`                                                                                                                                                                                        | `rr-compare-radar-{default,tooltip}-1440`                                                                                                                                                                                            |
| C24   | `ref-compare-side-by-side-vs-property-1440`, `ref-compare-tab-full-1440`                                                                                                                                                                   | `rr-compare-side-by-side-1440`, `-vs-property-1440`                                                                                                                                                                                  |
| C25   | not renderable (`ref-search-manual-entry-no-chart-1440`)                                                                                                                                                                                   | `rr-rent-comps-rental-distribution{,-tooltip}-1440`, `rr-mobile-390-rent-comps-rental-distribution`                                                                                                                                  |

All captures are palette PNGs to stay under
the 64 MiB tree limit; full-page and tall mobile panel captures were not committed.

**Interactions checked:** chip show/hide and "+" example chips; tile focus; Absolute /
Δ vs Base; horizon presets; Index / Dollars; benchmark-card focus; Compare asset chips,
the two-asset limit and swapping to REITs; KPI popovers (click, Escape); risk expand;
lever toggles, Best Fix, Apply, Apply All and Reset; hover on every chart; arrow keys on
the scenario, growth, scatter, bar, radar and distribution plots; tap at 390. At 390 px
`scrollWidth` equals `clientWidth` on Summary, Charts (all six sub-tabs), Scenarios,
Benchmarks, Compare and the comps page. The earlier C1–C17 charts were re-checked at
1440 and 390 on saved Maple data: all render, no overflow, no console errors.

### 11.4 Remaining differences

1. Engine definitions (§9.5, §10.5): reserves below NOI (DSCR 1.03 vs 0.95), so the risk
   score is 65 (reference 73), targets aim at DSCR ≥ 1.25 rather than ≥ 1.0, lever values
   differ, and the property's annualized growth is 8.80% (reference 8.95%).
2. Deliberate behaviour noted in §11.2 (single risk score, no invented volatility or
   yield, selection limit, Benchmarks fixed market set, what-if never saved).
3. Key Metrics rows use RocketRental metrics (NOI, cap rate, cash flow, equity,
   cumulative cash, IRR, equity multiple) rather than the reference's "Total Return".
4. _Superseded by §12.3:_ C25 is paired with the reference component rendered
   from a labelled fixture.

### 11.5 Live delivery (2026-10-20)

- `main` in the project root was merged to `cfea7f6` and the real app was rebuilt and
  restarted with `scripts/start-live.ps1 -StopExisting -Rebuild -SkipInstall`: no
  pending migrations, seed "up to date", served build `CwBGDFWOAtf7o78IofNLb` from
  `cfea7f6`, whose bundles contain the new charts. To outlive the agent session it was
  then relaunched once more with `start-live.ps1 -StopExisting -SkipInstall` as a
  detached process (parent `WmiPrvSE`), still `http://localhost:3100` on
  `localhost:5434/rocketrental`.
- Live checks at 1440 and 390 after the reference (3300) and task build (3110) were
  closed: Maple Court shows the Deal Snapshot, Fix My Deal and all new tabs; Actual vs
  projected reads income $215,850 and expenses $80,000 with "Rent coverage is partial";
  the exact table reads Year 1 −$2,555 and Year 2 −$176 / −$2,731; Harbor ↔ Maple
  switching loads each property's own inputs ($4,790,000 / $3,350,000 and $2,830,000 /
  $1,980,000); a full reload keeps them; no tab overflows at 390; the only console error
  is the existing `/favicon.ico` 404. Compare shows its "Choose at least one reference
  asset" state because Maple has no saved selection.
- Data preservation: row counts and MD5 of every row in all 33 tables of 5434 were
  identical before the work, after the browser checks and after both restarts
  (`RoiAnalysisState` empty, 4 properties). `.data/postgres-5433` and
  `.data/postgres-5434` are both kept; nothing was reseeded, reset or switched.
- Open item for the owner: the scheduled task `RocketRentalLive3100` still runs
  `start.ps1 -Port 3100 -DbPort 5433` at logon, so after the next sign-in it would serve
  the other dataset. It was not changed here. _Resolved in §12.5._

## 12. Final fidelity, startup and launcher (2026-10-20)

Evidence lives in `docs/analysis/realroi-chart-parity/final/` (palette PNGs).
Every capture was taken on isolated runtimes: the reference on 3300 (and a fixture
instance on 3301), and this branch's production build on 3191 against a new
isolated database `.data/postgres-5541`. The live 3100 / 5434 app was not used for
matched inputs, so no live draft could be saved.

### 12.1 Fonts

- **Inter** was already bundled (`public/fonts/inter-latin-wght-normal.woff2`). It is
  byte-identical to the reference's Google Fonts file (SHA-256 `3100E775…4C62`).
- **JetBrains Mono** is now bundled from the same Google Fonts file the reference loads
  (`jetbrains-mono-latin-wght-normal.woff2`, 31 KB, OFL licence beside it). It is
  declared for weights 400–500 only, like the reference's stylesheet, so bold figures
  are synthesised from 500 in both apps.
- Rendered check (`final/pairs/pairs-report.json`): both pages report
  `document.fonts.check` true for `600 14px Inter` and `700 18px "JetBrains Mono"`.
  The loaded faces are Inter and JetBrains Mono 400–500. Card titles compute to
  Inter, and chart figures compute to the JetBrains Mono stack.
- Chart card headings had been inheriting the app's Space Grotesk heading face. They
  now use Inter (`roi-chart.module.css`, `rent-distribution.module.css`).
- At 390 px, `scrollWidth` equals 390 on Summary, all six Charts sub-tabs, Scenarios,
  Benchmarks, Compare and the comps page (`final/pairs/rr-mobile-390-*`).

### 12.2 Domains, ticks and layout

The value axes now use the reference's own rules, ported from recharts-scale into
`chart-data.ts`:

- `referenceScale`: Recharts' default `[0, auto]` domain with five nice ticks.
- `fixedDomainScale`: an explicit `[min, max]` domain.
- `equityAxisMax`: C6's `ceil(max × 1.1 / 50k) × 50k` rule, or `/ 50` when indexed.

Zero always stays on the axis. A chart whose tick labels would repeat falls back to
the earlier plain steps. On desktop the label band is at least Recharts' 60 px. The
mobile 390 layout is unchanged.

Paired at the same 800 px card width, with the §1 sample on isolated Elm Street
(`tests/analysis/realroi-pairs-runtime.mjs`):

| Chart | Reference ticks                 | RocketRental ticks                                           |
| ----- | ------------------------------- | ------------------------------------------------------------ |
| C1    | `$-2k … $2k` (1k)               | `-$2k … $2k`                                                 |
| C6    | `$0k $250k $500k $950k`         | same                                                         |
| C7    | `$0k … $1000k` (250k)           | same                                                         |
| C8    | `$-9k $0k $9k $17k $26k`        | `-$8.5k $0k $8.5k $17k $25.5k`                               |
| C9    | `$-15k … $45k` (15k)            | `-$15k … $45k`                                               |
| C11   | `$0k … $400k` (100k)            | same                                                         |
| C14   | `$0k $350k $700k $1050k $1400k` | same                                                         |
| C18   | `$0k … $1400k` (350k)           | same (with the unsaved Optimistic and Conservative examples) |
| C19   | `0 900 1800 2700 3600`          | same                                                         |
| C20   | x `0…24`, y `0%…16%`            | same                                                         |
| C22   | `0.0% … 16.0%`                  | same                                                         |

The domains and steps are now the same. C8's labels differ only in precision: the
reference prints $8,500 as `$9k`, while RocketRental keeps the exact `$8.5k`.

C25's x axis uses the fixed `[dataMin, dataMax]` rule. A step tick that would print
the same `$x.xk` as the final tick is dropped.

Unit tests:

- `tests/analysis/realroi-charts.test.tsx` checks these tick sets and that C6 draws
  `$950k`, not `$1000k`.
- The Y1 all-negative case keeps five distinct ticks (`-$1.2k … $0k`).

### 12.3 C25 with a deterministic fixture

The reference chart is inline in `SearchPanel.tsx` and needs Google Places and RentCast.
To render it without either service, `tests/analysis/realroi-c25-fixture.mjs`:

- Starts the reference with **placeholder, non-secret** `VITE_GOOGLE_MAPS_API_KEY` and
  `VITE_RENTCAST_API_KEY` strings. Its source is not modified.
- Answers every Google Maps and RentCast request in Playwright: a Places stub with an
  inert map, plus RentCast property, rent, value and listing JSON.
- Aborts any other external host. Only the reference's Google Fonts are allowed.
  The run log shows 5 intercepted calls and 0 external API calls.

**Fixture:** RocketRental's sandbox comps for Maple Court unit 3A. These are
deterministic demo data, not market data:

- Comps: $1,700, $1,800, $1,850, $1,825, $2,025 and $2,025.
- Subject (listed rent): $1,600.
- Range: $1,805–$1,980.

The fixture feeds both apps, and both cards are captured at 800 px:

- `final/c25/ref-fixture-search-rental-distribution-1440.png`
- `final/c25/ref-fixture-search-rental-distribution-tooltip-1440.png`
- `final/c25/rr-fixture-rent-comps-rental-distribution-1440.png`

Remaining C25 differences, all from the reference's source:

1. The reference averages the subject into the statistics: Low $1,600, Average
   $1,832. RocketRental excludes it: Low $1,700, Average $1,871.
2. The reference subtitle counts curve points ("compared to 60 comparable rentals").
   RocketRental counts comps (6).
3. The reference rounds the density to whole numbers, so its curve is slightly
   stepped. Its x domain is `avg ± 2.5 sd`. RocketRental widens the domain to keep
   the subject and every comp on the axis.

There is no remaining blocker for C25. It is still a fixture comparison, not live
RentCast data.

### 12.4 Startup seeding (fresh and repeat)

The real `scripts/start.ps1 -Port 3191 -DbPort 5541 -SkipInstall` was run on an empty
`.data/postgres-5541`. Logs are in `final/startup/fresh-start.log`. It:

1. Created `.env` from the sandbox block.
2. Built the app.
3. Initialised Postgres and applied the migrations.
4. Ran `prisma/seed.ts`, then `load-roi-examples.ts --seed-inputs-only`. All four
   properties were "populated seed-roi-inputs-v1".
5. Wrote `.demo-seeded` and served the app.

`tests/analysis/startup-charts-runtime.mjs` then signed in and opened every chart
(`final/startup/fresh-charts-report.json`):

- All of C1–C25 render on Maple Court.
- The notice reads "28 assumptions are fictional demo values (seed-roi-inputs-v1)".
- No console errors.
- C25 uses the sandbox comps for unit 3A, from the "Demo comps · not live market
  data" banner.

What the seed provides, and what it deliberately does not:

- Scenarios (C18) start with Base Case only; the preset chips add unsaved examples.
- Compare (C21–C24) starts with "Choose at least one reference asset". Scenarios
  and the Compare selection are saved-analysis state, and the seed never writes a
  saved analysis: a saved snapshot would take precedence over the property's demo
  inputs. The harness picks S&P 500 and Nasdaq 100 in an unsaved draft, and all four
  Compare charts render. No seed wiring was missing for C1–C25.

**Preservation test.** `tests/analysis/startup-preservation-edits.mts` made these
changes through the app's own write paths:

- Edited Maple's rent to $23,456.
- Cleared Cedar's insurance.
- Saved a Harbor draft at 7% vacancy.
- Deleted one seeded Maple expense.

A real repeat `start.ps1 … -StopExisting` then ran:

- It reused the build, applied no migrations and logged "Demo seed is up to date".
- The `.demo-seeded` timestamp was unchanged (`2026-10-20T22:26:20Z`).
- The digest over all 33 tables' row hashes was identical before and after:
  `70990f93…4122` (`final/startup/hash-after-edits.json` and `hash-after-repeat-start.json`).
- Semantic check (`semantic-after-repeat-start.json`):
  - Maple rent is still $23,456, with no demo label.
  - 27 demo values remain.
  - Cedar insurance is still cleared and unlabelled.
  - The Harbor draft is still revision 1.
  - The deleted expense is still absent (239 expenses).
  - There are no duplicate properties (4) or units (45).
- The chart run after the repeat start rendered all 25 charts again
  (`repeat-charts-report.json`).

### 12.5 Persistent launcher

`scripts/register-live-task.ps1` now defaults to `-DbPort 5434`, the preserved
dataset, and registers `start.ps1 … -SkipInstall -StopExisting`. A restart therefore
takes over a detached copy on 3100/5434. `start.ps1 -StopExisting` stops the
`RocketRentalPreview` task only when that task holds one of the requested ports.
`.data/postgres-5433` is kept but not served.

### 12.6 Evidence index (all 25 charts)

| Charts                                       | Rendered reference                                                           | RocketRental                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| C1, C6–C9, C11, C14, C18–C20, C22            | `final/pairs/ref-pair-*` (matched width) plus the §9.4, §10.4 and §11.3 sets | `final/pairs/rr-pair-*` plus the earlier `rr-*` sets                          |
| C2–C5, C10, C12, C13, C15–C17, C21, C23, C24 | §9.4, §10.4 and §11.3 `ref-*` (domains unchanged or not value axes)          | §9.4, §10.4 and §11.3 `rr-*`                                                  |
| C25                                          | `final/c25/ref-fixture-*` (fixture, not live data)                           | `final/c25/rr-fixture-*`, `final/startup/repeat-rental-distribution-1440.png` |
| C1–C25 on fresh startup                      | n/a                                                                          | `final/startup/fresh-*.png` and `*-charts-report.json`                        |

Earlier captures were re-checked against the new rules. C2, C5, C10, C12, C13, C15–C17,
C23 and C24 have no Recharts value axis, or their tick rule did not change. C21's USD
lines use the same automatic rule as C19, but they were not re-captured here.

To make room in the repository:

- Three byte-identical duplicates in `roi-graphs/fix/` were removed:
  `1440-equity-card3`, `-exit-card2` and `-expenses-card2`. These are the same images
  as card2, card1 and card1.
- The superseded `roi-graphs/fix/` captures were re-encoded as palette PNGs
  (4.76 MB → 1.73 MB).

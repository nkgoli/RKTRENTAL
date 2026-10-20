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

| Item | Value |
| --- | --- |
| Repository | `https://github.com/nkgoli/RealROI` (`main`) |
| Commit | `0b12c76fea3958b98f4a722f5acf3336f1fd7d45` (2026-02-18, "Remove .env.example …") |
| Checkout | `.data/reference/RealROI` in this checkout (git-ignored, detached at the commit) |
| Toolchain | Node 22.23.1, pnpm 9.15.0 via `npx`, Vite 6.4.1, Recharts 2.x, visx (heatmap) |
| URL | `http://127.0.0.1:3300/demo` (public route, no sign-in) |
| Viewports | 1440×900 desktop and 390×844 mobile |

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

| Group | Values |
| --- | --- |
| Property | Sample Investment Property, 123 Main Street, Austin TX 78701 |
| Purchase | price $350,000; ARV $380,000; closing $8,000; rehab $5,000; furnishing $0 |
| Financing | 25% down; 7.25%; 30 years; points 0; lender fees $1,500 |
| Income | rent $2,800/mo; other income $100/mo; vacancy 5%; rent growth 3% |
| Expenses | tax $4,200; insurance $1,800; HOA 0; maintenance 5%; CapEx 5%; management 8%; utilities 0; leasing $500; other $200; growth 2% |
| Exit | appreciation 3%; hold 30 years; selling costs 6% |
| Taxes | 24% marginal; 5% state; 15% capital gains; depreciation over 27.5 years; land 20% |

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

| Tab | Component |
| --- | --- |
| Summary | `RoiWorkspace.tsx` |
| Charts | `RoiProjections.tsx` |
| Scenarios | `RoiScenarios.tsx` |
| Benchmarks and Compare | `RoiBenchmarks.tsx` |

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
stays. Reorder the Charts sub-tabs to match the reference (owner: TASK-8C409E13).

## 3. Ownership

| Owner Task | Charts |
| --- | --- |
| **TASK-8C409E13** cash-flow and equity | C1–C2 (Net Cash Flow by Year, Outcome donut), C5 (projection-table mini bars), C6–C9 (Equity Composition, Value vs Mortgage, Cash Flow & Cumulative, Income Bridge), the shared chart primitives (§5) and the sub-tab order |
| **TASK-2F1D1EFB** expense, amortization, exit and sensitivity | C10–C17 (Operating Expenses bars, Amortization area, payoff bar and schedule bars, Exit chart, Sensitivity heatmap) |
| **TASK-DFDAA085** comparison and live parity | C3–C4 (Deal Snapshot risk ring, gauge and factor bars; Fix My Deal lever bars), C18–C25 (Scenario lines, Benchmark lines and scatter, Compare lines, bars and radar, Search distribution), and the final 1440/390 live verification |

## 4. Inventory

"Ref shots" are the screenshot files without the `ref-` prefix and `.png` suffix.

| # | Reference chart (route → tab) | Type | Ref shots | RocketRental now | Gap |
| --- | --- | --- | --- | --- | --- |
| C1 | Net Cash Flow by Year (Summary) | Bar, positive/negative cells | summary-net-cashflow-{y1,y5,y30,custom,y30-tooltip,y5-tooltip-negative}-1440; mobile-390-viewport-summary-net-cashflow | Summary "Cash flow over time" ComboChart (`RoiWorkspace.tsx:872-930`) | Major |
| C2 | Outcome: Wealth Created donut (Summary) | Pie / donut | summary-outcome-donut-{y1,y30,y30-tooltip}-1440, summary-outcome-custom-1440, summary-outcome-after-best-fix-1440 | **None** | Missing |
| C3 | Deal Snapshot risk ring, gauge and factor bars (Summary) | SVG ring + semicircle gauge + segmented bars | summary-deal-snapshot{,-monthly,-cashflow-popover}-1440, summary-risk-meter-expanded-gauge-1440, mobile-390-viewport-summary-deal-snapshot | **None** (Summary "Year 1 at a glance" text metrics) | Missing |
| C4 | Fix My Deal lever bars (Summary) | Segmented gradient bars + pills | summary-fix-my-deal{,-expanded,-best-fix-applied}-1440 | **None** | Missing |
| C5 | Cash Flow & Equity Projections mini bars (Summary) | Table + inline % bars | summary-projection-table-{keyrows,full}-1440 | Summary "Exact annual cash flow" table, no bars | Partial |
| C6 | Equity Composition vs Debt Paydown (Charts → Equity) | Stacked bars + line, dual axis, overlays | charts-equity-composition-{y1,y5,y30,custom,incl-down,indexed,y30-tooltip,indexed-tooltip}-1440; mobile-390-viewport-equity-{composition,tap-tooltip} | `Equity` C1 ComboChart (`RoiProjections.tsx:327-496`) | Major |
| C7 | Value vs Mortgage Balance (Charts → Equity) | Area band + 2 lines | charts-value-vs-mortgage-{y10,y30-tooltip}-1440; charts-full-1440 | **None** (closest: "Equity growth at year N" CSS bars) | Missing |
| C8 | Cash Flow & Cumulative (Charts → Cash Flow) | Bars + line + pre/post shading | charts-cashflow-cumulative-{y10-default,y1,y30,custom,custom-y20,y10-tooltip}-1440 | `CashFlow` B1 ComboChart (`RoiProjections.tsx:170-280`) | Moderate |
| C9 | Income to Cash Flow Bridge (Charts → Cash Flow) | 3 lines + bars | charts-cashflow-bridge-{y10-default,y1,y30,y10-tooltip}-1440 | `CashFlow` B2 "From income to cash flow" Year-1 CSS bar list | Major |
| C10 | Operating Expenses ranked bars (Charts → Expenses) | CSS horizontal bars | charts-expenses-{y1,y10,y30,custom,y30-sort-delta,simulate-tax,info-tooltip}-1440 | `Expenses` D1 bar list (all teal) + D2 growth lines | Moderate |
| C11 | Principal vs Interest Over Time (Charts → Amortization) | Overlapping areas | charts-amortization-area-{default,tooltip}-1440 | `Amortization` E1 ComboChart, lines only | Moderate |
| C12 | Loan Payoff Breakdown bar (Charts → Amortization) | Two-segment progress bar | charts-amortization-schedule-summary-1440 | **None** | Missing |
| C13 | Schedule "Paid Off" mini bars and milestone chips (Charts → Amortization) | Table + inline bars | charts-amortization-schedule-{summary,detailed}-1440, charts-amortization-insights-10y-y20-1440 | Annual schedule table + monthly select, no bars, chips or insight cards | Partial |
| C14 | Exit Analysis & Comparison (Charts → Exit Analysis) | Stacked bars + reference lines | charts-exit-{default-y10-selected,total-cash-back,cleared-hover-tooltip,y30-selected,breakeven-chip-selected}-1440 | `Exit` F3 "Profit by exit year" grouped bars | Major |
| C15 | Sensitivity heatmap (Charts → Sensitivity) | visx heatmap + contour + gradient legend | charts-sensitivity-{year1-default,stabilized,year5,show-values,colorblind-values,customize-ranges,hover-cell}-1440 | `Sensitivity` HTML table, two-tone | Major |
| C16 | Sensitivity gradient legend (inside C15) | Gradient bar | same as C15 | Absent (two colours, no legend) | Missing |
| C17 | Amortization "Interest (First Ny)" and "Balance at YN" cards | KPI cards with selects | charts-amortization-insights-10y-y20-1440 | Absent | Missing |
| C18 | Equity Growth by Scenario (Scenarios) | Multi-line | scenarios-equity-growth-{30y,10y,tooltip,with-worst,focused-optimistic}-1440, scenarios-tab-full-1440, scenarios-delta-vs-base-1440 | `RoiScenarios` "Equity growth by scenario" + "Cash flow by scenario" ComboCharts | Moderate |
| C19 | Investment Growth Over Time (Benchmarks) | Multi-line, Index/Dollars | benchmarks-growth-{indexed,dollars,indexed-tooltip,dollars-tooltip,focused-sp500}-1440 | `RoiBenchmarks` I1 (indexed, property excluded) + I2 (USD) | Moderate |
| C20 | Risk vs Return scatter (Benchmarks) | Recharts scatter | benchmarks-risk-return-{scatter,tooltip}-1440 | `RoiBenchmarks` I3 hand-made SVG scatter, property omitted, no tooltip | Moderate |
| C21 | Investment Growth Over Time (Compare) | Multi-line, USD | compare-growth-{default,tooltip,reits-selected}-1440 | `RoiBenchmarks` I2 with `compare` | Moderate |
| C22 | Annualized Returns Comparison (Compare) | Bar per asset | compare-annualized-bars-{default,tooltip}-1440 | **None** | Missing |
| C23 | Multi-Dimensional Comparison (Compare) | Radar | compare-radar-{default,hover-no-tooltip}-1440 | **None** | Missing |
| C24 | Compare side-by-side table (Compare) | Table, Best/Worst badges | compare-side-by-side-vs-property-1440, compare-tab-full-1440 | "Side-by-side comparison" table | Minor |
| C25 | Rental Distribution bell curve (Search) | Area + reference dots | **not renderable**: needs RentCast/Google keys; see search-manual-entry-no-chart-1440 | **None** (`/rent-comps` has a range bar) | Missing, source-only |

**Not rendered anywhere in the reference** (dead code, so no parity is needed):

- `CashflowChart`, `IncomeNOICashflowChart`, `TotalReturnsDonut` in `apps/web/src/components/charts`.
- `CumulativeCashflowChart`, `ExitAnalysisChart`, `ExpenseBreakdownChart` in `packages/charts`.
- The non-compact RiskMeter.

The landing page shows only a static `hero-chart.jpg`. Library, Blog, About and
Pricing have no charts.

**Mobile reference** (whole tab): `ref-mobile-390-{summary,charts-equity,charts-cashflow,charts-expenses,charts-amortization,charts-exit,charts-sensitivity,scenarios,benchmarks,compare}.png`.

## 5. Shared chart system (owner: TASK-8C409E13; consumed by all)

The reference uses Recharts with Tailwind. RocketRental can keep its SVG
`ComboChart` but must reproduce these rendered conventions.

| Aspect | Reference (observed) | RocketRental now | Action |
| --- | --- | --- | --- |
| Card | `rounded-lg bg-white border border-slate-200 overflow-hidden`; header `bg-slate-100 border-b px-4 py-3`; title 14px/600 `#1e293b`; subtitle **10px** `#64748b` | `ChartCard`: header `#f1f5f9`, title 15px, subtitle 12px | Title 14px, subtitle 10px |
| Year selector | `Y1 Y5 Y10 Y30 Custom`. Pill group `rounded-lg border p-0.5`; buttons `px-2.5 py-1` 10px/500; active `bg-teal-500` (`#14b8a6`) white. Custom shows a range slider (min 2, max = data years, default 7) and a `Y{n}` mono label | `Y5 Y10 Y30 All Ny`, 12px/600, active `#0f766e`; no Y1, no Custom | Add Y1 and Custom with slider + `Y{n}`. Keep a 50-year "All" only when the hold is longer than 30 |
| Defaults | Net CF **Y5**; Outcome **Y1**; Equity, Value/Mortgage **Y30**; Cash Flow, Bridge **Y10**; Expenses **Y1**; Exit selected **Year 10** | Full hold (`null`) everywhere | Per-chart defaults as listed |
| KPI tiles | `rounded-lg px-3 py-2..2.5`, label 10px/600, value **JetBrains Mono** 18px/700; teal-50 / teal-50/50 / slate-100 tones | Tiles 20px/700 sans, 11px label | Mono values, 10px labels, reference tones |
| Chips | `rounded-full px-3 py-1(.5) text-xs` with lucide icon or 6px dot; teal-100/700, red-100/700, teal-50/600, slate-100/700 | `Chips` 12px with dot | Add icons (Target, TrendingDown, TrendingUp) on C8 |
| Insight row | `rounded-lg bg-slate-50 px-4 py-2.5 text-xs`, bold "Insight:" lead, mono teal/red figures | `Insight` 12px, "Reading:" lead | Use "Insight:" and mono figures |
| Grid | `3 3` dashes `#e2e8f0`, **horizontal and vertical** lines | Horizontal only; solid zero line `#94a3b8` | Add vertical lines; keep the zero line |
| Y ticks | `$${(v/1000).toFixed(0)}k`: `$0k`, `$-9k`, `$1050k`, `$1400k`; 11px `#64748b`. Domains are Recharts auto (or `ceil(max×1.1/50k)×50k` on C6) | `compactUsd`: `$12.5K`, `$1.2M`; nice 1/2/2.5/5 steps | Use the `$Nk` style (lowercase k, no M). **Do not** copy the reference Y1 defect, where the ticks read `$-1k` ×5 (`ref-charts-cashflow-cumulative-y1-1440.png`); keep distinct ticks |
| X ticks | Year numbers; every year up to 10, otherwise `1,5,10,…,30`; Summary uses `Y1…Y5` with `interval=0`; Amortization `Year 1, Year 3, …` | Raw years, `xTickIndexes` thinning, axis title "Year" | Match per-chart tick sets; drop the "Year" axis title where the reference has none |
| Tooltip | White `rounded-lg border-slate-200 shadow-lg p-3`, `min-w-[180–260px]`, header "Year N", equation rows (`− x`, `= y`), mono whole-dollar values, teal/red sign colours; follows the cursor | Readout box, cents, swatch rows, `details()` rows | Equation-style rows and whole dollars in tooltips. Tables keep cents |
| Legend | Custom, bottom-centred, 12px; line swatch `h-0.5 w-4`, bar swatch square | Same idea | Match labels and order per chart |
| Colours | teal-500 `#14b8a6`, teal-300 `#5eead4`, teal-600 `#0d9488`, slate-600 `#475569`, slate-500 `#64748b`, slate-400 `#94a3b8`, red-500 `#ef4444`, green-600 `#16a34a` | teal `#0d9488`, tealLight `#5eead4`, slate `#475569`, red `#dc2626` | Primary teal becomes `#14b8a6`, negatives `#ef4444` |
| Bars | `radius [4,4,0,0]` (Summary `[4,4,4,4]`); stacked bars with thin darker stroke | `rx ≤ 3`, white 0.5 stroke, stacks square | Radius 4 on top; teal strokes on stacks |
| Lines | Monotone curves, width 3 (mortgage, cumulative) or 2.5; dot r 2–3; active r 6 | Straight polyline 2.5, dot 2.5/1.5, active 5 | Monotone interpolation and reference widths |
| Animation | Recharts default mount/update animation (≈1.5 s ease) on every chart; tooltip slides (`transition: transform 400ms`); CSS bars `transition-all duration-300/500` | 120 ms opacity/fill only | Add an entry animation and a tooltip slide, both gated by `prefers-reduced-motion`. The reference ignores reduced motion for Recharts; RocketRental must not |
| Typography | Inter; numbers in **JetBrains Mono** (tiles, tooltips, tables, chips) | `var(--design-font)`, tabular numerals | Load a mono numeric face for chart numbers |
| Keyboard / a11y | No keyboard access to charts; no live region | Arrow, Home, End and Escape on the plot; polite live region | **Keep RocketRental's**. This is a deliberate improvement |
| Responsive | **Not responsive.** At 390 px the results column measures 567–952 px (`scrollWidth` 583/635/655/699/803/968), so charts clip and the page scrolls sideways | Cards fit at 390 (`scrollWidth == clientWidth`); readout moves under the chart below 480 px | **Do not copy.** Match the desktop look and keep RocketRental's 390 px fit. Stack header controls under the title, and use 2-column tiles |

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

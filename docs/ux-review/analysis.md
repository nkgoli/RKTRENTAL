# Analysis: Returns & ROI, Rent Analysis, Portfolio returns

Screens reviewed: `/roi-analysis` (chooser), `/roi-analysis?property=seed-property-maple` with views Summary, Actual vs projected, Charts (Equity, Cash Flow, Expenses, Amortization, Exit Analysis, Sensitivity), Scenarios, Benchmarks, Compare; `/rent-analysis` (chooser and Maple Court); `/properties/:id/listing?unit=` (rent comps workbench); `/returns` (Portfolio returns). The ROI save/reload dialog was deliberately not exercised.

This is the area the human called cramped and busy, and the captures agree: the ROI Summary is 3,589px at desktop and 5,076px on phone, and the first metric appears 450px down an 800px viewport. The underlying analysis (actual-vs-projected coverage, exit comparison, sensitivity grid) is strong; the problem is chrome, repetition and colour.

| ID | Route | Severity | Finding | Status |
| --- | --- | :-: | --- | :-: |
| AN-01 | /roi-analysis?property= | P0 | Three stacked headers (page title, analysis title + 3 buttons, Assumptions card + 2 buttons) before the tabs | Fixed |
| AN-02 | /roi-analysis Summary | P0 | Deal Snapshot card holds 15 numbers, a risk gauge, 3 chips and 3 rainbow sliders | Fixed |
| AN-03 | /roi-analysis Summary | P1 | Seven stacked cards with their own Y1/Y5/Y10 toggles and repeated basis badges; 3,589px | Fixed |
| AN-04 | /roi-analysis Summary "Fix My Deal" | P1 | Rainbow lever sliders, teal "+$929/yr" gains, two "Apply All" buttons, sparkle "Best Fix" | Fixed |
| AN-05 | /roi-analysis (390) | P1 | 5,076px page; three header buttons across; six tabs overflow with no fade | Fixed |
| AN-06 | /roi-analysis | P2 | "Edit assumptions" appears twice; "Show details" vs "Edit assumptions" ambiguous | Fixed |
| AN-07 | /roi-analysis Actual vs projected | P2 | Each cell carries 2–3 lines of qualifiers; "Not recorded / Unavailable / loan payments are not recorded" three times | Fixed |
| AN-08 | /roi-analysis Benchmarks | P2 | Seven blocks (alert, 4 tiles, table, chart, 3 cards, scatter, insight) say the same thing | Deferred |
| AN-09 | /roi-analysis Compare | P2 | Tab opens empty ("No reference selected") | Fixed |
| AN-10 | /roi-analysis Sensitivity | P2 | Values hidden by default; saved cell is only an outline; hint box in the middle of the chart | Fixed |
| AN-11 | /roi-analysis Exit | P2 | "Select Exit Year" is two 440px buttons plus a Clear link; probe form sits above the result | Deferred |
| AN-12 | /roi-analysis Charts | P2 | Axis labels "$2000k"; basis badges under every chart title | Deferred |
| AN-13 | /rent-analysis?property= | P2 | Raw "OCCUPIED/VACANT" enum text; gap signs uncoloured; eyebrow "Analysis" | Fixed |
| AN-14 | /properties/:id/listing?unit= | P2 | Three provenance/legal boxes (amber demo banner, blue data-source box, amber fair-housing box) on one page | Fixed |
| AN-15 | /properties/:id/returns | P2 | Workspace "Returns" tab leaves the workspace and lands on ROI "Actual vs projected" | Fixed |
| AN-16 | /returns | P1 | Three-line amber method disclaimer above the KPIs; sparkline stubs; YoY column "—" | Fixed |
| AN-17 | /returns (390) | P2 | Chart and two tables overflow the card | Fixed |

---

### AN-01
- **Route:** `/roi-analysis?property=seed-property-maple` (all views). Screenshots: [roi-summary-fold-1280.jpg](screenshots/roi-summary-fold-1280.jpg), [roi-summary-fold-390.jpg](screenshots/roi-summary-fold-390.jpg).
- **Severity:** P0
- **What is wrong:** Top to bottom at 1280 × 800: eyebrow "Money" + h1 "Returns & ROI" (72px); a second title "ROI Analysis · Maple Court · 214 Maple Ave · Whole property · Revision 0" + "New analysis - filled in from saved property details." with Save draft / Save ready / More actions (90px); an "Assumptions" card with two sentences, "Show details", "Edit assumptions" and a "Sample data: 28 assumptions are fictional demo values (seed-roi-inputs-v1)…" line (90px); then six tabs (60px). The first number (Deal Snapshot) starts at y ≈ 450. On phone the same chrome is 520px tall before the tabs.
- **Premium looks like:** Mercury/Stripe analytics: one header row — eyebrow "Returns & ROI", h1 "Maple Court", meta "Whole property · Revision 0 · Unsaved changes", actions Save ▾ and ⋯ — then tabs, then content. Total chrome ≤ 160px.
- **Fix:** Remove the generic page h1 on this route (`PageHeader` gets `title={property.name}` and `eyebrow="Returns & ROI"`); fold "Revision 0 · New analysis" into a 13px meta line; merge "Save draft / Save ready" into one split button `Save ▾` (Save as draft / Save as ready) with the dirty state in the meta line; move "More actions" into ⋯. Replace the Assumptions card with one line directly under the tabs: "Assumptions: from property details · 28 demo values · Edit" (`Edit` opens a side drawer, AN-06). Put the sample-data warning inside that drawer, not on the page.
- **Files:** `src/components/analysis/RoiWorkspace.tsx` (header block before `AnalysisTabs`, ~lines 700–810), `src/components/analysis/analysis.module.css`, `src/app/(manager)/roi-analysis/page.tsx`, `src/components/shell/PageHeader.tsx`.
- **Status:** Fixed - One property header with Save menu and one compact link to Edit Property replaces stacked headers.

### AN-02
- **Route:** `/roi-analysis?property=…` Summary, "Deal Snapshot". Screenshots: [roi-summary-fold-1280.jpg](screenshots/roi-summary-fold-1280.jpg), [roi-summary-1280.jpg](screenshots/roi-summary-1280.jpg).
- **Severity:** P0
- **What is wrong:** One card contains: a "SNAPSHOT" side column (Year 1 NOI $161k, Rent $23,000/mo, Price $2,830k, Appreciation 3%, 5-Yr Returns $588,602), five metric tiles each with an ⓘ icon and two-line caption (Cash Flow −$213, DSCR 1.07x, CoC −0.29%, Cap Rate 5.70%, Total Cash In $893,500), a 67 "Risk score" ring, "RISK Elevated · Heuristic, not advice", three coloured chips (Break-even 96%, Cash-on-Cash −0.3%, DSCR 1.07x) repeating the tiles, a "✧ Increase rent to lower the ratio" link, and three red→green rainbow gradient bars with markers. Plus a Monthly/Annual toggle and "$23,000/mo · 5% vac · 6.5% rate" in the header. That is 15 numbers and four visual languages in 360px.
- **Premium looks like:** A 4-tile KPI row (Cash flow / Cash-on-cash / Cap rate / DSCR) with value, one-word basis ("Year 1, monthly") and a small delta or risk chip; secondary facts in the header meta; risk detail behind a popover.
- **Fix:** Rebuild `RoiDealPanels` snapshot as: header "Year 1 · Monthly ▾ · Marginal" ; KPI row of four `KpiCard`s (value 24px, caption 12px, one ⓘ tooltip each); below it a single line "Price $2.83M · Rent $23,000/mo · Appreciation 3% · 5-yr return $588,602" in 13px muted; the risk score becomes a `Badge tone="warning"` "Risk 67 · Elevated" that opens a popover with the three gauges as plain progress bars (`--rr-subtle` track, cobalt fill, no gradients). Delete the duplicate chips and the sparkle link (keep "Increase rent…" as the first item in "Fix my deal").
- **Files:** `src/components/analysis/RoiDealPanels.tsx`, `src/components/analysis/deal-panels.module.css`, `src/components/dashboard/KpiCard.tsx`.
- **Status:** Fixed - Four KPI tiles lead; exact breakdowns and a single risk disclosure replace the dense snapshot.

### AN-03
- **Route:** `/roi-analysis?property=…` Summary. Screenshot: [roi-summary-1280.jpg](screenshots/roi-summary-1280.jpg) (3,589px).
- **Severity:** P1
- **What is wrong:** After the snapshot: "Year 1 at a glance" + "Actual vs projected" (two cards), "Net Cash Flow by Year" (chart, Y1/Y5/Y10/Custom), "Outcome" (donut + 4 ratios, its own Y1/Y5/Y10), "Cash Flow & Equity Projections" (table with Key rows/Full table and Positive/Negative legend), "Fix My Deal" (six sliders), "More detail" (three disclosures). Every card repeats a badge row "Projected · USD per year · Before tax". Seven cards, four horizon controls.
- **Premium looks like:** Summary = KPIs, one chart, one table, links to the deep tabs; one horizon control in the tab bar.
- **Fix:** Summary keeps: KPI row (AN-02), "Net cash flow by year" chart, "Milestones" table (Y1/Y5/Y10 columns only), and a "Go deeper" row of three link cards (Actual vs projected · Scenarios · Exit analysis). Move "Outcome" into Charts → Equity, "Fix My Deal" into Scenarios (as "Suggested changes"), "More detail" disclosures into the assumptions drawer. Hoist the Y1/Y5/Y10 control to the tab bar right side (`AnalysisTabs` slot) and read it from URL `?horizon=`. Show the basis badges once, under the tabs.
- **Files:** `src/components/analysis/RoiSummaryCharts.tsx`, `src/components/analysis/RoiWorkspace.tsx`, `src/components/analysis/summary-charts.module.css`, `src/components/analysis/RoiScenarios.tsx`.
- **Status:** Fixed - Summary now contains KPIs, one chart, a five-row milestone table and deep-view links; advanced content moved to Charts and Scenarios.

### AN-04
- **Route:** `/roi-analysis?property=…` Summary, "Fix My Deal". Screenshot: [roi-summary-1280.jpg](screenshots/roi-summary-1280.jpg) (y ≈ 2,700–3,300).
- **Severity:** P1
- **What is wrong:** Six levers (Rent +$100/mo, Vacancy −1%, …) each on a red→orange→green gradient track with a red thumb; gains "+$929/yr" in teal on the right; a "✧ Best Fix" primary button, an amber "Targets to Hit" disclosure with "✧ Apply" and "✧ Apply All", and a second "✧ Apply All" below. Two primary actions and sparkle icons for a what-if tool.
- **Premium looks like:** A plain list of suggested changes with a neutral slider, the resulting Year-1 cash flow, and one "Apply selected" action.
- **Fix:** Rename "Suggested changes"; slider track `--rr-subtle`, fill `--design-primary`, thumb white with cobalt border; show "Year 1 cash flow: −$2,555 → +$1,200" as the headline that updates live; one `Apply selected` secondary button and a "Reset" link; delete "Best Fix" and the sparkle glyphs. Move the panel to Scenarios (AN-03).
- **Files:** `src/components/analysis/RoiDealPanels.tsx`, `src/components/analysis/deal-panels.module.css`.
- **Status:** Fixed - Suggested changes lives in Scenarios with neutral checkboxes, one Apply selected action, cash-flow result and Reset; temporary calculations preserve saved data.

### AN-05
- **Route:** `/roi-analysis?property=…` at 390px. Screenshots: [roi-summary-390.jpg](screenshots/roi-summary-390.jpg), [roi-summary-fold-390.jpg](screenshots/roi-summary-fold-390.jpg).
- **Severity:** P1
- **What is wrong:** The page is 5,076px; the header stack is 520px (three buttons in a row, "Assumptions" card 200px); the six tabs overflow with "Sce…" cut and no fade; the snapshot side column becomes a 2 × 3 grid of small numbers; chips and sliders wrap into 600px of controls.
- **Premium looks like:** The design's phone reference: selected property, four tabs, one KPI pair, a short alert, an "Assumptions & exact amounts" disclosure.
- **Fix:** On ≤ 640px: sticky 56px header (property name + Save button); tabs as a `<select>` or scrollable strip with right fade (MC-19); KPI row as 2 × 2; every secondary card becomes a collapsed `details` ("Net cash flow by year ▸") so the page lands under 1,800px; sliders hidden behind "Suggested changes ▸".
- **Files:** `src/components/analysis/RoiWorkspace.tsx`, `src/components/analysis/analysis.module.css`, `src/components/analysis/RoiSummaryCharts.tsx`.
- **Status:** Fixed - Compact sticky phone heading, locally scrolling faded tabs and two-by-two KPI grid; browser summary measured below 1800px.

### AN-06
- **Route:** `/roi-analysis` header and Charts. Screenshots: [roi-charts-equity-1280.jpg](screenshots/roi-charts-equity-1280.jpg).
- **Severity:** P2
- **What is wrong:** "Edit assumptions" is in the header card and again above the chart sub-tabs; "Show details" next to it opens the same data read-only. On Charts the row "Projected · 10-year hold · USD · Before tax … Edit assumptions" repeats under the tabs.
- **Premium looks like:** One "Assumptions" entry point that opens a right-side drawer (480px) with the editable grouped fields and a "View as table" toggle.
- **Fix:** Single `Assumptions` button in the header (AN-01) opening a drawer (`<dialog>` positioned right, full height); remove the per-tab buttons; the drawer shows the 28 values grouped (Purchase, Income, Expenses, Growth) with inline edit and the sample-data note.
- **Files:** `src/components/analysis/RoiWorkspace.tsx`, `src/components/analysis/AssumptionsSummary.tsx`, `src/components/analysis/RoiProjections.tsx`.
- **Status:** Fixed - Property assumptions are not repeated on ROI; the single Edit property assumptions link preserves return context and unsaved-change guarding. Human direction takes precedence over the proposed drawer.

### AN-07
- **Route:** `/roi-analysis?…&view=actual`. Screenshot: [roi-actual-1280.jpg](screenshots/roi-actual-1280.jpg).
- **Severity:** P2
- **What is wrong:** The comparison table's Actual cells read "$215,850 / Partial / Rent coverage is partial"; Debt service reads "Not recorded / Unavailable / Loan payments are not recorded; see scheduled debt service." and the Cash flow row repeats three qualifiers. Below, a yellow "Needed to complete this comparison" panel restates the same three gaps, then "Sources and coverage" restates them again with day counts.
- **Premium looks like:** One coverage chip per row ("Partial · 325/355 days") with a tooltip; one callout listing the three missing inputs with their actions; sources in a collapsed footnote.
- **Fix:** Cell = value + `Badge tone="neutral"` chip ("Partial", "Not recorded") with `title` text; remove the sentence lines. Keep the amber panel as the single explanation (three rows, each with its action link). Collapse "Sources and coverage" into a `details` under the table. Difference column shows the number when both sides exist, otherwise "—".
- **Files:** `src/components/analysis/RoiActuals.tsx`, `src/components/analysis/actuals.module.css`.
- **Status:** Fixed - Cells show value plus one coverage badge; explanatory notes are available on the badge and Sources and coverage is collapsed.

### AN-08
- **Route:** `/roi-analysis?…&view=benchmarks`. Screenshot: [roi-benchmarks-1280.jpg](screenshots/roi-benchmarks-1280.jpg).
- **Severity:** P2
- **What is wrong:** Amber alert "Markets outperform this deal (10-year hold)" with two value tiles inside; four amber/red stat tiles (DSCR, Worst Year CF, Breakeven, Negative CF Years); "Investment Comparison" table; "Investment Growth Over Time" indexed line chart with its own table underneath; three market description cards; a "Risk vs Return" scatter; an "Insight: Nasdaq 100 would outperform by $919,377" bar; "Exact growth by year" disclosure. The conclusion is repeated five times.
- **Premium looks like:** Headline sentence, one comparison table (with the market descriptions as a tooltip on the name), one chart with a Dollars/Index toggle, and the scatter as an optional disclosure.
- **Fix:** Keep: headline (plain, not amber — it is information, not a warning), the comparison table with "Annual return used / Volatility" as extra columns, the growth chart. Move the four risk tiles to Summary's risk popover (AN-02), fold the three market cards into the table, make "Risk vs return" a `details`, delete the duplicate "Insight" bar and the inner table under the chart (the "Exact growth" disclosure already provides it).
- **Files:** `src/components/analysis/RoiBenchmarks.tsx`, `src/components/analysis/benchmark-charts.module.css`.
- **Status:** Deferred - Benchmark charts remain fully functional; consolidating their overlapping comparison, risk and market-card presentations needs a separate information-hierarchy pass beyond the required summary work.

### AN-09
- **Route:** `/roi-analysis?…&view=compare`. Screenshot: [roi-compare-1280.jpg](screenshots/roi-compare-1280.jpg).
- **Severity:** P2
- **What is wrong:** The tab opens with chips "S&P 500 +, Nasdaq 100 +, …" and an empty-state card "No reference selected — choose at least one reference asset above". The primary state is empty.
- **Premium looks like:** A default comparison (S&P 500) already rendered; chips act as toggles with a selected style.
- **Fix:** Preselect `S&P 500` when the URL has no `refs=`; chips become toggle buttons (`aria-pressed`, filled when active); show the comparison immediately; keep "Add custom reference" as a dashed chip.
- **Files:** `src/components/analysis/RoiCompareCharts.tsx`, `src/components/analysis/RoiBenchmarks.tsx` (shared panel), `src/components/analysis/RoiWorkspace.tsx` (URL state).
- **Status:** Fixed - New analyses preselect S&P 500; explicitly saved reference selections, including an empty selection, remain intact.

### AN-10
- **Route:** `/roi-analysis?…&view=charts&chart=sensitivity`. Screenshot: [roi-charts-sensitivity-1280.jpg](screenshots/roi-charts-sensitivity-1280.jpg).
- **Severity:** P2
- **What is wrong:** The 5 × 7 heatmap shows colours only; "Show values" is an unchecked checkbox; the saved-assumption cell has a thin blue outline; an italic box "Hover, tap or use the arrow keys on a cell to see details" sits under the legend; the colour legend is a red→teal gradient bar (the only place this gradient is appropriate, but it clashes with the rainbow sliders elsewhere).
- **Premium looks like:** Values printed in cells at desktop, the saved cell marked with a dot and label "Saved", selection details in a side panel.
- **Fix:** Default `showValues=true` at ≥ 1024px; mark the saved cell with a 6px cobalt dot + "Saved" caption under the grid; move the hint into the chart caption (12px muted); keep the diverging legend but use the token pair (`--design-danger` → `--rr-subtle` → `--design-accent`).
- **Files:** `src/components/analysis/RoiSensitivity.tsx`, `src/components/analysis/detail-charts.module.css`.
- **Status:** Fixed - Heatmap values start visible and the saved cell has a cobalt dot; accessible keyboard readouts and exact table remain available.

### AN-11
- **Route:** `/roi-analysis?…&view=charts&chart=exit`. Screenshot: [roi-charts-exit-1280.jpg](screenshots/roi-charts-exit-1280.jpg).
- **Severity:** P2
- **What is wrong:** An "Exit probe" form (three inputs, two buttons) sits above the actual analysis; "Select Exit Year" is two 440px-wide buttons (5y / 10y) plus a "Clear" link; the Year 10 summary tile row, the chart and a table all repeat Net proceeds / Cash flow / Total cash back / Profit / IRR.
- **Premium looks like:** The chart first, with Y5 · Y10 · Custom as chips in its header; probe inputs behind "Try another exit ▸"; one table.
- **Fix:** Reorder: comparison card first; exit-year as a segmented chip group in the card header; probe form as a `details` under the chart; drop the summary tile row (the table carries the same values) or drop the table on phone.
- **Files:** `src/components/analysis/RoiExit.tsx`, `src/components/analysis/detail-charts.module.css`.
- **Status:** Deferred - Exit-year buttons are compact and the probe now sits in a disclosure below results; consolidation of selected-year tiles with the exact comparison table remains for a later chart pass.

### AN-12
- **Route:** `/roi-analysis?…&view=charts` (all sub-charts). Screenshots: [roi-charts-equity-1280.jpg](screenshots/roi-charts-equity-1280.jpg), [roi-charts-cashflow-1280.jpg](screenshots/roi-charts-cashflow-1280.jpg).
- **Severity:** P2
- **What is wrong:** Y-axis ticks read "$2000k", "$1500k", "$315k"; every chart title is followed by a 12px badge row ("Projected · USD · Year-end · Before selling costs and tax"); a footer paragraph "Charts share the selected property and base assumptions…" repeats on every sub-tab.
- **Premium looks like:** "$2.0M / $1.5M"; the basis stated once per tab; footnotes only where they add something.
- **Fix:** Axis formatter: `≥ 1e6 → $x.xM`, `≥ 1e3 → $xxxk`; render the basis badges once under the sub-tabs and pass `basis` as a tooltip on each chart's ⓘ; remove the repeated footer.
- **Files:** `src/components/analysis/RoiChart.tsx` (tick formatter), `src/components/analysis/RoiProjections.tsx`, `src/components/analysis/projections.module.css`.
- **Status:** Deferred - Million-scale axes now use M notation and the duplicate Edit assumptions control is gone; per-chart basis qualifiers remain because they distinguish year-end equity, cash flow and sale proceeds.

### AN-13
- **Route:** `/rent-analysis?property=seed-property-maple`. Screenshots: [rent-analysis-maple-1280.jpg](screenshots/rent-analysis-maple-1280.jpg), [rent-analysis-maple-390.jpg](screenshots/rent-analysis-maple-390.jpg).
- **Severity:** P2
- **What is wrong:** The Status column prints raw enum values "OCCUPIED" / "VACANT" in caps; "Gap / month" shows "$75 vs current lease" and "-$50 vs current lease" in the same colour; the eyebrow says "Analysis" while the nav item is "Rent Analysis"; the whole table is inside a "▾ View all 12 units in Maple Court" disclosure. On phone the table is 663px wide and clipped.
- **Premium looks like:** Badges for status, signed/coloured gaps, consistent eyebrow, table rows that link to comps.
- **Fix:** Use `Badge` ("Occupied" success, "Vacant" info); colour gaps teal (+) / danger (−) with a leading sign; eyebrow "Money / Rent Analysis"; remove the disclosure wrapper; rows link to `/properties/:id/listing?unit=`; card mode on phone.
- **Files:** `src/app/(manager)/rent-analysis/page.tsx`, `src/app/(manager)/rent-analysis/rent.module.css`.
- **Status:** Fixed - Sentence-case status badges, signed colored gaps, consistent heading and labeled mobile unit cards.

### AN-14
- **Route:** `/properties/:id/listing?unit=…` (rent comps). Screenshot: [property-unit-listing-1280.jpg](screenshots/property-unit-listing-1280.jpg).
- **Severity:** P2
- **What is wrong:** The page shows an amber "Demo comps · not live market data / Sandbox response · 10/21/2026, 6:25:41 AM UTC · newly fetched" banner at the top, a blue "Data source: Sandbox…" box and an amber "Fair housing" box at the bottom, and "Source: Sandbox" in every table row. The schematic map takes 300px to show six dots.
- **Premium looks like:** One provenance chip in the card header ("Sandbox data · updated 6:25 AM") and a single footnote; the map is optional and collapsed by default.
- **Fix:** Replace the banner with a `Badge tone="warning"` "Sandbox data" + "Updated 6:25 AM" meta in the Rent comps card header; drop the Source column when all rows share one source; make the map a `details` ("Show map"); merge fair-housing into a one-line footnote with a "Learn more" link.
- **Files:** `src/components/rent-comps/RentCompsPanel.tsx`, `src/app/(manager)/rent-comps/comps.module.css`, `src/components/rent-comps/RentDistribution.tsx`.
- **Status:** Fixed - Compact provenance metadata replaces duplicate source banners; the map starts collapsed and the Source column appears only for mixed providers. Fair-housing context remains available.

### AN-15
- **Route:** `/properties/:id/returns` → `/roi-analysis?property=…&view=actual`. Screenshot: [property-returns-1280.jpg](screenshots/property-returns-1280.jpg).
- **Severity:** P2
- **What is wrong:** Clicking the workspace tab "Returns" leaves the property workspace (breadcrumb, View selector, tab strip disappear) and opens the ROI page on "Actual vs projected" with the "Returns & ROI" sidebar item active. Back returns to the workspace, so the tab behaves like an external link without saying so.
- **Premium looks like:** Tabs stay inside the workspace; cross-app jumps are labelled with an arrow.
- **Fix:** Either embed `RoiActuals` inside the workspace Returns tab (property pre-selected, no header stack) or rename the tab "Returns & ROI ↗" and open the ROI page with a "← Back to Maple Court" link in its header.
- **Files:** `src/app/(manager)/properties/[id]/returns/page.tsx`, `src/components/workspace/WorkspaceTabs.tsx`, `src/components/workspace/ReturnsWorkspace.tsx`.
- **Status:** Fixed - Property tab explicitly says Returns & ROI with an outward arrow; ROI provides a Property overview backlink.

### AN-16
- **Route:** `/returns`. Screenshot: [returns-1280.jpg](screenshots/returns-1280.jpg).
- **Severity:** P1
- **What is wrong:** Under the range picker: a two-line grey paragraph ("Portfolio · Nov 2025 – Oct 2026. Income follows settled payments…") then a three-line amber box ("These portfolio figures are month-based summaries, not recorded-only results. Cash flow and cash-on-cash subtract scheduled debt service…") before any number. KPI tiles embed 40px sparklines with two points. "Year over year" shows "—" in the YoY column for both rows. "Returns by property" header carries another two-line estimate note.
- **Premium looks like:** Range picker → KPI row → chart. Method notes live behind an ⓘ "How these are calculated" popover; sparklines only with ≥ 6 points; columns that cannot be computed are hidden.
- **Fix:** Collapse both paragraphs into a single ⓘ popover on the "Portfolio returns" title (and an "Estimates" chip on the tiles that are estimates); remove the sparkline stubs; hide YoY until two full years exist; move the estimate note on "Returns by property" into column-header tooltips.
- **Files:** `src/app/(manager)/returns/page.tsx`, `src/components/returns/returns.module.css`, `src/components/returns/RangePicker.tsx`.
- **Status:** Fixed - Method disclosure replaces the warning block, short/flat sparklines are omitted and unavailable YoY columns are hidden; estimate notes move to relevant headings.

### AN-17
- **Route:** `/returns` at 390px. Screenshot: [returns-390.jpg](screenshots/returns-390.jpg).
- **Severity:** P2
- **What is wrong:** The income/expenses SVG (553px) and the "Year over year" and "Returns by property" tables overflow the 343px card and are clipped with no scroll hint.
- **Premium looks like:** Chart fits the container; tables become per-property cards.
- **Fix:** See MC-18 for the chart; "Returns by property" rows → cards (name, units, NOI, cap rate; the rest behind a tap); "Year over year" as two stacked rows.
- **Files:** `src/components/returns/IncomeExpenseChart.tsx`, `src/app/(manager)/returns/page.tsx`, `src/components/ui/Table.tsx`.
- **Status:** Fixed - Income chart fits the card; portfolio and yearly tables become labeled stacked rows on phones.

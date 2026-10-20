# ROI graphs — RealROI visual reference

The ROI graph surfaces (Summary cash-flow chart, Charts tab panels, Scenarios
and Benchmarks charts) now share one chart system,
`src/components/analysis/RoiChart.tsx`, modelled on the RealROI charts. The
RocketRental app shell, calculation engine, tables and CSV exports are unchanged.

## Reference inspected

- Repository: `nkgoli/RealROI`, `main` tree `0b12c76fea3958b98f4a722f5acf3336f1fd7d45`
  (read through the authenticated `gh` API).
- Source: `apps/web/src/components/charts/ChartsPanel.tsx`, `EquityDebtChart.tsx`,
  `CashFlowCumulativeChart.tsx`, `IncomeBridgeChart.tsx`, `ExpenseBreakdownPanel.tsx`,
  `ExitAnalysisPanel.tsx`; `packages/charts/src/components/ChartHeader.tsx`,
  `LoanAmortizationChart.tsx`, `SensitivityHeatmap.tsx`.
- Screenshots: the `apps/web/public/screenshots/` listing (13 renders). The visual
  notes for `EquityVDebtPaydown.png` and `CashflowProjections.png` come from the
  manager's inspection: teal and slate series, pale metric tiles, large values,
  compact segmented controls, subtle dashed grids, clear axes and legends, generous
  spacing. The source files above encode the same patterns.

## Reference → implementation mapping

| RealROI pattern                                                                 | Delivered in RocketRental                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slate header strip with title, one-line subtitle and right-aligned controls     | `ChartCard` on every chart card: Cash flow, Income → cash flow, Equity, Expenses, Amortization, Exit, Holding period, Sensitivity, Scenario charts                                             |
| Compact `Y1/Y5/Y10/Y30/Custom` segmented control, teal when active              | `Segmented` + `useHorizon`: `Y5/Y10/Y30/All Ny`, limited to the calculated hold; toggle buttons with `aria-pressed`. Custom slider not adopted; "All" covers 50-year holds                     |
| Pale teal / slate KPI tiles with large values                                   | `Tiles` above the Cash flow, Equity, Amortization, Expenses and Exit charts; values are the engine's numbers formatted to the cent                                                             |
| Landmark chips (Breakeven, Worst, Best; equity crossover; mortgage paid off)    | `Chips`: "Cumulative turns positive · year N" (only for a real crossing), lowest and highest year, "Equity exceeds loan balance" (only when equity started below), "Loan paid off"             |
| Cash flow bars teal / red negative + slate cumulative line, zero reference line | Cash Flow panel and Summary chart: `ComboChart` bars (teal; red when negative) + slate cumulative line, solid zero baseline, dashed `Cumulative > $0` marker                                   |
| Equity composition stacked bars + mortgage line, "Include down payment" toggle  | Equity panel: stacked Principal paid (teal) + Appreciation & repair value change (light teal; red if negative) bars, Loan balance line, "Equity gain / Incl. purchase equity" segmented toggle |
| Tooltip with the equation Value − Mortgage = Equity                             | Equity tooltip rows: Property value and "= Equity (value − loan)", taken from the engine's `equity`                                                                                            |
| Loan amortization area chart (balance, principal, interest)                     | Amortization: balance (slate), cumulative principal (teal), cumulative interest (amber, dashed) over the full loan term, with loan-amount, payment and term-interest tiles                     |
| Exit comparison bars by holding period                                          | Exit: grouped bars for cash returned and profit per recalculated horizon (red when negative); tooltip adds Total ROI                                                                           |
| Sensitivity heatmap with outlined base cell                                     | Existing value table kept; palette changed to teal (non-negative) and red (negative), base cell outlined in teal                                                                               |
| `CartesianGrid strokeDasharray="3 3"`, `$Nk` axes, smart year ticks             | `niceScale` (1/2/2.5/5 steps, always includes zero), compact currency ticks, dashed grid, `xTickIndexes` keeps long horizons uncrowded and always labels the final year                        |
| "Insight" row under the chart                                                   | `Insight` under Cash flow: cumulative cash flow and share of initial cash for the shown year, with the existing "not profit" caveat                                                            |

Not adopted: the indexed equity view, custom year slider, donut charts,
multi-dimension analysis and risk scoring. These would need new calculations or
fall outside the existing ROI graphs.

## Meaning kept visible

- Subtitles say **Projected** and **before tax**. The actual-vs-projected comparison
  and its CSV are unchanged, and actuals are never drawn on projection charts.
- Missing values are `null`, never `0`. Lines break at gaps, the legend shows
  "Gap = unavailable, not $0", and tooltips say "Unavailable".
  `scenarioSeries` fixes the previous `?? 0` that plotted missing scenario years as $0.
- Tooltip values use the same formatter as the adjacent table: cents for projection
  tables, whole dollars on the Summary table, and 4 decimal places for indexes.
  Exact tables still list every year whatever chart horizon is chosen.
- Fictional-demo provenance notices and property/scenario selection are unchanged.

## Interaction and accessibility

- Hover (mouse), tap (touch) and arrow keys / Home / End / Escape on the focusable
  plot select a year. A polite live region announces the year's values.
- Below 480 px the readout is shown under the chart instead of over it.
- Transitions run only under `prefers-reduced-motion: no-preference`.

## Evidence

`docs/analysis/roi-graphs/` holds the before and after screenshots (desktop
1440 px and 390 px) taken from the live localhost:3100 app.
`tests/analysis/chart-data.test.tsx` covers the adapters and checks the chart
readout against the projection table.

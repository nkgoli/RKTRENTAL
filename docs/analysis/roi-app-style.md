# ROI analysis in the RocketRental app style

The ROI charts keep everything they do. They no longer copy how RealROI looks.

- **Functional parity is still the contract.** Every chart, calculation, table,
  control, tooltip, legend, scenario, missing-data state and demo label that
  `realroi-chart-parity.md` lists (C1–C25) is unchanged.
- **The visual target is the RocketRental app.** The RealROI fonts, Tailwind
  teal/slate palette, slate header strips, dark Deal Snapshot band and pill chrome
  are no longer goals. Each was replaced by the matching app token or component in
  `src/styles/globals.css`.

Use RealROI only to check what a chart does, never how it looks.

## 1. Visual authority

The current manager screens set the look:

- `/dashboard`, in particular its "Collection history" chart (`CollectionChart`):
  chip range buttons, a solid light grid, a small square legend and muted axis text.
- `/properties/<id>`: tabs, cards and the lease timeline.
- The shared classes in `globals.css`: `.card`, `.card-header`, `.btn*`, `.chip`,
  `.tabs`, `.badge`, `.alert`, `.kpi`, `.table` and `.field`, plus the global focus
  ring in `accessibility.css`.

Captures of both screens are in `roi-app-style/after/app-dashboard-*.png` and
`app-property-*.png`.

## 2. What changed

| Element                                    | RealROI look (removed)                                          | App style (now)                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chart card                                 | 8 px radius, `#e2e8f0` border, slate-100 header strip           | `.card`: 12 px radius, `--rr-border`, `--rr-card-shadow`; white header with a bottom rule                                                                                                 |
| Card title                                 | Inter 14 px                                                     | Space Grotesk (`--design-heading-font`) 16 px (`--rr-h3`), as in `.card-header`                                                                                                           |
| Subtitles and labels                       | 10 px slate                                                     | 12 px `--design-muted`                                                                                                                                                                    |
| Range / view toggles (Y1…Custom, $ Value…) | Grouped teal-500 pills                                          | The dashboard's `.chip` row: pill buttons with a `--rr-border-strong` edge; pressed = `--design-primary`                                                                                  |
| Sensitivity and Amortization view toggles  | Slate segmented control                                         | The same chip toggles                                                                                                                                                                     |
| KPI tiles                                  | Pale teal/slate fills, JetBrains Mono 18 px                     | Bordered tiles like `.kpi`: 12 px muted label, Space Grotesk 20 px value; red/amber tints only for meaning                                                                                |
| Landmark chips                             | Teal/red/amber Tailwind pills                                   | `.badge`: 6 px radius, dot or icon, `--rr-ok/bad/warn` tints                                                                                                                              |
| Toggle chips (Exit Best IRR …)             | Slate or teal fills                                             | `.chip` buttons; pressed = primary                                                                                                                                                        |
| Figures (tooltips, tables, insight)        | JetBrains Mono                                                  | Inter with tabular numerals                                                                                                                                                               |
| Grid                                       | Dashed both ways                                                | Horizontal only, solid `#e8edf4` (the dashboard grid); zero line stays darker                                                                                                             |
| Insight row                                | Slate-50 strip                                                  | Bordered `--design-background` note, 13 px                                                                                                                                                |
| Deal Snapshot                              | Dark gradient band with neon tones                              | A white app card: badge status, chip Monthly/Annual, KPI tiles, light risk panel                                                                                                          |
| Fix My Deal buttons                        | Teal pill buttons                                               | `.btn-primary` / `.btn-secondary` proportions (7 px radius, 13 px/600)                                                                                                                    |
| Workspace shell                            | Local token overrides (`#1e3a8a`, coral focus ring, 8 px cards) | The overrides are gone, so the app tokens apply; secondary/primary buttons, `.alert.warning` notices, `.tabs` underline tabs, `.field` inputs; no extra gutter inside the shell's `.page` |
| Rental Distribution (C25)                  | Slate header strip, uppercase stat labels                       | App card and header, bordered stat tiles                                                                                                                                                  |

Fonts: only the app's Inter and Space Grotesk load now. The JetBrains Mono face,
its `@font-face` rule, the bundled `jetbrains-mono-latin-wght-normal.woff2` and its
licence were removed. Nothing else used them.

## 3. Series colours

SVG attributes cannot read CSS variables, so `chartColors` in `RoiChart.tsx` repeats
the token values and names them by role:

| Role                                        | Value                                      | Token                                          |
| ------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Main series (cash flow, value, principal …) | `#3159d9`                                  | `--design-primary`                             |
| Darker / lighter steps of the main series   | `#203fa8`, `#6383e6`, `#a7b9f0`, `#dbe4ff` | `--rr-primary-active`, tints                   |
| Property, positive outcome, net proceeds    | `#087c91`                                  | `--design-accent`, `--rr-ok`                   |
| Negative values, loan payoff                | `#b4233e`                                  | `--design-danger`, `--rr-bad`                  |
| Interest, maintenance                       | `#cf8a68`                                  | `--rr-warm`                                    |
| Mortgage and debt lines                     | `#58687e`, `#17243b`, `#0b2545`            | `--design-muted`, `--design-text`, `--rr-navy` |
| Grid and empty tracks                       | `#dce3ed`                                  | `--rr-border`                                  |

Charts that need more distinct series use companions with at least 3:1 contrast on
white:

- Scenario presets (`scenarios.ts`): Base `#3159d9`, Optimistic `#087c91`,
  Conservative `#b04a1c`, Best `#4f7a2b`, Worst `#b4233e`. Extra cases cycle through
  plum, navy, ochre, muted, dark primary and dark accent.
- Benchmark assets (`RoiBenchmarks.tsx`, UI only; the market data is untouched):
  S&P 500 primary, Nasdaq 100 plum, bonds olive, REITs burnt orange, savings muted,
  custom coral ink. All reach 4.5:1, so their table labels are legible.
- Expense categories (`chart-data.ts`): primary, navy, accent, coral, plum, light
  primary, ochre and grey. CapEx is olive.
- Risk scale (`deal-insights.ts` `riskScale`): danger → burnt orange → ochre →
  olive → accent. Each passes 4.5:1, because the score text uses it.
- Sensitivity heatmap: danger → sand → accent. The colour-blind-safe RdBu option is
  unchanged.

Negative values are always `--rr-bad`. Positive or "good" values are always
`--rr-ok`. Sign colours and the "Gap = unavailable, not $0" key keep their meaning.

## 4. What did not change

- `src/lib/analysis` calculations, the projection engine and `src/lib/roi`.
- Chart domains and tick rules (`referenceScale`, `equityAxisMax`, …) and the
  `$Nk` tick labels.
- Exact tables in cents, CSV, demo provenance notices, the
  "Projected · before tax" labels and the missing-data and "Complete your
  assumptions" states.
- Hover, tap, arrow-key, Home, End and Escape readouts, the live regions, popovers,
  Enter-to-select on Exit, the 25 chart types, legends and horizons.
- Responsive rules: header controls stack below 640 px, tiles use two columns and
  every card fits at 390 px.

Only colour constants changed in `src/lib/analysis`: `heatPalette`,
`expenseCategories`, `capexCategory`, the scenario presets and the risk-scale
colours. Their tests now check the palette constants.

## 5. Evidence

All captures come from an isolated runtime: this branch's production build on
port 3191 against `.data/postgres-5541`, seeded by `start.ps1`. The harness is
`tests/analysis/app-style-runtime.mjs`. It refuses port 3100. Compare picks two
assets only in an unsaved draft there.

```powershell
node tests/analysis/app-style-runtime.mjs http://127.0.0.1:3191 <outDir>
```

`roi-app-style/after/` holds every chart family at 1440 and 390 px, the ROI page
and both app reference screens, plus `app-style-report.json`. `roi-app-style/before/`
holds a representative subset of the RealROI-styled build: the page, Deal Snapshot,
C1, C6, C8, C10, C11, C14, C15, C18, C19, C24 and C25. The "before" ROI page was a
read-only view of the live 3100 app, which then still served `1a6c913`.

| Family                     | Charts       | After (1440 / 390)                                                         |
| -------------------------- | ------------ | -------------------------------------------------------------------------- |
| Summary                    | C1, C2, C5   | `summary-net-cashflow-*`, `summary-outcome-*`, `summary-projections-*`     |
| Deal Snapshot, Fix My Deal | C3, C4       | `summary-deal-snapshot-*`, `summary-fix-my-deal-*`                         |
| Actual vs projected        | table        | `actual-vs-projected-*`                                                    |
| Equity                     | C6, C7       | `equity-composition-*`, `equity-value-mortgage-*`                          |
| Cash Flow                  | C8, C9       | `cashflow-cumulative-*`, `cashflow-bridge-*`                               |
| Expenses                   | C10          | `expenses-*`                                                               |
| Amortization               | C11–C13, C17 | `amortization-area-*`, `amortization-schedule-*`                           |
| Exit                       | C14          | `exit-*`                                                                   |
| Sensitivity                | C15, C16     | `sensitivity-*`                                                            |
| Scenarios                  | C18          | `scenarios-*`                                                              |
| Benchmarks                 | C19, C20     | `benchmarks-growth-*`, `benchmarks-risk-*`                                 |
| Compare                    | C21–C24      | `compare-growth-*`, `compare-bars-*`, `compare-radar-*`, `compare-table-*` |
| Rental Distribution        | C25          | `rental-distribution-*`                                                    |
| Interaction                | C1 tooltip   | `tooltip-*`                                                                |

Computed styles (`after/app-style-report.json`, same at both widths):

| Probe                             | App screen                                        | ROI after                                    | ROI before                                        |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| Card                              | 12 px radius, 1px `rgb(220,227,237)`, card shadow | identical                                    | 8 px radius, `rgb(226,232,240)`, no shadow        |
| Card heading                      | Space Grotesk 16 px                               | Space Grotesk 16 px                          | Inter 14 px                                       |
| Pressed toggle (first on Summary) | `.chip.active` `rgb(49,89,217)`, 999px            | `rgb(49,89,217)`, 999px                      | `rgb(30,58,138)` (local `#1e3a8a` override), 6 px |
| Card text colour                  | `rgb(23,36,59)` (`--design-text`)                 | `rgb(23,36,59)`                              | `rgb(23,20,43)` (local override)                  |
| Tile value / axis text            | `.kpi .value` Space Grotesk / Inter               | Space Grotesk / Inter                        | JetBrains Mono / Inter                            |
| Loaded faces                      | Inter, Space Grotesk                              | Inter, Space Grotesk (JetBrains not present) | Inter, Space Grotesk, JetBrains Mono              |

Behaviour in the same run, at both widths:

- All 23 captured cards were found.
- `scrollWidth` equalled `clientWidth` on every tab, the comps page included.
- Hovering (1440) or tapping (390) C1 shows the year 3 equation tooltip.
- Home then → announces year 2 with exact cents (`Cash Flow -$175.80`). This
  matches the earlier verified readout.
- There were no console errors.

## 6. Startup and seeding

No startup, seed, migration or launcher code changed. Only styles, presentation
colour constants, tests and docs did. The fresh and repeat startup evidence in
`realroi-chart-parity.md` §12.4–12.5 therefore still applies and was not rerun.

This work's isolated runtime did run the real `scripts/start.ps1` twice on a new
`.data/postgres-5541`:

- The first run initialised the database, migrated and seeded it.
- The repeat run logged "Demo seed is up to date".

`npm run build` cannot regenerate the Prisma engine while the live copy holds it
(EPERM), so the isolated builds ran `next build` directly. The Prisma schema is
unchanged.

## 7. Live delivery (2026-10-20)

- Root `main` was fast-forwarded to `b57e710`. Root's own local edits were left as
  they were: `prisma/package-lock.json` and the untracked `start-rocketrental.ps1`.
- `register-live-task.ps1 -Restart` restarted `RocketRentalLive3100`
  (`start.ps1 -Port 3100 -DbPort 5434 -SkipInstall -StopExisting`).
  - It rebuilt from build `80LybE7yms0czS-GwZ-0s` to `qH58PGKbiK-DM2WYQRPrA`. That
    build's `_buildManifest.js` returns 200, and `/fonts/jetbrains-mono-…woff2` now
    returns 404.
  - Processes: `next start -p 3100` under PowerShell, with postgres on
    `.data/postgres-5434`.
  - `.demo-seeded` is still 2026-10-20 11:57:30, so nothing was reseeded.
  - `.data/postgres-5433` was not started; it was last written at 12:31.
- Read-only live check on Maple Court at 1440 and 390 px
  (`roi-app-style/after/live-3100-check.json`). It clicked only tabs: no Save, no
  Reload and no Compare selection, and Elm Street was not opened.
  - Cards: 12 px radius, `rgb(220,227,237)` border. Titles: Space Grotesk 16 px.
    Tile values: Space Grotesk. Pressed toggles: `rgb(49,89,217)`, 999px.
    JetBrains Mono is not loaded.
  - All six Charts sub-tabs, Scenarios, Benchmarks, Actual vs projected and
    Summary rendered without horizontal overflow or console errors.
  - Actual vs projected still reads $215,850 and $80,000 with "Rent coverage is
    partial". Maple is at revision 0.
  - The keyboard readout gives year 2 Cash Flow −$175.80, as before.
  - The live ROI page captures were byte-identical to the isolated
    `after/roi-page-1440.png` and `roi-page-390.png`, so they were not added again.
- **Data preservation in 5434** (`roi-app-style/after/live-5434-hashes.json`):
  - Every row of all 33 tables was hashed (row count plus an MD5 over the sorted
    row MD5s) before integration and after the restart and live check.
  - All 33 tables were identical. The digest stayed `bc7bed62…61d2`.
  - The one `RoiAnalysisState` row, the 18 Elm Street DRAFT at revision 2, is
    unchanged.

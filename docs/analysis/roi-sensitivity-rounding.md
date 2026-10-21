# Sensitivity table: one-decimal percentages

The Sensitivity grid table under Charts → Sensitivity used to show vacancy headings and
results to four decimal places (`5.0000% vacancy`, `-9.3871%`). It now rounds them for
display to one place: `5.0% vacancy`, `-9.4%`, and `-11.8086%` becomes `-11.8%`. Whole
percentages keep their `.0`, and a tiny negative that rounds to zero reads `0.0%`.

- `rate(value, digits = 4)` in `src/lib/analysis/projections.ts` takes an optional
  number of places. Only the sensitivity table passes `1`. Other tables and the heatmap's
  keyboard and hover readout keep four places.
- Caption: `<timeframe> · percentages rounded to one decimal place` (was `· exact`).
- The projections footer now says: "rates to four decimal places (sensitivity rates to one)".
- Engine values, the stored analysis, rent row headings in cents, Base highlighting,
  negative colouring, missing-cell reasons and the heatmap are unchanged.

## Checks

- `tests/analysis/projections.test.ts`: `-0.093871` gives `-9.4%`, `-0.118086` gives
  `-11.8%`, `0.05` gives `5.0%` and `-0.0004` gives `0.0%`. Four places by default are unchanged.
- `tests/analysis/realroi-charts.test.tsx`: checks the caption, the `0.0%`–`15.0% vacancy`
  headings and the one-decimal Base cell. It also checks that the grid's base value still
  equals the engine's full-precision cash-on-cash.

## Live delivery (2026-10-20)

- Root `main` was fast-forwarded to `b4f26c7`. Root's own local edits were left as they
  were.
- `register-live-task.ps1 -Restart` rebuilt the app from `qH58PGKbiK-DM2WYQRPrA` to
  `x5jszLV2HwIMdgTEC5RWA` on 3100 / `.data/postgres-5434`. `.demo-seeded` is still
  11:57:30, so nothing was reseeded.
- Read-only live check on Maple Court, Cedar Row and Harbor View at 1440 and 390 px
  (`roi-sensitivity-rounding/live-sensitivity-check.json`). It clicked only tabs and the
  heatmap's arrow keys. Elm Street, which holds the saved draft, was not opened.
  - All headings read `0.0% … 15.0% vacancy`.
  - Base cells: Maple `-0.3%`, Cedar `2.4%`, Harbor `1.5%`. Each keeps its teal outline.
  - Positive and negative cells both show one place, negatives in red.
  - Rent headings keep cents, for example `$23,000.00`.
  - There was no page overflow and no console errors.
  - The heatmap readout still gives four places, for example `-3.8723%`.
- Screenshots: `roi-sensitivity-rounding/maple-sensitivity-1440.jpg` and `-390.jpg`.
- **Data preservation** (`roi-sensitivity-rounding/live-5434-hashes.json`): row hashes of
  all 33 tables were taken before delivery and after the live check. They were identical:
  digest `bc7bed62…61d2`, the same as at the previous delivery. The `RoiAnalysisState`
  row is unchanged.
- The screenshot's values (base rent $1,690, Base `-9.3871%`) are not in these three
  properties. Their rounding is covered by the unit test above.

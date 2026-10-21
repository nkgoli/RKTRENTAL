# ROI UX polish: final slice (cross-screen states, shared components, delivery)

The last ROI polish slice closes the coverage map in `roi-ux-polish.md` §1 and the follow-ups
in `roi-ux-core.md` §2, `roi-ux-decisions.md` §2 and `roi-ux-comparisons.md`. It does not
change calculations, the 25 chart types, one-decimal sensitivity, drafts and scenarios,
Property-based assumption editing, the compact header or tab and chart-sub-tab returns.

Base: `8a4b926`. It contains the overview (`dc0991f`), comparisons (`050c2c3`), core charts
(`3c38069`), core evidence move (`bd08b8d`) and decision views (`b7cbeee`) slices, plus the
compact header and round trip (`637bcfa`).

## 1. What changed

**Opening and loading a property** (`RoiWorkspace.tsx`, `analysis.module.css`)

- **Bug fix: no chooser while loading.** Opening `/roi-analysis?property=…` used to render
  "Choose a property" with the full property list, both in the server HTML and for the whole
  load. Next runs server actions in a transition, and that held back the loading render until
  the data arrived. On a slow connection the page looked like it had forgotten the property.
  - A property address now renders as that property from the first paint: the "ROI Analysis"
    heading, the property name and address, and a loading card.
  - `load()` yields one task before starting its requests, so the loading state paints when you
    switch properties too.
- **Loading card** (`role="status"`): "Loading analysis…", one line saying what is loading,
  and a static four-tile placeholder (two columns on phones, no motion). It replaces the bare
  "Loading analysis..." text. "Revision N" is hidden until there is a revision to show.
- **Load failure card** (`role="alert"`): "This analysis did not load", the reason, "Nothing was
  changed.", **Retry loading** and **Change property**. Before, there was a lone Retry button
  under the status line. Retry is hidden for an unknown or archived property, because retrying
  cannot fix that.
- **No repeated status.** "New analysis - filled in from saved property details." and
  "Loaded draft - revision 3" repeated the Assumptions band's source. They are now announced to
  screen readers only. The band shows the saved status itself: `Saved draft · revision 3` /
  `Saved ready · revision 1` (it used to say `Saved analysis`). Save and error messages are
  still visible.
- The "Out of date" line now says "correct the entries to review; results update
  automatically". It used to say "recalculate", but recalculation is automatic.

**Shared components**

- **Phone tab rows** (`AnalysisTabs`, used by the ROI sections and the chart sub-tabs). When the
  row scrolls sideways, the edge that hides more tabs fades (`data-more="start|end"`). The
  selected tab still scrolls into view. Before, tabs past the edge had no cue.
- **Basis tags**: `Hypothetical…` and `Temporary…` tags (reference markets, exit and
  sensitivity probes) get the caution tint, so they never look like the property's own muted
  facts. `Projected` and `Recorded` tints are unchanged.
- **`ComboChart`**
  - Gains a `Percent` unit. The C22 annualized-return chart used it; its SVG title said
    "(index)" and now says "(percent)". Ticks and tooltips default to `%`.
  - Rows that show words now speak them, followed by the exact value. For example "Mortgage
    Balance No loan ($0.00)" is read instead of "$0.00" under a visible "No loan" (core
    follow-up 1).
- `benchmarkComparison` messages no longer tell you to "recalculate".

## 2. Coverage map: final status

| Item (source)                                                                 | Outcome                                                                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Status repeats the band's source (polish §1)                                  | **Done**: announced only; the band shows draft/ready + revision                                                              |
| Loading text only (polish §1)                                                 | **Done**: loading card; the chooser no longer appears during a load (bug found in this slice)                                |
| Load error / retry                                                            | **Done**: in-place card with Retry and Change property                                                                       |
| Phone tab scroll cue (polish §1)                                              | **Done**: edge fade on every scrolling tab row                                                                               |
| Actuals per-cell notes and tags (polish §1)                                   | Kept: notes are row-specific and tests pin the tags                                                                          |
| Spoken vs visual tooltip text (core 1)                                        | **Done**                                                                                                                     |
| `fixedDomainScale` uneven last step, round `referenceScale` (core 2, 4)       | Kept: they reproduce the RealROI reference axes; parity tests pin them                                                       |
| `useHorizon` visible label (core 3, decisions 3)                              | Kept: the year tag beside each picker names the horizon; the group already has an accessible name                            |
| Skip link after taps at 390 (decisions 2)                                     | Verified not reproducible: hidden after taps at 390, shown on keyboard Tab (check below)                                     |
| `scenario-charts.module.css` split (decisions 4)                              | Kept: the scenario-only classes stay grouped under one comment                                                               |
| `stale` cannot tell request errors from incomplete (decisions 5, comparisons) | Kept: cards distinguish by `snapshot`; the band copy covers both                                                             |
| C22 "(index)" title (comparisons)                                             | **Done**: `Percent` unit                                                                                                     |
| Rent comps mojibake `Â·` (comparisons)                                        | Verified absent: source is clean UTF-8 and the rendered page has no `Â` at 1440/390                                          |
| "and recalculate" messages (comparisons)                                      | **Done**                                                                                                                     |
| Hypothetical tint (comparisons)                                               | **Done**                                                                                                                     |
| Comparisons blocking checklist: 390 provenance, rerun, 404, evidence          | **Done**: comparison harness passes on the combined head before and after (layout width 390 kept, no console errors or 404s) |

## 3. Evidence and verification

Evidence is in the untracked `evidence/roi-ux-final/` (not committed, because the tracked tree
is near its limit): `before/` (build of `8a4b926`) and `after/` (this change), each with the
harness captures and report JSON, plus startup logs.

Runtime: fully isolated. The app ran on port 3201 against a **fresh** embedded Postgres on 5551.
`scripts/start.ps1` created and seeded it, and added the demo ROI inputs. `demo:roi` added the
fictional examples. The startup and seed code is unchanged by this slice, and this actual
isolated startup passed again.

Harness: `node tests/analysis/ux-final-runtime.mjs <baseUrl> <outDir> [propertyId...]`. It is
read-only: it produces loading and failure states by holding or aborting the page's own
server-action requests in the browser. It refuses 18 Elm Street on 3100. At 1440 and 390 it
checks:

- the chooser;
- the loading card instead of the chooser, and that it is announced;
- the failure card, Retry, recovery, and no overflow;
- that the load status is not repeated beside the source;
- the tab-row cues before and after selecting Compare, and that the selected tab is in view;
- that the skip link is hidden after a tap and shown on keyboard Tab;
- the hypothetical tint;
- rent comps text;
- console errors and HTTP ≥ 400 responses.

`UX_FINAL_WRITE=<propertyId>` (isolated only) saves a Compare selection as a draft, reloads, then
removes it and saves again.

Results (all on the isolated 3201/5551 runtime):

| Run                                                         | Before (`8a4b926`)                                                                   | After                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| `ux-final-runtime.mjs`                                      | 18 failures: chooser during load, no failure card, repeated status, no tab cue, no tint | 52 checks, 0 failures       |
| `ux-overview-runtime.mjs`                                   | 42 checks, 0 failures                                                                | 42, 0                         |
| `ux-core-runtime.mjs`                                       | 198, 0                                                                               | 198, 0                        |
| `ux-decisions-runtime.mjs`                                  | 182, 0                                                                               | 182, 0                        |
| `ux-decisions-runtime.mjs` + `UX_DECISIONS_WRITE` / `_MISSING` | —                                                                                 | 208, 0                        |
| `ux-comparison-runtime.mjs` (the comparisons checklist)     | 48, 0                                                                                | 48, 0                         |
| `compact-roundtrip-runtime.mjs flow` / `capture`            | —                                                                                    | 14, 0 / 6, 0                  |

- The `after` final run includes `UX_FINAL_WRITE` on Harbor View: Compare selection saved
  (revision 1), restored (revision 2).
- The round-trip flow covers:
  - Show details and More actions keys;
  - Sensitivity Cancel/Save return with one-decimal cells;
  - Scenarios/Benchmarks/Compare Cancel;
  - Keep editing / Save draft and continue / Discard and continue.
- The decisions write covers:
  - scenario create, override, Save draft, reload, clear, remove;
  - Cedar Row's missing state on every decision view.
- There were no console errors or HTTP errors in any run.
- Vitest (`tests/analysis`, `tests/properties`, `tests/returns`, `tests/navigation`,
  `tests/rent-analysis`): all passed. That includes new tests for:
  - the address loading state and the load announcement;
  - the failure card and Retry;
  - the hypothetical tint;
  - the C22 percent title;
  - the spoken "No loan ($0.00)".
- `tsc --noEmit`, ESLint (`--max-warnings=0`) and Prettier passed on the changed files.

# ROI baseline assumptions are edited through the property

Returns & ROI is a results dashboard. A compact heading band holds the property context,
**Save draft**, **Save ready** and a keyboard-accessible **More actions** disclosure
(Recalculate, Reload saved analysis, Change property). Below it, the read-only **Assumptions**
summary is a single row by default: source, calculation state, **Show details** (an
`aria-expanded` toggle for the seven-item digest) and **Edit assumptions**. When inputs are
missing it adds one line with a count, the first gap and **Complete assumptions**; sample-data
values are always named. Both links open the property's Edit Property page at its ROI section
(`/properties/<id>/edit?returnTo=…&field=…#roi-details`).

## Round trip

- The dashboard address carries `view` (`actual`, `charts`, `scenarios`, `benchmarks`,
  `compare`; Summary is the default and omitted), on Charts a non-default `chart` sub-tab
  (`cash-flow`, `expenses`, `amortization`, `exit`, `sensitivity`), and the period parameters.
- `returnTo` is accepted only when it is `/roi-analysis` for the same property; it is rebuilt
  from `property`, a supported `view`/`chart` and the period parameters
  (`src/lib/analysis/return-path.ts`); unknown values are dropped. Anything else falls back to
  the property page.
- From ROI, the fields are prefilled with the values the analysis actually uses: the saved
  analysis baseline, or for a new analysis the property details (plus complete lease rent).
  Where a saved value differs from the property's own value, the field says so.
- The editor shows full field-level ROI validation and a missing-input list; saving is never
  blocked by it, so ROI details stay optional for ordinary property setup.
- **Save and return to ROI** saves and returns to the same property, section, chart sub-tab
  and period, which reloads and recalculates. **Cancel** and the back link return without saving.
- Unsaved scenario, comparison or tax edits on the dashboard are guarded before leaving
  (save draft, discard or keep editing).

## Source precedence

1. A saved analysis (draft or ready) remains the source for the dashboard. Property details
   only seed a new analysis.
2. An explicit **Edit Property** save also applies exactly the baseline assumptions that save
   changed or cleared to that property's saved analysis, in the same transaction
   (`src/lib/analysis/property-sync.ts`). Untouched assumptions, earlier ROI-only values,
   scenarios, overrides, comparisons and tax options stay as saved. The revision increments,
   so an open ROI tab gets the existing conflict prompt instead of overwriting the change.
3. If that change leaves a ready analysis incomplete or incalculable, it becomes a draft so it
   still loads. Nothing is filled in or invented.
4. Seed, demo and import loaders and other property updates do not touch saved analyses; the
   sync runs only for the Edit Property save, for that one property.

## Layout and round-trip checks

`tests/analysis/compact-roundtrip-runtime.mjs` checks the compact header and the round trip
against a production build:

- `capture` (read-only, safe on the live app) opens each property at 1440 and 390 px and
  checks that at least 200 px of the first result card is in the first viewport, without
  horizontal overflow. On phones the ROI section tabs and chart sub-tabs are one row that
  scrolls sideways.
- `flow` (isolated runtimes only; it saves data) checks keyboard use of **Show details**
  (Enter/Space) and **More actions** (Enter, Tab, Escape back to the toggle). It also checks
  Cancel and **Save and return to ROI** from Charts → Sensitivity with a period, Cancel from
  Scenarios, Benchmarks and Compare, and the unsaved-changes guard (Keep editing, Save draft
  and continue, Discard and continue).

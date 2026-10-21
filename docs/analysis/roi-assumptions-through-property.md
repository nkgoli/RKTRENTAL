# ROI baseline assumptions are edited through the property

Returns & ROI is a results dashboard. It shows a compact, read-only **Assumptions** summary
with **Edit assumptions**, and, when inputs are missing, a count, the first gap and
**Complete assumptions**. Both links open the property's Edit Property page at its ROI section
(`/properties/<id>/edit?returnTo=…&field=…#roi-details`).

## Round trip

- `returnTo` is accepted only when it is `/roi-analysis` for the same property; it is rebuilt
  from `property`, `view=actual` and the period parameters (`src/lib/analysis/return-path.ts`).
  Anything else falls back to the property page.
- From ROI, the fields are prefilled with the values the analysis actually uses: the saved
  analysis baseline, or for a new analysis the property details (plus complete lease rent).
  Where a saved value differs from the property's own value, the field says so.
- The editor shows full field-level ROI validation and a missing-input list; saving is never
  blocked by it, so ROI details stay optional for ordinary property setup.
- **Save and return to ROI** saves and returns to the same property, view and period, which
  reloads and recalculates. **Cancel** and the back link return without saving.
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

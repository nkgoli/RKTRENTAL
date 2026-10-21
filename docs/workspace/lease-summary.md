# Lease summary on property and unit overviews

## What changed

The Overview lease timeline no longer draws a wide filled date track with a Today marker. It now reads as a compact lease summary:

- Explicit text status: Current, Upcoming, Draft, Past, Vacant.
- Readable Start and End dates taken from the real lease record, not the clamped axis bounds.
- Date-relative wording measured from the timeline's supplied date: `Ends today`, `Ends in 11 days`, `2 months remaining`, `Starts in 2 months`, `Ended 4 months ago`, `Starts in 2 months · not signed`.
- Scoped `View lease` links (`/leases/<id>?propertyId=…&unitId=…`) and scoped unit links.
- Current, upcoming, draft and past leases stay discoverable. Non-primary leases sit behind a compact `Other leases` / `Lease history` disclosure; extra units sit behind `Show all N units`.
- Vacant units show `No lease on file` or `No current lease` with the last lease's ended wording. No fabricated vacancy date range is shown.
- The unit view stays compact so the existing `WorkspaceOverview` footer keeps the current tenant, dates, rent/deposit and `View lease`. Property rows keep tenant context and scoped links.

## Files

- `src/components/workspace/LeaseTimeline.tsx`
- `src/components/workspace/LeaseTimeline.module.css`
- `src/lib/workspace/timeline.ts`
- `tests/workspace/lease-summary/timeline.test.ts`
- `tests/workspace/lease-summary/lease-timeline.test.tsx`
- `docs/workspace/lease-summary.md`

## Verification

- `npm test` — 169 test files passed, 11 skipped; 1121 tests passed, 54 skipped.
- `npm run typecheck` — passed.
- `npx eslint src/components/workspace/LeaseTimeline.tsx src/lib/workspace/timeline.ts tests/workspace/lease-summary --max-warnings=0` — passed.
- `npx next build` — passed.
- Preview checks at 1280px and 390px with synthetic leases:
  - Current lease: Cedar Row Townhomes · Unit Townhome 1.
  - Upcoming renewal: Maple Court · Unit 1A (synthetic next lease).
  - Draft: Maple Court · Unit 1B (synthetic draft lease).
  - History: Maple Court · Unit 3A (synthetic ended lease).
  - Vacancy: Cedar Row Townhomes · Unit Townhome 8.
  - Multiple units: Cedar Row Townhomes and Maple Court property overviews.
  - Keyboard: focused the `Other leases` summary and pressed Enter; the disclosure opened. The 3px focus ring is visible.
  - Links: unit and lease links carry the property/unit scope.

Screenshots are in `.playwright-mcp/` (local evidence, not committed):

- `lease-summary-desktop-property.png`
- `lease-summary-desktop-unit-current.png`
- `lease-summary-desktop-maple.png`
- `lease-summary-desktop-upcoming.png`
- `lease-summary-desktop-draft.png`
- `lease-summary-desktop-history.png`
- `lease-summary-desktop-vacant.png`
- `lease-summary-desktop-focus.png`
- `lease-summary-390-property.png`
- `lease-summary-390-unit-current.png`
- `lease-summary-390-maple.png`
- `lease-summary-390-history.png`
- `lease-summary-390-vacant.png`
- `lease-summary-390-upcoming-long-name.png`

The before state is the supplied attachment `Artifacts/input:c33d5e889c5f468422431cf83c91072bf238ed5771d53a1bba49ae78086fa2c3` (the thick solid blue lease-term bar).

## Limitations

- The synthetic leases were inserted into the local preview database only; they are not part of the seed or the committed change.
- The existing Playwright e2e suite was not run. The focused workspace tests, typecheck, lint and production build were run.

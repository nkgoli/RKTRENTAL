# Lease summary on property and unit overviews

## What changed

The Overview lease timeline no longer draws a wide filled date track with a Today marker. It now reads as a compact lease summary:

- Explicit text status: Current, Upcoming, Draft, Past, Vacant. A lease whose record is `ENDED` or `TERMINATED` keeps that terminal status through `TimelineSegment` and reads `Ended` or `Terminated` instead of the generic `Past`.
- Readable Start and End dates taken from the real lease record, not the clamped axis bounds. For a terminal lease the end date is labelled `Scheduled end`, because the record's `endDate` is the scheduled term end and may not be the actual ending date.
- Date-relative wording measured from the timeline's supplied date: `Ends today`, `Ends in 11 days`, `2 months remaining`, `Starts in 2 months`, `Ended 4 months ago`, `Starts in 2 months · not signed`.
- Terminal leases never measure elapsed time from a scheduled end date. With no authoritative actual ending date in the timeline data, they use neutral wording: `Ended early` / `Terminated early` when the scheduled end is still in the future, otherwise `Ended` / `Terminated`. The vacant summary adds `· scheduled through <date>` so the scheduled term is not mistaken for the actual termination date.
- Scoped `View lease` links (`/leases/<id>?propertyId=…&unitId=…`) and scoped unit links.
- Current, upcoming, draft and past leases stay discoverable. Non-primary leases sit behind a compact `Other leases` / `Lease history` disclosure; extra units sit behind `Show all N units`.
- Vacant units show `No lease on file` or `No current lease` with the last lease's truthful terminal wording. No fabricated vacancy date range is shown.
- The unit view stays compact so the existing `WorkspaceOverview` footer keeps the current tenant, dates, rent/deposit and `View lease`. Property rows keep tenant context and scoped links.

## Files

- `src/components/workspace/LeaseTimeline.tsx`
- `src/components/workspace/LeaseTimeline.module.css`
- `src/lib/workspace/timeline.ts`
- `tests/workspace/lease-summary/timeline.test.ts`
- `tests/workspace/lease-summary/lease-timeline.test.tsx`
- `docs/workspace/lease-summary.md`

## Verification

- `npx vitest run --config vitest.config.ts tests/workspace/lease-summary` — 2 files passed, 28 tests passed. Includes ENDED and TERMINATED records with future scheduled ends, terminal status retention, vacant summary wording, and expanded history.
- `npm run typecheck` — passed.
- `npx eslint src/components/workspace/LeaseTimeline.tsx src/lib/workspace/timeline.ts tests/workspace/lease-summary --max-warnings=0` — passed.
- `npx next build` — passed.
- Preview checks at 1280px and 390px with a synthetic early-terminated lease:
  - Maple Court · Unit 3A: `TERMINATED`, start 2026-01-01, scheduled end 2026-12-31, move-out 2026-10-01. The vacant summary reads `No current lease` and `Terminated early · scheduled through Dec 31, 2026`; the expanded `Lease history (1)` shows the `Terminated` badge, tenant Taylor Reed, `Terminated early`, `Start Jan 1, 2026`, `Scheduled end Dec 31, 2026`, and a scoped `View lease` link. No `Ended 71 days ago` or `Terminated 71 days ago` wording appears.
  - Maple Court · Unit 1A: current lease stays compact (`Current`, `2 months remaining`, footer tenant/dates/rent/deposit/`View lease`); the expanded history shows the synthetic `TERMINATED` lease with `Scheduled end Jun 30, 2025` and no invented elapsed time.
  - Maple Court property overview: `Show all 12 units` reveals Unit 3A with the same truthful vacant summary; current units keep their existing compact rows.
  - Responsive layout: the 390px captures keep the compact summary, wrap the terminal wording, and keep the history disclosure and `View lease` link usable.

Screenshots are in `.playwright-mcp/` (local evidence, not committed):

- `lease-summary-terminated-desktop-1280.png` — Unit 3A, desktop, expanded history.
- `lease-summary-terminated-390.png` — Unit 3A, 390px, expanded history.
- `lease-summary-terminated-history-390.png` — Unit 1A, 390px, current lease plus expanded terminal history.
- `lease-summary-terminated-property-1280.png` — Maple Court property overview with all units expanded.

The before state is the supplied attachment `Artifacts/input:c33d5e889c5f468422431cf83c91072bf238ed5771d53a1bba49ae78086fa2c3` (the thick solid blue lease-term bar). The retained checkout also has the previous task's before captures for the same unit: `tests/workspace/native-review/evidence/before-1280-unit-occupied.png` and `before-390-unit-occupied.png`; the matching after captures are `lease-summary-desktop-unit-4b.png` and `lease-summary-390-unit-4b.png`.

## Limitations

- The timeline data does not currently carry an authoritative actual ending date (`moveOutDate` is not selected in `src/lib/workspace/timeline-data.ts`, which is outside this Task's owned paths). The UI therefore uses the neutral terminal wording described above rather than claiming an elapsed time.
- The synthetic leases were inserted into the local preview database only; they are not part of the seed or the committed change.
- The existing Playwright e2e suite was not run. The focused workspace tests, typecheck, lint and production build were run.

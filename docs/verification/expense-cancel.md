# Add expense Cancel on /returns

Date: 2026-10-22. Base: `fa42fd9` (includes the button-label fix `68792dd`).

## Symptom

On `/returns?add=1`, clicking **Cancel** fetched `/returns?period=12M` (RSC, HTTP 200), but the
URL stayed on `?add=1` and the Add expense form stayed open.

## Reproduction

Isolated runtime: embedded PostgreSQL on 5483 (fresh migrate and seed), Next on 3483/3484.

| Build                  | Cancel from `?period=3Y&property=seed-property-maple&add=1`                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `next dev`, base       | Works (click, Enter, 390px, repeated, after invalid submit)                 |
| `next start`, base     | Fails every time: one RSC GET 200, no document load, URL and form unchanged |
| `next start`, this fix | Works: one document GET 200 to the filtered URL, form closed                |

The dev server never reproduced it. That is why the earlier check could not explain it.

On the base production build the same stall also hit every same-route transition on `/returns`:

- `+ Add expense`.
- `router.push`/`router.replace` to another `/returns?…`.
- The server-action redirect after **Save expense**. For a valid entry the expense **was saved**
  (database row count went up), but the form stayed open with no notice, so a second save could
  duplicate it.
- An invalid entry showed no notice.

There were no console errors. Prefetching was ruled out: blocking or holding the `/returns/export`
prefetch, or disabling all viewport prefetch, did not help.

## Cause

This is a framework race in production client navigation (Next 15.5.27, bundled React
`19.2.0-canary-0bdb9206-20250818`). It hits same-route transitions on `/returns`.

- The router reducer applies the new state completely. `getCurrentAppRouterState()` showed the new
  tree and a cache with the page's `rsc` element.
- React keeps that transition suspended (`pendingLanes === suspendedLanes`, `pingedLanes 0`,
  nothing scheduled). Every thenable registered in the root `pingCache` was already fulfilled,
  except Next's never-resolving `unresolvedThenable`.
- The stale render is thrown by Next's `InnerLayoutRouter`. It ran for the new page segment with a
  cache node that had `rsc: null` and its own lazy refetch still pending. The refetch body arrived
  complete and decodes fine on its own, but the render never retried with the patched cache.

Whether it happens depends on how much the page renders:

- Trimming `/returns` sections made it intermittent.
- The full page stalled in every run.
- `/dashboard?period=…` stalls the same way.
- Payments, Maintenance, Properties and ROI same-route pushes commit.

The app has no state bug here, and CSS is not involved. No change under `src/app/(manager)/returns`
or `src/components/returns` makes the client transition reliable.

## Fix

Keep the Add expense flow off client transitions, as the range chips and the property filter on
this page already do:

- **Cancel** and **+ Add expense** are plain `<a class="btn …">` document links with the same
  classes `Button` renders. The card-header rule from `68792dd` still excludes `.btn`.
- The form posts natively to `POST /returns/expense` (`expense/route.ts`). It answers `303` to the
  same report URL plus a notice, so the browser loads the result as a document. This matches the
  tenant pay endpoint, including the same-origin / `sec-fetch-site` check and the
  `canAccessRole(…, 'MANAGER')` rule the server action used.
- Validation and recording moved unchanged into `add-expense.ts`.
- The empty-state "Add expense" link (a `next/link` inside the shared `EmptyState`) was dropped.
  The `+ Add expense` button sits directly below it in the same card.

Cancel builds its URL from `range` and the selected property only. It never carries `add` or
`notice`. A cancelled form posts nothing.

## Verification (production build, isolated database)

`tests/returns/expense-cancel.spec.ts` checks:

- Each step is a real document navigation.
- The URL is the filtered report.
- The form and invalid notice are gone.
- The property select keeps `seed-property-maple` and the `3Y` chip stays current.
- The Expense breakdown total is unchanged and no POST was sent.

It covers three click open/cancel rounds, keyboard Enter open and cancel with a partly filled
form, cancel after an invalid submission (amount −5), and a 390px viewport.

- Fix build (3483): 3 passed. Base build (3484): 3 failed (Cancel never navigated).
- Expense rows before and after Cancel: 241 → 241 at 1280px and at 390px.
- Valid save on the fix shows "Expense added." with the form closed, and writes exactly one row.
- `vitest tests/returns tests/ui`: 12 files, 138 passed, 11 skipped. ESLint and Prettier are clean
  on the changed files.
- Screenshots (local only, `.playwright-mcp/expense-cancel/`):
  `{base,fix}-{1280,390}-form-before.png` and `{base,fix}-{1280,390}-after-cancel.png`.

## Remaining limits

- The framework race is not fixed. Other same-route client transitions can still stall in
  production; `/dashboard?period=…` does. A Next/React upgrade, or the same document-navigation
  approach there, is needed outside these paths.
- The existing `tests/returns/returns.spec.ts` (2 tests) and `navigation.spec.ts` (2 tests) fail
  the same way on base and fix. They still expect the pre-redesign heading "Returns and metrics"
  and the "Workspace sections" nav.
- Open/cancel now does a full page load, so scroll position resets. The `#add-expense` anchor
  still scrolls to the form.

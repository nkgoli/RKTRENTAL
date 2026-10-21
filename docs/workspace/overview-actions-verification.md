# Property and unit actions verification

The candidate consolidates workspace actions: the header has one **Edit property**
link to the populated dedicated editor, unit facts have **Edit unit**, and the
existing **Returns & ROI** tab opens the selected property or unit report. Reports
link to the same property's actual-versus-projected analysis and explain that
projections cover the whole property. Property reporting remains inside the
workspace so the switcher, navigation and browser history remain available.
Workspace tabs and unit/all-units switching retain `period`, `from` and `to`
and omit one-shot notices. The local Returns & ROI tab has no external-link arrow.

## Checks

- `npm.cmd run typecheck`: passed on the current shared checkout.
- Scoped ESLint and `git diff --check`: passed. New tests, route helper,
  review launcher and this report were formatted with Prettier.
- `npm.cmd test -- tests/workspace/overview-actions tests/workspace/routes.test.ts tests/workspace/scope.test.ts tests/workspace/scoped-tabs.test.tsx tests/workspace/workspace.test.tsx tests/analysis-navigation/entry.test.tsx tests/returns/presentation.test.tsx tests/properties/facts-navigation.test.tsx`:
  39 tests passed in ten files. New regressions cover unique actions, inline
  Cancel/Save, selected-unit form data, active-lease status locking, validation,
  report routing, custom dates and foreign-unit rejection.
- The three earlier failures requiring the old duplicate/generic edit controls
  are resolved. Updated coverage verifies the single property editor destination,
  explicit unit affordance, selected unit payload and successful inline save.
- The configured Playwright MCP browser checked a task-local Next development
  server on port 3261 and fresh PostgreSQL fixture on 55561. Managed Preview
  inspection returned `absent`; no publication was attempted. The launcher ran
  `prisma migrate deploy` (22 migrations) and `prisma/seed.ts` against this isolated
  database, producing four properties, 45 units and 41 occupied leases. Browser
  saves changed only that fixture. No live database was connected or reseeded.
  After capture, the exact review launcher/server processes were verified and
  stopped; the database PID file was absent. The fixture remains on disk.
  The follow-up browser checks reused this fixture, reported no pending migrations
  and skipped seeding. The launcher stopped its own app process tree and database
  after those checks.
- At 1280×1000 and 390×844: switched all-units/unit views; opened populated Cedar
  property fields from the sole property edit link; canceled a changed city;
  verified it was discarded; submitted an empty property name and saw validation;
  saved a new city and reopened the editor to confirm persistence. The mobile
  save restored the fixture city to Austin.
- At both widths: opened **Edit unit**, confirmed active-lease status was disabled,
  submitted an invalid bedroom count and saw its field error, canceled edits,
  reopened to confirm the saved value, saved a valid count and reloaded to confirm
  persistence. The fixture unit ends with four bedrooms.
- At both widths: opened the scoped unit report, opened Cedar's analysis, and used
  browser Back to return to the same unit report; switched to whole-property
  reporting without leaving the workspace. The mobile report tab was activated
  with keyboard Enter. Observed page widths did not overflow.
- Compared the existing control styling, visible labels, field errors, responsive
  forms and scrolling tabs with revision 7 of
  `Designs/rocketrental-light-system` (`shared-controls`, `responsive-navigation`).
  This change retains the established workspace layout and theme.

## Retained browser evidence

Screenshots are local to this retained checkout, ignored by Git, under
`tests/workspace/overview-actions/.runtime/evidence/`.

| Flow                               | Desktop capture                                                                                                        | 390px capture                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Property overview, one edit action | [Property](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-property.png)                | [Property](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-property.png)                |
| Property editor validation         | [Editor](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-property-validation.png)       | [Editor](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-property-validation.png)       |
| Unit validation and active lease   | [Unit editor](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-unit-validation.png)      | [Unit editor](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-unit-validation.png)      |
| Saved unit facts                   | [Saved](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-unit-saved.png)                 | [Saved](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-unit-saved.png)                 |
| Scoped unit report                 | [Unit report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-unit-returns.png)         | [Unit report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-unit-returns.png)         |
| Whole-property report              | [Property report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-property-returns.png) | [Property report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-property-returns.png) |
| Custom dates, property to unit     | [Unit report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-custom-unit.png)          | [Unit report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-custom-unit.png)          |
| Custom dates, unit to property     | [Property report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-custom-property.png)  | [Property report](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-custom-property.png)  |

The [desktop analysis capture](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-analysis.png)
shows the property's actual-versus-projected destination. The browser session reset
during the first mobile unit-save attempt; after a read-only availability probe,
the browser reconnected, signed in and successfully repeated the interrupted flow.
An initial desktop assertion looked for an obsolete analysis heading; checking the
actual **Actual vs projected** panel and the return trip succeeded.

## Custom range regression resolved

The refreshed Task scope includes `UnitSwitcher.tsx` and both preexisting edit-test
files. The switcher now preserves the supported date parameters in each direction
and still drops transient notices and one-shot flags. All four focused cases pass:
custom property-to-unit, custom unit-to-property, a preset between units, and an
unfiltered switch with transient flags.

The configured browser verified January–June 2026 at 1280 and 390 pixels in both
directions, checking the URL and displayed From/To fields. Desktop keyboard
navigation between Overview and Returns & ROI and browser Back/Forward retained
the range. On mobile, opening the property's Actual vs projected analysis and
going Back retained the same custom dates and selected unit. Neither width
overflowed. New custom-range captures show the final arrow-free workspace tab.
The earlier [failure capture](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-custom-range-lost.png)
is retained only as diagnostic history.

The initial follow-up desktop probe used an unavailable URL constructor in the
browser tool's execution environment; switching to direct URL-string assertions
and checking visible inputs passed. The mobile browser session reset once, then
the required flow passed after a read-only availability probe and reconnection.

The declared source commit is present in this checkout, as are the settled reminder
commits from the shared branch. Reminder source was left untouched. The current
combined checkout passes typecheck. This report claims a checked Git candidate;
it does not claim integration, push, Preview publication or independent acceptance.

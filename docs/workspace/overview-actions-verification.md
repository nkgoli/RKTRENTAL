# Property and unit actions verification

The candidate consolidates workspace actions: the header has one **Edit property**
link to the populated dedicated editor, unit facts have **Edit unit**, and the
existing **Returns & ROI** tab opens the selected property or unit report. Reports
link to the same property's actual-versus-projected analysis and explain that
projections cover the whole property. Property reporting remains inside the
workspace so the switcher, navigation and browser history remain available.
Workspace tabs retain `period`, `from` and `to` and omit one-shot notices.

## Checks

- `npm.cmd run typecheck`: passed on the current shared checkout.
- Scoped ESLint and `git diff --check`: passed. New tests, route helper,
  review launcher and this report were formatted with Prettier.
- `npm.cmd test -- tests/workspace/overview-actions tests/workspace/routes.test.ts tests/workspace/scope.test.ts tests/workspace/scoped-tabs.test.tsx tests/analysis-navigation/entry.test.tsx tests/returns/presentation.test.tsx`:
  28 tests passed in seven files. New regressions cover unique actions, inline
  Cancel/Save, selected-unit form data, active-lease status locking, validation,
  report routing, custom dates and foreign-unit rejection.
- The earlier run including `tests/workspace/workspace.test.tsx` and
  `tests/properties/facts-navigation.test.tsx` had 29 passes and three failures.
  Those assertions require the removed duplicate property-card action and generic
  unit label, or explicitly forbid **Edit unit**. Changes to these files require
  the requested path authorization.
- The configured Playwright MCP browser checked a task-local Next development
  server on port 3261 and fresh PostgreSQL fixture on 55561. Managed Preview
  inspection returned `absent`; no publication was attempted. The launcher ran
  `prisma migrate deploy` (22 migrations) and `prisma/seed.ts` against this isolated
  database, producing four properties, 45 units and 41 occupied leases. Browser
  saves changed only that fixture. No live database was connected or reseeded.
  After capture, the exact review launcher/server processes were verified and
  stopped; the database PID file was absent. The fixture remains on disk.
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

The [desktop analysis capture](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-1280-analysis.png)
shows the property's actual-versus-projected destination. The browser session reset
during the first mobile unit-save attempt; after a read-only availability probe,
the browser reconnected, signed in and successfully repeated the interrupted flow.
An initial desktop assertion looked for an obsolete analysis heading; checking the
actual **Actual vs projected** panel and the return trip succeeded.

## Remaining scope decision

`src/components/workspace/UnitSwitcher.tsx` currently retains `period` while dropping
custom `from` and `to`. Reproduced in the browser: selecting January–June 2026
produced `period=CUSTOM&from=2026-01&to=2026-06`; switching to Townhome 1 produced
`period=CUSTOM&unit=seed-unit-cedar-1`. See the
[remaining failure capture](../../tests/workspace/overview-actions/.runtime/evidence/overview-actions-390-custom-range-lost.png).
The typed questions request authority for that file and the two stale test files.
They remain untouched pending a decision. The candidate is not a completed
acceptance result while this issue remains.

The declared base commit is present in this checkout. The checkout also contains
concurrent uncommitted reminder schema, dependency, API and test changes. Those
files are outside this candidate and were left untouched. No reminder result
commit was supplied for ancestry verification, so shared membership is established
only by the observed working files. This report claims no integration, push,
Preview publication or acceptance.

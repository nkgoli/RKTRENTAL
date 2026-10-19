# Light dashboard handoff

Implements **Implement the approved light dashboard composition**, using dashboard-reference revision 6 and light-system revision 7. The manager dashboard body now has a portfolio pulse, a raised collection panel and history, leases beside attention, and property rows beside the activity timeline. Real figures replace the design's illustrative amounts. Shared fonts, tokens, controls, navigation and approved property SVG geometry are reused.

## Admitted base

- Initial assigned HEAD: `b62f7666dbe4c644f825904201bf29b2b6bb8fdf`.
- Required foundation admitted by ordinary fast-forward merge: `37314def68c96b2cf550b0f18a90ad9c42425d75`.
- Foundation tested source `ce760d10a1d82e5b764f9459ba7d0cef554ea140`, coverage `0582ac8ccd62e00c2c812d6f4b0b36ebf6e6b76a`, and visual-system handoff `c7cb0310a9694463e93568e040c7741750c0353b` remain ancestors. Coverage and system ancestry commands returned 0.
- Checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@2f9n5vihnwf0oxvzdq4/repository`; branch `orchestra/work-2gcjdifqik3o7helc0b-4fflu1d0q73pntl8c45`.
- The exact final dashboard candidate is recorded in the typed task report. No root integration, push, deployment or Preview publication was performed. Bound root `refs/heads/main` was observed at the initial assigned HEAD.

Foundation checks are reused from `light-foundation.md`: 71 component tests, six browser regressions, lint, typecheck and build. This task does not duplicate the shared foundation or modify its pending submission state.

## Behavior and route coverage

- `/dashboard` retains manager authorization and organization-scoped loading. `assemble.ts`, `trend.ts`, ledger queries and persistence are unchanged.
- Current collected, due, clamped collection percent, unpaid difference and previous-month trend retain their existing meanings. Past-grace balance remains distinct from unpaid-this-month.
- Pulse expiry uses the existing complete **60-day** signal. The lease list remains the existing **90-day**, maximum-six result. The reference's sample count and 90-day pulse are not substituted for either query.
- URL range identities remain `/dashboard`, `?range=12M`, `?range=2Y`, `?range=5Y`. Due is now a dashed line with monthly segments, allowing changing due values. Current collection uses teal; exact collected/due/outstanding values remain in the keyboard-operable disclosure table. Outstanding is clamped at zero.
- Existing lease, property, unit, application, payment and maintenance destinations remain intact. Property cover photos keep their API identity; absent photos use the approved shared property SVG. No unsupported report/action destination was introduced.
- Empty properties, leases, activity and overdue balances retain their next-step text. Missing chart series has an explicit unavailable message. A dashboard error boundary offers retry and direct property navigation without exposing backend details.
- Desktop collection uses two columns; phone stacks the collection and history. Tablet stacks lower content. Phone properties retain unit counts and occupancy percentages, while exact chart data scrolls within a labelled focusable region.
- Property monthly rent totals shown in the illustration are omitted because the existing property view does not supply them; no approximate financial totals were invented.

## Runtime and verification

All data preparation was confined to the new isolated PostgreSQL cluster on port **55428**, database `rocketrental`, directory `tests/dashboard/.runtime/postgres`. Nineteen migrations deployed and the existing seed created four properties, 45 units, 41 occupied leases and related fixtures. Existing databases were untouched; fixture data stays on disk.

Review server: this checkout, Next 15.5.27, `http://localhost:3228`. Baseline was captured **before source edits**, immediately after admitting the exact foundation. Final browser review uses production build `AFP2Fu5f6Vc4ZfOZT7itT`. Both task-owned web and database processes were stopped after review; fixture data remains on disk.

| Check                                                                               | Observed result                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/dashboard` | 5 files / 20 tests passed; calculation suites unchanged; added presentation, unavailable chart, identity and error recovery assertions.                                             |
| Scoped ESLint on dashboard route/components/tests                                   | Passed with zero warnings.                                                                                                                                                          |
| `node node_modules/typescript/bin/tsc --noEmit`                                     | Passed; production build also checks types.                                                                                                                                         |
| `npm.cmd run build`                                                                 | Passed; Prisma generated, Next compiled, type/lint checks and all 22 static pages completed.                                                                                        |
| Dashboard and foundation chart browser checks                                       | Five passed: real seeded amounts and lease navigation, unauthenticated redirect, 390/768 chart/disclosure/menu flow and axe scans, shared recovery example.                         |
| Direct Playwright review                                                            | Desktop/390px, no horizontal page overflow. Enter opens monthly amounts, Tab focuses the named table region. 6M has six rows, 12M has twelve; existing 2Y coverage asserts 24 rows. |
| Contextual link review                                                              | Opened late payments, applications, maintenance, Alex Rivera's exact lease, and the Elm property row; each resolved to its existing destination.                                    |
| Patch hygiene                                                                       | `git diff --check` passed.                                                                                                                                                          |

An initial production build hit the active dev server's Prisma DLL lock; stopping only this task's server resolved it. Accessibility checks found 4.34:1 lease-initial contrast, corrected to a darker ink; rerun passed. Environment warnings concern Prisma's future configuration, Next's multiple-lockfile root inference, Vite's future config loader and runner color settings.

Final browser console contained only the existing missing `/favicon.ico` 404. The configured Playwright session expired once during final capture; reconnecting, signing in again and recapturing produced the supplied dashboard images.

## Evidence and remaining verification

- `tests/dashboard/evidence/desktop-before.png` and `phone-before.png`: unchanged admitted foundation at 1440 and 390 CSS pixels.
- `tests/dashboard/evidence/desktop-after.png` and `phone-after.png`: real production dashboard at 1440 and 390 CSS pixels, with monthly disclosure open on phone.
- `tests/dashboard/evidence/native-desktop-before.png`: existing Edge session baseline, Windows MCP snapshot at 2560 x 1600 display resolution. Desktop lease was acquired and released.

**Required final native Edge desktop/390px review is pending.** During its leased window, personal browsing changed the active tab between automation actions. The desktop was released without continuing to compete for focus; a quiet bounded window was requested through the typed task question. This does not affect the passing isolated Playwright results, but task acceptance must wait for the required native review. Empty/error states have component coverage, not an induced production database-outage browser test.

### Pending native checklist

Wait for the explicit quiet-window signal; silence does not establish availability. Reuse the retained fixture cluster and production build above without migrating, reseeding or rebuilding.

1. Acquire one bounded desktop lease and use only the dashboard review tab in the existing Edge session.
2. At desktop width, inspect collection/history, leases/attention and property/activity composition; capture the final native screenshot against the preserved baseline.
3. Emulate 390 x 844 CSS pixels; inspect stacking, readable amounts, property identities and page overflow. Capture the final native phone screenshot.
4. Use keyboard focus and Enter on **View monthly amounts**, then Tab into **Monthly rent collection amounts**. Confirm exact values and the selected URL range remain available.
5. Open the existing late-payment, lease and property contextual links, confirming their intended identities; return to the dashboard. These flows already pass in isolated Playwright and need only the missing native observation.
6. Restore the review tab's device emulation and browser state, release the lease promptly, stop only the task-owned runtime, and record observations/screenshots in this handoff. Preserve every passing check unless source or relevant runtime changes.

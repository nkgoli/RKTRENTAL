# RocketRental UX review — premium SaaS bar

> **Screenshots are not tracked in Git.** The repository tree is at its 64 MiB cap, so the 146 captures referenced below as `screenshots/<name>.jpg` were submitted as this Task's evidence files instead of being committed. Fix Tasks should open the routes in the Preview at 1280px and 390px themselves rather than rely on the images, and must not commit screenshots under `docs/ux-review/screenshots/` or anywhere else in the tree.

Reviewed 21 October 2026 against the running app (production build of this checkout on `http://localhost:3100`, embedded Postgres seeded with `prisma/seed.ts` plus the demo ROI assumptions). Every route below was opened in Chromium at **1280 × 800** and **390 × 844**, signed in as the seeded manager (`jordan.mills@rocketrental.example`) and tenant (`alex.rivera@email.com`). Screenshots live in [`screenshots/`](screenshots/) and are named `<route>-<width>.jpg`; `-fold` variants are viewport-only captures.

The bar is Linear (hierarchy and speed), Stripe Dashboard (tables, money, restraint), Mercury (calm density, one accent) and AppFolio (property-management workflows that fit on one screen). The intended look is `Designs/rocketrental-light-system` r7 (shared controls, phone navigation) and `Designs/rocketrental-app` r337 (screen content and words).

## What premium means for RocketRental

1. **One header, then the numbers.** A page spends at most ~160px on chrome before the first number, row or form field. Eyebrow + title + one primary action; context (property, period, revision) is a single meta line, not a second header card.
2. **Every row has one obvious action and one obvious click.** Tables and lists are row-clickable; secondary and destructive actions sit in a row menu. Amounts are text, not links. Status is a `Badge`; descriptors ("Multi-unit", "1 tenant") are plain muted text.
3. **Filters apply themselves.** Search debounces, chips and selects apply on change, the URL stays shareable, and a single "Clear filters" link resets. No "Apply filters" or "Search" buttons.
4. **Feedback is immediate and consistent.** One `ConfirmDialog` for destructive actions, one `Toast` for results, one `Field` for label/hint/error, one skeleton that keeps the page header in place. Native browser tooltips and inline "Confirm?" rows do not appear.
5. **Phone is a first-class layout, not a squeezed desktop.** Wide tables become cards below 640px, tab strips show a fade and scroll the active tab into view, sticky headers stay compact, and nothing scrolls sideways.

## Scorecard (1 = far from the bar, 5 = at the bar)

| Area | File | Hierarchy | Density | Consistency | Mobile | Delight | Notes |
| --- | --- | :-: | :-: | :-: | :-: | :-: | --- |
| Manager core (dashboard, properties, payments, maintenance, documents, integrations) | [manager-core.md](manager-core.md) | 3 | 3 | 3 | 2 | 3 | Dashboard is the strongest screen; payments and maintenance need row-action and layout work; tables clip on phone. |
| Leasing (lists, builder, templates, detail) | [leasing.md](leasing.md) | 3 | 2 | 3 | 2 | 3 | Lease detail is good; builder picker breaks at 390px; template editor is a 10,000px page. |
| People (tenants, applications) | [people.md](people.md) | 2 | 2 | 3 | 2 | 2 | Tenants lands on an untracked-status matrix; add tenant is a form at the bottom of a 41-row table. |
| Analysis (ROI, Rent Analysis, Portfolio returns) | [analysis.md](analysis.md) | 2 | 1 | 3 | 1 | 3 | The Returns & ROI dashboard is the cramped, busy screen: three headers, a 15-number snapshot card, rainbow sliders, 3,600px long. |
| Tenant portal | [tenant-portal.md](tenant-portal.md) | 4 | 4 | 4 | 4 | 3 | Closest to the design; confirm-payment step and desktop layout are the gaps. |
| Account and auth | [account-auth.md](account-auth.md) | 4 | 4 | 4 | 4 | 3 | Clean; loses the typed email on error and has no recovery path. |
| Forms, tables, dialogs, states, motion | [forms-dialogs.md](forms-dialogs.md) | 3 | 3 | 2 | 3 | 2 | Six table styles, four confirm patterns, no toasts, disclosure triangles as primary controls. |

## Top 12 fixes, ranked by impact

| # | Finding | Why it is first | Severity |
| --- | --- | --- | :-: |
| 1 | [AN-01](analysis.md#an-01) + [AN-02](analysis.md#an-02) ROI page: collapse the three stacked headers into one and rebuild the Deal Snapshot as a 4-tile KPI row | The human's named pain point; first number currently appears 450px down an 800px viewport, and the snapshot shows 15 numbers, a gauge and 3 rainbow bars in one card | P0 |
| 2 | [LS-03](leasing.md#ls-03) Lease builder unit picker overflows at 390px; "Start lease" is off-screen | A manager cannot start a lease from a phone | P0 |
| 3 | [FD-01](forms-dialogs.md#fd-01) Filters apply on change everywhere; remove "Apply filters"/"Search" buttons | Six list pages each cost one extra click per filter; the chips already auto-apply so the current mix feels broken | P1 |
| 4 | [MC-08](manager-core.md#mc-08) Payments rent roll: row-click to ledger, contextual action per status, Refund moved into a menu with confirmation | "Refund" is the most prominent action on 33 of 41 rows | P1 |
| 5 | [PE-01](people.md#pe-01) Tenants lands on the Directory, and the Status view hides untracked columns | The default view today is a 3,500px matrix that says "Not tracked" 123 times and flags 36 people for data that does not exist | P1 |
| 6 | [AN-03](analysis.md#an-03) + [AN-05](analysis.md#an-05) ROI Summary cut to KPI row + one chart + one table; sticky compact header on phone | Summary is 3,589px (desktop) and 5,076px (phone) | P1 |
| 7 | [MC-17](manager-core.md#mc-17) + [LS-02](leasing.md#ls-02) Responsive table mode: cards below 640px for payments, leases, tenants, units | Payments at 390px shows only two of six columns; leases is 5,369px of 250px cards | P1 |
| 8 | [LS-10](leasing.md#ls-10) Template editor becomes sectioned accordions with a sticky Save | 10,156px page (11,673px on phone) with Save at the bottom | P1 |
| 9 | [MC-01](manager-core.md#mc-01) Sidebar fits an 800px-tall viewport without its own scrollbar | Visible on every manager page at 1280 × 800 | P1 |
| 10 | [FD-02](forms-dialogs.md#fd-02) + [FD-04](forms-dialogs.md#fd-04) Shared `ConfirmDialog` and `Toast` | Four confirm patterns and no success feedback for saves | P1 |
| 11 | [LS-05](leasing.md#ls-05) Lease builder Tenants step: applicants for the unit first, searchable, instead of 41 checkboxes | Core leasing flow; today the manager scrolls a flat list of everyone in the organization | P1 |
| 12 | [TP-03](tenant-portal.md#tp-03) Tenant pay: confirm step as a sheet at the point of action | The confirm box appears below the fold after tapping Pay | P1 |

## Coverage

Routes visited at both widths (manager unless noted): `/sign-in` (empty, invalid, signed-out notice), `/sign-out`, `/` and unknown URL (404), `/dashboard` (incl. monthly table open, phone drawer open), `/properties` (grid, list, no-match), `/properties/new`, `/properties/seed-property-maple` (overview, unit overview, edit with ROI assumptions, listing, unit listing/comps, leases, payments incl. Create charge and Record payment dialogs, returns → ROI actuals, maintenance, applications), `/properties/seed-property-elm` (single-family, archive control), `/tenants` (status, directory, no-match, add form), `/tenants/seed-tenant-maple-11`, `/applications`, `/leases` (active, drafts, ended), `/leases/new` (picker + all ten steps incl. validation and review), `/leases/templates`, `/leases/templates/:id`, `/leases/seed-lease-maple-11` (overview, agreement incl. terminate confirm, documents, payments, activity), `/payments`, `/returns`, `/roi-analysis` (chooser; summary, actual vs projected, charts: equity, cash flow, expenses, amortization, exit, sensitivity; scenarios, benchmarks, compare), `/rent-analysis` (chooser, Maple Court), `/rent-comps` (redirect), `/maintenance` (board, all history), `/maintenance/new`, `/maintenance/:id/edit`, `/documents` (library, no-match), `/integrations`, `/ui`; tenant: `/home`, `/pay` (incl. confirm step), `/lease`, `/repairs` (incl. empty-submit validation).

Not exercised: ROI save/reload dialog (`RoiWorkspace` alertdialog) and any mutation that writes money, screening or files; route `loading.tsx` and `error.tsx` were reviewed from source (`src/components/RouteStates.tsx`, `src/components/RouteError.tsx`) and the `/ui` kit. One side effect was created in the local database: a draft lease for Maple Court · Unit 3A (tenant Abigail Hayes) from walking the builder; it is visible in `/leases?tab=drafts`.

Findings: **3 P0, 25 P1, 68 P2** (96 total). Counts per file: manager-core 22, leasing 16, people 9, analysis 17, tenant-portal 9, account-auth 7, forms-dialogs 16 (cross-cutting findings reference area findings by ID rather than duplicating them).

Findings reference the components under `src/components/` and routes under `src/app/`; file paths in each finding are the likely edit points, confirmed by reading the route and component tree, not by running the fixes.

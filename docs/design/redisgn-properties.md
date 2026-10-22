# Redisgn — Properties and property & unit workspace handoff

Design: `Designs/redisgn` (block design), built on the foundation in `redisgn-foundation.md`. Shared tokens and the
`brand`, `desktop-navigation` and `mobile-navigation` components were not changed.

| Screen | Device | Verified revision |
| --- | --- | --- |
| `properties` — Properties | desktop 1280 px | 8 |
| `properties-mobile` — Properties · mobile | phone 390 px | 15 |
| `property` — Property & unit workspace (Maple Court) | desktop 1280 px | 28 (last write) |
| `property-mobile` — Property & unit workspace · mobile | phone 390 px | 25 (last write) |

Other Tasks were writing other screens in parallel, so the design revision moved between these writes. Each revision
above is the one at which that screen was last written and then checked with `design_screenshot`.

## Edge observations (2026-10-21, human's session, `localhost:3100`)

- **`/properties`.** Stats: 45 total units across 4 properties, 41 occupied (91%), 4 vacant ("Ready to list or turn
  over"). Below them: search, filter chips (All 4 / Multi-unit 3 / Single-unit 1 / Has vacancies / Archived 0) and a
  Grid/List toggle. The four cards each have a pale icon or gradient placeholder, name, address, type or unit count,
  rent per month and an occupancy bar:
  - 18 Elm Street: $1,690
  - Cedar Row Townhomes: $11,550, 7/8
  - Harbor View Lofts: $38,990, 22/24
  - Maple Court: $21,400, 11/12
- **`/properties/seed-property-maple`.** Breadcrumb, then the title with an Active badge. The address and "Multi-unit"
  sit on their own line, apart from the Edit button and a gradient cover. A "View" scope select (Maple Court · all
  units) sits above the tabs: Overview / Applications / Leases / Payments / Returns & ROI / Maintenance / Media.
  - Occupancy is 92% (11 of 12). Payments this month: $21,400 collected of $21,400, all paid, no overdue balance, with
    a reminder-history icon.
  - A long "Lease timeline" repeats Current / START / END blocks for every unit.
  - The Units table: 1A Dana Kim … 5D Tara Wu, with 3A vacant at $1,600.
  - Property details: year built 1998; owner Harbor Holdings LLC; Archive property.
  - Next steps: 2 repairs need attention, 10 leases expiring soon, review vacant units and pricing.
- **Supplied reference (`input:bd796147…`, 18 Elm Street).** The address appears twice: in the header and in Property
  details. The lease-term block is a thick, mostly empty card. "Send payment reminder" sits directly in the overview
  beside $1,690 overdue.
- No property photos exist in the app (only placeholders), so the redesign uses a square monogram tile for identity
  rather than fake media.
- Navigation only: nothing was edited, sent or archived. The tab was returned to `/dashboard`.

## What changed in the hierarchy

- **Identity.** A monogram tile, an eyebrow (type and unit count), a large name with the Active badge, and **one**
  address line with a pin icon. Property details no longer repeat the address. There is one Edit action, in the
  header on desktop and in the app bar on phone.
- **Summary band.** The foundation's primary→accent band holds the screen's main number:
  - Portfolio occupancy, 91%, on Properties.
  - October payments, $21,400 of $21,400, on the workspace.

  White stat cards beside the band carry the secondary figures: rent roll $73,630 with $60,390 collected (82%), vacant
  units 4, occupancy 92%, and leases expiring soon 10 (first is 4B, Nov 30).
- **Lease terms are compact.** The thick per-unit timeline is replaced by "Units & lease terms": one table row per
  unit with the tenant, rent, a single-line term ("Jan 1 – Dec 31, 2026"), time left and status. The phone version is a
  list sorted by attention: vacant first, then the next ending. The rest sits behind "6 more occupied units".
- **Act-now queue.** One ink panel, "Next steps", per the foundation rules:
  - Maintenance: 2 repairs, 1 urgent kitchen sink leak in 4B.
  - Renewals: 10 expiring.
  - Vacancy: 3A at $1,600 asking, with Rohan Das's application awaiting consent.
- **Property cards.** Each card shows the monogram, name, one address, rent per month and an occupancy bar, plus a
  single status badge:
  - 18 Elm Street: "$1,690 overdue · 1 late" (danger: past grace)
  - Cedar Row Townhomes: "1 vacant unit" (warning)
  - Harbor View Lofts: "2 vacant units" (warning)
  - Maple Court: "October all paid" (positive)

  "Has vacancies" now shows its count (3).

## Workflow preservation

- **Scope.** The "View" select (all units or a single unit) stays above the tabs on both devices. The units caption says
  that picking a unit scopes every tab.
- **Tabs and links.**

  | Tab | Desktop screen | Phone screen |
  | --- | --- | --- |
  | Applications | `applications` | `applications-mobile` |
  | Leases | `leases` | `leases-mobile` |
  | Payments | `payments` | `payments-mobile` |
  | Returns & ROI | `returns` | `returns-mobile` |
  | Maintenance | `maintenance` | `maintenance-mobile` |
  | Media | `documents` | `documents-mobile` |

  On phone the tabs are wrapping pill buttons, so no tab is clipped.
- **Payment reminders.** The overview no longer has a direct "Send payment reminder". The band offers "View payments"
  and "Reminder history →", which goes to `ledger` / `ledger-mobile`. This keeps reminders a reviewed action, as the
  foundation requires.
- **Other actions.**
  - Add unit sits in the units card.
  - Add property sits in the Properties header. It is the only add action there.
  - Archive property is kept, in its own bordered strip. The strip says it moves the property to the Archived filter and
    asks for confirmation.
  - Links to rent analysis ("Review vacant units and pricing") and Returns & ROI stay in Property details.
- **Navigation.** On desktop the shared sidebar is used, matching Home. On phone the screens have a top app bar (brand,
  bell and avatar on Properties; back to Properties, Edit and avatar on the workspace) and the shared `mobile-navigation`
  tab bar at the bottom. Property cards go to `property` / `property-mobile`, and the breadcrumb and back button return
  to the list.

## Representative states

- Overdue money (18 Elm Street card) and all paid (Maple Court).
- Vacant unit with a pending applicant (3A).
- Renewal due within 60 days (4B, 39 days).
- Long lease (2A, to Mar 31, 2027).
- An empty time-left cell for leases whose end date wasn't observed.

## Verification

`design_screenshot` was run after every write:

- **`properties` (rev 8).** Band, two stat cards, the filter and search row, and a 2×2 card grid. Nothing clipped.
- **`property`.**
  - Rev 10: the units table was cramped at the 2:1 split, so names and terms wrapped, and the details footer wrapped.
  - Rev 13: re-laid out. Next steps (three columns) and details sit side by side, and the units table runs full width
    on one line per row.
  - Rev 28: corrected the archive caption to avoid claiming behaviour that wasn't observed.
- **`properties-mobile` (rev 15).** Wrapping filter pills and four cards. No horizontal overflow at 390 px.
- **`property-mobile`.**
  - Rev 20: the name wrapped beside the Active badge.
  - Rev 25: moved the badge onto the address line, so the name fits on one line.

  The stat carousel is clipped at the edge on purpose (sideways scroll).

**Contrast.** Text on the ink and gradient panels uses the renderer's light ink. Badges sit on white only. Links carry
`→` and are underlined.

## Limitations and requests

- Lease end dates for 3B, 3C, 4A and 5D were not observed, so those rows read "Current lease" with no time left. Fill
  them from data when building.
- Per-property collection for Cedar Row and Harbor View wasn't observed, so their cards show vacancy instead of a
  collection status.
- **Shared-component request (not applied).** It would help if `mobile-navigation` and `desktop-navigation` had an
  active state, as the foundation proposed. Properties would then be highlighted on these screens.

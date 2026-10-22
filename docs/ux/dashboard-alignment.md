# Dashboard panel alignment

The four lower dashboard panels (Leases expiring soon, Needs attention, Properties, Recent activity)
now share one layout.

## What was wrong

- `.split` (1.4fr / 1fr, 16px gap, 300px minimum on the right) and `.bottom` (1.35fr / 1fr, 20px gap)
  were separate grids, so the rows had different column boundaries and gutters.
- Recent activity used `.activityPanel` instead of the shared card. It had no border or shadow,
  4px side padding and its own divider under the header.
- Recent activity cut each detail line off with an ellipsis, which hid the date on long rows.
- Both rows used `align-items: start`, so paired cards ended at different heights.

## What changed

- One `.panels` grid holds all four cards: `minmax(0, 1.4fr) minmax(0, 1fr)` with `var(--rr-gap)`
  between rows and columns. Both rows share the same column lines.
- All four panels use the global `.card` with `.card-header` and its standard padding, header spacing,
  border and shadow. The `.activityPanel` overrides were removed.
- Cards in the same row stretch to the taller card's content height, with no fixed heights. In a
  stretched card, the Needs attention items and Properties rows share the extra height evenly, so
  there's no empty band at the bottom.
- Recent activity detail lines now wrap instead of being cut off.
- At 1000px and below the grid becomes a single column, in the original reading order.
- Data, links, badges and ARIA labels are unchanged.

## Verification (2026-10-21)

Checked on a local `next dev` server for this checkout, using the seeded demo manager, in Playwright.
The cards' left and right edges were measured in CSS px.

| Viewport | Before: lower panels (left–right) | After: lower panels (left–right) |
| --- | --- | --- |
| 2023px | Leases 548–1192, Needs attention 1208–1668; Properties 548–1180, Recent activity 1200–1668 | Leases and Properties 548–1192; Needs attention and Recent activity 1208–1668 |
| 1366px | — | Left column 240–860; right column 876–1319 |
| 900px / 390px | Single column | Single column, all four cards 16–359 at 390px |

- **Heights at 2023px:** before, the cards were 386/308 and 304/376 px tall. After, each row matches:
  386/386 and 405/405. Space below the last item is 17px in every card, which is just the card's own
  padding.
- **Overflow:** the document never scrolls horizontally, and no element sticks out of its card at
  2023, 1366, 900 or 390px. This also held with very long tenant, property, activity and amount text
  inserted into the page; the text wraps.
- **Empty states:** with the lease and activity lists replaced by their empty messages, the rows stay
  aligned at 308px and 304px.
- **Navigation:** All properties, View payments, the Alex Rivera lease and Review balances each open
  the expected route.
- **Tests:**
  - `vitest run tests/dashboard`: 22 passed, including a new test that the four panels are sibling
    cards in one grid.
  - `playwright test tests/dashboard/dashboard.spec.ts` against the dev server: 2 passed.
  - `tsc --noEmit` and eslint on the changed files: clean.
- **Spec change:** the Playwright spec's lease-page heading check now also accepts
  `Maple Court · Unit 4B`. An earlier lease workspace change dropped the trailing "Lease" from that
  heading.

The before and after screenshots stay in the task checkout under `.playwright-mcp/` and are not
committed, because the repository tree is at its size cap:

- `before-desktop-2023.png`, `before-mobile-390.png`
- `after-desktop-2023.png`, `after-mobile-390.png`
- `after-long-content-desktop-2023.png`, `after-long-content-mobile-390.png`
- `after-empty-content-desktop-2023.png`

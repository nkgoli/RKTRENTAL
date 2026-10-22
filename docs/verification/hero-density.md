# Hero density — verification

Compact hero and summary panels on every manager page, plus a 24px gap between the Leases
summary and Lease portfolio.

## What changed

- `src/styles/hero-density.css` (new, imported after `redisgn.css` in `src/app/layout.tsx`):
  - **Page header (`.topbar`)**: padding 48/32 → 32/24px on desktop, 32/24 → 24/20px on
    tablet, 20/16 → 16/12px on phones.
  - **Summary band**: padding 32 → 20/24px (desktop/tablet) and 24 → 16px (phone); inner gap
    40 → 24px; lead figure 52 → 40px (desktop) and 40 → 32px (phone).
  - **Stats**: on desktop they are compact rows beside the lead figure (label and detail on the
    left, figure on the right; 112px cards → 59px rows). On tablets they wrap side by side. On
    phones they are the same compact rows, so the side-scrolling strip that hid two of three
    stats off-screen is gone.
  - **Spacing**: one `--hero-gap: 24px` (from the 8px scale) between a band and the content
    after it. Flex and grid parents of a band get it as `row-gap`, so margins are never doubled.
    Block parents opt in with `.hero-flow`.
- `src/app/(manager)/leases/page.tsx`: the page wrapper was a plain block, so the band touched
  Lease portfolio (0px gap). It now uses `hero-flow`. I also removed a stray `{' '}` text node.
- `SummaryBand.tsx` needed no markup change; I added no CSS module.
- Unchanged: palette, fonts, 16px radius, every label, value, detail, action and link.

## Hero inventory

| Route                                                        | Hero                                                            | Covered by                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/dashboard`                                                 | SummaryBand (rent collection, progress, footer action, 3 stats) | shared CSS                                                          |
| `/properties`                                                | SummaryBand                                                     | shared CSS                                                          |
| `/properties/[id]`                                           | SummaryBand via WorkspaceOverview (wrapped in `.band`)          | shared CSS + wrapper gap rule                                       |
| `/properties/[id]/returns`                                   | SummaryBand via ReturnsWorkspace                                | shared CSS                                                          |
| `/tenants`                                                   | SummaryBand                                                     | shared CSS                                                          |
| `/leases`                                                    | SummaryBand                                                     | shared CSS + `hero-flow`                                            |
| `/leases/[id]/ledger`                                        | SummaryBand                                                     | shared CSS                                                          |
| `/applications`, `/payments`, `/maintenance`, `/documents`   | SummaryBand                                                     | shared CSS                                                          |
| `/rent-comps`                                                | SummaryBand only after a comps analysis has run                 | shared CSS (not measured; see limitations)                          |
| All manager pages                                            | `.topbar` page header (eyebrow, title, meta, actions)           | shared CSS                                                          |
| `/leases/[id]`, `/tenants/[id]`, `/returns`, `/integrations` | topbar only, no band                                            | topbar CSS                                                          |
| Tenant `/pay`                                                | bespoke amount-due card (`pay.module.css`)                      | not changed: 208px on a phone, already compact, outside owned paths |
| Tenant `/home`                                               | bespoke `heroTop` greeting row (36px)                           | not changed: already compact                                        |
| Loading skeleton (`RouteStates` hero)                        | `aria-hidden` shimmer                                           | not changed                                                         |

## Measurements (px, Chromium, demo seed)

Command: `node tests/hero-density/measure.mjs <label>` against a local dev server. "Before" is
base `95c8f29` (stylesheet import and Leases change temporarily disabled). "After" is this
change. Raw JSON is in `tests/hero-density/out/`; it is git-ignored.

| Route @ width                  | Band before → after | Gap to next before → after | Topbar before → after |
| ------------------------------ | ------------------- | -------------------------- | --------------------- |
| /leases @1280                  | 455 → 235           | **0 → 24**                 | 170 → 146             |
| /leases @820                   | 310 → 250           | **0 → 24**                 | 136 → 124             |
| /leases @390                   | 334 → 345\*         | **0 → 24**                 | 232 → 224             |
| /dashboard @1280               | 435 → 235           | 32 → 24                    | 170 → 146             |
| /dashboard @820                | 388 → 314           | 24 → 24                    | 157 → 145             |
| /dashboard @390                | 479 → 474           | 24 → 24                    | 197 → 189             |
| /properties @1280              | 435 → 235           | 32 → 24                    | 170 → 146             |
| /properties/[id] @1280         | 331 → 268           | 24 → 24                    | —                     |
| /properties/[id] @820          | 442 → 369           | 16 → 24                    | —                     |
| /properties/[id] @390          | 573 → 501           | 16 → 24                    | —                     |
| /properties/[id]/returns @1280 | 307 → 226           | 24 → 24                    | —                     |
| /tenants @1280                 | 428 → 231           | 20 → 24                    | 170 → 146             |
| /tenants @390                  | 390 → 411\*         | 20 → 24                    | 176 → 168             |
| /applications @1280            | 435 → 235           | 24 → 24                    | 170 → 146             |
| /applications @390             | 479 → 454           | 24 → 24                    | 176 → 168             |
| /payments @1280                | 326 → 204           | 32 → 24                    | 170 → 146             |
| /payments @390                 | 462 → 407           | 24 → 24                    | 232 → 224             |
| /maintenance @1280             | 435 → 235           | 32 → 24                    | 170 → 146             |
| /documents @1280               | 307 → 172           | 16 → 24                    | 170 → 146             |
| /documents @390                | 450 → 386           | 16 → 24                    | 197 → 189             |
| /leases/[id]/ledger @1280      | 324 → 186           | 24 → 24                    | 173 → 149             |
| /leases/[id]/ledger @390       | 423 → 380           | 24 → 24                    | 172 → 164             |

\* On phones the old band showed one stat and pushed the other two into a side-scrolling
strip. Now all three are visible, which adds 11px on Leases and 21px on Tenants. Every desktop
and tablet band is shorter: 455 → 235 on Leases and 435 → 235 on Dashboard (about 46%).

No route reported horizontal page overflow or a clipped element inside a band at 1280, 820 or
390px (the script checks `scrollWidth` and `overflow: hidden|clip` children).

## Screenshots (local, git-ignored)

`tests/hero-density/shots/before/` and `tests/hero-density/shots/after/` hold:

- `leases-desktop.png` and `leases-mobile.png`: the first supplied example.
- `dashboard-desktop.png` and `dashboard-mobile.png`: the second supplied example (Home).
- `properties_id-desktop.png` and `properties_id-mobile.png`: the bespoke workspace band with
  actions.
- `payments-*.png`, plus tenant `pay-*.png` and `home-*.png`.

`after/` also has `leases-820.png` and `leases-1024.png` (tablet wrapping).

## Checks

- `node tests/hero-density/focus-check.mjs` passed. On `/dashboard`, `/leases`, `/payments` and
  `/properties/seed-property-elm` at 1280, 1024, 820 and 390px, every link and button in the
  band is reachable with Tab, shows a focus ring and sits fully inside the band.
- `npx vitest run tests/hero-density`: 4 passed. They check the stylesheet order, that the
  stats strip no longer scrolls, the shared gap, and the Leases `hero-flow` wiring.
- `npx vitest run tests/ui tests/dashboard/page.test.tsx`: 81 passed (8 files).
- `npx tsc --noEmit`, ESLint on the changed files and `prettier --check` all passed.

## Concurrent work

- The button-label fix (`68792dd`, on `main` after this branch's base) changes only the
  `.card-header > a` rules in `redisgn.css` and `accessibility.css`. This change doesn't touch
  those files or selectors, so both apply.
- No property-navigation commit was visible on any branch at verification time. This change
  doesn't edit property-list navigation, `redisgn.css`, `globals.css` or the shared
  Button/Card components.

## Limitations

- The `/rent-comps` band appears only after an analysis runs, so I didn't measure it. It uses
  the same shared CSS.
- I left the tenant `/pay` amount-due card unchanged. It is bespoke, already compact (about
  208px on a phone) and lives in `pay.module.css`, which this Task doesn't own.
- The measurements come from a local `next dev` server on the demo seed, not a managed Preview.

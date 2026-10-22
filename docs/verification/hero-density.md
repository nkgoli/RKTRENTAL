# Hero density: verification

Compact hero and summary panels on every page, a 24px gap between each manager hero and the
content after it (including Leases, which had none), and noticeably shorter heroes on phones.

## What changed

### First pass (`fed0a9c`)

- `src/styles/hero-density.css` is imported after `redisgn.css` in `src/app/layout.tsx`.
  - **Page header (`.topbar`)**: padding goes from 48/32 to 32/24px on desktop, 32/24 to 24/20px
    on tablet, and 20/16 to 16/12px on phones.
  - **Summary band**: padding and inner gaps are smaller, and the lead figure goes from 52 to
    40px on desktop.
  - **Stats**: compact rows beside the lead figure on desktop; on tablets they wrap side by
    side.
  - **Spacing**: one `--hero-gap: 24px` before the content that follows a band.
- `src/app/(manager)/leases/page.tsx` uses `hero-flow`, which gives the 0 → 24px Leases gap.

### This pass

- **Phones (< 600px), every SummaryBand**: the three stats are now one inset list (same
  surface, border and 16px corners) with divider rows, instead of three separately padded
  cards. Band spacing is tighter and the lead figure is 30px. Rows stay at least 44px tall and
  text stays at least 12px.
- **Scope fix**: every stat rule is now under `.summary-band-stats`. The first pass styled every
  `.summary-stat`, which also restyled the selected application's **Screening report** cards
  on `/applications`. Those cards now render exactly as before hero density (see
  [Screening report](#screening-report-unrelated-cards)).
- **ROI Deal Snapshot** (`RoiDealPanels.tsx`, `deal-panels.module.css`):
  - Stat buttons use the compact padding, with room kept for the ⓘ marker.
  - On phones the stats join the inset list, and the Monthly/Annual toggle sits beside the
    eyebrow instead of on its own row.
  - Stat details run full width under the label and figure (`stack-details`).
  - "How returns are calculated →" has a 24px target.
  - **Bug fixed:** below 1024px an open breakdown no longer covers the stat after it. The stat
    button used to stretch to `height: 100%` of its wrapper.
- **Rent analysis** (`CompsWorkbench.tsx`): the suggested-rent band passes `stackDetails`, a
  new optional `SummaryBand` prop. On phones it runs long stat details full width.
  - Text links in a band footer get a 24px minimum target.
- **Tenant Home `RentHero`** (`portal.module.css`): this is the whole `.rentHero` card, not just
  its 36px `heroTop` row.
  - The rhythm is tighter at all widths.
  - On phones: smaller icon chip, 36px amount, and Pay now stays 44px tall.
  - From 1200px the amount and Pay now sit side by side again.
- **Tenant Pay amount-due card** (`pay/page.tsx`, `pay.module.css`):
  - Card padding is 20/24px, and 14/16px on phones.
  - Grid gap is 8px, and the two notes use a `note` class instead of inline margins.
  - Every line item, the total and the notes are unchanged.
- **Unchanged**: palette, fonts, 16px radius, and every label, value, detail, action and link.
  The merged button-label fix (`68792dd`, `.card-header > a`) is untouched.

## Hero inventory

| Route                                                                 | Hero                                                                                                                                         | How it is covered                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                          | SummaryBand: rent collection, progress, footer action, 3 linked stats                                                                        | shared CSS                                                                                          |
| `/properties`, `/tenants` (People), `/applications`, `/payments`      | SummaryBand                                                                                                                                  | shared CSS                                                                                          |
| `/maintenance`, `/documents`                                          | SummaryBand                                                                                                                                  | shared CSS                                                                                          |
| `/leases`                                                             | SummaryBand                                                                                                                                  | shared CSS + `hero-flow`                                                                            |
| `/properties/[id]`, `/properties/[id]/returns`, `/leases/[id]/ledger` | SummaryBand in the workspace                                                                                                                 | shared CSS                                                                                          |
| `/roi-analysis?property=…`                                            | **Deal Snapshot**: custom `summary-band` with Monthly/Annual toggle, a lead popover and 3 stat popovers, risk meter, Compare and How actions | shared CSS + `deal-panels.module.css`; measured populated (Maple Court) and every control exercised |
| `/rent-analysis?property=…&unit=…`                                    | Suggested-rent SummaryBand, shown only once the unit's comps analysis has run                                                                | shared CSS + `stackDetails`; measured after running the analysis (Maple Court, first unit)          |
| `/rent-comps`                                                         | Redirects to the unit's Listing tab, which uses the Listing layout with no summary band                                                      | nothing to compact; confirmed in the browser                                                        |
| All manager pages                                                     | `.topbar` page header                                                                                                                        | shared CSS                                                                                          |
| `/returns`, `/integrations`, `/leases/[id]`, `/tenants/[id]`          | topbar only                                                                                                                                  | topbar CSS                                                                                          |
| Tenant `/home`                                                        | **RentHero**: the full `.rentHero` card (eyebrow + icon, amount, Pay now, premises/autopay, manager)                                         | `portal.module.css`                                                                                 |
| Tenant `/pay`                                                         | **Amount-due card**: header + badge, line items, total, notes                                                                                | `pay.module.css`                                                                                    |
| Loading skeleton (`RouteStates` hero)                                 | `aria-hidden` shimmer                                                                                                                        | not changed                                                                                         |

## Measurements (px, Chromium, demo seed)

Command: `node tests/hero-density/measure.mjs <label> [baseURL] [--check]` against a local
`next dev` server.

- **Original**: base `fed0a9c~1`, before any hero-density change, measured by temporarily
  restoring those files.
- **Prior**: `fed0a9c`, the first pass.
- **Now**: this change.
- **Following panel top**: the page y-position of the first block after the hero, so it also
  reflects page-header savings.

Raw JSON is in `tests/hero-density/out/{before,prior,after}.json`, which is git-ignored.

| Route @ width                    | Hero height: original → prior → now | vs original | Following panel top: original → now | Gap original → now |
| -------------------------------- | ----------------------------------- | ----------- | ----------------------------------- | ------------------ |
| /dashboard @desktop              | 435 → 235 → **235**                 | -46%        | 637 → **405**                       | 32 → 24            |
| /dashboard @tablet               | 388 → 314 → **314**                 | -19%        | 630 → **544**                       | 24 → 24            |
| /dashboard @mobile               | 479 → 474 → **410**                 | -14%        | 761 → **684**                       | 24 → 24            |
| /properties @desktop             | 435 → 235 → **235**                 | -46%        | 637 → **405**                       | 32 → 24            |
| /properties @tablet              | 340 → 274 → **274**                 | -19%        | 561 → **484**                       | 24 → 24            |
| /properties @mobile              | 364 → 365 → **305**                 | -16%        | 625 → **559**                       | 24 → 24            |
| /tenants @desktop                | 428 → 231 → **231**                 | -46%        | 703 → **490**                       | 20 → 24            |
| /tenants @tablet                 | 336 → 270 → **270**                 | -20%        | 638 → **569**                       | 20 → 24            |
| /tenants @mobile                 | 390 → 411 → **353**                 | -9%         | 730 → **693**                       | 20 → 24            |
| /leases @desktop                 | 455 → 235 → **235**                 | -48%        | 625 → **405**                       | **0 → 24**         |
| /leases @tablet                  | 310 → 250 → **250**                 | -19%        | 507 → **460**                       | **0 → 24**         |
| /leases @mobile                  | 334 → 345 → **287**                 | -14%        | 627 → **596**                       | **0 → 24**         |
| /applications @desktop           | 435 → 235 → **235**                 | -46%        | 629 → **405**                       | 24 → 24            |
| /applications @tablet            | 396 → 321 → **321**                 | -19%        | 618 → **530**                       | 24 → 24            |
| /applications @mobile            | 479 → 454 → **394**                 | -18%        | 740 → **648**                       | 24 → 24            |
| /payments @desktop               | 326 → 204 → **204**                 | -37%        | 529 → **375**                       | 32 → 24            |
| /payments @tablet                | 378 → 305 → **305**                 | -19%        | 600 → **514**                       | 24 → 24            |
| /payments @mobile                | 462 → 407 → **364**                 | -21%        | 780 → **674**                       | 24 → 24            |
| /maintenance @desktop            | 435 → 235 → **235**                 | -46%        | 637 → **405**                       | 32 → 24            |
| /maintenance @tablet             | 310 → 233 → **233**                 | -25%        | 531 → **442**                       | 24 → 24            |
| /maintenance @mobile             | 310 → 324 → **266**                 | -14%        | 571 → **519**                       | 24 → 24            |
| /documents @desktop              | 307 → 172 → **172**                 | -44%        | 493 → **343**                       | 16 → 24            |
| /documents @tablet               | 338 → 273 → **273**                 | -19%        | 552 → **482**                       | 16 → 24            |
| /documents @mobile               | 450 → 386 → **342**                 | -24%        | 724 → **616**                       | 16 → 24            |
| /properties/:id @desktop         | 307 → 214 → **214**                 | -30%        | 577 → **484**                       | 24 → 24            |
| /properties/:id @tablet          | 388 → 314 → **314**                 | -19%        | 762 → **697**                       | 16 → 24            |
| /properties/:id @mobile          | 419 → 350 → **309**                 | -26%        | 949 → **846**                       | 16 → 24            |
| /properties/:id/returns @desktop | 307 → 226 → **226**                 | -26%        | 714 → **634**                       | 24 → 24            |
| /properties/:id/returns @tablet  | 370 → 304 → **304**                 | -18%        | 890 → **824**                       | 24 → 24            |
| /properties/:id/returns @mobile  | 487 → 399 → **355**                 | -27%        | 1185 → **1071**                     | 15 → 24            |
| /roi-analysis @desktop           | 471 → 324 → **320**                 | -32%        | 816 → **665**                       | 24 → 24            |
| /roi-analysis @tablet            | 484 → 392 → **384**                 | -21%        | 947 → **848**                       | 24 → 24            |
| /roi-analysis @mobile            | 617 → 697 → **567**                 | -8%\*       | 1026 → **976**                      | 24 → 24            |
| /rent-analysis @desktop          | 455 → 288 → **288**                 | -37%        | 856 → **665**                       | 24 → 24            |
| /rent-analysis @tablet           | 431 → 353 → **353**                 | -18%        | 860 → **769**                       | 24 → 24            |
| /rent-analysis @mobile           | 539 → 584 → **484**                 | -10%\*      | 1041 → **978**                      | 24 → 24            |
| tenant /home @desktop            | 273 → 273 → **203**                 | -26%        | 518 → **448**                       | 20 → 20            |
| tenant /home @tablet             | 198 → 198 → **184**                 | -7%         | 393 → **379**                       | 20 → 20            |
| tenant /home @mobile             | 263 → 263 → **237**                 | -10%        | 452 → **425**                       | 20 → 20            |
| tenant /pay @desktop             | 226 → 226 → **182**                 | -19%        | 502 → **458**                       | 20 → 20            |
| tenant /pay @tablet              | 210 → 210 → **182**                 | -13%        | 437 → **409**                       | 20 → 20            |
| tenant /pay @mobile              | 208 → 208 → **182**                 | -12%        | 426 → **400**                       | 20 → 20            |

\* The original phone ROI and Rent analysis bands showed one stat and hid the other two in a
side-scrolling strip (the script flags those stats as escaping the band). Now all three stats
are visible, and the band is still shorter.

- **Phones**: the prior pass made Leases (+11px), People (+21px), Maintenance, ROI (+80px) and
  Rent analysis (+45px) taller and left Home almost unchanged (479 → 474px). Every phone hero
  is now shorter than the original:
  - Home: −69px.
  - Leases: −47px.
  - People: −37px.
  - Applications: −85px.
  - Payments: −98px.
  - ROI: −50px.
  - Rent analysis: −55px.
- **Desktop and tablet**: the first pass's gains are kept, and ROI is 4–8px shorter again.
- **Gaps**: every manager hero is followed by a 24px gap. The tenant portal keeps its existing
  20px rhythm.

On every route at 1280, 820 and 390px:

- No horizontal page overflow.
- No clipped content and nothing escaping a hero.
- No hero text under 12px.
- No button-like hero control under 30px tall.
- No standalone text link under 24px.

## Screening report (unrelated cards)

`/applications?applicant=seed-application-marcus` renders the selected application's Screening
report with `.summary-stat` cards outside any hero.

| Width | Original                 | Prior (unscoped rules)           | Now                      |
| ----- | ------------------------ | -------------------------------- | ------------------------ |
| 1280  | block, 112px, value 24px | grid row, 79px, value 20px right | block, 112px, value 24px |
| 820   | block, 112px, value 24px | block, 94px, padding 12/14, 22px | block, 112px, value 24px |
| 390   | block, 112px, value 24px | grid row, 59px, value 20px right | block, 112px, value 24px |

`budgets.json` stores the original layout of these cards, and `measure.mjs --check` fails if
any card's display, padding, height, value size or alignment differs.

## Controls, keyboard and touch

`node tests/hero-density/focus-check.mjs` passed. It runs at 1280, 1024, 820 and 390px on these
routes:

- Manager: `/dashboard`, `/leases`, `/tenants`, `/payments`, `/properties/seed-property-elm`,
  ROI (Maple Court) and Rent analysis (Maple Court, first unit).
- Tenant: `/home` and `/pay`.

It checks:

- **Focus**: every link, button and disclosure in the hero is reached with Tab, shows a focus
  ring and sits fully inside the hero.
- **Phone touch targets**: controls are at least 24px tall, and stat rows at least 44px.
- **ROI**:
  - **Annual** switches the lead to "/ year" and sets `aria-pressed`, and **Monthly** switches
    it back.
  - Each of the four breakdowns (Cash flow, Cash-on-cash, Cap rate, Debt service coverage)
    opens with Enter, stays on screen with no clipped text, and closes with Escape with focus
    back on its trigger.
  - Below 1024px an open breakdown stays under its stat and inside its tile. This last check
    caught the overlap bug that is now fixed.
  - Compare with actuals and How returns are calculated are reached and focus-ringed. Clicking
    them changes the view or scrolls, so the script does not click them.

Long ROI labels and values, such as "Year 1 NOI ÷ debt service · lenders look for 1.20×+" and
"$161,424", stay readable in the desktop popovers and in the phone in-place panels. See
`shots/controls/roi-popover-*-1280.png` and `-390.png`.

## Rendered budget check

`node tests/hero-density/measure.mjs <label> [baseURL] --check` compares a run with
`tests/hero-density/budgets.json` and fails if any of the following is true:

- A hero is more than 6px taller than now.
- The following panel starts more than 6px lower.
- A hero gap is not exactly what it is now.
- A hero is missing required content (for example "Open rent roll", "Debt service coverage",
  "Pay now").
- Content is clipped or the page overflows.
- Text is under 12px, a control under 24px, or a standalone text link under 20px.
- The Screening report differs from its original layout.

As a regression test I temporarily restored the prior stylesheet. The check failed with 27
problems: every phone band over budget, and the Screening report changed at all three widths.
With this change the check passes.

## Screenshots (local, git-ignored)

Under `tests/hero-density/shots/`, for desktop 1280, tablet 820 and mobile 390:

- `before/` and `after/` hold the page view (`<route>-<width>.png`) and the whole hero
  (`<route>-<width>-hero.png`) for:
  - `dashboard` (Home)
  - `leases`
  - `tenants` (People)
  - `payments`
  - `properties_id`
  - `roi-analysis` (populated)
  - `rent-analysis` (populated)
  - tenant `home` and `pay`

  Fixed bars are hidden in the hero crops.

- `before/` and `after/` also hold `screening-report-desktop.png` and
  `screening-report-mobile.png`.
- `controls/` holds `roi-popover-{0..3}-1280.png` and `roi-popover-{0..3}-390.png`, each with a
  breakdown open.

## Other checks

- `npx vitest run tests/hero-density`: 5 passed.
  - Stylesheet order.
  - Every stat rule is scoped to `.summary-band-stats`.
  - SummaryBand renders `stack-details` only when asked.
  - The Leases `hero-flow` wiring.
  - Every requested hero's budget is at or below its original height.
- Related suites passed:
  - `tests/ui`, `tests/dashboard/page.test.tsx` and `tests/analysis`: 289 passed.
  - `tests/tenant-pay`, `tenant-portal`, `rent-analysis`, `rent-comps`, `comps`, `roi`,
    `applications`, `screening` and `hero-density`: 219 passed.
- `npx tsc --noEmit`, ESLint on the changed files and `prettier --check` passed.

## Concurrent work

- This change does not touch property navigation (`task:360f8a58…`) or Returns Cancel
  (`task:83e2a197…`) files, `redisgn.css`, `globals.css`, `accessibility.css` or the shared
  Button/Card components.
- The button-label rules (`.card-header > a`) are unchanged.

## Limitations

- Measurements come from a local `next dev` server on the demo seed with a temporary local auth
  secret, not from a managed Preview.
- Tablet heights are the same as after the first pass, except for ROI, tenant Home and Pay,
  which are shorter. Those tablet layouts already lay the stats out side by side.
- Tenant pages keep their 20px panel rhythm. The 24px hero gap applies to manager pages.
- ROI and Rent analysis on phones are 8–10% shorter than the original rather than ~15%. They
  carry more required content (a three-line detail, the risk meter, two actions and a
  disclosure), and all of it is kept.

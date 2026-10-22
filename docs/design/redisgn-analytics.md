# Redisgn analytics — Returns & ROI and Rent analysis handoff

Design: `Designs/redisgn` (block design). This round finished four screens. Each was last written and checked with
`design_screenshot` at the revisions below. Revision 57 is the latest revision of the design that includes all four.

| Screen | Device | Final revision |
| --- | --- | --- |
| `returns` (Returns & ROI) | desktop, 1280 px | 54 |
| `returns-mobile` (Returns & ROI · mobile) | phone, 390 px | 56 |
| `rent-analysis` (Rent analysis) | desktop, 1280 px | 57 |
| `rent-analysis-mobile` (Rent analysis · mobile) | phone, 390 px | 52 |

No shared tokens, components or other screens were changed. The screens follow `docs/design/redisgn-foundation.md`:
the dark `Sidebar` rail with the `brand` and `desktop-navigation` components, a phone app bar (`brand`, bell, avatar)
and the `mobile-navigation` tab bar, one primary→accent dotted band, one ink "act now" panel per screen, and white
soft-shadow chart cards beside bordered gradient panels.

## 1. Edge inspection (2026-10-21)

This used the existing Edge tab "RocketRental" at `http://localhost:3100`, signed in as Jordan Mills. It was read only.
Nothing was saved, applied, refreshed or sent. Neither the ROI "Save" control nor the rent "Apply" control was
touched, and no reload dialog appeared. The tab was returned to `/dashboard`, and the desktop was released.

- `/roi-analysis` is a property chooser, with a card per property and a "What you'll need" note.
- `/roi-analysis?property=seed-property-maple` (Summary) shows "Maple Court · Whole property · Revision 0" and
  "Assumptions from property details · 28 demo values", plus Edit property assumptions, Save ▾ and More ▾. The tabs are
  Summary / Actual vs projected / Charts / Scenarios / Benchmarks / Compare. **Year 1 at a glance** (projected, before
  tax, with a Monthly/Annual toggle) shows cash flow −$213, cash-on-cash −0.29%, cap rate 5.70% and DSCR 1.07x, with
  Risk 67 · Elevated. **Net cash flow by year** has Y1/Y5/Y10/Custom, red and blue bars, a "Positive Y3" marker and
  the tags Projected · USD per year · Before tax and sale proceeds. **Milestones** shows Years 1/5/10: effective income
  $262,200 / $283,814 / $313,353, operating expenses $100,776 / $111,238 / $125,855, NOI $161,424 / $172,576 /
  $187,498, debt service $150,179, and cash flow −$2,555 / $7,164 / $20,084.
- `…&view=actual` (Actual vs projected) covers Nov 1, 2025 – Oct 22, 2026, 356 of 365 days. Period chips run from MTD
  to 5Y, with From/To. Operating income is $215,850 partial against $255,735 projected. Operating expenses are $80,000
  against $98,291. NOI is $135,850 against $157,444. Debt service is not recorded ($146,476 projected), and so is cash
  flow (−$2,492 projected). "Needed to complete this comparison" lists rent 326/356 days (Review leases), expenses
  295/356 days, unverified rather than $0 (Add expense), and loan payments not recorded (Review financing).
  "Scheduled and estimated" is marked "Never counted as actual". "Sources and coverage" is a disclosure.
- `/rent-analysis` is a property chooser. Cards say "12 available units · 11 occupied", where *available* means total.
- `/rent-analysis?property=seed-property-maple&unit=seed-unit-maple-7` (Unit 3A) shows a 12-unit table with Status,
  Current lease, Listed rent, Saved market rent and Gap / month. The "Demo comps · not live market data" banner reads
  "Sandbox, synced 10/22/2026 3:54:58 AM UTC". Comp filters are radius 2 mi, 1 bd, any baths, sqft range, last 90 days
  and Listed + leased. Nearest comps are 210 Oltorf $1,700, 222 Lamar $1,800, 234 Barton Hills $1,850 and 246 Congress
  $1,825. The market summary has 6 comps: low $1,700, median $1,838, high $2,025, $2.16/sqft. The suggested rent is
  $1,840, +$240 over listed, with a range of $1,805–$1,980 and medium confidence. The page also has "Market rent to
  apply", **Apply to Maple Court · Unit 3A** (it updates saved market rent only), Create lease and Open in listing.

The before captures are Windows MCP screenshots. They are kept local because of the tree size cap, under
`C:\Users\nkgol\.claude\projects\C--Users-nkgol-RocketRental--orchestra-workspaces--6sppxkkxbm3ilkgp9nc-repository\52ff1422-06eb-4a44-b788-94f840d9f50d\tool-results\`:
`…-1792641238403-nvqe20.png` (ROI chooser), `…-1792641244266-2dyvic.png` and `…-1792641259724-bffvui.png`
(Summary), `…-1792641269835-uak6fu.png` and `…-1792641264532-y2zm6n.png` (Actual vs projected),
`…-1792641274060-puadl0.png` (rent chooser), `…-1792641294886-9tr4sm.png` (unit table) and
`…-1792641309741-u33h3q.png` and `…-1792641304226-bbrdy1.png` (Unit 3A comps).

## 2. Hierarchy changes

**Returns & ROI.** The four equal KPI tiles become one band. It shows **−$213 / month** at display size, labeled
"Year 1 · Projected estimate · before tax · USD", with the yearly figure, the debt service and the Year 3 turn on one
line. The risk score is a surface Progress bar. Cash-on-cash, cap rate and DSCR sit beside it as white Stat cards,
each with its formula. Below the band:

- The cash-flow chart (2/3 width) sits beside an ink **To complete actuals** queue (1/3 width), so missing records are
  an action and not a footnote.
- The full-width Actual vs projected table has a Period select and an Actual / Projected / Partial legend.
- The bordered **Scheduled and estimated** panel ("Estimates · never counted as actual") is paired with the Milestones
  table.
- **Optional ROI inputs** come last. Every field shows "From property details" until it is overridden.

**Rent analysis.** The "Demo comps · not live market data" warning sits above everything. The band leads with
**$1,840 / month**, labeled "Suggested rent · estimate". It shows the range, the median-rent basis, "not adjusted for
size" and a confidence bar. Its three Stat cards keep the comp median (estimate), listed rent (actual) and saved
market rent apart. Below the band:

- The comps chart and filters sit beside an ink **Set market rent** panel that holds the only write action.
- A map with the nearest-comps list follows.
- The full-width 12-unit table comes last. A badge summary above it reads 4 below market · +$75, 4 at market, and
  4 above · −$50.

## 3. Data distinctions kept

- **Actual vs estimate.** Every money figure is labeled with its source: Actual (recorded cash), Projected (ROI
  assumptions), Scheduled, Partial, or Not recorded. Missing actuals show "Not recorded" or "No actual to compare",
  never $0. Market figures are estimates from demo comps.
- **Period, currency and scope.** Each card names its period (Year 1, Years 1–5, Nov 1, 2025 – Oct 22, 2026 or the
  last 90 days), USD, and its scope: Whole property, or Maple Court · Unit 3A. Rent analysis says that a multi-unit
  property has no blended rent. It also defines the gap as being against the current lease, or against listed rent
  when the unit is vacant.
- **Charts without colour alone.** Each bar label carries its signed amount ("Y1 −$2.6k", "3A listed $1,600"). The
  caption states the axis offset ("bars start at −$3,000", "bars start at $1,500"). The Chart block only accepts values
  from 0 to 100, so the offset is what lets negative cash flow show. Y2–Y4 are rounded from the live chart's bar
  heights. Y1 and Y5 are exact from Milestones.
- **Safe writes.** "Apply to Unit 3A" says that the listed rent and lease stay unchanged. Save analysis and Update
  projection don't touch recorded actuals.

## 4. Workflow and navigation

- Returns links back to `property` (breadcrumb, Edit assumptions, Review financing), and on to `leases` (Review
  leases), `payments` (Add expense) and `rent-analysis` (the Unit 3A vacancy link). The tabs and the Scope select keep
  the app's six views and the unit scoping.
- Rent analysis links to `properties` (Change property), `applications` (Review applicants for 3A), `leases` (Create
  lease, renewal pricing), `returns` (See the effect) and `property` (Open in listing).
- The phone screens have a `← Maple Court` back link. The scope and view use Selects instead of six tabs. Tables become
  stacked rows with a status Badge each: actual vs projected lines on Returns, and a 12-unit List on Rent. Stat cards
  scroll sideways. Milestones, optional inputs, sources and comp filters collapse into Accordions. Returns pins "Save
  analysis" above the tab bar.

## 5. Verification

| Screen | Revisions shot | Fixed before final |
| --- | --- | --- |
| `returns` | 41, 45, 56 | The header select and buttons wrapped, legend badges wrapped, the estimates column split values ("$215,85 0") and the period radio wrapped. These were fixed at 45 (scope moved beside the tabs, a Period select, a two-column estimates row). The "Break-even" badge wrapped and was fixed at 54. Revision 56 shows no clipping. |
| `rent-analysis` | 47, 49, 56, 57 | A cramped 1:2 bottom row wrapped prices and gap cells, and was fixed at 49 (a map + list band, a full-width table). The summary badges wrapped and were fixed at 57. A remaining nit: the "Leases →" link wraps to two lines at 1280. |
| `returns-mobile` | 51, 56 | "−$2,555" broke across lines in the band and was reworded at 56. There is no horizontal overflow. The stat carousel is clipped at the edge on purpose. |
| `rent-analysis-mobile` | 52 | There is no horizontal overflow, the badges wrap cleanly and the tab bar is pinned. |

Contrast: light ink is used on the gradient and ink panels. Eyebrows are used on ink, not tinted badges. Badges sit on
white. Links carry a `→` and are underlined.

## 6. Shared-component requests (not applied)

The navigation components still render plain underlined links with no active state. The foundation's proposal, in
section 3 of `redisgn-foundation.md`, would let these screens mark Returns & ROI and Rent analysis as active. Phone
screens have no Returns or Rent tab, so they rely on the back link and in-page links.

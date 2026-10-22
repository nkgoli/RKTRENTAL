# Redisgn foundation — Home direction and handoff

Design: `Designs/redisgn` (block design). Home (`home`, 1280 px) and Home · mobile (`home-mobile`, 390 px) are finished
at **revision 5**. Home was last written at revision 4; revision 5 only added `home-mobile`. Every other screen is still
the stub from revision 2, and the design tokens and the three shared components are unchanged.

## 1. Inspection of the existing app (Edge, 2026-10-21)

The review used the human's existing Microsoft Edge window, tab "RocketRental", signed in as Jordan Mills (property
manager). The app was served from `http://localhost:3100`. The viewport was 1728 CSS px wide on a 2560 × 1600 display
at 150% scaling. Navigation was through the sidebar and one typed property URL. Nothing was edited, sent, paid or
deleted. A DevTools prompt opened by F12 was dismissed with "No thanks". The tab was left on `/dashboard`, where it
started.

| Route | Screen family | What it shows today | Opportunity |
| --- | --- | --- | --- |
| `/dashboard` | Home | Three KPIs in a hairline row (91% occupancy, 40 leases expiring within 90 days, 4 open repairs). Rent collection card ($60,390 of $73,630, 82%). 6M/12M/2Y/5Y collection bar chart. Leases expiring soon. Needs attention (8 past due, $13,240 past grace; 4 applications; 4 repairs, 1 urgent). Properties and recent activity below the fold. | The page's best signal (collection) shares equal weight with everything else. Actions sit in the right half of rows and are easy to miss. Every panel has the same white card treatment. |
| `/properties` | Properties | Three stats, search, filter chips (All 4 / Multi-unit 3 / Single-unit 1 / Has vacancies / Archived 0), grid/list toggle, four property cards (rent per month, occupancy bar). | Good structure. Cards are icon placeholders with a lot of empty pale blue. |
| `/properties/seed-property-maple` | Property & unit workspace | Breadcrumb, title with Active badge, Edit, cover image, "View" unit scope select. Tabs: Overview / Applications / Leases / Payments / Returns & ROI / Maintenance / Media. Occupancy 92%, payments this month, lease timeline per unit. | Keep the tab set and unit scope. The lease timeline repeats START/END labels for every unit and is long. |
| `/tenants` | People | Directory/Status tabs, four stats (41 active, 0 move-ins, 1 ending in 60 days, $13,240 outstanding / 8 tenants), search plus property filter, status chips, and a table with "…" actions. | The Balance column shows "—" for current tenants. Status is the only colour. |
| `/applications` | Applications | Send application, Screening provider, Invitations empty state, 1/1/2 pipeline counts, and a master–detail view of applicants and the selected applicant (TransUnion SmartMove connected, FCRA consent and fair housing notices). | Strong master–detail. Keep the FCRA and fair-housing callouts verbatim. Pipeline counts are small. |
| `/leases` | Leases | Review applications / Lease templates / + New lease. Stats: 41 active, 1 expiring in 60 days, 0 awaiting e-signature. Tabs: Active 41 / Expiring soon 1 / Drafts 1 / Ended 2. Table with a Renew action. | The E-sign status column is empty for every active row. Drafts (deletable) live behind a tab. |
| `/payments` | Payments | Payment reminders / Payment settings / + Record payment. Collected $60,390, outstanding $13,240 (8 open balances), late $4,950 (3 past grace, includes late fees). October rent roll with chips All 41 / Paid 33 / Open 8 / Late 3, and Late or Autopay status per row. | The figures disagree with Home (see below). The rent roll is the right model for the ledger. |
| `/maintenance` | Maintenance | Open 4, urgent 1 (Kitchen sink leak, Maple Court), 1 completed this week. Status and date filters. Kanban: New / Assigned / In progress / Done. | The kanban works well. Unassigned cards need a stronger Assign affordance. |
| `/documents` | Documents | Documents and photos: Upload files, type chips, property/unit filters, lease-grouped PDFs (Move-in inspection, Signed lease agreement, Photo ID with restricted access), property files empty state, photos. | Lease grouping is good. View and download icons need labels. |
| `/roi-analysis` | Returns & ROI | "Choose a property" with four property tiles and a "What you'll need" panel. | The page is just a chooser. A portfolio summary would earn the nav slot. |
| `/rent-analysis` | Rent analysis | "Choose a property" list with Open Rent Analysis buttons and a helper panel. | It reads "8 available units · 7 occupied" for Cedar Row. Here "available" means *total*, which is confusing. |

Before references from the human's session (Windows MCP captures, kept local and not committed; repository tree size cap):
`C:\Users\nkgol\.claude\projects\C--Users-nkgol-RocketRental--orchestra-workspaces--6sppxkkxbm3ilkgp9nc-repository\5d7fbcd6-b7ca-403c-b541-b42f1423103b\tool-results\`

- `mcp-mcp_bundled_windows_mcp-blob-1792640280976-dq36f6.png`: dashboard
- `…-1792640286206-90bqmy.png`: properties
- `…-1792640302851-khf43t.png`: Maple Court workspace
- `…-1792640307027-0fa0i4.png`: tenants
- `…-1792640310154-nx2v2x.png`: applications
- `…-1792640313404-4dwlwb.png`: leases
- `…-1792640318419-fbi0p6.png`: payments
- `…-1792640322603-jxjzks.png`: maintenance
- `…-1792640325808-a0nce8.png`: documents
- `…-1792640329638-et4ij1.png`: returns and ROI
- `…-1792640332963-7qsep9.png`: rent analysis
- `…-1792640350568-8wkhur.png`: dashboard, final state

The two Task inputs are human-supplied before references for the dashboard's lower half and the 18 Elm Street lease
Payments tab:

- `Artifacts/input:c94588f4…`: the dashboard's lower half.
- `Artifacts/input:2a621558…`: the 18 Elm Street lease Payments tab. Its balance-due / last-payment band above dated
  rent rows is the **preferred lease-ledger presentation**. Keep it.

**Mobile viewport (limitation).** Edge could not be resized through Windows MCP, and opening DevTools device mode would
have changed the human's browser state. The Playwright browser at 390 × 844 has no session and redirected to
`/sign-in?next=%2Fdashboard`, so a signed-in phone "before" view was not captured. No sign-in was attempted.

### Data inconsistencies the redesign must not repeat

- **Past due.** Home says "8 leases are past due · $13,240 past grace". Payments says outstanding is $13,240 across
  8 open balances, and *late* is $4,950 across 3 tenants past grace. The redesign uses "8 leases past due · $13,240" for
  open balances and keeps "past grace" for the 3 late tenants ($4,950).
- **Expiring.** Home counts 40 leases within 90 days. Leases and Tenants count 1 within 60 days. Always name the window
  ("ending within 90 days", "1 in the next 60 days").
- **Rent analysis "available".** Rent analysis says "available units" where it means total units.

## 2. Visual rules

Tokens (unchanged): primary `#3E4FE5` indigo, accent `#007F7A` teal, text `#17233A` ink, muted `#58677D`, background
`#F4F5F8`, surface `#FFFFFF`, danger `#B4233F`. Inter body, Outfit headings, expressive scale, 16 px radius, 8 px unit.

- **One summary band per screen.** The band is a primary→accent gradient Stack with `pattern: dots`, `corners: large`,
  `shadow: lifted` and padding 5 (padding 3 on phone). It holds the screen's single most important number at `display`
  size, weight black, tracking tight, and a surface-coloured Progress bar. White Stat cards sit beside it on desktop and
  scroll sideways below it on phone. Don't use `hero` size for currency at 1280: `$60,390` breaks across lines.
- **Ink panel for "act now".** A Card with `background: text` holds the actionable queue. Each item is an eyebrow
  label (not a tinted Badge, which loses contrast on ink), a level-4 heading, an optional small detail and a `→` Link.
  Use at most one ink panel per screen.
- **Panel variety.** Use a white Card with `shadow: soft` for charts, a bordered surface→background gradient Stack for
  occupancy and progress groups, and plain white Cards for lists. Don't put two identical treatments side by side.
- **Asymmetry.** On desktop, main rows use `Grid template 2:1` (band) or `1:2` (ink queue beside charts). Lists pair
  in `columns: 2`. The `1:1:2` three-up was too cramped beside the sidebar at 1280 and was removed.
- **Rows.** A list row is a row Stack with `justify: between`: small Avatar, bold name plus caption detail, then a Badge
  on the right. Badge tones: warning for under 60 days or screening, info for scheduled or later, positive for
  paid/ready, neutral for waiting on someone else, danger only for money past grace.
- **Type.** The page eyebrow is Heading level 4, uppercase, tracking wide, primary. The page title is Heading
  `size: large`, tracking tight (desktop) or level 1 (phone). Section titles are level 3. Captions carry the
  secondary facts: unit, rent and date, joined by ` · `.
- **Accent use.** Teal is for occupancy bars and the gradient end only. Indigo is for actions and links. Red is for
  past-grace money only.
- **Spacing.** Page padding is 6 on desktop and 2 on phone. Gaps between sections are 4 (desktop) and 3 (phone).
  Card padding is 4 (desktop) and 3 (phone).

## 3. Shared components and navigation map

- `brand`: placed with `set: {"brand-0": {"level": 3}}` on both Home screens. At level 2 it wraps to "RocketRent / al"
  in a medium Sidebar.
- `desktop-navigation`: placed in a `Sidebar` (`width: medium`, `background: text`, padding 3, gap 3). Below it come
  a Divider and the Integrations note, "Owner payout setup · coming soon". **Owner-bank payout is a placeholder. Never
  show it as connected or working.**
- `mobile-navigation`: placed in `bottom`, inside a surface Stack with a border and padding 1. The app bar in `top` is
  the `brand` component, a bell Icon and an Avatar.

Navigation: Overview→`home`, Properties→`properties`→`property`, People→`people`, Applications→`applications`,
Leases→`leases`→`lease`, Payments→`payments`→`ledger`, Maintenance→`maintenance`, Documents→`documents`, Returns &
ROI→`returns`, Rent analysis→`rent-analysis`. Phone screens use the `-mobile` ids. Home links to `ledger` for "Review
balances", `applications`, `maintenance`, `leases` and `payments`.

**Proposed shared-component update (needs manager authority; not applied).** The components render as underlined
links with no active state. The proposal:

1. `desktop-navigation`: change the Stack to `gap 1`. Before each group, add a `Text` eyebrow: "Portfolio" above
   Properties/People, "Leasing" above Applications/Leases, "Money" above Payments/Returns & ROI/Rent analysis, and
   "Operations" above Maintenance/Documents. This matches the live app's groups.
2. `mobile-navigation`: replace the four Links with `Button variant quiet size small` and `icon` home / grid /
   credit-card / users, with ids `mobile-link-0` to `mobile-link-3` and the same `goesTo`. Each screen then marks its
   tab with `set: {"mobile-link-N": {"variant": "primary"}}`.

## 4. Workflow constraints for dependent designers

- **Lease ledger.** Keep the balance-due / last-payment band above dated rent rows (Rent badge, amount, "Due Oct 1,
  2026"). Ledger and reminder review comes *before* any reminder is sent. Home's past-due item links there, never
  straight to "send".
- **Promotion.** An applicant becomes a lease from Applications ("Ready for decision" → create lease). Keep the
  applicant identity across the lease steps.
- **Signing and PDFs.** "Review agreement & signatures", the owner/lessor signing link, the signed-agreement PDF and
  document view/download stay reachable from the lease workspace and Documents.
- **Draft deletion.** Lease drafts (Leases → Drafts) remain deletable, behind a confirmation.
- **Reminders.** Payment reminders stay an explicit, reviewed action on Payments and the ledger.
- **Screening.** Keep the FCRA consent and fair-housing notices on Applications verbatim.
- Use the real portfolio names and figures above (Maple Court, Cedar Row Townhomes, Harbor View Lofts, 18 Elm Street).
  Don't invent tenants.

## 5. Verification

`design_screenshot` was run on each screen after writing, and both were fixed before submission:

- `home` at revision 3: the brand wrapped, `$60,390` broke at hero size, the three-up bottom row was cramped and
  tinted badges were hard to read on ink. All four were fixed at revision 4: brand level 3, display size, two-column
  lists and eyebrows on ink.
- `home` at revision 4 (unchanged at revision 5): one-line greeting, band with three Stat cards, ink queue beside the
  chart and occupancy panels, and Renewals / Recent activity in two columns. No clipping at 1280 px.
- `home-mobile` at revision 5: app bar, two-line greeting, gradient band, sideways Stat carousel (intentionally
  clipped at the edge), ink queue, renewals, occupancy and activity, and a pinned tab bar. No horizontal overflow at
  390 px.

Accessibility: text on ink and gradient uses the renderer's light ink. Badges sit on white only. Links carry a `→`
and are underlined. Status is never shown by colour alone, because every Badge has a text label.

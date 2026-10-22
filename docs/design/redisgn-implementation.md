# Redisgn — application implementation and coverage

The approved `Designs/redisgn` look (revision 172, 40 screens; Home and Home · mobile at the
approved r134 aesthetic) is implemented in the running application. It uses white bordered
summaries, medium Outfit headings and restrained cards. This document supersedes the visual
status in [light-rollout-coverage.md](light-rollout-coverage.md). That file's functional
inventory of routes and states still applies.

The work landed in two passes:

1. **Look and shell** (commit `4950da5`): tokens, shell, Home and summary bands.
2. **Layout completion** (this pass): the screens the first pass only restyled now follow the
   reference panels, hierarchy and phone order. It also closes the review's verification gaps.

## First pass: look and shell

- **Tokens and type.** `--design-*` use the design tokens:
  - primary `#3e4fe5`, background `#f4f5f8`, text `#17233a`, muted `#58677d`, accent `#007f7a`,
    danger `#b4233f`
  - 16px radius and an 8px spacing unit
  - headings in Outfit (vendored, OFL) at weight 500
- **`src/styles/redisgn.css`** loads last. It defines the shell, page header, pill buttons,
  cards, pill badges, table headings, fields, dialogs and the shared summary band.
- **Shell (`ManagerShell`, `nav.ts`).**
  - The ink sidebar groups sections as Portfolio, Leasing, Money, Operations and Analysis.
  - Integrations shows "Owner payout setup · coming soon".
  - Below 1024px, an app bar (brand, Notifications, account menu) and a five-tab bar (Home,
    Properties, People, Payments, More) replace the drawer. `/more` is manager-protected.
- **`SummaryBand`** (`src/components/ui/SummaryBand.tsx`) shows:
  - the lead figure and its detail
  - an accessible meter
  - a footer action
  - inset stat cards, which scroll sideways on phones
- **Home, Properties, People, Leases, Payments and Maintenance** use the band. Home's open and
  late figures come from the same `loadPaymentsOverview` as Payments.

## Layout completion pass

### Resolution of review findings

1. **Property and property-mobile** (`WorkspaceOverview`, `WorkspaceHeader`, `UnitSwitcher`,
   `overview-model.ts`).
   - **Header:** eyebrow "Multi-unit · N units", title with status badge, address with map pin,
     the "View" unit select ("Unit 4B · Alex Rivera") and Edit property.
   - **Payment band:** "<Month> · Payments this month" with the collected lead figure, the
     due/outstanding detail and the meter. Its footer keeps View payments, Send reminder (when
     overdue) and Reminder history. Insets show Occupancy (naming the vacant unit) and "Leases
     expiring soon" (first unit and date).
   - **Next steps:** a three-column Next steps card (Maintenance, Renewals, Vacancy) built from
     live data, next to a Property details panel.
   - **Units & lease terms:** a striped table with lease term, time left and status ("Renewal due"
     under 60 days; asking rent and applicants for vacant units). The old occupancy strip and the
     standalone timeline are gone; the timeline is kept in a collapsed disclosure.
   - **Archive row:** caption plus the existing confirmation.
   - **Phones:** tabs become wrapping pills, units become stacked rows (vacant and soonest-ending
     first), and the rest go in a disclosure.
   - **Unit view:** `?unit=` uses the same hierarchy.
   - **Data:** `src/lib/properties/data.ts` adds read-only unit lease dates and
     `getOverviewSignals` (open repairs and applicants). Existing queries are unchanged.
2. **Applications and the invitation/promotion variants** (`applications/page.tsx`,
   `src/lib/applications/pipeline.ts`).
   - **Provider line:** "TransUnion SmartMove · sandbox". It never claims "connected" while
     sandbox mode routes screening to the mock adapter.
   - **Pipeline band:** "N to review", with the ready / screening / awaiting-consent split, a
     consent-and-report meter, and stat cards. Decided applications are excluded; invitations
     and drafts never count.
   - **Invitations card:** steps, a warning while secure links are unconfigured, and real open
     invitations with their delivery state. Beside it, an "Invitation or application?" guide.
   - **Applicants and selected applicant:** a filtered applicants list (status tabs on phones). The
     selected-applicant card has the Submitted→Promote steps, the provider row, the
     credit/background/eviction report, the FCRA consent alert (real date) and the Fair housing
     alert, then the Decision section.
   - **Send application:** the 1 · Create and 2 · Review cards with a live preview.
   - **Invitation detail:** steps and preview, with send, copy and renew retained.
   - **Promote:** "existing contact" now uses a modal with the same semantics.
3. **Lease, lease-mobile, lease-alex, ledger and ledger-confirm** (`leases/[id]/page.tsx`,
   `lease-view.ts`, `RentLedger`, `ReminderWorkspace`).
   - **Lease header:** eyebrow "Lease · start → end" and the status badge ("Active · ends in N
     days" warns under 60 days).
   - **Signature panel:** shows signed, PDF unavailable, awaiting signatures or not sent, with
     per-signer badges.
   - **Overview and Payments tabs:** the ledger is beside Terms, Documents and Activity cards.
   - **Documents tab:** files grouped into Signed agreement, Addendums and Inspections & IDs.
   - **New `/leases/[id]/ledger` page:**
     - a scope bar (Property | Unit | Lease, lease term, sandbox badge)
     - a "Balance due · as of … UTC" band with Last payment and "Credit on account" insets
       (credit is never balance due)
     - a Charge ledger with Charges / Payments / All views and older paid months folded
     - the reminder review below it
   - **Reminder confirm:** a Step 4 of 4 summary and a message preview. Nothing sends without
     confirmation.
   - **Historical signed leases:** a lease marked signed with no RocketRental signing record no
     longer shows per-person "Signed" badges. It lists "Named tenant" and "Signer details ·
     Review in PDF" (design wording), and its uploaded file is not badged Signed. This matches
     Documents, which counts only files pinned by an executed agreement.
4. **Documents and the maintenance new/edit variants.**
   - **Documents:**
     - a "Portfolio files" band with Signed and Restricted insets
     - a filter panel (type tabs, sort, search, property, unit)
     - lease documents grouped by lease, a Preview card, and Property files and Photos panels
   - **New request:** the Request details card next to "What happens next".
   - **Edit request:** status steps, location line, Title, Description, Status / Priority / Vendor
     selects, photo row and Cancel / Save changes. The "No description yet" alert and the
     Activity card sit on the right.
   - **Phones:** Cancel and Save stay pinned above the tab bar. Editor CSS modules no longer
     override the shared control and card look.
5. **Returns and rent analysis.**
   - **ROI workspace:** breadcrumbs, a save-state badge, and meta with revision and demo-value
     count.
   - **Year 1 band:** "−$213 / month" in danger, a risk meter, and Cash-on-cash, Cap rate and DSCR
     insets.
   - **Panels:** "Net cash flow by year" (exact values, break-even badge), "To complete
     actuals", and "Actual vs projected", where partial actuals are never differenced and missing
     records say "Not recorded". Then the estimates panel, Milestones, and the "Optional ROI
     inputs" disclosure.
   - **Rent analysis:** a unit chooser state ("Every unit vs saved market rent"). The selected-unit
     state has a suggested-rent band, comparison card, Set market rent, map, distribution and the
     full comps table. Analysis controls use the shared pill and field look.
6. **Responsive fixes.**
   - **Manager tab bar:** `globals.css` set `.tabbar` to four columns, which pushed the fifth tab
     off-screen. The manager bar now uses `.tabbar.manager-tabbar` with five equal columns; tenant
     navigation is unchanged (four equal columns).
   - **Shared styles:** `.steps` rows now wrap on phones. Shared field and search borders use
     `--rr-border-strong` (3:1 against white).
   - **ROI:** the More menu opens leftward on phones. The Estimates/Milestones pair stacks until
     both tables fit.
7. **Tests and lint.**
   - **Tenant tests:** the six `src/lib/tenants/tenants.test.ts` failures were baseline. Commit
     `accd440`, an ancestor of base `cca8313`, added the `$queryRaw` advisory lock and contact
     lookup without updating the test's fake transaction. `src/lib/tenants` is byte-identical
     between `cca8313` and `4950da5`. The fake transaction now supplies `$queryRaw`, and the tests
     assert the lock and the org-scoped lookup. On the current tree: 24 passed, 0 failed.
   - **Lint:** the 21 `no-require-imports` errors were in CommonJS runtime helpers. They are fixed
     with a `**/*.cjs` override in `eslint.config.mjs`, and the redundant disable comments were
     removed.

## Design screen → application coverage (40/40)

Desktop is ≥1024px with the sidebar; phone and tablet (<1024px) use the app bar and tab bar.
"Verified" means checked in the browser on the isolated runtime at 1280, 768 and 390px.

| Design screen(s)                      | Route / state                                                   | Status                                                                 |
| ------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `home`, `home-mobile`                 | `/dashboard`                                                    | Implemented (first pass); verified                                     |
| `more-mobile`                         | `/more` + phone tab bar                                         | Implemented; five tabs fit at 390px                                    |
| `properties`, `properties-mobile`     | `/properties`                                                   | Implemented (first pass); verified                                     |
| `property`, `property-mobile`         | `/properties/[id]`, `?unit=`                                    | Implemented: payment band, next steps, units & lease terms; verified   |
| `people`, `people-mobile`             | `/tenants`, `/tenants/[id]`                                     | Implemented (first pass)                                               |
| `applications`, `applications-mobile` | `/applications`                                                 | Implemented: pipeline band, invitations, applicant review; verified    |
| `applications-invite`, `-mobile`      | `/applications/send`, `/applications/invitations[/id]`          | Implemented; create → review → sandbox send verified                   |
| `applications-promote`, `-mobile`     | `/applications?applicant=…` → Promote to tenant                 | Implemented in the selected card (modal for existing contact)          |
| `leases`, `leases-mobile`             | `/leases`                                                       | Implemented (first pass)                                               |
| `leases-delete`, `-mobile`            | Drafts → Delete → `ConfirmDialog`                               | Implemented (first pass)                                               |
| `lease`, `lease-mobile`, `lease-alex` | `/leases/[id]` (Overview/Agreement/Documents/Payments/Activity) | Implemented: signature panel, ledger + Terms/Documents/Activity        |
| `payments`, `payments-mobile`         | `/payments`                                                     | Implemented (first pass)                                               |
| `ledger`, `ledger-mobile`             | `/leases/[id]/ledger` (new), property/unit ledgers              | Implemented: scope bar, balance band, charge ledger, reminder review   |
| `ledger-confirm`, `-mobile`           | Ledger or `/notifications?leaseId=` → Preview → confirm         | Implemented inline (Step 4 of 4); sandbox send verified                |
| `maintenance`, `maintenance-mobile`   | `/maintenance`                                                  | Implemented (first pass)                                               |
| `maintenance-new`, `-new-mobile`      | `/maintenance/new`                                              | Implemented: details card + "What happens next"; verified              |
| `maintenance-edit`, `-edit-mobile`    | `/maintenance/[id]/edit`                                        | Implemented: steps, 3-column selects, activity; sticky actions checked |
| `documents`, `documents-mobile`       | `/documents`                                                    | Implemented: files band, filters, grouped lease files, preview         |
| `returns`, `returns-mobile`           | `/roi-analysis?property=`, `/properties/[id]/returns`           | Implemented: Year 1 band, cash flow, actuals, estimates, milestones    |
| `rent-analysis`, `-mobile`            | `/rent-analysis?property=[&unit=]`                              | Implemented: unit chooser and selected-unit comp result; verified      |

### Surfaces not pictured in the design

| Surface            | Routes                                                                          | Treatment                                         |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| Auth and recovery  | `/sign-in`, `/recover`, `/recover/[token]`, `/sign-out`                         | Tokens, wordmark, flat card; recovery verified    |
| Tenant portal      | `/home`, `/pay`, `/lease`, `/repairs`                                           | Tokens; four-tab bar unchanged; verified at 390px |
| Lease creation     | `/leases/new` (10 steps), `/leases/templates[/id]`                              | Tokens; renewal draft → send verified             |
| Signing            | `/sign`, `/sign/leases/[id]`                                                    | Tokens; owner and tenant signing verified         |
| Public application | `/apply/[token]`                                                                | Tokens                                            |
| Settings/ancillary | `/integrations`, `/notifications`, property listing/media/documents tabs, `/ui` | Tokens, shared components                         |

## Verification (22 October 2026)

**Isolated runtime.** All browser work used the `rocketrental_redesign_fix` database on the
local Postgres. It was created with `prisma migrate deploy` and `npm run db:seed`, plus
`load-roi-examples.ts --seed-inputs-only` for the populated ROI state.

- The checkout's own git-ignored `.env` holds a local auth secret, a local invitation origin and
  a link secret, and sandbox mode.
- The app ran on port 3210: `next dev` while building, then `next start` from the final build.
- The live database (`rocketrental` on 5434) and the app on port 3100 were not touched.
- Email went to the mock provider (`EmailDelivery` rows); no message left the machine.

**Automated checks** (on the committed tree):

- `npx tsc --noEmit`: passed.
- `npx eslint . --max-warnings=0`: passed (previously 21 errors).
- `npx vitest run`: 1384 passed, 130 skipped, 0 failed (previously 6 failed).
- `npm run build`: passed.
- Prettier is clean for changed files, except three that were already unformatted at base:
  `PropertyForm.tsx`, `tenants.test.ts` and `workspace.test.tsx`. They were left as-is to avoid
  churn.

**Responsive and accessibility checks** (Playwright):

- **Overflow sweep:** 18 changed routes at 390, 768 and 1280px. There is no page overflow, and
  no visible element crosses the viewport outside a labelled scroll region. Collapsed menus are
  not rendered.
- **Menus at 390px:** the lease document row menu (87–367px) and the ROI More menu (159–359px)
  stay on screen when open. Save analysis is pinned above the tab bar.
- **Manager tab bar at 390px:** five tabs at 68.5px each; the last ends at 367px of 375px.
- **Tenant bar:** four 86.7px columns.
- **Maintenance edit at 390px:**
  - Cancel and Save sit above the tab bar (bottom 760 < 779px).
  - A focused Description field stays visible.
- **Dialogs at 390px:** Add unit and Archive property fit. Escape closes them and returns focus.
- **Account menu:** opens with Sign out; Escape returns focus.
- **Keyboard:** Tab through 25 controls on each of seven changed pages; every focused control
  shows a ring.

**Browser flows and outcomes**

- **Property save and reload:** Year built 1998 → 1999 persisted after reload, then reverted to 1998.
- **Invitation:**
  - Send application, Maple Court 3A, then "Create invitation & preview". The review page shows
    the applicant, home, private link and the full email preview.
  - Send recorded "Sandbox recorded · no email sent".
  - Applications then shows "Invitations · 1 open".
- **Reminder:** Chloe Fisher's ledger → Preview reminder (focus moves to "Confirm sandbox
  reminder") → Record sandbox test. Reminder history shows "Sandbox · not delivered".
- **ROI save and reload:** Save draft → "Saved draft · revision 1"; reload shows "Loaded draft"
  with no reload prompt. The isolated test assumptions are 28 marked demo values.
- **Rent apply:** Unit 3A suggested $1,840 → "Market rent updated. Now $1,840 / month". It
  persisted after reload, and the listed rent stays $1,600.
- **Recovery:**
  - `/recover` for the owner account shows the neutral "Check your inbox".
  - The mock `PASSWORD_RESET` email's link was followed without printing the token, and a new
    password was set.
  - The owner then signed in.
- **Lease signing and document availability:**
  - The historical signed lease correctly refuses re-sending ("Create a renewal or amendment").
  - A renewal draft for Alex Rivera was completed through the wizard and sent ("No email or text
    notification was sent").
  - The panel showed "Awaiting signatures 0 of 2"; the owner signed, then the tenant.
  - The panel then read "Signed agreement on file · All parties signed".
  - The signed PDF downloaded with HTTP 200 (`application/pdf`, `%PDF` header).
  - Documents then counted 1 signed agreement.
- **Tenant:** Alex's Home, Pay, Lease (both agreements, files) and Repairs render at 390px
  without overflow. There is no separate `/account` page (404); account actions are the account
  menu and recovery.

Screenshots are kept locally in this checkout's `.playwright-mcp/` because the repository tree
is at its size cap:

- `fix-<width>-<screen>.png` show the layouts.
- `flow-*.png` show the flow states.
- `check-*.png` show the menu and dialog bounds.

## Limitations

- **Sample values.** Design sample values are fixtures; the app shows live data (for example, 5
  open repairs where the design shows 4).
- **Breadcrumbs and in-header selects.** The shared page header supports only a back link, so
  the following show "← Section / eyebrow" rather than separate breadcrumb rows:
  - Send application
  - maintenance new/edit
  - the lease and ledger pages
  - rent analysis

  For the same reason, the rent-analysis unit select sits in a row under the header.

- **Promote.** Promotion stays inside the selected-applicant card; there is no separate route.
- **Ledger.** It has no Export button and no "Create a charge" action (that action exists only on
  the property/unit Payments board). The confirm step stays inline rather than a modal, so focus
  and no-double-send behaviour are unchanged.
- **Phone tables.** Returns tables scroll sideways in labelled regions instead of becoming
  stacked lists. Comp filters stay visible.
- **Maintenance.**
  - The new-request photo control is a compact "Add photos" file button, as designed, so the
    drag-and-drop area is gone; selection, type and size checks are unchanged.
  - Choosing a vendor while creating a request calls the existing assign action after the
    create, so the request starts as Assigned. The two steps are not one transaction, and a
    failed assign says to assign from the request.
  - Edit-request activity cannot say the priority at creation, because it is not stored.
- **Property details.** The panel is read-only; editing stays on `/properties/[id]/edit`, which
  was verified.
- **Accessibility.** Formal WCAG conformance was not audited; focus, Escape, contrast of the
  shared field borders and the tab-bar bounds were checked.
- **Delivery.** Not pushed, not deployed, and no Preview was published.

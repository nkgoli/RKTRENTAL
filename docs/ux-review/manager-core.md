# Manager core: dashboard, properties, payments, maintenance, documents, integrations

Screens reviewed: `/dashboard`, `/properties` (grid, list, empty), `/properties/new`, `/properties/:id` (overview, unit overview, edit), `/properties/:id/listing`, `/properties/:id/payments`, `/properties/:id/maintenance`, `/payments`, `/maintenance`, `/maintenance/new`, `/maintenance/:id/edit`, `/documents`, `/integrations`. Desktop captures: `screenshots/*-1280.jpg`; phone: `screenshots/*-390.jpg`.

What is already good: the dashboard composition (hero collection card + chart, expiring leases, attention list), the property overview lease timeline, the integrations page structure, and the empty states on Properties/Tenants/Documents. Keep those.

| ID | Route | Severity | Finding | Status |
| --- | --- | :-: | --- | :-: |
| MC-01 | all manager routes | P1 | Sidebar has its own scrollbar at 1280 × 800 | Open |
| MC-02 | /dashboard | P1 | "Leases expiring soon" KPI (1) disagrees with the list (6) | Open |
| MC-03 | /dashboard | P2 | Current-month bar is teal with no legend entry | Open |
| MC-04 | /dashboard | P2 | Activity rows show "12:00 AM" and mix badges with badge-styled links | Open |
| MC-05 | /dashboard | P2 | Attention avatars use off-palette coral/pink/navy | Open |
| MC-06 | /properties | P1 | Property cards spend 180px on decorative icon headers; Maple Court shows a gradient instead | Open |
| MC-07 | /properties | P2 | Search needs a button; chips reload the page | Open |
| MC-08 | /payments | P1 | "Refund" is the primary row action on 33 of 41 rows; actions ignore status | Open |
| MC-09 | /payments | P2 | Rent amounts rendered as links; header not sticky; no page-size | Open |
| MC-10 | /payments | P2 | Owner payouts "Recent: $1,000 paid · $1,000 paid…" line is noise | Open |
| MC-11 | /maintenance | P1 | Board has 4 columns in a 3-column grid; "Done" wraps under "New" | Open |
| MC-12 | /maintenance | P2 | "▸ Manage request" disclosure inside cards; "?" avatar for Unassigned; filters need Apply | Open |
| MC-13 | /maintenance/new, /maintenance/:id/edit | P2 | Two h1s with a back link squeezed between them | Open |
| MC-14 | /maintenance/:id/edit | P2 | Photo shown as a full-width grey 140px block with text links under it | Open |
| MC-15 | /documents | P2 | Filter rail is chips + 3 selects + Apply; thumbnails are gradient placeholders; text-link actions | Open |
| MC-16 | /integrations | P2 | Three stacked "Save settings" buttons; badge casing differs from Applications | Open |
| MC-17 | /payments (390) | P1 | Rent roll shows only Tenant and Property columns; the rest need unsignposted sideways scroll | Open |
| MC-18 | /properties?view=list (390), /returns (390) | P2 | List table and income chart overflow their cards | Open |
| MC-19 | /properties/:id (390) | P1 | Workspace tab strip overflows; Returns and Maintenance are cut off with only a thin scrollbar | Open |
| MC-20 | /properties/new, /properties/:id/edit | P2 | "Number of units" defaults to 0 for a multi-unit building; ROI details is four collapsed disclosures under three paragraphs of help | Open |
| MC-21 | /properties/:id | P2 | Overview page is 3,407px: full units table, 12-row timeline, photos, uploader and an "Add unit" form all expanded | Open |
| MC-22 | /properties/:id/listing | P2 | Unit configuration prints "— bd · — ba" for every unit; twelve identical "See comps" buttons | Open |

---

### MC-01
- **Route:** every manager route at 1280 × 800. Screenshot: [properties-list-1280.jpg](screenshots/properties-list-1280.jpg) (scrollbar between sidebar and content), [lease-templates-1280.jpg](screenshots/lease-templates-1280.jpg).
- **Severity:** P1
- **What is wrong:** "There's a second scrollbar next to the menu on every page." The sidebar content (brand 56px, 9 nav items at 38px, group labels, divider, Integrations, account card 100px) is taller than 800px, so the sticky sidebar scrolls independently and shows a permanent scrollbar at x ≈ 200px.
- **Premium looks like:** Linear/Mercury sidebars fit a 13-inch laptop with room to spare; the account control is a compact row at the bottom and the nav never scrolls.
- **Fix:** In `.sidebar` set `height: 100vh; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto` and let only the nav column scroll with `scrollbar-width: thin`. Reduce rhythm: nav item height 36px, item gap 2px, group gap 16px (was ~24px), group labels 11px/16px, padding 12px. Replace the 100px account card with a single 44px row (avatar 28px, name, chevron) that opens `AccountMenu` with "Sign out". Target total height ≤ 640px.
- **Files:** `src/styles/globals.css` (`.sidebar`, `.nav`, `.sidebar-foot`), `src/components/shell/ManagerShell.tsx`, `src/components/shell/AccountMenu.tsx`.
- **Status:** Open

### MC-02
- **Route:** `/dashboard`. Screenshot: [dashboard-1280.jpg](screenshots/dashboard-1280.jpg).
- **Severity:** P1
- **What is wrong:** The KPI strip says "Leases expiring soon · 1 · within 60 days", the card below lists six leases, five of them "71d" away. Two definitions of "soon" on one screen.
- **Premium looks like:** One number, one definition, repeated consistently ("Expiring within 90 days · 6"), and the card shows exactly that set.
- **Fix:** Use one constant (`EXPIRING_WINDOW_DAYS = 90`) for both the KPI and the list; relabel the KPI "within 90 days"; order the list by days remaining and colour only ≤ 30d as warning (today Nov 30 shows warning tone, Dec 31 shows info tone; keep that mapping but with the shared constant). Cap the list at 5 with "View all 6 →".
- **Files:** `src/app/(manager)/dashboard/page.tsx`, `src/components/dashboard/KpiCard.tsx`, `src/lib` dashboard query that computes `expiringSoon`.
- **Status:** Open

### MC-03
- **Route:** `/dashboard`. Screenshot: [dashboard-1280.jpg](screenshots/dashboard-1280.jpg).
- **Severity:** P2
- **What is wrong:** The October bar is teal while May–Sep are cobalt; the legend only lists "Collected" and "Due". Nothing says the teal bar is the current, partial month.
- **Premium looks like:** Stripe's "current period" bars are the same hue at 50% opacity or hatched, with "to date" in the axis label and the legend.
- **Fix:** Render the current month with `fill: var(--design-primary); fill-opacity: .45` and a dashed outline; axis label "Oct · to date"; add a third legend item "Current month (to date)". Reserve teal for the second data series only.
- **Files:** `src/components/dashboard/CollectionChart.tsx`, `src/components/dashboard/CollectionChart.module.css`.
- **Status:** Open

### MC-04
- **Route:** `/dashboard` Recent activity. Screenshot: [dashboard-1280.jpg](screenshots/dashboard-1280.jpg).
- **Severity:** P2
- **What is wrong:** Every row ends "Oct 11, 12:00 AM" (seed dates at midnight, but real data would still show a meaningless time). The right column mixes true badges ("Submitted", "Screening", "Paid") with blue "Review" links styled like badges.
- **Premium looks like:** Relative or date-only stamps ("Oct 11", "3h ago"), one status badge per row, the whole row is the link.
- **Fix:** Format with `formatRelativeDate()` (today/yesterday/MMM d, no time unless < 24h). Make each `<li>` an anchor to the target (application, lease, payment); drop the "Review" link and show `Badge tone="info"` "Needs review" instead. Wrap long secondary lines: "Marcus Bell · Harbor View Lofts · 21" should truncate at one line with `text-overflow: ellipsis`.
- **Files:** `src/app/(manager)/dashboard/page.tsx` (activity list), `src/app/(manager)/dashboard/dashboard.module.css`, `src/components/ui/Badge.tsx`.
- **Status:** Open

### MC-05
- **Route:** `/dashboard` Needs attention. Screenshot: [dashboard-1280.jpg](screenshots/dashboard-1280.jpg).
- **Severity:** P2
- **What is wrong:** The "CF SH LD GS +4" avatar stack uses coral, pink, mint and navy backgrounds. Those are legacy `--rr-coral`/`--rr-navy` tokens; the light system has one accent (cobalt) plus teal and danger.
- **Premium looks like:** Monochrome initials avatars (cobalt tint background, cobalt text, 1px surface border) stacked with −6px overlap.
- **Fix:** Replace the hue hashing with the single `ls-avatar` style from the design (`background: var(--rr-primary-tint); color: var(--design-primary)`); the "+4" chip uses `--design-text` on `--rr-subtle`. Remove `--rr-coral*`, `--rr-navy*`, `--rr-warm` from `globals.css` once no consumer remains.
- **Files:** `src/components/ui/Flair.tsx` (avatar), `src/app/(manager)/dashboard/dashboard.module.css`, `src/styles/globals.css`.
- **Status:** Open

### MC-06
- **Route:** `/properties`. Screenshots: [properties-grid-1280.jpg](screenshots/properties-grid-1280.jpg), [properties-grid-390.jpg](screenshots/properties-grid-390.jpg).
- **Severity:** P1
- **What is wrong:** Each card has a 180px pale header with a single line icon; Maple Court (the only property with a cover) shows a blue gradient instead. Four cards fill 950px for four lines of data. On phone each card is 260px tall.
- **Premium looks like:** AppFolio/Buildium property cards: 4:3 cover photo (real or a flat tinted placeholder with the building miniature), name, address, two stats, occupancy bar, all inside 220px.
- **Fix:** Card header 96px (desktop) / 80px (phone) with `object-fit: cover` photo when `coverUrl` exists, otherwise `--rr-primary-tint` background with the approved 40 × 40 building miniature at 29px (not 60px). Body: name 16px/600, address 13px muted, a single meta row "8 units · $11,550/mo", occupancy bar 4px. Grid `repeat(auto-fill, minmax(280px, 1fr))` so 1280px shows three columns. Add the same 40px thumbnail to the list view's first column.
- **Files:** `src/app/(manager)/properties/page.tsx`, `src/app/(manager)/properties/properties.module.css`, `src/components/dashboard/MiniCover.tsx`.
- **Status:** Open

### MC-07
- **Route:** `/properties`. Screenshot: [properties-grid-1280.jpg](screenshots/properties-grid-1280.jpg).
- **Severity:** P2
- **What is wrong:** Search has a separate "Search" button; filter chips ("Multi-unit 3") are links that reload the page; the Grid/List toggle is also a navigation.
- **Premium looks like:** Type-to-filter with the URL updated silently; chips toggle instantly.
- **Fix:** Add a client `SearchField` (debounce 250ms, `router.replace` with `?q=`), keep server rendering for the list. Chips and Grid/List use `router.replace` with `scroll: false`. Remove the Search button; Enter still submits. See FD-01 for the shared pattern.
- **Files:** `src/app/(manager)/properties/page.tsx`, new `src/components/ui/SearchField.tsx`, `src/components/ui/AutoSubmitSelect.tsx`.
- **Status:** Open

### MC-08
- **Route:** `/payments`. Screenshot: [payments-1280.jpg](screenshots/payments-1280.jpg).
- **Severity:** P1
- **What is wrong:** "Refund" is the only action on every paid row (33 of 41), rendered as a blue link, the same weight as "Record payment". Autopay rows also offer "Record payment". Late rows have two actions side by side ("Add late fee" button + "Record payment" link). There is no way to open the tenant's ledger from the row.
- **Premium looks like:** Stripe payments list: the row opens the detail; the one contextual action is on the right; refunds live behind "⋯" with a confirm dialog.
- **Fix:** Make the row a link to `/leases/:id?tab=payments`. Action column by status: Late → `Record payment` (secondary) + overflow (Add late fee, Send reminder, Refund); Open → `Record payment`; Autopay → muted text "Scheduled Nov 1" + overflow; Paid → overflow only (View receipt, Refund). Refund opens `ConfirmDialog` (FD-02). Use the `Button size="sm" variant="secondary"` for the visible action, never a bare link.
- **Files:** `src/app/(manager)/payments/page.tsx`, `src/app/(manager)/payments/payments.module.css`, new `src/components/ui/RowMenu.tsx`.
- **Status:** Open

### MC-09
- **Route:** `/payments`. Screenshot: [payments-1280.jpg](screenshots/payments-1280.jpg).
- **Severity:** P2
- **What is wrong:** The Rent column ("$1,650") is blue link text; the table header scrolls away over 20 rows; pagination is "1 / 3" with Prev/Next and no page-size; "Due" is always "Oct 1" (redundant for a monthly view).
- **Premium looks like:** Right-aligned tabular numerals in `--design-text`, sticky header inside the card, 25/50/100 rows.
- **Fix:** Render amounts as `<td class="num">` text with `font-variant-numeric: tabular-nums`; `thead { position: sticky; top: 0 }` inside the card's scroll container; add a page-size select (25 default); drop the Due column when the month filter is active and show it in the row detail.
- **Files:** `src/app/(manager)/payments/page.tsx`, `src/components/ui/Table.tsx`, `src/components/ui/Pagination.tsx`.
- **Status:** Open

### MC-10
- **Route:** `/payments` Owner payouts. Screenshot: [payments-1280.jpg](screenshots/payments-1280.jpg).
- **Severity:** P2
- **What is wrong:** "Recent: $1,000 paid · $1,000 paid · $1,000 paid · $1,000 paid" below the Send payouts button; it has no dates, properties or links. The payouts card also shows "$0" rows for properties with nothing collected.
- **Premium looks like:** A three-line "Last payouts" list (date · property · amount) linking to the payout record.
- **Fix:** Replace the inline string with a list of the last 3 payouts (`Oct 18 · Harbor View Lofts · $38,990`); hide properties with `$0 collected` behind "2 properties with nothing to send".
- **Files:** `src/app/(manager)/payments/page.tsx`.
- **Status:** Open

### MC-11
- **Route:** `/maintenance`. Screenshot: [maintenance-1280.jpg](screenshots/maintenance-1280.jpg).
- **Severity:** P1
- **What is wrong:** The board has four status columns (New, Assigned, In progress, Done) but the grid is three columns wide, so "Done" wraps onto a second row under "New" with 500px of empty canvas beside it.
- **Premium looks like:** Linear's board: equal columns in one row, horizontal scroll when the viewport is narrow, never a wrapped column.
- **Fix:** `.board { grid-template-columns: repeat(4, minmax(240px, 1fr)) }` at ≥ 1200px; at 1024–1199px `display: flex; overflow-x: auto; scroll-snap-type: x mandatory` with 280px columns; ≤ 640px stack as a single list grouped by status with sticky group headers. Column header shows count as a `Badge tone="neutral"`.
- **Files:** `src/components/ui/Kanban.tsx`, `src/app/(manager)/maintenance/maintenance.module.css`.
- **Status:** Open

### MC-12
- **Route:** `/maintenance`, `/properties/:id/maintenance`. Screenshots: [maintenance-1280.jpg](screenshots/maintenance-1280.jpg), [property-maintenance-1280.jpg](screenshots/property-maintenance-1280.jpg).
- **Severity:** P2
- **What is wrong:** Each card ends with "▸ Manage request", a `<details>` triangle that expands assignment/status/comments inside the card. Unassigned requests show a grey "?" avatar. The filter bar needs "Apply filters". In the property-scoped list the "▸ Manage request" row sits as a separate table row under each request.
- **Premium looks like:** The card is the click target and opens the request page; assignment shows "Unassigned · Assign" as a link; filters apply on change.
- **Fix:** Make the whole card a link to `/maintenance/:id/edit?returnTo=…` with a hover lift (`--rr-shadow-lift`); remove the inline disclosure. Replace "?" with a dashed-outline 28px circle and the text "Unassigned" as a link that opens the assign form. Status select and date inputs submit on change (AutoSubmitSelect); drop the Apply button.
- **Files:** `src/app/(manager)/maintenance/page.tsx`, `src/components/maintenance/MaintenanceListControls.tsx`, `src/components/maintenance/RequestDetails.tsx`, `src/components/workspace/panels/operations/PropertyMaintenanceList.tsx`.
- **Status:** Open

### MC-13
- **Route:** `/maintenance/new`, `/maintenance/:id/edit`. Screenshots: [maintenance-new-1280.jpg](screenshots/maintenance-new-1280.jpg), [maintenance-edit-1280.jpg](screenshots/maintenance-edit-1280.jpg).
- **Severity:** P2
- **What is wrong:** The page renders the section h1 "Maintenance" (32px) and then a second h1 "New repair request" (28px) with a small "Back to repair requests" link between them. Two titles, two levels of indentation (the form is inset 64px from the section title).
- **Premium looks like:** Eyebrow "Operations / Maintenance", one h1 "New repair request", breadcrumb back link in the eyebrow.
- **Fix:** Pass `title="New repair request"` and `eyebrow="Maintenance"` to `PageHeader`; render the back link as the first breadcrumb item; remove the nested `<h1>` from the form card and align the form to the page gutter (`max-width: 760px`, no inset). Same for Edit.
- **Files:** `src/app/(manager)/maintenance/new/page.tsx`, `src/app/(manager)/maintenance/[id]/edit/page.tsx`, `src/components/shell/PageHeader.tsx`, `src/components/maintenance/MaintenanceIssueForm.tsx`.
- **Status:** Open

### MC-14
- **Route:** `/maintenance/:id/edit`. Screenshot: [maintenance-edit-1280.jpg](screenshots/maintenance-edit-1280.jpg).
- **Severity:** P2
- **What is wrong:** The attached photo renders as an 850 × 140px grey band (object-fit cover of a placeholder), followed by "Open photo (new tab)" and "Download" as 13px text links, then the full dropzone and an "Upload photo" button that duplicates "Browse files".
- **Premium looks like:** A thumbnail grid (120px squares, 8px gap) with a lightbox on click and a small "+ Add" tile; one upload control.
- **Fix:** Grid of `RequestPhoto` thumbnails at 120 × 120 (`object-fit: cover`, radius 8px); clicking opens a `<dialog>` lightbox with Download; the dropzone becomes the last tile ("+ Add photos"); delete the separate "Upload photo" button (upload on selection with progress).
- **Files:** `src/components/maintenance/RequestPhoto.tsx`, `src/components/maintenance/RequestDetails.tsx`, `src/components/upload/FileUploader.tsx`.
- **Status:** Open

### MC-15
- **Route:** `/documents`. Screenshots: [documents-1280.jpg](screenshots/documents-1280.jpg), [documents-390.jpg](screenshots/documents-390.jpg).
- **Severity:** P2
- **What is wrong:** The filter card stacks six type chips, a search box, Property/Unit/Sort selects and an Apply button (two rows, 160px). Upload is a "▸ Upload files" disclosure. Photo thumbnails are gradient placeholders with the file name in a dark pill; every item has "Preview Download" as 13px text links.
- **Premium looks like:** Google Drive/Notion file views: one toolbar row (search, type segmented control, property select) that applies itself; a prominent "Upload" button in the header; thumbnails are the actual image; actions appear on hover as icon buttons.
- **Fix:** Move "Upload files" to the page header as the primary button opening a dialog (destination select + dropzone). Toolbar: search (debounced), type chips, property/unit selects auto-applying; remove Sort select (default newest, header sort instead). Thumbnails `object-fit: cover` of the stored file with icon fallback by MIME; actions as 32px icon buttons (eye, download) visible on hover/focus and always on touch. Group headers keep "Grouped by lease" meta right-aligned.
- **Files:** `src/app/(manager)/documents/page.tsx`, `src/app/(manager)/documents/documents.module.css`, `src/components/ui/Files.tsx`, `src/components/upload/FileUploader.tsx`.
- **Status:** Open

### MC-16
- **Route:** `/integrations`. Screenshot: [integrations-1280.jpg](screenshots/integrations-1280.jpg).
- **Severity:** P2
- **What is wrong:** Three settings cards each end with a right-aligned "Save settings" primary button; a page with three primary buttons. The TransUnion card says "Sandbox connected" (sentence case, teal dot) while Applications shows the same provider as "CONNECTED" (uppercase).
- **Premium looks like:** Settings save on change with a toast, or one sticky "Save changes" bar that appears only when dirty; one badge style across the app.
- **Fix:** Convert the three forms to auto-save on change (`AutoSubmitSelect`, switch) with `Toast` "Payout schedule updated"; remove the per-card buttons. Normalise provider status to `Badge` with sentence case ("Connected", "Sandbox", "Available").
- **Files:** `src/app/(manager)/integrations/page.tsx`, `src/components/integrations/integrations.module.css`, `src/app/(manager)/applications/page.tsx` (provider badge).
- **Status:** Open

### MC-17
- **Route:** `/payments` at 390px. Screenshots: [payments-390.jpg](screenshots/payments-390.jpg), [payments-fold-390.jpg](screenshots/payments-fold-390.jpg).
- **Severity:** P1
- **What is wrong:** The rent roll card shows only the Tenant and Property columns; Due, Rent, Status and Action are 380px further right inside a horizontally scrolling card with no scrollbar, shadow or hint. A manager on a phone cannot see who is late without discovering the sideways scroll.
- **Premium looks like:** Mercury/Stripe mobile: each row becomes a two-line card (name + unit, amount + status chip) with the single action on the right.
- **Fix:** Add a `Table` responsive mode (`data-mobile="cards"`): below 640px render `tbody tr` as `display: grid; grid-template-columns: 1fr auto; padding: 12px` with cells mapped by `data-label`; hide the Due column; show the status `Badge` under the amount. Until then, at minimum add `overflow-x: auto` scroll shadows (`mask-image` gradient) and `scrollbar-gutter: stable` so the scroll is visible.
- **Files:** `src/components/ui/Table.tsx`, `src/app/(manager)/payments/page.tsx`, `src/app/(manager)/payments/payments.module.css`.
- **Status:** Open

### MC-18
- **Route:** `/properties?view=list` and `/returns` at 390px. Screenshots: [properties-list-390.jpg](screenshots/properties-list-390.jpg), [returns-390.jpg](screenshots/returns-390.jpg).
- **Severity:** P2
- **What is wrong:** The properties list table is 840px wide inside a 343px card (Address clipped mid-word, no scroll affordance); the income/expenses SVG is 553px wide and clipped at the card edge, the year-over-year and returns-by-property tables are clipped too.
- **Premium looks like:** Charts resize to their container; tables switch to cards.
- **Fix:** Properties list: on phone switch to the grid view automatically (hide the Grid/List toggle below 640px). Chart: size the SVG from `ResizeObserver` on the card (`viewBox` + `width: 100%`), reduce ticks to 4 on phone. Returns tables: use the Table card mode from MC-17.
- **Files:** `src/app/(manager)/properties/properties.module.css`, `src/components/returns/IncomeExpenseChart.tsx`, `src/components/returns/returns.module.css`, `src/app/(manager)/returns/page.tsx`.
- **Status:** Open

### MC-19
- **Route:** `/properties/:id` and every workspace tab at 390px. Screenshots: [property-overview-fold-390.jpg](screenshots/property-overview-fold-390.jpg), [property-listing-390.jpg](screenshots/property-listing-390.jpg).
- **Severity:** P1
- **What is wrong:** The tab strip "Overview · Applications · Leases · Payments · Re…" overflows the viewport by 120px; the only hint is a 4px scrollbar under the tabs. "Returns" and "Maintenance" are invisible. The DOM check shows `Workspace_tab` elements with `right = 494` on a 375px viewport.
- **Premium looks like:** Tabs scroll horizontally with a fade on the right edge and the current tab scrolled into view (design: "dense tables/tabs scroll locally").
- **Fix:** Wrap tabs in `overflow-x: auto; scrollbar-width: none` with `mask-image: linear-gradient(90deg, #000 85%, transparent)` when scrollable; on mount `activeTab.scrollIntoView({ inline: 'center' })`; reduce tab padding to 8px and font to 13px on phone. Alternative: wrap to two rows on ≤ 420px.
- **Files:** `src/components/workspace/WorkspaceTabs.tsx`, `src/components/workspace/Workspace.module.css`, `src/components/ui/Tabs.tsx`.
- **Status:** Open

### MC-20
- **Route:** `/properties/new`, `/properties/:id/edit`. Screenshots: [properties-new-1280.jpg](screenshots/properties-new-1280.jpg), [property-edit-1280.jpg](screenshots/property-edit-1280.jpg), [property-edit-390.jpg](screenshots/property-edit-390.jpg).
- **Severity:** P2
- **What is wrong:** "Number of units" defaults to 0 while Type defaults to "Multi-unit building". The "ROI details · Optional" disclosure opens to three paragraphs of explanation (five on Edit: "Clear a saved field to mark it unknown…", "Sample data: 28 values are fictional…") followed by four or five collapsed sub-disclosures (Purchase & financing, Income & vacancy, …). Nothing is visible until the user opens each one. The page title has no eyebrow and sits flush with the top of the content area (unlike every other page).
- **Premium looks like:** A short form with sensible defaults (units = 1 for single-family, blank+required for multi-unit), optional sections as cards with their first three fields visible, help text as a 1-line hint plus an "ⓘ" popover.
- **Fix:** Default units to blank with placeholder "e.g. 12" and `min=1`; derive 1 and disable for single-family. Render the ROI sections as cards, each open by default with its fields in a 3-column grid; move the long explanation to a `details` labelled "How ROI details are used" at the end of the section. Use `PageHeader` (eyebrow "Properties", h1 "Add property") like other pages. The sticky Save bar gets `border-top: 1px solid var(--rr-border)` and a backdrop (FD-16).
- **Files:** `src/app/(manager)/properties/_components/PropertyRoiFields.tsx`, `src/app/(manager)/properties/_components/PropertyForm.tsx`, `src/app/(manager)/properties/new/page.tsx`, `src/app/(manager)/properties/[id]/edit/page.tsx`.
- **Status:** Open

### MC-21
- **Route:** `/properties/:id` overview. Screenshots: [property-overview-1280.jpg](screenshots/property-overview-1280.jpg), [property-overview-390.jpg](screenshots/property-overview-390.jpg) (6,317px).
- **Severity:** P2
- **What is wrong:** The overview stacks a 10-row lease timeline, a 12-row units table (every row says "Details not set"), property details, next steps, photos, documents, the full uploader, "Edit property & ROI details", "Open ROI Analysis" as two full-width outlined buttons, and an always-open "Add unit" form. The phone page is 6,317px.
- **Premium looks like:** Overview = header stats, timeline (collapsed to 5 rows + "Show all"), units table with "Add unit" as a button opening a dialog, details card, next steps; media and uploads live on their own tab.
- **Fix:** Collapse the timeline to 5 rows by default (already has "Show all 12 units"; make it the default collapsed state). Move "Add unit" into a dialog opened from the units card header. Move Photos & documents + uploader to a "Media" workspace tab. Put "Edit property" and "Open ROI analysis" in the header actions (secondary buttons), not as full-width buttons at the bottom. Replace "Details not set" with a muted "—" and an inline "Add details" link.
- **Files:** `src/components/workspace/WorkspaceOverview.tsx`, `src/components/workspace/LeaseTimeline.tsx`, `src/components/workspace/WorkspaceMedia.tsx`, `src/components/workspace/WorkspaceHeader.tsx`, `src/components/workspace/WorkspaceTabs.tsx`.
- **Status:** Open

### MC-22
- **Route:** `/properties/:id/listing` (multi-unit). Screenshot: [property-listing-1280.jpg](screenshots/property-listing-1280.jpg).
- **Severity:** P2
- **What is wrong:** The Configuration column shows "— bd · — ba" for all twelve units, the Gap column shows "+$0" rows, and every row has a 36px "See comps" secondary button (twelve identical buttons).
- **Premium looks like:** Empty data is omitted or prompts ("Add beds/baths"), zero gaps render as "—", and the row itself opens the comps.
- **Fix:** Hide the Configuration column when no unit has bed/bath data and show one banner "Add unit details to improve comps → Edit units". Render gaps with signed colour (teal for +, danger for −) and "—" for zero. Make rows clickable (`href=…/listing?unit=`) and keep a single chevron on the right instead of twelve buttons.
- **Files:** `src/components/workspace/PropertyListing.tsx`, `src/components/workspace/PropertyListing.module.css`.
- **Status:** Open

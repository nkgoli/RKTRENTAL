# Cross-cutting: forms, tables, dialogs, toasts, empty/loading/error states, motion

Evidence: every list page (Properties, Tenants, Applications, Leases, Payments, Maintenance, Documents, Returns), the dialogs reachable without writing data (Create a charge, Record payment, mobile drawer), the inline confirms (Terminate lease, Archive property, Move out), the `/ui` kit page, and the shared state components in `src/components/RouteStates.tsx` and `src/components/RouteError.tsx` (loading/error were reviewed from source; they cannot be triggered on demand).

| ID | Where | Severity | Finding | Status |
| --- | --- | :-: | --- | :-: |
| FD-01 | all list pages | P1 | Filters need "Apply filters"/"Search" buttons, and the pattern differs page to page | Open |
| FD-02 | destructive actions | P1 | Four confirm patterns (inline row, disabled + hint, bare danger button, none); no shared dialog | Open |
| FD-03 | Create charge / Record payment / New request dialogs | P2 | Text-link "Close", left-aligned primary, no Cancel, no footer | Open |
| FD-04 | app-wide | P1 | No toast system; saves either show a page banner or nothing | Open |
| FD-05 | tables | P2 | Six table styles across the app | Open |
| FD-06 | badges | P2 | Dot badges used for descriptors; uppercase and count variants | Open |
| FD-07 | disclosures | P2 | "▸ Something" `<details>` triangles are the main control on 15+ screens | Open |
| FD-08 | empty states | P2 | Three empty-state shapes (card with icon, bordered box with a sentence, bare heading) | Open |
| FD-09 | loading | P2 | Whole-page skeleton with a "Loading page…" label replaces the header | Open |
| FD-10 | error | P2 | Error boundary replaces the page; no reference id; no secondary link on manager routes | Open |
| FD-11 | motion | P2 | No transitions: drawer, dialogs and tabs snap | Open |
| FD-12 | form fields | P2 | 44px desktop inputs, inconsistent optional/required marking, helper text placement varies | Open |
| FD-13 | date inputs | P2 | Native `mm/dd/yyyy` inputs as filters with no presets | Open |
| FD-14 | focus | P2 | After some actions focus lands on the "Skip to main content" link, which then shows on screen | Open |
| FD-15 | header actions | P2 | Primary buttons use a typed "+" ("+ Add property") instead of the icon | Open |
| FD-16 | sticky form bars | P2 | Add/Edit property Save bar floats over the form with no border or backdrop | Open |

---

### FD-01
- **Where:** `/properties` (Search button), `/tenants` (Apply filters), `/applications` (Apply filters), `/maintenance` and `/properties/:id/maintenance` (Apply filters), `/documents` (Apply), `/returns` (Apply), `/leases` (Search). Screenshots: [tenants-directory-1280.jpg](screenshots/tenants-directory-1280.jpg), [maintenance-1280.jpg](screenshots/maintenance-1280.jpg), [documents-1280.jpg](screenshots/documents-1280.jpg).
- **Severity:** P1
- **What is wrong:** Every list has a different rule: Properties chips apply instantly but the search needs a button; Tenants chips apply instantly but the property select needs "Apply filters"; Documents type chips apply instantly but search/property/unit/sort need "Apply"; Maintenance needs Apply for everything; Returns range chips apply but the custom dates need Apply. Users learn a different contract per page.
- **Premium looks like:** Linear/Stripe: every control applies itself; text search debounces; the URL updates; one "Clear filters" link; a result count.
- **Fix:** Build `FilterBar` (client): `SearchField` (debounce 250ms → `router.replace`), `AutoSubmitSelect` for selects, chip toggles, and a trailing "Clear" link; delete all Apply/Search buttons. Keep server rendering by reading `searchParams`. Custom date ranges apply on blur of the second date. Show "41 tenants" as the count next to Clear.
- **Files:** new `src/components/ui/FilterBar.tsx`, `src/components/ui/SearchField.tsx`, `src/components/ui/AutoSubmitSelect.tsx`; consumers: `src/app/(manager)/properties/page.tsx`, `tenants/page.tsx`, `applications/page.tsx`, `leases/page.tsx`, `documents/page.tsx`, `src/components/maintenance/MaintenanceListControls.tsx`, `src/components/returns/RangePicker.tsx`.
- **Status:** Open

### FD-02
- **Where:** Terminate lease (inline "Terminate this lease? Confirm terminate · Cancel"), Archive property (button + red hint "1 active lease must end before this property can be archived"), Remove photo / Remove cover (bare outlined danger buttons on the property overview), Delete unit (disabled + grey hint), Move out (full-width danger button), document Delete (inside a "More actions" disclosure). Screenshots: [lease-terminate-confirm-1280.jpg](screenshots/lease-terminate-confirm-1280.jpg), [property-archive-confirm-1280.jpg](screenshots/property-archive-confirm-1280.jpg), [property-overview-1280.jpg](screenshots/property-overview-1280.jpg).
- **Severity:** P1
- **What is wrong:** Each destructive action has its own ritual, and some (Remove photo, Delete document) appear to act immediately. The design specifies one dialog: 440px, eyebrow, title with the object name, description of consequences, Cancel focused, outlined danger confirm, Escape closes, focus restored.
- **Premium looks like:** One `ConfirmDialog` everywhere, with the object named in the title ("Remove 'Lobby' photo?").
- **Fix:** Add `src/components/ui/ConfirmDialog.tsx` built on native `<dialog>` with `showModal()`, `aria-labelledby/describedby`, autofocus on Cancel, `inert` background, 120ms fade; props `{ title, description, confirmLabel, tone: 'danger' | 'primary', onConfirm }`. Replace the six patterns above; keep disabled-with-reason for truly blocked actions but render the reason as muted hint text under the button, not red.
- **Files:** new `src/components/ui/ConfirmDialog.tsx`; `src/app/(manager)/leases/[id]/page.tsx`, `src/app/(manager)/properties/_components/PropertyForm.tsx` (archive), `src/components/workspace/WorkspaceMedia.tsx` (remove photo), `src/components/units/DeleteUnitControl.tsx`, `src/app/(manager)/tenants/[id]/page.tsx` (move out), lease documents actions.
- **Status:** Open

### FD-03
- **Where:** `/properties/:id/payments` → Create a charge, Record payment; `/properties/:id/maintenance` → New request dialog. Screenshots: [property-payments-create-charge-dialog-1280.jpg](screenshots/property-payments-create-charge-dialog-1280.jpg), [property-payments-record-payment-dialog-1280.jpg](screenshots/property-payments-record-payment-dialog-1280.jpg).
- **Severity:** P2
- **What is wrong:** The 520px dialog has "Close" as a blue text link in the title row (focus lands there on open), fields stacked, and a left-aligned "Create charge" primary button as the last element with no footer separation or Cancel. The backdrop is a flat grey without the design's dialog shadow.
- **Premium looks like:** Title + 44px icon close; body; footer `Cancel · Create charge` right-aligned on a top-bordered row; focus on the first field; shadow `0 16px 40px #17243b24`.
- **Fix:** Shared `Dialog` shell (`src/components/ui/Dialog.tsx`): header (h2, icon close `aria-label="Close"`), scrollable body, footer slot; `autoFocus` first input; `max-width: 480px` (design 440px for confirms, 520px acceptable for forms); backdrop `#17243b24` with blur 2px. Use it for PaymentsBoard's three dialogs and NewMaintenanceRequestDialog.
- **Files:** new `src/components/ui/Dialog.tsx`, `src/components/workspace/panels/leasing/PaymentsBoard.tsx`, `src/components/workspace/panels/leasing/payments.module.css`, `src/components/workspace/panels/operations/NewMaintenanceRequestDialog.tsx`.
- **Status:** Open

### FD-04
- **Where:** Save note (tenant detail), Save settings (Integrations ×3), Apply to unit (rent comps), Save property, Save changes (maintenance edit), Upload complete, Send payouts. Evidence: Integrations relies on `?notice=`/`?error=` page banners (`src/app/(manager)/integrations/page.tsx`); other saves give no visible confirmation beyond a reload; no toast component exists under `src/components/ui/`.
- **Severity:** P1
- **What is wrong:** Results are either a page-level banner (which needs a reload and scroll to the top) or nothing. A manager who clicks "Save note" sees the textarea clear and must trust it worked.
- **Premium looks like:** A toast (bottom-left on desktop, above the bottom nav on phone), 4s, `role="status"`, optional action ("Undo", "View"), stacking up to 3, respects reduced motion.
- **Fix:** Add `src/components/ui/Toast.tsx` + a `ToastProvider` mounted in both shells; server actions return `{ ok, message }` and the client calls `toast.success(message)`; for pure server-rendered forms, read `?toast=` once and render the same component. Replace the Integrations and sign-in query banners with toasts (keep the signed-out notice inline since there is no shell).
- **Files:** new `src/components/ui/Toast.tsx`, `src/components/shell/ManagerShell.tsx`, `src/components/shell/TenantShell.tsx`, `src/styles/globals.css`; consumers above.
- **Status:** Open

### FD-05
- **Where:** `/payments` (avatar rows, 58px, blue amounts), `/leases` (avatar + email rows, link dates), `/tenants?view=directory` (avatar rows, dual links), `/properties/:id` units (two-line unit cell, "Open" link), `/rent-analysis` (plain 36px rows, caps status), ROI "Cash Flow & Equity Projections" (grouped rows with icons), `/ui` kit table (the intended one). Screenshots: [payments-1280.jpg](screenshots/payments-1280.jpg), [leases-1280.jpg](screenshots/leases-1280.jpg), [rent-analysis-maple-1280.jpg](screenshots/rent-analysis-maple-1280.jpg), [ui-kit-1280.jpg](screenshots/ui-kit-1280.jpg).
- **Severity:** P2
- **What is wrong:** Header labels vary between 12px grey and 13px dark; row heights 36–70px; numeric columns right-aligned in some tables and left in others; amounts sometimes links; actions as text links, outlined buttons or chevrons; captions sometimes above the table in the card header, sometimes inside.
- **Premium looks like:** One `Table` contract (design: caption, 12px muted header, row header bold, right-aligned tabular numbers, 44px rows, hover row background, one link per row).
- **Fix:** Make `src/components/ui/Table.tsx` the only table renderer: props for `columns` (`align: 'num'`), `rowHref`, `density`, `mobile: 'cards'`; move the shared CSS into `globals.css` (`.table`) and delete per-page overrides in `payments.module.css`, `leases-ux.module.css`, `tenants.module.css`, `rent.module.css`.
- **Files:** `src/components/ui/Table.tsx`, `src/styles/globals.css`, the four module files above.
- **Status:** Open

### FD-06
- **Where:** property header ("● Multi-unit"), lease detail ("● One property · one unit", "● 1 tenant"), lease payments ("● Rent"), Applications ("● CONNECTED"), Leases tabs ("Active 41" count pill), Properties chips ("All 4"). Screenshots: [lease-detail-overview-1280.jpg](screenshots/lease-detail-overview-1280.jpg), [applications-1280.jpg](screenshots/applications-1280.jpg).
- **Severity:** P2
- **What is wrong:** The dot-badge is used for status and for plain descriptors alike, so status loses meaning; "CONNECTED" is uppercase; counts render as a different pill than badges.
- **Premium looks like:** Badge = status only (Paid/Pending/Past due/Active/Draft per design); descriptors are muted text; counts are a neutral number in the tab label.
- **Fix:** Restrict `Badge` to the five design tones with sentence-case text; replace descriptor badges with `<span class="meta">`; counts in tabs as `<span class="count">` without a dot. Lint rule or code review checklist: no `Badge` without a status source.
- **Files:** `src/components/ui/Badge.tsx`, `src/components/workspace/WorkspaceHeader.tsx`, `src/app/(manager)/leases/[id]/page.tsx`, `src/app/(manager)/applications/page.tsx`, `src/components/ui/Tabs.tsx`.
- **Status:** Open

### FD-07
- **Where:** "▸ View monthly amounts" (dashboard), "▸ Manage request" (maintenance ×6), "▸ Edit terms", "▸ Record notice or move-out", "▸ More actions" (lease), "▸ Upload files" (documents), "▸ How Year 1 adds up", "▸ Exact annual cash flow…", "▸ Exact figures" (ROI, 10+), "▾ View all 12 units" (rent analysis), "▸ Purchase & financing…" (property form). Screenshots: [maintenance-1280.jpg](screenshots/maintenance-1280.jpg), [roi-summary-1280.jpg](screenshots/roi-summary-1280.jpg).
- **Severity:** P2
- **What is wrong:** Native `<details>` with the default triangle marker is used for primary actions (Manage request, Upload files, Edit terms) as well as for optional data tables. The triangle reads as a footnote toggle and is 13px blue text, below the 36/44px target sizes.
- **Premium looks like:** Buttons for actions; for optional detail, a 44px summary row with a right-aligned plus/minus (design `ls-details`).
- **Fix:** Actions (Manage request, Upload files, Edit terms, Record notice, More actions) become `Button variant="secondary"` or links that reveal a panel/dialog. Data disclosures keep `<details>` but with the design style: `summary { min-height: 44px; display: flex; font-weight: 600 } summary::after { content: '+' }` and a bordered body; hide the default marker.
- **Files:** `src/styles/globals.css` (details/summary), `src/components/ui/Feedback.tsx` (Disclosure), consumers listed above.
- **Status:** Open

### FD-08
- **Where:** Properties / Tenants / Documents no-match (card with icon, title, sentence, button), Leases "Drafts 0"/"Past 0" ("No drafts in progress." in a bordered box), Documents "Nothing uploaded for properties yet" (28px heading inside a list card), Maintenance board empty columns (nothing), Compare tab ("No reference selected" plain card), ROI chooser. Screenshots: [properties-no-match-1280.jpg](screenshots/properties-no-match-1280.jpg), [property-leases-1280.jpg](screenshots/property-leases-1280.jpg), [documents-1280.jpg](screenshots/documents-1280.jpg), [roi-compare-1280.jpg](screenshots/roi-compare-1280.jpg).
- **Severity:** P2
- **What is wrong:** Three shapes and three type sizes for "nothing here". The good one (Properties no-match) exists in `EmptyState` but is not used everywhere.
- **Premium looks like:** One component with two sizes: `size="page"` (icon, 20px title, sentence, button) and `size="inline"` (one muted sentence with an optional link) for sections inside cards.
- **Fix:** Extend `EmptyState` with `size`; use `inline` for lease groups, documents sections, kanban columns ("No requests") and compare; use `page` for list no-match. Keep copy from the design where it exists ("No active lease yet", "No properties match your search").
- **Files:** `src/components/RouteStates.tsx`, `src/components/route-states.module.css`, consumers.
- **Status:** Open

### FD-09
- **Where:** `src/components/RouteStates.tsx` `LoadingState` used by `src/app/(manager)/loading.tsx` and tenant loading boundaries; visible in the `/ui` kit ([ui-kit-1280.jpg](screenshots/ui-kit-1280.jpg), "Page states").
- **Severity:** P2
- **What is wrong:** The skeleton replaces the whole route segment including the page header, shows a spinner plus the literal text "Loading page…", and three 60px grey boxes that do not resemble any real page. On navigation the title disappears and reappears.
- **Premium looks like:** Header stays (eyebrow + title render immediately from the route), only the content area shimmers with blocks shaped like the destination (KPI row, table rows); no text label; 1.2s shimmer; `aria-busy` on the region.
- **Fix:** Move `PageHeader` into the layout so it is not part of the suspended segment; give `LoadingState` variants (`list`, `detail`, `analysis`) with proportionate blocks; replace the spinner+label with a visually hidden "Loading" status; add a `shimmer` keyframe with `prefers-reduced-motion` fallback.
- **Files:** `src/components/RouteStates.tsx`, `src/components/route-states.module.css`, `src/app/(manager)/layout.tsx`, `src/app/(manager)/loading.tsx`, `src/app/(tenant)/loading.tsx`.
- **Status:** Open

### FD-10
- **Where:** `src/components/RouteError.tsx` used by route `error.tsx` boundaries.
- **Severity:** P2
- **What is wrong:** The boundary renders "Page unavailable / Something went wrong / Try again" and, only when `homeHref` is passed, a secondary link; the error digest is logged but not shown, so support cannot correlate a report; the whole content area is replaced.
- **Premium looks like:** The header stays, the error card sits in the content area with "Try again", "Back to dashboard" and a small "Reference: a1b2c3" line.
- **Fix:** Always pass `homeHref` from the manager/tenant boundaries; render `error.digest` as "Reference" in 12px muted text; keep the design copy. Same layout change as FD-09 keeps the header.
- **Files:** `src/components/RouteError.tsx`, `src/app/(manager)/error.tsx`, `src/app/(tenant)/error.tsx`.
- **Status:** Open

### FD-11
- **Where:** manager drawer (phone), dialogs, tab switches, disclosure open/close, toast (to be added). Screenshot: [manager-drawer-open-390.jpg](screenshots/manager-drawer-open-390.jpg).
- **Severity:** P2
- **What is wrong:** The drawer, dialogs and panels appear instantly with no easing; the disclosure bodies pop; nothing in the app has motion except the native select. The design specifies `--ls-duration: 120ms` for state changes and respects reduced motion.
- **Premium looks like:** 120–160ms ease-out: drawer slides from the left with a backdrop fade; dialogs fade + 8px rise; tab panels cross-fade; toasts slide up. All disabled under `prefers-reduced-motion`.
- **Fix:** Add `@keyframes rr-fade-rise` and `rr-slide-in` in `globals.css`; apply to `dialog[open]`, `::backdrop`, the drawer panel in `ManagerShell`, and the `Toast`; `@media (prefers-reduced-motion: reduce) { animation: none }`. Keep tab switches instant but animate the underline (`transform` 120ms).
- **Files:** `src/styles/globals.css`, `src/components/shell/focus.module.css`, `src/components/shell/ManagerShell.tsx`, `src/components/ui/Tabs.tsx`.
- **Status:** Open

### FD-12
- **Where:** all forms. Screenshots: [properties-new-1280.jpg](screenshots/properties-new-1280.jpg), [maintenance-new-1280.jpg](screenshots/maintenance-new-1280.jpg), [lease-builder-step9-lessor-info-1280.jpg](screenshots/lease-builder-step9-lessor-info-1280.jpg).
- **Severity:** P2
- **What is wrong:** Desktop inputs are 44px tall with 16px text (design: 36px, 13px label, 16px text only on phone); "optional" is marked as "Phone (optional)" in some forms, "Occupants (optional)" in others and not at all on Add property (where everything after name/address is optional); helper text sits under some fields and above others ("You can add or rename units later." under Units; "Choose any day from the 1st…" under Rent due day; the ROI explanations above the fields).
- **Premium looks like:** One `Field` with label, optional tag, control, hint, error in a fixed order; 36px controls on desktop, 44px on phone; required marked by absence of "Optional".
- **Fix:** Extend `Forms.tsx` `Field` with `optional` and `hint` props and enforce the order; set `--rr-control: 36px` desktop / 44px `(max-width: 640px)`; sweep forms to use `Field`. Add property: mark the Owner/Year built/Units as Optional where they are.
- **Files:** `src/components/ui/Forms.tsx`, `src/styles/globals.css` (input sizing), the property, maintenance, tenant, lease-builder and tenant-portal forms.
- **Status:** Open

### FD-13
- **Where:** Maintenance "Created from / Created to", Returns "From / To", lease builder custom end date. Screenshots: [maintenance-1280.jpg](screenshots/maintenance-1280.jpg), [returns-1280.jpg](screenshots/returns-1280.jpg).
- **Severity:** P2
- **What is wrong:** Native `type=date` inputs show "mm/dd/yyyy" placeholders that look like disabled fields; the Maintenance filter offers no presets, while Returns offers presets but still shows two date inputs permanently.
- **Premium looks like:** Preset chips (Last 30 days, 90 days, This year, Custom) with the date pair only under "Custom".
- **Fix:** Reuse `RangePicker` for maintenance; show the two date inputs only when "Custom" is selected; style native date inputs with the `Field` border and a calendar icon; apply on change (FD-01).
- **Files:** `src/components/returns/RangePicker.tsx`, `src/components/maintenance/MaintenanceListControls.tsx`, `src/components/ui/Forms.tsx`.
- **Status:** Open

### FD-14
- **Where:** tenant Pay after "Pay $1,850", tenant Repairs after submit, ROI after closing a panel with Escape. Screenshots: [tenant-pay-confirm-1280.jpg](screenshots/tenant-pay-confirm-1280.jpg), [tenant-repairs-validation-1280.jpg](screenshots/tenant-repairs-validation-1280.jpg), [roi-charts-exit-1280.jpg](screenshots/roi-charts-exit-1280.jpg) (all show the "Skip to main content" box rendered on screen).
- **Severity:** P2
- **What is wrong:** When these interactions re-render the page, focus is lost and moves to the first focusable element, the skip link, which becomes visible as a white box over the layout. Keyboard users land at the top of the document after every action.
- **Premium looks like:** Focus stays on, or returns to, the control that triggered the change, or moves to the newly revealed region (the confirm box, the error summary).
- **Fix:** For client transitions, keep the triggering button mounted (do not swap the button for the confirm box) and call `focus()` on the revealed region's heading (`tabIndex={-1}`); for server-action re-renders, restore focus by `id` after navigation (`useEffect` with the last-focused id in `sessionStorage`); make the skip link show only on `:focus-visible`.
- **Files:** `src/styles/accessibility.css` (skip link), `src/app/(tenant)/pay/PayForm.tsx`, `src/app/(tenant)/repairs/RepairForm.tsx`, `src/components/analysis/RoiWorkspace.tsx`.
- **Status:** Open

### FD-15
- **Where:** `+ Add property`, `+ Add tenant`, `+ Record payment`, `+ New lease`, `+ Create lease`, `+ New request`, `+ Add unit`, `+ Add expense`. Screenshots: [properties-grid-1280.jpg](screenshots/properties-grid-1280.jpg), [payments-1280.jpg](screenshots/payments-1280.jpg).
- **Severity:** P2
- **What is wrong:** The plus is a typed character inside the label (varying spacing: "+ Add" vs "+Add"), the only "icon" in buttons app-wide, while the design uses an 18px stroked plus icon with an 8px gap.
- **Premium looks like:** `Button icon="plus"` with the approved icon geometry; labels without punctuation.
- **Fix:** Add `icon` prop to `Button` (renders `Icon` at 18px before the label); update `managerNav` actions and page headers to `{ label: 'Add property', icon: 'plus' }`; remove the typed "+".
- **Files:** `src/components/ui/Button.tsx`, `src/components/shell/Icons.tsx`, `src/components/shell/nav.ts`, `src/components/shell/PageHeader.tsx`, page headers that hard-code "+".
- **Status:** Open

### FD-16
- **Where:** `/properties/new`, `/properties/:id/edit`. Screenshots: [properties-new-1280.jpg](screenshots/properties-new-1280.jpg), [property-edit-390.jpg](screenshots/property-edit-390.jpg) (bar overlapping the Units field).
- **Severity:** P2
- **What is wrong:** The "Save property · Cancel" bar is `position: sticky; bottom: 0` with a plain white background and no border, so it floats over the ROI sections (desktop) and over the Units input (phone) as a hard white band; it is also indented to the card's inner edge, so it looks like part of whichever section is behind it.
- **Premium looks like:** A full-width sticky footer with `border-top: 1px solid var(--rr-border)`, 12px padding, `backdrop-filter: blur(6px)` on a translucent surface, actions right-aligned, and 80px of bottom padding on the form so the last field is never hidden.
- **Fix:** Apply the above styles to the form footer; on phone make it full-bleed with safe-area padding; alternatively move Save into the page header and drop the sticky bar.
- **Files:** `src/app/(manager)/properties/_components/PropertyForm.tsx`, `src/app/(manager)/properties/properties.module.css`.
- **Status:** Open

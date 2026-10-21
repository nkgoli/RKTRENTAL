# Leasing: lease list, builder, templates, detail and signing

Screens reviewed: `/leases` (Active, Expiring soon, Drafts, Ended), `/leases/new` (unit picker and all ten steps: Lease term, Rent/deposit/fees, Tenants, Options, Clauses, Rules, Disclosures, Attachments, Lessor info, Review & send), `/leases/templates`, `/leases/templates/:id`, `/leases/:id` (Overview, Agreement incl. terminate confirm, Documents, Payments, Activity), `/properties/:id/leases`.

What is already good: the lease detail Overview (four stat tiles, premises/tenants cards, agreement and rent summary) is the best-composed detail page in the app; the builder's step rail, "Draft saved" indicator and the Review & send scheduled-charges preview are strong. Keep them.

| ID    | Route                     | Severity | Finding                                                                                            |  Status  |
| ----- | ------------------------- | :------: | -------------------------------------------------------------------------------------------------- | :------: |
| LS-01 | /leases                   |    P1    | Every row shows View + Renew; term dates styled as links; 20 identical "Signed" badges             |  Fixed   |
| LS-02 | /leases (390)             |    P1    | List becomes 5,369px of 250px stacked cards                                                        |  Fixed   |
| LS-03 | /leases/new (390)         |    P0    | Unit picker card overflows the viewport; "Start lease" is off-screen and the page scrolls sideways |  Fixed   |
| LS-04 | /leases/new               |    P1    | Picking a unit with a saved draft silently jumps into that draft at step 10                        |  Fixed   |
| LS-05 | /leases/new step 3        |    P1    | Tenants step is a flat checklist of all 41 people in the organisation                              |  Fixed   |
| LS-06 | /leases/new               |    P2    | Step heading shows a focus-ring rectangle on every step change                                     |  Fixed   |
| LS-07 | /leases/new               |    P2    | Two headers: a sticky top bar plus an in-scroll "Create lease" title that scrolls away             | Deferred |
| LS-08 | /leases/new steps 5–7     |    P2    | The template switcher card (Reset / Save as new template) repeats on three steps                   |  Fixed   |
| LS-09 | /leases/new step 6        |    P2    | Template blanks render as yellow "_____ (aquarium gallons)" with no way to fill them in place      |  Fixed   |
| LS-10 | /leases/templates/:id     |    P1    | Template editor is one 10,156px page (11,673px on phone) with Save at the bottom                   |  Fixed   |
| LS-11 | /leases/:id               |    P2    | ✳ glyph in the page title; empty "Terms as signed" card on a signed lease                          |  Fixed   |
| LS-12 | /leases/:id?tab=payments  |    P2    | Ledger is three "Rent $1,850 Due …" rows with no paid state or balance                             | Deferred |
| LS-13 | /leases/:id?tab=agreement |    P2    | Terminate uses an inline "Terminate this lease? Confirm terminate · Cancel" row                    |  Fixed   |
| LS-14 | /leases/templates         |    P2    | "Used by 0 leases" while 41 signed leases carry a copy of the template                             |  Fixed   |
| LS-15 | /leases/:id?tab=documents |    P2    | Document cards with a Download button and "▸ More actions" disclosure each                         | Deferred |
| LS-16 | /properties/:id/leases    |    P2    | 11 rows each 70px tall with View + Renew; Drafts/Past sections render empty boxes                  |  Fixed   |

---

### LS-01

- **Route:** `/leases`. Screenshot: [leases-1280.jpg](screenshots/leases-1280.jpg).
- **Severity:** P1
- **What is wrong:** Twenty rows each carry "View" and "Renew" links. "Renew" is offered for leases that end in 14 months. The lease term ("Jan 1, 2026 – Dec 31, 2026") is blue link text, the property is also a link, so each row has four blue targets. The E-sign column repeats a "Signed" dot badge twenty times with no other value.
- **Premium looks like:** Linear issue list: the row is the link; one secondary action appears only when it applies; columns carry information, not decoration.
- **Fix:** Make rows clickable (`<tr>` wraps an `<a>` on the tenant cell plus `cursor: pointer` on the row); remove "View". Show "Renew" only on the Expiring soon tab or when `endDate − today ≤ 90 days`; elsewhere an overflow menu. Render term and rent as plain text (`--design-text`, tabular). Replace the E-sign column with a status `Badge` only when not "Signed" (Draft, Sent, Awaiting signature); for Signed show nothing or a muted check. Row height 56px.
- **Files:** `src/app/(manager)/leases/page.tsx`, `src/app/(manager)/leases/leases-ux.module.css`, `src/components/ui/Table.tsx`.
- **Status:** Fixed - Row anchors open the lease; dates and amounts are plain text, signed badges are suppressed, renewal actions appear within 90 days and other renewals use the row menu.

### LS-02

- **Route:** `/leases` at 390px. Screenshot: [leases-390.jpg](screenshots/leases-390.jpg).
- **Severity:** P1
- **What is wrong:** The table collapses to stacked cards 250px tall: "Property / unit" label, property, unit, "Lease term" label, dates, "Rent / month", amount, then View and Renew. Twenty rows = 5,369px.
- **Premium looks like:** A 72px row: avatar, name + unit on line one, "Jan–Dec 2026 · $1,650/mo" on line two, status chip right.
- **Fix:** In the Table card mode (MC-17) map lease rows to: line 1 `tenant.name` (14px/600) + `Badge`; line 2 `property · unit`; line 3 `term · $rent/mo` muted 13px. No labels, no View link (the card is the link). Page size 10 on phone with "Load more".
- **Files:** `src/app/(manager)/leases/page.tsx`, `src/components/ui/Table.tsx`.
- **Status:** Fixed - Shared table card mode shows three compact information lines without field labels or View buttons; pagination is limited to 10 leases per page at every width.

### LS-03

- **Route:** `/leases/new` at 390px. Screenshots: [lease-new-picker-390.jpg](screenshots/lease-new-picker-390.jpg), [lease-new-picker-fold-390.jpg](screenshots/lease-new-picker-fold-390.jpg).
- **Severity:** P0
- **What is wrong:** The "Which unit is this lease for?" card is 489px wide on a 390px screen (`lease-builder_cardHead` right edge = 489). The select runs off the right edge, the "Start lease" primary button is a 12px sliver at the right border, and the whole page gets a horizontal scrollbar. A manager cannot start a lease on a phone without discovering sideways scroll.
- **Premium looks like:** The card fills the viewport with 16px gutters; Cancel and Start lease stack full-width at the bottom.
- **Fix:** In `lease-builder.module.css` give the picker card `width: 100%; max-width: 640px; min-width: 0; box-sizing: border-box` and remove any fixed `width: 640px`/`min-width`; `.cardHead` and `.kicker` must not set widths; at ≤ 640px the footer row becomes `flex-direction: column-reverse; gap: 8px` with full-width buttons. Add `overflow-x: hidden` on the builder shell only after the card is fixed (so the bug cannot hide again). Add a Playwright check at 390px asserting `document.documentElement.scrollWidth === 390`.
- **Files:** `src/components/lease-builder/lease-builder.module.css`, `src/components/lease-builder/UnitPicker.tsx`, `tests/lease-create/*.spec.ts`.
- **Status:** Fixed - Picker layout and native select are constrained to the available width; card children can shrink and phone footer actions stack full width. Added a 390px overflow and button-bounds browser regression check.

### LS-04

- **Route:** `/leases/new`. Screenshots: [lease-new-picker-1280.jpg](screenshots/lease-new-picker-1280.jpg), [leases-drafts-1280.jpg](screenshots/leases-drafts-1280.jpg).
- **Severity:** P1
- **What is wrong:** With a draft already saved for Maple Court · Unit 3A, choosing that unit again and pressing "Start lease" navigates straight to `?draft=…` at step 10 of the old draft. Nothing in the picker says a draft exists, and there is no "start over".
- **Premium looks like:** The picker marks units with drafts ("Unit 3A · Draft from Oct 21") and asks: "Resume draft (step 10 of 10) · Start a new lease".
- **Fix:** Load drafts with the unit list; append "· Draft in progress" to those options. After selection show an inline card "A draft for Unit 3A was saved Oct 21 (Abigail Hayes, $1,600/mo)" with `Resume draft` (primary) and `Discard and start over` (secondary, confirm dialog). The Leases page Drafts tab keeps "Continue setup".
- **Files:** `src/components/lease-builder/UnitPicker.tsx`, `src/app/(manager)/leases/new/page.tsx`, `src/components/lease-builder/LeaseBuilder.tsx`.
- **Status:** Fixed - Units identify saved drafts. Selecting one shows its saved date and step, with explicit Resume draft and Start a separate lease choices; the latter preserves the existing draft through the existing fresh=1 flow.

### LS-05

- **Route:** `/leases/new` step 3 Tenants. Screenshots: [lease-builder-step3-tenants-validation-1280.jpg](screenshots/lease-builder-step3-tenants-validation-1280.jpg), [lease-builder-step3-tenants-selected-1280.jpg](screenshots/lease-builder-step3-tenants-selected-1280.jpg).
- **Severity:** P1
- **What is wrong:** The step lists every tenant in the organisation (41 people, alphabetical, 80px each) as checkboxes, including people who already have active leases elsewhere. Approved applicants for Unit 3A (Olivia Reed, "Ready for review" in Applications) are not surfaced. The validation banner says "Please fix the highlighted fields" but nothing is highlighted.
- **Premium looks like:** "Who is moving in?" → a search box; group 1 "Applicants for Unit 3A" (from screening, with status chip), group 2 "Existing tenants" (searchable, collapsed), plus "Add a new person" inline form. The selection shows as chips at the top with a "Primary" toggle.
- **Fix:** Query approved/ready applications for the unit and render them first with `Badge` "Approved"; render existing tenants behind a search (`SearchField`, min 2 chars) limited to 8 results; add "Add new tenant" (name + email) that creates the contact on Next. Validation: show "Select at least one tenant" under the list and set `aria-invalid` on the group; the banner text should name the field.
- **Files:** `src/components/lease-builder/steps.tsx` (Tenants step), `src/components/lease-builder/LeaseBuilder.tsx`, `src/lib` applications query.
- **Status:** Fixed - Approved and ready-for-review applications for this unit appear first; existing contacts require two search characters and are capped at eight results. Selected tenants stay visible, the primary selector remains available, and validation is linked to the selection group. New contacts use the existing tenant creation flow instead of introducing a second mutation path.

### LS-06

- **Route:** `/leases/new` every step. Screenshots: [lease-builder-step1-lease-term-1280.jpg](screenshots/lease-builder-step1-lease-term-1280.jpg), [lease-builder-step10-review-send-1280.jpg](screenshots/lease-builder-step10-review-send-1280.jpg).
- **Severity:** P2
- **What is wrong:** On each step change focus is moved to the step `<h2>`, which draws a 2px cobalt rectangle around "Lease term"/"Review & send" even for mouse users.
- **Premium looks like:** Focus moves for assistive tech without a visible ring on a non-interactive heading; the ring appears only for keyboard focus on controls.
- **Fix:** Keep `tabIndex={-1}` on the heading but add `outline: none` for `:focus` and rely on `:focus-visible` globally; or move focus to the step container (`role="group"`) with `outline: none`. Also announce "Step 2 of 10, Rent, deposit & fees" via the existing live region.
- **Files:** `src/components/lease-builder/LeaseBuilder.tsx`, `src/components/lease-builder/lease-builder.module.css`, `src/styles/accessibility.css`.
- **Status:** Fixed - Programmatic step-heading focus no longer draws a control outline; the persistent top bar announces step progress through a polite live region.

### LS-07

- **Route:** `/leases/new`. Screenshots: [lease-builder-step3-tenants-validation-1280.jpg](screenshots/lease-builder-step3-tenants-validation-1280.jpg) (inner title visible) vs [lease-builder-step4-options-1280.jpg](screenshots/lease-builder-step4-options-1280.jpg) (scrolled away).
- **Severity:** P2
- **What is wrong:** The builder has a sticky top bar ("CREATE A LEASE · Maple Court · Unit 3A · Save and exit") and, inside the scroll container, a second header ("Leasing workspace / New lease · Create lease · Build the agreement… · Draft saved") that scrolls out of view. The "Draft saved" status is therefore invisible on most steps. The scroll container also means the browser's own scrollbar never moves (scrollHeight 800).
- **Premium looks like:** One sticky bar: back, title, step progress ("Step 3 of 10"), save status, Save and exit. Content scrolls with the page.
- **Fix:** Remove the inner header; put "Draft saved · 2 min ago" (role=status) and a thin progress bar into the sticky bar. Use normal document scrolling (drop `height: 100vh; overflow: auto` on the main column) so phone browsers collapse their chrome.
- **Files:** `src/components/lease-builder/LeaseBuilder.tsx`, `src/components/lease-builder/lease-builder.module.css`.
- **Status:** Deferred - Removed the duplicate inner header and moved save status plus step progress into the sticky bar. Normal document scrolling is deferred because the focused builder currently covers and inerts the manager shell; changing that shell contract needs dedicated navigation and mobile focus checks.

### LS-08

- **Route:** `/leases/new` steps 5, 6, 7. Screenshots: [lease-builder-step5-clauses-1280.jpg](screenshots/lease-builder-step5-clauses-1280.jpg), [lease-builder-step6-rules-1280.jpg](screenshots/lease-builder-step6-rules-1280.jpg), [lease-builder-step7-disclosures-1280.jpg](screenshots/lease-builder-step7-disclosures-1280.jpg).
- **Severity:** P2
- **What is wrong:** Each of the three content steps opens with the same 130px "Lease template" card: select, "Reset to template", "Save as new template" and a two-line caveat. Then "Expand all", then 37/16/6 items each with an "Include" checkbox, a "Required by template" badge, an "Expand" link and "Included by the template" footer text.
- **Premium looks like:** The template is chosen once; later steps show a one-line "Template: Standard residential lease v2 · Change" with the counts; items are compact rows (checkbox, title, 1-line preview, chevron).
- **Fix:** Show the full template card only on Clauses; on Rules/Disclosures render a single muted line with a "Change" link that returns to Clauses. Item rows: 44px, checkbox + title (600) + "Required" tag; the preview and "Included by the template" text move inside the expanded state. "Expand all" becomes a toggle in the section header right.
- **Files:** `src/components/lease-builder/TemplateTermsStep.tsx`, `src/components/lease-builder/lease-builder.module.css`.
- **Status:** Fixed - Only Clauses shows the template switcher; Rules and Disclosures show a compact template line with Change template. Collapsed rows contain the include checkbox, title and compact status; wording and inclusion reasons appear when expanded.

### LS-09

- **Route:** `/leases/new` step 6 Rules. Screenshot: [lease-builder-step6-rules-1280.jpg](screenshots/lease-builder-step6-rules-1280.jpg).
- **Severity:** P2
- **What is wrong:** Rule 2 reads "No waterbeds, aquariums over ______ (aquarium gallons) gallons…" with the blank highlighted yellow. There is no input, no count of blanks, and nothing stops Send with blanks left.
- **Premium looks like:** DocuSign-style fill-ins: the blank is an inline input when expanded, a "2 blanks to fill" chip at the top of the step, and Review & send lists unresolved blanks as a blocker.
- **Fix:** Parse `{{placeholder}}` tokens into `<input size=6 inline>` fields inside the expanded clause; show "N blanks to fill" in the step summary; Review step shows a warning row per unresolved blank and disables "Send for e-signature" until resolved (or marks the clause excluded).
- **Files:** `src/components/lease-builder/TemplateTermsStep.tsx`, `src/components/lease-builder/steps.tsx` (Review), `src/lib` lease template placeholder parsing.
- **Status:** Fixed - Expanded terms expose persistent fill-in inputs that remain editable after the first character. Section summaries count terms with blanks; Review lists unresolved terms and disables Send until included wording is complete.

### LS-10

- **Route:** `/leases/templates/:id`. Screenshots: [lease-template-editor-1280.jpg](screenshots/lease-template-editor-1280.jpg) (10,156px), [lease-template-editor-390.jpg](screenshots/lease-template-editor-390.jpg) (11,673px).
- **Severity:** P1
- **What is wrong:** The editor renders all 37 clauses, 16 rules and 6 disclosures fully expanded with a textarea-style body, Edit/Remove per item and "+ Add" at each section end; "Apply to properties" is a right rail that scrolls away; Save is the last element on the page. Finding one clause means scrolling ten screens.
- **Premium looks like:** Notion/Google Docs settings: a sticky header with the template name, version and Save; tabs or a left index (Clauses 37 · Rules 16 · Disclosures 6 · Fees · Properties); rows collapsed to title + first line, expand to edit; reorder by drag.
- **Fix:** Sticky header (`position: sticky; top: 0`) with name field, "v2" badge, Save (disabled until dirty) and "Preview". Section tabs via `?section=` or in-page tabs; each item is a 48px accordion row (grip, title, 1-line preview, Required toggle, overflow menu) opening to the editor. Keep "Apply to properties" as the Properties tab. Add an index search ("Find clause").
- **Files:** `src/app/(manager)/leases/templates/[id]/page.tsx`, `src/app/(manager)/leases/templates/[id]/template-editor.module.css`.
- **Status:** Fixed - The existing accordion editor now displays one section at a time, including separate fees and property-default sections, with term search, single-line previews and a sticky Save disabled until edits exist. Validation opens the affected section without discarding edits; keyboard reorder controls remain available.

### LS-11

- **Route:** `/leases/:id`. Screenshots: [lease-detail-overview-1280.jpg](screenshots/lease-detail-overview-1280.jpg), [lease-detail-agreement-1280.jpg](screenshots/lease-detail-agreement-1280.jpg).
- **Severity:** P2
- **What is wrong:** The h1 "Maple Court · Unit 4B ✳" carries the decorative asterisk, as does "Lease templates ✳"; the glyph reads as a required-field marker in a manager context. The Agreement tab shows a "Terms as signed" card whose only content is "No agreement snapshot is recorded for this lease."
- **Premium looks like:** The decorative glyph is a brand touch reserved for the tenant greeting; empty cards are not rendered.
- **Fix:** Remove `✳` from manager page titles (keep it in `/home` "Welcome home" only). Hide "Terms as signed" when `snapshot == null` and add a muted line under Signature: "Signed copy: see Documents →".
- **Files:** `src/app/(manager)/leases/[id]/page.tsx`, `src/app/(manager)/leases/templates/page.tsx`, `src/components/ui/Flair.tsx`.
- **Status:** Fixed - Removed the explicit template-page flourish and empty signed-terms card; leases without snapshots link to Documents under Signature. The lease detail title already supplies only property and unit text.

### LS-12

- **Route:** `/leases/:id?tab=payments`. Screenshot: [lease-detail-payments-1280.jpg](screenshots/lease-detail-payments-1280.jpg).
- **Severity:** P2
- **What is wrong:** "Rent ledger" shows a balance tile, then three rows "Rent · $1,850 · Due Oct 1, 2026" with no paid/open status, no payment rows, no running balance, and no link per row. It is a charge list, not a ledger.
- **Premium looks like:** Stripe customer balance: Date · Description · Charge · Payment · Balance · status chip, newest first, with "Record payment" and "Export".
- **Fix:** Reuse `PaymentsBoard` ledger rendering scoped to the lease (charges and payments interleaved, running balance column, `Badge` Paid/Open/Late); header actions "Record payment" (dialog) and "Open in Payments". Show 12 months with "Show earlier".
- **Files:** `src/app/(manager)/leases/[id]/page.tsx` (payments tab), `src/components/workspace/panels/leasing/PaymentsBoard.tsx`, `src/components/workspace/panels/leasing/payments.module.css`.
- **Status:** Deferred - A complete financial ledger requires verified payment allocation/running-balance semantics and shared PaymentsBoard integration. The current scoped Payments link remains; this P2 change is not a safe presentation-only substitution.

### LS-13

- **Route:** `/leases/:id?tab=agreement`. Screenshot: [lease-terminate-confirm-1280.jpg](screenshots/lease-terminate-confirm-1280.jpg).
- **Severity:** P2
- **What is wrong:** Clicking "Terminate" swaps the button for an inline row "Terminate this lease? [Confirm terminate] [Cancel]" with no explanation of what happens (charges, tenant access, unit vacancy).
- **Premium looks like:** The design's 440px dialog: "Terminate lease for Unit 4B?", three bullets of consequences, Cancel focused, outlined danger confirm, Escape closes.
- **Fix:** Use the shared `ConfirmDialog` (FD-02) with title, description ("Ends the lease today, stops future rent charges and marks Unit 4B vacant. Payment history stays."), optional end-date field, and `Terminate lease` danger button.
- **Files:** `src/app/(manager)/leases/[id]/page.tsx` (Lease actions), new `src/components/ui/ConfirmDialog.tsx`.
- **Status:** Fixed - Lease termination now uses the shared ConfirmDialog with the property/unit in the title, Cancel-first focus and an accurate description of retained charges, payment history and documents. Existing termination action and data behavior are unchanged.

### LS-14

- **Route:** `/leases/templates`. Screenshot: [lease-templates-1280.jpg](screenshots/lease-templates-1280.jpg).
- **Severity:** P2
- **What is wrong:** The only template shows "Used by 0 leases" while 41 active leases exist and the seed states signed leases carry a copy of this template. The count measures live links, which is not what a manager reads.
- **Premium looks like:** "41 leases (snapshot v2 · 0 drafts)" or no column at all.
- **Fix:** Count leases whose snapshot references the template id/version; label "Used by 41 leases"; if the metric cannot be computed cheaply, remove the column and show it on the editor's header.
- **Files:** `src/app/(manager)/leases/templates/page.tsx`, template usage query in `src/lib`.
- **Status:** Fixed - Removed the misleading live-link usage metric from desktop and phone template lists; versions and property defaults remain visible.

### LS-15

- **Route:** `/leases/:id?tab=documents`. Screenshot: [lease-detail-documents-1280.jpg](screenshots/lease-detail-documents-1280.jpg).
- **Severity:** P2
- **What is wrong:** Three 240px cards each with a "PDF" tile, name, meta, a secondary "Download" button and a "▸ More actions" disclosure that reveals Save name / Share with tenant / Delete forms inline. The dropzone sits above the files, pushing them down.
- **Premium looks like:** A file list (icon, name, type · date · size, shared-with-tenant toggle, overflow menu) with the uploader as a compact bar or header button.
- **Fix:** Render documents with the shared `Files` list row (44px): icon, name (inline-rename on click), meta, `Switch` "Shared with tenant", overflow menu (Rename, Download, Delete → ConfirmDialog). Move the dropzone below the list or into an "Upload" header button.
- **Files:** `src/app/(manager)/leases/[id]/page.tsx` (documents tab), `src/components/ui/Files.tsx`, `src/app/(manager)/leases/[id]/lease-detail.module.css`.
- **Status:** Deferred - The file-row redesign and sharing switch require the shared file interaction work and supported document-sharing state. Existing download, rename and delete behavior is preserved in this P2 area; no nonfunctional sharing toggle was introduced.

### LS-16

- **Route:** `/properties/:id/leases`. Screenshot: [property-leases-1280.jpg](screenshots/property-leases-1280.jpg).
- **Severity:** P2
- **What is wrong:** Eleven 70px rows each with avatar, name, meta line, "Active" badge, "View" and "Renew" links; below them "Drafts 0" and "Past 0" sections render as empty bordered boxes ("No drafts in progress.", "No past leases.").
- **Premium looks like:** A compact table (unit, tenant, term, rent, status) and section headers that collapse when empty ("Past (0)").
- **Fix:** Reuse the leases Table (LS-01) scoped to the property with the unit as the first column; render empty groups as a single muted line "No drafts" without the box, or hide them with a count in the header.
- **Files:** `src/components/workspace/panels/leasing/LeasesPanel.tsx`, `src/components/workspace/panels/leasing/leases-ux.module.css`.
- **Status:** Fixed - Property lease rows have one stretched primary link, compact spacing and contextual renewal actions; empty Drafts/Past groups are plain muted lines without bordered boxes.

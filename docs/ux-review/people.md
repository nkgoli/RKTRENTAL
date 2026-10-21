# People: tenants, tenant detail, applications and screening

Screens reviewed: `/tenants` (Status view = default, Directory view, no-match, Add tenant form), `/tenants/:id`, `/applications`, `/properties/:id/applications`.

What is already good: the Directory table (avatar, email, lease end, balance, status) is close to the bar once the row actions are cleaned up; the applicant review panel's FCRA/fair-housing guardrails are clear. Keep those.

| ID | Route | Severity | Finding | Status |
| --- | --- | :-: | --- | :-: |
| PE-01 | /tenants | P1 | Default view is a 3,519px setup matrix whose cells say "Not tracked" 123 times and flags "36 need attention" | Fixed |
| PE-02 | /tenants | P1 | "+ Add tenant" scrolls to a form at the bottom of a 41-row table | Fixed |
| PE-03 | /tenants?view=directory | P2 | Lease end and property are blue links; "View Lease" twin links; "$0.00" repeated | Fixed |
| PE-04 | /tenants/:id | P2 | Payment history out of date order; lease column repeats on every row; anchor tabs look like links | Fixed |
| PE-05 | /tenants/:id | P2 | Full-width outlined danger "Move out" directly under a success banner, no confirm | Fixed |
| PE-06 | /applications | P2 | Four status styles on one screen ("Awaiting consent", "CONNECTED", "Report not run", "Ready") | Fixed |
| PE-07 | /applications | P2 | Disabled Approve/Decline look identical to enabled; gating reason is two lines of blue text | Fixed |
| PE-08 | /properties/:id/applications | P2 | "Application settings" row has no affordance; two groups both titled "Unit 3A" | Fixed |
| PE-09 | /tenants (390) | P2 | Status view 7,864px, Directory 8,749px on phone | Fixed |

---

### PE-01
- **Route:** `/tenants` (redirects to Status). Screenshots: [tenants-status-1280.jpg](screenshots/tenants-status-1280.jpg), [tenants-390.jpg](screenshots/tenants-390.jpg).
- **Severity:** P1
- **What is wrong:** Landing on Tenants shows "Tenant status: who has finished setup", then 20 cards of 80px each with six cells: Invited "Not tracked", Accepted "Not tracked", Bank added, Bank verified "Not tracked", Autopay, Card on file. The banner at the bottom admits "Invitation, acceptance and bank verification are not tracked", yet the header counts "36 need attention". Messaging and invitations buttons at the bottom say they "are not available".
- **Premium looks like:** Tenants opens on the directory; a setup view, if kept, shows only tracked facts as a compact progress column ("Autopay ✓ · Card —") with a filter "Needs payment method".
- **Fix:** Default `/tenants` to `view=directory`. In Status, remove the three untracked columns and the "Message / Resend invite" controls until they work; compute "need attention" only from tracked facts (no autopay AND no card/bank) and show it as a filter chip. Collapse each row to 44px: name, unit, "Autopay on · Bank ••••6789" or "No payment method" with a `Badge tone="warning"`.
- **Files:** `src/app/(manager)/tenants/page.tsx`, `src/app/(manager)/tenants/tenants.module.css`, `src/components/shell/nav.ts` (Tenants href).
- **Status:** Fixed - Directory is the default. Payment setup shows only tracked methods/autopay; the needs-payment-method chip counts tenants without any method or autopay.

### PE-02
- **Route:** `/tenants`. Screenshots: [tenants-directory-1280.jpg](screenshots/tenants-directory-1280.jpg) (form at y ≈ 2,300), [tenants-no-match-1280.jpg](screenshots/tenants-no-match-1280.jpg).
- **Severity:** P1
- **What is wrong:** The header's primary button "+ Add tenant" links to `#add-tenant`, an always-rendered six-field form below the table (and below the pagination). On a 41-row directory it is 2,300px down; on the Status view it does not exist at all.
- **Premium looks like:** Primary action opens a 520px dialog (or a `/tenants/new` page) with the same six fields and "Save tenant"; the list never carries a permanent form.
- **Fix:** Wrap the existing form in the `<dialog>` already used by `TenantForms` (`showModal()` on click, Escape closes, focus the name field); remove the inline card. Keep `?add=1` so the header link works without JS. After save, `Toast` "Jamie Doe added" and highlight the new row.
- **Files:** `src/app/(manager)/tenants/page.tsx`, `src/app/(manager)/tenants/TenantForms.tsx`, `src/components/shell/nav.ts`.
- **Status:** Fixed - Add tenant opens the shared dialog from ?add=1 in either view, focuses the name field, and reports a successful save by toast on the new profile.

### PE-03
- **Route:** `/tenants?view=directory`. Screenshot: [tenants-directory-1280.jpg](screenshots/tenants-directory-1280.jpg).
- **Severity:** P2
- **What is wrong:** "Dec 31, 2026" and "Harbor View Lofts / Unit 16" are blue links, so each row has four link colours; Actions column shows "View Lease" as two adjacent text links that read as one phrase; balance shows "$0.00" on 36 rows and the late rows show "$1,650.00" in red beside a "Late" badge (double encoding).
- **Premium looks like:** The row is the link; property/unit and dates are muted text; balance shows only when non-zero; one status badge.
- **Fix:** Row click → `/tenants/:id`; render property and date as `--design-muted` text; replace "View Lease" with an overflow menu (Open lease, Record payment, Message); show "—" for zero balance and keep the amount in `--design-text` with the Late badge carrying the colour.
- **Files:** `src/app/(manager)/tenants/page.tsx`, `src/app/(manager)/tenants/tenants.module.css`.
- **Status:** Fixed - Directory rows open the tenant profile; property/date and zero balances are quiet text; secondary links live in a named row menu.

### PE-04
- **Route:** `/tenants/:id`. Screenshots: [tenant-detail-1280.jpg](screenshots/tenant-detail-1280.jpg), [tenant-detail-390.jpg](screenshots/tenant-detail-390.jpg).
- **Severity:** P2
- **What is wrong:** Payment history lists Jul 3, Jun 3, May 3 … Jan 3, then Dec 3 2025, then Oct 3, Sep 3, Aug 3 2026 — not sorted. Every row repeats "Maple Court · Unit 4B / Rent · Jul 2026" though the tenant has one lease. The in-page links "Contact · Lease summary · Payments · Documents · Move-in / move-out · Notes and history" are plain blue text, indistinguishable from the other links on the page. On phone the page is 4,699px.
- **Premium looks like:** Newest-first ledger with Date · Description · Amount · Status; a pill-style section nav or none; 2-column layout collapsing cleanly.
- **Fix:** Sort by `paidAt desc`; drop the lease column when the tenant has a single lease (show it in the Lease summary card); description "Rent · Jul 2026". Style the anchor nav as `Tabs` (underline, 44px) or remove it. On phone, collapse Payment history to the last 3 with "Show all".
- **Files:** `src/app/(manager)/tenants/[id]/page.tsx`, `src/app/(manager)/tenants/tenants.module.css`.
- **Status:** Fixed - Payments sort by paidAt with createdAt fallback, single-lease descriptions omit repeated property context, section links use underlines, and phone history starts with three rows.

### PE-05
- **Route:** `/tenants/:id`. Screenshot: [tenant-detail-1280.jpg](screenshots/tenant-detail-1280.jpg).
- **Severity:** P2
- **What is wrong:** The "Move-in / move-out" card shows a teal success box "Moved in Dec 1, 2025" and, 8px below, a full-width outlined danger button "Move out" with no date field and no confirmation visible.
- **Premium looks like:** Move-out is a secondary action in the header overflow ("Record move-out…") that opens a dialog with a date and consequences.
- **Fix:** Replace the button with a `Button variant="secondary"` "Record move-out" that opens `ConfirmDialog` with a date input, a note field and "Record move-out" (danger). Keep the success box as a one-line timeline entry.
- **Files:** `src/app/(manager)/tenants/[id]/page.tsx`, `src/app/(manager)/tenants/TenantForms.tsx`, `src/components/ui/ConfirmDialog.tsx`.
- **Status:** Fixed - Record move-out is a secondary trigger using the shared confirmation and a plain move-in timeline entry. The dialog states the existing ends-today behavior; no unsupported date/note inputs were added.

### PE-06
- **Route:** `/applications`. Screenshots: [applications-1280.jpg](screenshots/applications-1280.jpg), [applications-390.jpg](screenshots/applications-390.jpg).
- **Severity:** P2
- **What is wrong:** The applicant list uses grey-dot badge "Awaiting consent", amber "Screening in progress", teal "Ready" with a subtitle "Report complete"; the detail header repeats "Awaiting consent"; the provider card shows "CONNECTED" in uppercase; the review header shows "Report not run" as a neutral badge. Four treatments for status on one screen.
- **Premium looks like:** One `Badge` scale: neutral (Awaiting consent), warning (Screening), success (Ready), danger (Declined); sentence case; the provider state is a muted line, not a badge.
- **Fix:** Map application states to `Badge` tones once in a helper (`applicationStatusTone()`); remove the "Report complete" subtitle (the badge says it); render the provider status as muted text "TransUnion SmartMove · Connected" with a 6px dot. Align with Integrations (MC-16).
- **Files:** `src/app/(manager)/applications/page.tsx`, `src/app/(manager)/applications/applications.module.css`, `src/components/ui/Badge.tsx`.
- **Status:** Fixed - Application status labels and badge tones share one helper across list/property views. Repeated report-complete copy is removed and provider connection is sentence-case muted text.

### PE-07
- **Route:** `/applications`. Screenshot: [applications-1280.jpg](screenshots/applications-1280.jpg).
- **Severity:** P2
- **What is wrong:** "Decline" and "Approve" are both rendered as secondary buttons at full opacity even though both are disabled (consent missing); "Run screening" likewise. The reason is two sentences in `--design-primary` blue ("A current FCRA consent is required…") that look like links.
- **Premium looks like:** Disabled buttons use the design's disabled style (canvas background, muted text, no shadow); the reason is a single muted line with an icon directly beneath the buttons; Approve is primary when allowed.
- **Fix:** Apply `:disabled` styles from the light system to `Button`; render the gating reason as `<p class="hint">` in `--design-muted` with an info icon; make Approve `variant="primary"` once enabled. Add `aria-describedby` from the buttons to the reason.
- **Files:** `src/app/(manager)/applications/ReviewForms.tsx`, `src/components/ui/Button.tsx`, `src/styles/globals.css`.
- **Status:** Fixed - Disabled controls are visibly muted, gating copy is neutral and associated by aria-describedby, Approve is primary when allowed, and Decline requires confirmation.

### PE-08
- **Route:** `/properties/:id/applications`. Screenshot: [property-applications-1280.jpg](screenshots/property-applications-1280.jpg).
- **Severity:** P2
- **What is wrong:** A card reads "Application settings  Organization-wide defaults · Review or edit" as one line with no link styling or chevron. Two applicant groups are both titled "Unit 3A" with "1 applicant · latest Oct 11, 2026"; nothing distinguishes the groups apart from the applicant name inside.
- **Premium looks like:** A settings row with a trailing chevron that navigates to Integrations → Screening; groups titled by applicant(s) with the unit as meta.
- **Fix:** Render the settings card as a link row (`href="/integrations#screening"`, chevron icon, hover background). Title groups "Rohan Das · Unit 3A" / "Olivia Reed · Unit 3A" with the status badge on the right; drop the duplicated "1 applicant" when there is one.
- **Files:** `src/components/workspace/panels/leasing/ApplicationsPanel.tsx`, `src/components/workspace/panels/leasing/applications-ux.module.css`.
- **Status:** Fixed - Application settings is a chevron link to screening settings. Household headings include applicant names plus unit, with single-applicant count duplication removed.

### PE-09
- **Route:** `/tenants` at 390px. Screenshots: [tenants-390.jpg](screenshots/tenants-390.jpg), [tenants-directory-390.jpg](screenshots/tenants-directory-390.jpg).
- **Severity:** P2
- **What is wrong:** Status view is 7,864px and Directory 8,749px on a phone because each tenant becomes a labelled card ("Property / unit", "Lease end", "Balance", "Status", View, Lease).
- **Premium looks like:** 64px rows (avatar, name, unit · lease end; balance/status right) and 10 per page.
- **Fix:** Apply the Table card mode (MC-17) with the two-line mapping; page size 10 below 640px; hide the "Add tenant" inline form (PE-02).
- **Files:** `src/app/(manager)/tenants/page.tsx`, `src/components/ui/Table.tsx`.
- **Status:** Fixed - Directory uses compact two-column mobile cards and ten-row pages at both widths; tracked setup rows also paginate by ten, and the inline add form is removed.

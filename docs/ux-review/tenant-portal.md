# Tenant portal: home, pay, lease, repairs

Screens reviewed as `alex.rivera@email.com`: `/home`, `/pay` (including the confirm step), `/lease`, `/repairs` (including empty-submit validation), the account menu, plus `/dashboard` and `/` as a tenant (both redirect to `/home`). Desktop captures: `screenshots/tenant-*-1280.jpg`; phone: `screenshots/tenant-*-390.jpg` (`-fold` = viewport only).

This is the area closest to the design. The rent hero, quick actions, receipts list, lease card and repair form match `Designs/rocketrental-light-system` responsive-navigation well; inputs are 16px on phone, the bottom nav reserves space and no page overflows horizontally. The findings below are refinements.

| ID | Route | Severity | Finding | Status |
| --- | --- | :-: | --- | :-: |
| TP-01 | all tenant routes (1280) | P2 | Desktop shows a 640px phone column with a fixed bottom tab bar and empty canvas either side | Open |
| TP-02 | /home, /lease | P1 | "Pay now" hero duplicates the "Pay rent" quick action; "Renewal coming up" banner repeats on two pages | Open |
| TP-03 | /pay | P1 | "Pay $1,850" reveals an inline confirm box below the form instead of at the point of action; copy says "(ach)" | Open |
| TP-04 | /pay | P2 | Two full-width "+ Add bank account / + Add card" buttons after the primary; autopay copy contradicts the selected method | Open |
| TP-05 | /repairs | P2 | Empty submit shows the browser's native "Please fill out this field" bubble | Open |
| TP-06 | /repairs, /home | P2 | Request card shows "Other" for a plumbing request; progress labels only on Home | Open |
| TP-07 | /lease | P2 | Page titled with the tenant's name; placeholder unit photos; "Preview" link + "Download" button pairs | Open |
| TP-08 | bottom nav | P2 | Active tab has tint but no top marker; icons/labels smaller than the design | Open |
| TP-09 | header | P2 | "AR" account button is 37px tall (below the 44px phone target) | Open |

---

### TP-01
- **Route:** `/home`, `/pay`, `/lease`, `/repairs` at 1280px. Screenshots: [tenant-home-1280.jpg](screenshots/tenant-home-1280.jpg), [tenant-pay-1280.jpg](screenshots/tenant-pay-1280.jpg).
- **Severity:** P2
- **What is wrong:** The portal is a 640px centred column with the phone bottom tab bar fixed at the viewport bottom; the remaining 640px of canvas is empty. On a laptop the tenant sees a phone app in the middle of the screen.
- **Premium looks like:** The same content with a top navigation row ≥ 900px (Home · Pay · Lease · Repairs under the header), a 760px column, and the home page in two columns (rent hero + quick actions left, repairs + announcements right).
- **Fix:** In `TenantShell` render the four tabs inside the header at ≥ 900px (`.topTabs`), hide `.bottomNav`; raise `max-width` to 760px; on `/home` use `grid-template-columns: 1.2fr 1fr` at ≥ 900px. Keep the phone layout unchanged.
- **Files:** `src/components/shell/TenantShell.tsx`, `src/components/shell/tenant-shell.module.css`, `src/app/(tenant)/portal.module.css`, `src/app/(tenant)/home/page.tsx`.
- **Status:** Open

### TP-02
- **Route:** `/home`, `/lease`. Screenshots: [tenant-home-390.jpg](screenshots/tenant-home-390.jpg), [tenant-lease-390.jpg](screenshots/tenant-lease-390.jpg).
- **Severity:** P1
- **What is wrong:** Home shows the rent hero with "Pay now", then a "Quick actions" grid whose first tile is "Pay rent · Bank or card · autopay" (same destination). The "Renewal coming up" banner (two lines) appears on Home and again on Lease with identical copy. Together they push the open repair request below the fold on phone.
- **Premium looks like:** One payment call to action; quick actions cover the other three destinations; a renewal notice shown once, dismissible, with an action.
- **Fix:** Quick actions = My lease · Request repair · Documents (three tiles in one row on desktop, 3-up compact list on phone). Show the renewal banner on Home only, with "Ask about renewal" (mailto/message) and a dismiss that persists in localStorage; on Lease show a one-line "Ends Nov 30, 2026 · renewal pending" meta under the term instead.
- **Files:** `src/app/(tenant)/home/page.tsx`, `src/app/(tenant)/lease/page.tsx`, `src/app/(tenant)/portal.module.css`.
- **Status:** Open

### TP-03
- **Route:** `/pay`. Screenshots: [tenant-pay-1280.jpg](screenshots/tenant-pay-1280.jpg), [tenant-pay-confirm-1280.jpg](screenshots/tenant-pay-confirm-1280.jpg).
- **Severity:** P1
- **What is wrong:** Tapping "Pay $1,850" does not pay; it reveals a "Confirm payment" box below the amount field ("Pay $1,850 by bank transfer (ach) — $1,850 in total?") with Confirm payment / Back. On phone the box appears under the fold and the primary button the tenant just pressed disappears, so the screen looks unchanged until they scroll. The method name is lowercase "(ach)". After the click the page re-renders and focus lands on the skip link (visible "Skip to main content" box in the capture).
- **Premium looks like:** The design's "Confirm payment" dialog: a bottom sheet on phone / centred modal on desktop at the moment of tapping Pay, showing method, amount, fee, "Pay $1,850" primary and Cancel, focus on Cancel, Escape closes, focus returns to the Pay button.
- **Fix:** Render the confirm step in a `<dialog>` (`showModal()`) styled as a bottom sheet ≤ 640px; copy "Pay $1,850 by bank transfer (ACH)?" with a two-row summary (Amount, Fee, Total); on success close and show a `Toast` "Payment of $1,850 submitted" plus the receipt row at the top of "Recent receipts"; restore focus to the trigger.
- **Files:** `src/app/(tenant)/pay/PayForm.tsx`, `src/app/(tenant)/pay/page.tsx`, `src/app/(tenant)/pay/pay.module.css`.
- **Status:** Open

### TP-04
- **Route:** `/pay`. Screenshot: [tenant-pay-390.jpg](screenshots/tenant-pay-390.jpg).
- **Severity:** P2
- **What is wrong:** After the primary button: "+ Add bank account (Mock bank ••••6789)" and "+ Add card (Mock card ••••4242)" as two full-width secondary buttons, then an Autopay card that says "Add a payment method above, then turn on autopay" although a bank method is selected.
- **Premium looks like:** A single "Add a payment method" link under the method list; autopay copy that reflects state ("Turn on autopay with Bank ••••6789").
- **Fix:** Collapse both buttons into one link "Add a payment method" that opens a chooser (Bank / Card); make the autopay subtitle conditional on `selectedMethod`; move the Autopay card above "Recent receipts" but below the method list.
- **Files:** `src/app/(tenant)/pay/PayForm.tsx`, `src/app/(tenant)/pay/AutopayToggle.tsx`, `src/app/(tenant)/pay/pay.module.css`.
- **Status:** Open

### TP-05
- **Route:** `/repairs`. Screenshot: [tenant-repairs-validation-1280.jpg](screenshots/tenant-repairs-validation-1280.jpg).
- **Severity:** P2
- **What is wrong:** Submitting the empty form shows the browser's native yellow bubble "Please fill out this field" on the textarea; the manager app elsewhere uses a red summary box and inline text. "0 of 5 photos" sits as a stray line below the dropzone; the comment field label repeats the request name ("Comment on Kitchen sink leak").
- **Premium looks like:** Inline error under the field ("Describe what needs fixing so the vendor can prepare.") with `aria-invalid` and a danger border, consistent with the design's form spec.
- **Fix:** Add `noValidate` and custom validation in the form component; render the error with the shared `Field` error slot; move "0 of 5 photos" into the dropzone subtitle ("JPG, PNG or HEIC · up to 5 photos"); label the comment field "Add a comment".
- **Files:** `src/app/(tenant)/repairs/RepairForm.tsx`, `src/app/(tenant)/repairs/repairs.module.css`, `src/components/ui/Forms.tsx`, `src/components/upload/FileUploader.tsx`.
- **Status:** Open

### TP-06
- **Route:** `/repairs`, `/home`. Screenshots: [tenant-repairs-390.jpg](screenshots/tenant-repairs-390.jpg), [tenant-home-390.jpg](screenshots/tenant-home-390.jpg).
- **Severity:** P2
- **What is wrong:** The tenant's open request "Kitchen sink leak" is captioned "Other · Submitted Oct 21" though it is a plumbing issue (the category is lost or defaulted); its progress bar shows "Received → Scheduled → Done" labels on Home but only an unlabelled bar on Repairs; the attached photo is a 270px gradient placeholder.
- **Premium looks like:** The same request card on both screens: category, submitted date, 3-step labelled progress, 96px thumbnail.
- **Fix:** Extract a `RepairRequestCard` used by both pages; display `request.category` (fall back to "General" not "Other"); show the three step labels everywhere; thumbnails at 96 × 96 with a lightbox.
- **Files:** `src/app/(tenant)/repairs/page.tsx`, `src/app/(tenant)/home/page.tsx`, new `src/app/(tenant)/_components/RepairRequestCard.tsx`.
- **Status:** Open

### TP-07
- **Route:** `/lease`. Screenshots: [tenant-lease-1280.jpg](screenshots/tenant-lease-1280.jpg), [tenant-lease-390.jpg](screenshots/tenant-lease-390.jpg).
- **Severity:** P2
- **What is wrong:** The h1 is "Alex Rivera ✳ · Managed by Jordan Mills" rather than the lease; "Current lease · Documents (2) · Unit photos" are plain blue text links as a pseudo-tab row; each document has a text "Preview" link next to an outlined "Download" button; the unit photos are gradient placeholders with a "Living room" label.
- **Premium looks like:** h1 "Your lease" (design: "Current lease" card), section nav as tabs or none, icon buttons for preview/download, real photos.
- **Fix:** Title "Your lease" with "Maple Court · Unit 4B" as the meta; render the three links as `Tabs`; document actions as two 44px icon buttons (eye, download) with `aria-label`; use `object-fit: cover` images from `/lease/photos/:id` and a neutral "Photo unavailable" tile when absent.
- **Files:** `src/app/(tenant)/lease/page.tsx`, `src/app/(tenant)/portal.module.css`, `src/components/ui/Files.tsx`.
- **Status:** Open

### TP-08
- **Route:** bottom navigation on all tenant routes. Screenshot: [tenant-home-fold-390.jpg](screenshots/tenant-home-fold-390.jpg).
- **Severity:** P2
- **What is wrong:** The active tab has a tinted rounded box; the design specifies a 3px top marker plus tint and bold label. Icons render at 20px and labels at 12px regular; the design uses 18px icons with 12px/600 labels and a 52px minimum height. The tint box also has rounded corners on all sides so it floats inside the bar.
- **Premium looks like:** Design `ls-bottom-nav a[aria-current]`: top marker, tint, 600 weight.
- **Fix:** Add `border-top: 3px solid var(--design-primary)` on the current tab, `border-radius: 0 0 8px 8px`, `font-weight: 600`; set icon size 18px; keep `min-height: 52px` and the safe-area padding.
- **Files:** `src/components/shell/tenant-shell.module.css`, `src/components/shell/TenantShell.tsx`.
- **Status:** Open

### TP-09
- **Route:** tenant header. Screenshot: [tenant-home-fold-390.jpg](screenshots/tenant-home-fold-390.jpg).
- **Severity:** P2
- **What is wrong:** The "AR" avatar button is 37 × 37px (measured) and the "RocketRental home" logo link 39px; the design asks for 44px touch targets on phone; the sign-out menu it opens is the only account surface.
- **Premium looks like:** 44px targets; the menu shows name, unit and "Sign out".
- **Fix:** Set `min-width/min-height: 44px` on the avatar button and logo link (keep the 28px visual avatar centred); menu content "Alex Rivera · Maple Court · Unit 4B" + Sign out.
- **Files:** `src/components/shell/AccountMenu.tsx`, `src/components/shell/tenant-shell.module.css`.
- **Status:** Open

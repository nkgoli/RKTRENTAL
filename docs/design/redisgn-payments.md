# Redisgn payments — rent roll, ledger and reminder review handoff

Design: `Designs/redisgn` (block design). Screens owned here and their last verified saves:

| Screen | Device | Saved at revision | Checked with `design_screenshot` |
| --- | --- | --- | --- |
| `payments` (Payments & rent roll) | desktop 1280 px | 53 | rev 53 |
| `payments-mobile` | phone 390 px | 46 | rev 46 |
| `ledger` (Rent ledger & reminder review) | desktop 1280 px | 50 | rev 50 |
| `ledger-mobile` | phone 390 px | 48 | rev 48 |

The design revision number moves fast because other Tasks write their screens in parallel. No tokens, shared components
or other screens were changed.

## 1. What the live app shows (Edge, 2026-10-21)

The review used the human's signed-in Edge tab at `localhost:3100`. It was read-only: no payment, charge, late fee or
reminder was created, previewed or sent. The tab was put back on `/dashboard`.

- **`/payments`**: Payment reminders / Payment settings / + Record payment. KPI cards: Collected $60,390 (payments
  received in October 2026), Outstanding $13,240 (8 open balances, all charges due to date) and Late $4,950 (3 past
  grace, includes posted late fees). October 2026 rent roll with Prev / This month / Next, chips All 41 / Paid 33 /
  Open 8 / Late 3, the late/outstanding definition, Rows per page 25, and Tenant / Property / Rent / Status / Action
  columns.
- **Row "…" menu** (opened on Chloe Fisher, then closed with Esc): Open ledger, Send late-rent reminder, Add late fee.
  The human's reference shows the old menu overlapping the next rows. The redesign draws it unclipped.
- **`/notifications` (Payment reminders)**: "Choose a lease · 8 overdue". The 8 overdue leases are Cedar Row
  Townhomes 1–7 at $1,650.00 each and 18 Elm Street (Sam Wilson) at $1,690.00, totalling $13,240. Selecting Chloe
  Fisher shows:
  - "Overdue · all dates $1,650.00 · As of 2026-10-22 UTC", with remaining rent $1,650.00 and assessed late fees $0.00;
  - "Shared lease balance. No new fees are added by this reminder.";
  - Reminder history, which is a persistent record of the latest 100 sends and reads "No reminders submitted for this
    lease.";
  - the composer: Email / Text message (SMS), "Sandbox · not delivered", a recipient checkbox with the email on file,
    an editable subject and message (up to 2,000 characters), and "Preview reminder — Preview first, then confirm
    the send."
- **Human references.** `input:2a621558…` is the preferred lease Payments tab: a Balance due $1,690.00 / Last payment
  Sep 3, 2026 band above dated Rent rows. `input:c5d8357c…` is the 18 Elm Street property Payments tab: Sandbox
  payments / Settings / Create a charge / Record payment, and a 12-charge ledger for Jan–Sep paid, Oct late
  ($1,690.00 balance) and Nov–Dec scheduled. `input:fc69b18e…` is the clipped rent-roll menu.

**Data inconsistency (recorded, not repeated).** The rent roll labels Sam Wilson "Autopay", but the property ledger
marks his October charge "Late" with a $1,690.00 balance, and the reminder list counts it as overdue. The ledger screen
shows both facts and explains them, instead of picking one.

## 2. Changed visual hierarchy

- **One gradient band per screen** (the foundation rule). On Payments it holds Collected $60,390 of $73,630 with an
  82% bar and "Review balances". White stat cards for Outstanding $13,240 and Late · past grace $4,950 keep the two
  meanings apart. On the Ledger it holds **Balance due $1,690.00**, with Last payment Sep 3, 2026 and Credit on account
  $0.00 beside it, so balance due and credit are never merged.
- **Sandbox truth up front.** An info Alert reads "Sandbox payments · bank payouts not connected" and says that
  receiving-bank (owner payout) settings are placeholders. The Ledger scope bar carries a "Sandbox payments" badge.
  Nothing implies money reaches a bank.
- **Rent roll rows** use a 2:1:1 grid: tenant and property, then rent with its two-decimal balance and status badge,
  then the action. Late rows keep "Record payment" visible. The "More" menu is drawn in flow beside an "Open charges on
  this lease" summary, so it is never clipped.
- **Ledger** keeps the preferred lease-ledger reading order: band, then dated rent rows. Each row shows the charge
  name, its due date, a status badge, the amount and the balance. The late row is tinted, and only its balance is red.
  Jan–Jun are folded into an accordion with their totals. Charges / Payments / All activity tabs keep the full history
  one tap away. The footer gives term-to-date totals: $16,900.00 charged, $15,210.00 paid, $1,690.00 due.
- **Scope** is explicit: Property / Unit / Lease tabs and a Lease term select (Current · Jan 1 – Dec 31, 2026, or
  Ended terms), plus Active lease and Sandbox badges.
- **Mobile** uses the foundation app bar and the shared tab bar. The ledger's app bar is a "← Payments" back button.
  Stat cards scroll sideways on purpose, rows stack two lines (who and amount, then balance and actions), and the
  confirm step is a full-width dialog.

## 3. Representative states shown

- Rent roll statuses: Late (danger), Autopay (info, "Autopay scheduled"), Paid (positive, "Paid Oct 3"). Ledger
  statuses: Scheduled (neutral), Late, Paid.
- Row action menu open, with Open ledger, Send late-rent reminder and Add late fee (all lead to the ledger review).
- Reminder review:
  - an ink summary ("Remind Sam Wilson about $1,690.00 … No new fees are added");
  - Steps: Balance → Message → Recipients → Confirm;
  - the channel radio and the "Sandbox · not delivered" warning;
  - the recipient checkbox, and the subject and message fields;
  - Preview / Cancel buttons;
  - a confirm dialog with "Record sandbox send" / "Back to edit".
- Reminder history in its true empty state ("No reminders submitted for this lease."), with a note that sandbox
  attempts are listed as "Sandbox · not delivered" and live sends show each recipient's recorded outcome.

## 4. Workflow preservation

- Charge and payment actions stay: Record payment (header and late rows), Create a charge (ledger), Add late fee
  (menu), and Payment settings.
- Reminders stay an explicit, reviewed action: the rent roll menu and "Payment reminders" lead to the ledger review,
  never straight to sending. Home's "Review balances" link already points to `ledger`.
- Money keeps cent precision wherever a balance is stated. Rent-roll rent keeps the app's whole-dollar style.
- Navigation: `payments` ↔ `ledger` (breadcrumb, buttons, menu, row link); `payments-mobile` ↔ `ledger-mobile`
  (Reminders button, menu, row link, app-bar back button). The ledger breadcrumb's "18 Elm Street" goes to
  `property`.

## 5. Limitations and requests

- The ledger example uses 18 Elm Street / Sam Wilson, because that is the only lease whose full 12-month history was
  observed. Chloe Fisher's figures appear only where they were seen. "Payments 9" assumes one payment per paid month.
  The exact reminder message was shortened to fit the field (one line, 120 characters at most).
- The reminder preview, the confirm step and the sandbox history entry were **not** triggered in the live app, so the
  confirm dialog's wording is a design proposal.
- No phone-width "before" capture (see the foundation limitation). Screenshots stay local and are not committed
  because of the repository size cap.
- **Shared component request (not applied).** The rail and tab bar still render the shared components as underlined
  links with no active state. This screen set would benefit from the foundation's proposed
  `mobile-navigation`/`desktop-navigation` update (an active "Payments" tab). That needs manager approval.

# Tenant help

Sign in at `/sign-in` with the email your manager invited (in the demo seed:
`alex.rivera@email.com`). Tenants land on `/home` with their lease, balance
and open requests at a glance. The tenant pages are designed for phones.

## Paying rent (`/pay`)

- See your current balance, what is due and when, and your payment history.
- Add a card or bank account (ACH) payment method using the provider's
  secure fields — never email card or bank numbers to your manager.
- Pay in full or in part; a card payment confirms immediately, an ACH
  payment shows as pending until the bank settles it (a few business days).
- Turn on autopay to charge your saved method automatically on the due date;
  you can turn it off at any time before that day's charge runs.
- A failed payment keeps your balance unchanged and tells you why (for
  example an expired card). Update the method and pay again; late fees
  follow the terms on your lease page.

## Your lease (`/lease`)

Review the lease term, monthly rent, deposit, grace period and clauses, sign
documents sent for e-signature, and download your lease documents. Occupants
and notice/move-out dates your manager records also appear here.

## Repairs (`/repairs`)

- Report a problem with a title, a description and a priority; add a photo
  when it helps (for example a leak or a damaged fitting).
- Follow the status as your manager assigns a vendor and completes the work:
  New -> Assigned -> In progress -> Done.
- Mark an issue urgent only for safety or habitability problems (no water,
  no heat, security) so managers can triage correctly.

## Notifications

Rent-due, late-rent, repair-update and lease-renewal notices are recorded in
the notification outbox; in sandbox/demo deployments they are not emailed.
You can switch email notifications off on your account if your deployment
has them enabled.

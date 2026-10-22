# Rent ledger (lease, unit and property Payments)

One presentation and one set of numbers for every Payments scope. The lease page's Rent ledger was
the preferred reference; the property and unit Payments tabs now use the same card instead of the
older "Charge ledger" table.

## Shared pieces

- `src/components/payments/RentLedger.tsx`: `RentLedger` (title, explicit scope line, actions,
  the **Balance due | Last payment** summary panel) and `RentLedgerRows` (quiet rows: type pill,
  description, "Due Mon D, YYYY", status pill, amount with "$x left" when partly paid, **Details**).
- `src/components/payments/ledger-view.ts`: serializable row view, status pills and date format.
- `src/lib/ledger/property-ledger.ts`: `leaseLedger()` is the one statement used by the lease page,
  and `loadPropertyLedger()` builds each group with it, so a lease reads the same in every scope.

## Terminology

| Before (property)                        | Now (all scopes)                                     |
| ---------------------------------------- | ---------------------------------------------------- |
| Charge ledger                            | Rent ledger                                          |
| Current balance                          | Balance due (Credit on account when negative)        |
| (none)                                   | Last payment: date and amount, settled payments only |
| Balance: $x under every amount           | "$x left" only when partly paid                      |
| View                                     | Details                                              |
| Payment reminders & history (above card) | Reminders & history (card action)                    |

Statuses are shared: Paid, Partially paid, Late, Due, Scheduled.

## Scope rules

- The scope line says what Balance due covers, for example `Whole property · 1 active lease`,
  `Townhome 1 · 1 active lease · 1 ended lease`, `All 8 units · 7 active leases` or
  `This lease only · Townhome 1 · Jan 2026 – Dec 2026`.
- Balance due and Last payment cover the active leases in scope. Ended and terminated leases stay
  listed as collapsed groups with their own balance. If they still carry a balance, a note
  states the amount instead of hiding it.
- Rows are newest first and nothing is truncated. The lease tab shows the full statement, including
  scheduled rent and assessed fees, not a three-row excerpt.
- A multi-unit property without a unit filter keeps the per-unit balance table (stacked cards
  at 390px) inside the same card. The table total equals Balance due. Units whose leases have all
  ended stay listed last with an **Ended** status, the previous tenant and "$x on ended lease"
  (or "$x credit on ended lease"); that amount never joins Balance due or the total. Two ACTIVE
  terms on one unit stay one row whose balance is the sum of both.
- Every lease term lists its **Payment history** (date, method, reference, Received/Pending/Failed/
  Refunded, and any credit not applied to a listed charge). It is folded under the charges, and open
  when the term has no charges, so payment-only history reads "No charges on this lease · $x credit."
  instead of disappearing. Group headings say "Credit $x" when payments exceed charges.
- Charge Details name the lease term (heading and period) so the term stays identifiable.

## Actions

- Property/unit: Create a charge (primary), Record payment, Reminders & history, Settings, row
  selection with "Record payment for selected" and per-row Details (applied payments).
- Lease: Record payment (opens the unit/property Payments with the dialog) and a trailing-arrow
  link to the unit/property Payments for charges and reminders. The link carries lease=<id>; the
  dialog preselects exactly that lease when it is ACTIVE in the scope. A stale, ended or foreign id
  shows a warning and an empty, required lease choice; it never falls back to another lease. With
  several active terms and no target nothing is preselected, and options read
  "Unit · Tenant · Period". The server action also accepts only an ACTIVE lease in the scope.

Equivalent-scope regressions: `tests/ledger/rent-ledger-scope.test.ts`. Component behaviour:
`tests/payments/rent-ledger.test.tsx`. Browser proof (1280px and 390px, isolated database on port 55434):
`tests/ledger/ledger-history.spec.ts` with `tests/ledger/ledger-review-fixtures.ts`.

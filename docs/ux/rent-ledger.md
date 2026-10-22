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
  at 390px) inside the same card. The table total equals Balance due.

## Actions

- Property/unit: Create a charge (primary), Record payment, Reminders & history, Settings, row
  selection with "Record payment for selected" and per-row Details (applied payments).
- Lease: Record payment (opens the unit/property Payments with the dialog) and a trailing-arrow
  link to the unit/property Payments for charges and reminders.

Equivalent-scope regressions: `tests/ledger/rent-ledger-scope.test.ts`. Component behaviour:
`tests/payments/rent-ledger.test.tsx`.

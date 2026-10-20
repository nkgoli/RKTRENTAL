# Actual returns contract (v1)

Recorded, period-scoped returns for **one property**, for comparison with ROI projections.
It reads the rent ledger and expense records only, never writes, and never fills a gap with
an assumption. The existing returns screen (`computeReturns` / `loadReturnsOverview` in
`src/lib/returns/core.ts` and `queries.ts`) is unchanged; it still defaults debt service to 0
and appreciation to 3%/yr, and those defaults must not be presented as actual results.

## Entry points

| Import                                                 | Use                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `actualReturnsService(session, prisma, now?)` (server) | `.load({ propertyId, from, to })` → `ActualReturnsResult`                                                             |
| `computeActualReturns(input)` (pure)                   | Builds `ActualReturns` from already-scoped rows; no clock or database                                                 |
| `actualPeriod(from, to)` / `actualPeriodFromRange(p)`  | Validates inclusive `YYYY-MM-DD` bounds; reuses a returns-screen `ResolvedPeriod`                                     |
| Types                                                  | `ActualReturns`, `ActualAmount`, `Coverage`, `DerivedMetric`, `Estimate`, `ClassifiedReceipt`, `ActualReturnsFailure` |

All are exported from `@/lib/returns`; the pure module is `@/lib/returns/actual` (browser-safe:
it imports only types). The session must be the trusted server session from
`requireManagerRole()`; only `MANAGER` is allowed. The organization always comes from the
session; an `organizationId` in the request body is ignored. Suggested action for the UI task
(in `src/app/(manager)/…/actions.ts`, outside this module's paths):

```ts
'use server';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { actualReturnsService } from '@/lib/returns/actual-service';

export async function loadActualReturnsAction(request: unknown) {
  return actualReturnsService(await requireManagerRole(), db).load(request);
}
```

Failures are `{ ok: false, code }`: `FORBIDDEN` (non-manager or empty organization),
`NOT_FOUND` (identical for absent, archived and other organizations' properties) and
`INVALID` with `issues: { path: 'propertyId' | 'from' | 'to', message }[]`. Database errors
propagate; they are never disguised as missing data. DTOs are plain JSON (ISO strings, numbers).

## Units, period and accounting basis

- **Money is integer cents of a single currency, `currency: 'USD'`, `unit: 'cents'`.** Decimal
  dollar columns are converted once with `toCents` (no float drift). The ROI engine works in
  dollars: divide by 100 exactly once when comparing.
- **Ratios are fractions** (`0.053` = 5.3%).
- **Period**: `from`/`to` are inclusive UTC calendar days, stored half-open
  `[from 00:00Z, to + 1 day 00:00Z)`. A receipt at `to` 23:59:59Z counts; one at the next
  midnight does not. Bounds are validated, never clamped or swapped; at most 50 years.
  `wholeMonths` is set when the range is whole calendar months, else `null`.
- **As-of**: days after `now()` are not observable; coverage reports them as a gap.
- **Basis: cash.** Income is dated by `Payment.paidAt`, expenses by `Expense.occurredOn`.
  Rent billed in the period is reported separately under `scheduled.billedRent`.

## Source decisions

| Source                                | Decision                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Payment` (SUCCEEDED)                 | Rows have no category (see `docs/analysis/data-contract.md`). Each receipt is classified by replaying the ledger's settlement rule (`computeBalance`: oldest charge first, RENT < DEPOSIT < LATE_FEE < OTHER on a due date) payment by payment in `paidAt` order over the lease's full history. Totals per charge equal `computeBalance`'s allocation (tested).            |
| Classification                        | `rent`: wholly applied to RENT charges → **confirmed rent**. `otherIncome`: wholly LATE_FEE/OTHER. `deposit`: wholly DEPOSIT (liability, not income). `mixed`: spans kinds or credit. `unapplied`: nothing to settle (e.g. charges not generated yet). Mixed and unapplied receipts are **never labelled rent**; `mixedReceipts.allocatedRentCents` is informational only. |
| `Payment` PENDING / FAILED / REFUNDED | Excluded from income; summarized in `income.excluded`. Partial refunds already shrink the SUCCEEDED row (ledger rule), so receipts are net of refunds. Settled rows without `paidAt` belong to no period (`undatedCount`).                                                                                                                                                 |
| `Charge` RENT due in period           | `scheduled.billedRent`: billed, not collected.                                                                                                                                                                                                                                                                                                                             |
| `Expense`                             | Summed per category in SQL over the **full** period (no 1000-row cap, unlike the analysis draft facts). Manually entered; completeness is not verified.                                                                                                                                                                                                                    |
| `Property.loanAmount`                 | Explicit `0` is the only recorded statement of no debt → actual debt service `zero`.                                                                                                                                                                                                                                                                                       |
| `Property.annualDebtService`          | A schedule, not a payment record: only `scheduled.debtService` (prorated months÷12 or days÷365). Its column default `0` is **not** treated as no debt unless the loan amount is explicitly 0.                                                                                                                                                                              |
| `purchasePrice`, `downPayment`        | Denominators only. Cash invested = down payment, or the price when the loan amount is explicitly 0.                                                                                                                                                                                                                                                                        |
| Never used                            | Appreciation, projected/forecast rent (`roiInputs`), listed/market rent, vacancy, assumed debt, zero-filled expenses (`excludedAssumptions`).                                                                                                                                                                                                                              |

## Observations and coverage

`ActualAmount.status` keeps three cases distinct:

- `recorded`: rows exist; `cents` is their sum.
- `zero`: `cents: 0` from an explicit observation: the ledger covers the period and shows no
  receipts of that class (rent billed, nothing collected), a zero-sum expense row, or an explicit
  zero loan amount.
- `unavailable`: `cents: null` plus `reason`. Render "—"/"Not recorded", **never 0**. Absence of
  expense rows is always `unavailable`.

`coverage` = `{ status: complete | partial | none, observedDays, periodDays, recordedFrom,
recordedTo, gaps[] }`. The ledger window starts at the earliest non-draft lease start, charge or
settled payment; the expense window at the earliest expense ever recorded; both end at as-of.
Rent coverage is also `partial` when any receipt in the period is mixed or unapplied. Gaps
between leases inside the window are treated as observed vacancy.

## Derived metrics

`DerivedMetric = { status: derived | partial | unavailable, value, unit: cents | ratio, missing[] }`.
A missing input makes the value `null` and is listed; incomplete coverage keeps the value with
`status: 'partial'` and lists why.

| Metric (period, not annualized) | Formula / requirement                                                           |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `actual.operatingIncome`        | confirmed rent + other income (needs rent not unavailable)                      |
| `actual.noi`                    | operating income − recorded expenses (needs expenses recorded or zero)          |
| `actual.cashFlow`               | NOI − actual debt service (only with explicit zero loan; otherwise unavailable) |
| `actual.expenseRatio`           | expenses ÷ operating income (needs positive income)                             |
| `actual.periodCapRate`          | NOI ÷ purchase price                                                            |
| `actual.periodCashOnCash`       | cash flow ÷ cash invested                                                       |

Separately labelled, never mixed into `actual`: `scheduled.billedRent`, `scheduled.debtService`
(`basis: 'scheduled'`), `estimates.cashFlowAfterScheduledDebt` (`scheduled`),
`estimates.annualizedNoi` and `estimates.annualizedCapRate` (`basis: 'annualized'`, ×12÷months
or ×365÷days, no seasonality adjustment).

## Examples (abridged)

Complete (Jan–Mar 2026, three on-time rents, two expense categories, financed):

```json
{
  "currency": "USD",
  "unit": "cents",
  "accountingBasis": "cash",
  "period": { "from": "2026-01-01", "to": "2026-03-31", "days": 90, "wholeMonths": 3 },
  "income": {
    "confirmedRent": {
      "status": "recorded",
      "cents": 450000,
      "coverage": { "status": "complete", "observedDays": 90, "periodDays": 90, "gaps": [] },
      "sources": [{ "source": "payment", "ids": ["p1", "p2", "p3"], "count": 3 }]
    }
  },
  "expenses": { "total": { "status": "recorded", "cents": 150050 } },
  "debtService": {
    "actual": {
      "status": "unavailable",
      "cents": null,
      "reason": "Loan payments are not recorded; see scheduled debt service."
    }
  },
  "actual": {
    "noi": { "status": "derived", "value": 299950, "unit": "cents", "missing": [] },
    "cashFlow": { "status": "unavailable", "value": null, "missing": ["actualDebtService"] }
  },
  "scheduled": { "debtService": { "basis": "scheduled", "value": 450000 } },
  "estimates": { "annualizedNoi": { "basis": "annualized", "status": "derived", "value": 1199800 } }
}
```

Partial (deposit + rent in one receipt, a credit, lease starting mid-period):

```json
{
  "income": {
    "confirmedRent": {
      "status": "recorded",
      "cents": 240000,
      "coverage": {
        "status": "partial",
        "gaps": ["2 receipt(s) could not be classified as rent (mixed or unapplied)."]
      }
    },
    "mixedReceipts": { "status": "recorded", "cents": 160000, "allocatedRentCents": 60000 },
    "unappliedReceipts": { "status": "recorded", "cents": 40000 }
  },
  "actual": {
    "noi": {
      "status": "partial",
      "value": 94950,
      "missing": [
        "Rent coverage is partial",
        "mixed receipts are excluded from income until classified",
        "unapplied receipts are excluded from income until classified"
      ]
    }
  }
}
```

Unavailable (no lease, charge, payment or expense for the property/period):

```json
{
  "income": {
    "confirmedRent": {
      "status": "unavailable",
      "cents": null,
      "coverage": {
        "status": "none",
        "gaps": ["No lease, charge or payment is recorded for this property."]
      }
    }
  },
  "expenses": { "total": { "status": "unavailable", "cents": null } },
  "actual": {
    "noi": { "status": "unavailable", "value": null, "missing": ["confirmedRent", "expenses"] }
  }
}
```

Zero (rent billed but nothing collected; explicit zero loan):

```json
{
  "income": {
    "confirmedRent": { "status": "zero", "cents": 0, "coverage": { "status": "complete" } }
  },
  "scheduled": { "billedRent": { "status": "recorded", "cents": 450000 } },
  "debtService": { "actual": { "status": "zero", "cents": 0 } }
}
```

## UI integration guidance

- Request one property and an explicit range; reuse the screen's chips with
  `actualPeriodFromRange(resolvePeriod(...))` on the server, or send `from`/`to` days.
- Switch on `status` for every amount. Show `unavailable` as "Not recorded" with `reason`;
  show `zero` as `$0`; show `coverage.status !== 'complete'` with its `gaps`.
- Label `scheduled.*` as "Scheduled" and `estimates.*` as "Estimated"/"Annualized"; never place
  them in an "Actual" column. Do not show appreciation next to actuals.
- To compare with an ROI projection (dollars, annual): use `estimates.annualizedNoi.value / 100`
  against the projection's year-one NOI, and only when its status is `derived`; say "partial"
  otherwise. Do not average or sum ratios across properties.
- `income.receipts` lists each receipt's classification and applied cents for a drill-down.
  Source ID lists are capped at 500 (`idsTruncated`).

## Limitations

- Payments are not categorized at source; classification depends on charges existing. Until
  rent charges are generated for a month, its receipts are `unapplied`.
- Allocation is recomputed from current rows: later refunds or backdated charges can reclassify
  earlier receipts.
- Expense completeness, capital expenditure, owner contributions and actual loan payments are not
  recorded. Single currency, no FX. Day boundaries are UTC.

## Verification

- `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/returns` — pure
  contract tests (`actual.test.ts`) and service guards (`actual-service.test.ts`).
- `node --import ./prisma/os-userinfo.mjs tests/returns/run-actual-isolated.mjs` — throwaway
  embedded PostgreSQL under ignored `.data/` (port `ACTUAL_RETURNS_TEST_PORT`, default 55617),
  deploys all migrations and runs `actual-service.db.test.ts`: cents from Decimal columns,
  midnight boundaries, history-aware classification, foreign/archived/absent `NOT_FOUND`, and
  no cross-organization rows. It never touches the application database.

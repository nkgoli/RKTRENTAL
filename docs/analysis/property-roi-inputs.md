# Optional property ROI input contract

Property creation and editing accept the existing basic fields plus **one optional
`roiInputs` field**. In FormData it is a JSON string; `parsePropertyInput` also
accepts a typed object in a record. Both property server actions already pass the
parsed data to `propertiesDb`. No complete financial section is required to save
a property. The public ROI engine still requires complete assumptions to calculate.

```json
{
  "version": 1,
  "input": {
    "purchase": { "purchasePrice": 250000, "closingCosts": 0 },
    "financing": { "loanAmount": 0, "downPaymentPercent": 100 },
    "income": { "monthlyRent": 0 },
    "expenses": { "capex": 0 }
  },
  "options": { "discountRate": 0.08 }
}
```

The envelope requires `version: 1`, `input` and `options` (either object may be
empty). All sections and fields below are optional. Numeric JSON values must be
numbers, not currency-formatted strings. Unknown keys, null values, invalid dates,
non-finite numbers and values outside the public schema bounds are rejected.
Errors use `roiInputs.input.<section>.<field>` or `roiInputs.options.<field>`;
malformed JSON uses `roiInputs`. Other validation errors keep their existing names.

## Names, types and units

Money is dollars/currency units, never cents, and is nonnegative unless stated.
Every numeric value is finite with absolute value at most 10 billion. Canonical
`purchasePrice` and `loanAmount` allow at most two decimal places and a maximum
of 9,999,999,999.99. Percentages use **7 for 7%**; `discountRate` alone uses a
fraction (**0.07 for 7%**).

| Section                  | Fields and types                                                                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input.purchase`         | `purchasePrice`: positive money; `afterRepairValue`, `closingCosts`, `rehabCosts`, `furnishingCosts`: money; `acquisitionDate`: ISO timestamp with timezone, years 1900–2100                                                                                                                       |
| `input.financing`        | `loanAmount`, `lenderFees`: money; `downPaymentPercent`, `interestRate`: percent 0–100; `pointsPaid`: nonnegative percentage; `loanTermYears`, `amortizationYears`: integer 1–50; `loanType`: `conventional`, `fha`, `va`, `commercial`, `portfolio`, or `hard_money`                              |
| `input.income`           | `monthlyRent`, `otherMonthlyIncome`: monthly money for the **whole property**; `vacancyRate`: percent 0–100; `annualRentGrowth`: percent -50–100                                                                                                                                                   |
| `input.expenses`         | `propertyTax`, `insurance`, `maintenance`, `capex`, `propertyManagement`, `leasingCosts`, `otherExpenses`: annual money; `hoaMonthly`, `utilitiesMonthly`: monthly money; `maintenancePercent`, `capexPercent`, `propertyManagementPercent`: percent 0–100; `annualExpenseGrowth`: percent -50–100 |
| `input.appreciationExit` | `annualAppreciation`: percent -50–100; `holdingPeriodYears`: integer 1–50; `sellingCostsPercent`: percent 0–30; `salePriceOverride`: positive money                                                                                                                                                |
| `options`                | `startDate`: ISO timestamp with timezone, years 1900–2100; `discountRate`: fraction -0.99–10; `tax`: optional complete tax object below                                                                                                                                                            |

Optional `options.tax` follows the existing analysis OptionsSchema: numeric
`marginalTaxRate`, `stateTaxRate`, `capitalGainsTaxRate`, `recaptureTaxRate`,
`landValuePercent` (percent 0–100); `depreciationYears` (1–50); boolean
`depreciationEnabled`, `allowImmediateLossBenefit`. If supplied, this tax object
must be complete; marginal plus state rates cannot exceed 100. Omit it to use
the engine's existing no-tax mode.

## Persistence and reload

The additive migration adds nullable `Property.roiInputs` JSONB without defaults,
backfill, table replacement or changes to existing financial/analysis rows.
Existing properties retain null and continue using their recorded source facts.
`purchasePrice` and `loanAmount` are written to the existing Decimal columns in
the same transaction as the property and optional JSON. They are removed from
the JSON so there is no second price/debt value to become stale. No loan terms,
down payment amount or annual debt service are inferred or written. Existing
`downPayment` and `annualDebtService` remain historical facts, not forecast terms.

`propertiesDb(...).getProperty(id).roiInputs` returns the editable envelope with
canonical price/debt restored as numbers and all supplied assumptions available.
`analysisService.loadDraft` / `loadRoiDraftAction` return the engine-compatible
payload plus field provenance and missing-data issues.

Updates patch individual fields within supplied sections. An omitted or empty
top-level `roiInputs` FormData value leaves all financial data untouched. Empty
sections do not clear saved fields. The UI must omit blank inputs when building
the JSON: **blank means unknown/no patch; explicit 0 is a value**. Null is not a
clear operation. A future clearing workflow requires an explicit contract; do not
send zeros to clear unknowns. Concurrent patches lock the tenant-owned property
row and merge against its latest JSON, preserving sibling assumptions. Reads,
row locks, and writes are organization-scoped. Property and units are created in
one transaction; property updates and ROI patches also share one transaction.

## Precedence and missing data

1. A saved analysis is an independent customer-edited snapshot. Continue using
   `loadSavedRoiAnalysisAction` first in the existing workspace flow. Property
   create/update and default loading never update or merge into saved analyses.
   A saved zero or an intentionally missing field remains exactly as saved.
2. For a **new draft**, canonical recorded price/debt map to purchase price and
   loan amount. Explicit stored property forecast assumptions populate the other
   financial fields and projection options, each with `source: property`, property
   source ID, observation timestamp and an explanatory note.
3. Explicit property forecast monthly rent, including zero, outranks scheduled
   lease rent. Otherwise only a complete schedule (one current active lease for
   every non-archived unit) supplies whole-property monthly rent with lease
   provenance. The schedule remains separately available in `facts` even when
   overridden. Forecast rent is never written back to leases.
4. Unknown inputs remain absent. Listed/market rents, collected payments,
   historical expenses, historical down payment, and historical annual debt
   service never become inferred forecast assumptions. No market rates, growth,
   vacancies, fees, dates or projection defaults are invented.

The existing engine gives fixed maintenance/capex/management amounts precedence
over their percentages, including fixed zero. Complete calculation still requires
the corresponding percentage fields to be explicit. Explicit loan amount wins
over the engine's down-payment-based loan calculation. For all-cash examples,
provide loan amount 0 and down-payment percent 100; calculation still needs its
explicit rate, term, type, fees and other required assumptions. Partial all-cash
data may be saved without inventing these terms. Cross-field calculation limits
remain enforced by `missingData` and the public engine when calculating/saving
READY; partial property data does not need to be a calculable deal.

## Verification

Run `node --import ./prisma/os-userinfo.mjs tests/analysis/property-inputs-runtime.mjs`.
The harness creates an isolated PostgreSQL database, deploys the pre-change
migrations, inserts an existing priced property, deploys the new migration and
checks price preservation and null ROI inputs. It runs the new property-input
tests plus existing analysis persistence and contract tests. Database data stays
under `.data/`; the server is stopped in `finally`. On Windows, PostgreSQL may
need execution outside a restricted sandbox token to initialize.

The dependent UI task owns form controls, serialization and browser flows. This
change supplies the persisted contract and action plumbing; it does not publish
a Preview or add financial controls.

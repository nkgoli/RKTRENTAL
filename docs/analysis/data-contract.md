# Property-selected analysis data contract (v1)

This boundary complements recorded Returns and Listing comps. It never writes Property, Unit, Lease, Payment or Expense records. One resumable analysis workspace belongs to each organization/property; named scenarios and editable benchmark comparisons live inside that workspace. Unit selection is available to both dashboards, but ROI assumptions apply to the **whole selected property**, not a selected unit or an implicit portfolio sum.

## Entry points and DTOs

Import browser-safe schemas/types and calculations from `@/lib/analysis`. The server-only `analysisService(session, prisma)` accepts a trusted server session and supports dependency injection for tests. Never construct that session from client parameters. The actions in `src/app/(manager)/roi-analysis/actions.ts` authenticate with the existing manager role helpers on every call; only MANAGER is permitted, including for reads. Organization IDs always come from that session.

| Action                                   | Result on success                                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loadAnalysisSelectionAction()`          | `{ ok: true, data: PropertySelection[] }`: authorized nonarchived property identities/address and nonarchived units, including bedrooms, bathrooms, sqft, listed/market monthly rents and status |
| `loadRoiDraftAction(propertyId)`         | `RoiDraftResult`: fresh `payload`, structured `missing`, and recorded `facts`                                                                                                                    |
| `loadSavedRoiAnalysisAction(propertyId)` | `{ ok: true, data: SavedAnalysis \| null }`; null means an authorized property has no saved workspace                                                                                            |
| `saveRoiAnalysisAction(request)`         | `{ ok: true, data: SavedAnalysis }`                                                                                                                                                              |

`AnalysisPayload`, `DraftInput`, `AssumptionEvidence`, `ValidationIssue`, `SaveAnalysisRequest`, `SavedAnalysis`, `AnalysisFailure`, `AnalysisResult<T>`, `PropertySelectionResult` and `RoiDraftResult` are exported. `PropertySelection[]` above describes the success branch of `PropertySelectionResult`, not a separate exported interface. DTOs contain plain JSON: no Prisma Decimal, BigInt or Date instances.

```ts
type SaveAnalysisRequest = {
  propertyId: string;
  expectedRevision: number; // 0=create only; otherwise exact last loaded revision
  status: 'DRAFT' | 'READY';
  payload: AnalysisPayload;
};
type SavedAnalysis = {
  propertyId: string;
  revision: number;
  status: 'DRAFT' | 'READY';
  payload: AnalysisPayload;
  missing: { path: string; message: string }[];
  createdAt: string; // real database audit timestamps, ISO
  updatedAt: string;
};
```

Failure is `{ ok: false, code, issues?, currentRevision? }`. Codes: `FORBIDDEN` (service role denial), `NOT_FOUND` (same response for absent, archived and foreign properties), `INVALID` (schema, scope, dates, numeric or engine validation), `MISSING_DATA` (READY requested with required assumptions absent), `CONFLICT` (stale update or competing create), `UNSUPPORTED_VERSION` (stored envelope version). Authentication helpers retain the application's sign-in/role redirects before the service is reached. Database outages propagate as server errors; they are not disguised as missing data.

`issues` has stable field paths and readable messages. On conflict, `currentRevision` is provided without returning the competing inputs. Reload and let the manager reconcile; never automatically overwrite. Saves use an atomic revision predicate and increment; first creates use a unique organization/property constraint. Two simultaneous updates to the same revision cannot both succeed.

## Facts and assumptions

| Recorded source                              | Draft mapping                                                                             | Units / confirmation                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property identity/address                    | envelope `propertyId`, input metadata                                                     | Always loaded within session organization; inactive properties excluded                                                                                                                             |
| `Property.purchasePrice`                     | `input.purchase.purchasePrice`, if present                                                | Decimal dollars → number dollars exactly once, no /100; confirm forecast acquisition basis                                                                                                          |
| `Property.loanAmount`                        | `input.financing.loanAmount`, if present                                                  | Decimal dollars → dollars; confirm acquisition principal, not necessarily today's balance                                                                                                           |
| `Property.downPayment`                       | `facts.downPayment` only                                                                  | Dollars; no inferred down-payment percent or financing choice                                                                                                                                       |
| `Property.annualDebtService`                 | `facts.annualDebtService` only                                                            | Annual dollars, never reverse-engineered into rate, term or principal                                                                                                                               |
| Current ACTIVE leases, date inclusive in UTC | `input.income.monthlyRent` only when every nonarchived unit has exactly one current lease | Sum scheduled monthly dollars once for property. Evidence lists contributing lease IDs. Vacant/missing/ambiguous schedules leave rent absent, not zero. Status alone does not imply a current lease |
| Unit listed/market rent                      | selection DTO only                                                                        | Monthly dollars; manager chooses whether/how to use them for a forecast or comps. Never silently substituted for signed rent                                                                        |
| Unit bathrooms                               | selection DTO                                                                             | Decimal count → number; no currency scaling                                                                                                                                                         |
| Expense rows                                 | `facts.expenses` only                                                                     | Dated actual dollar observations, not annual forecasts. Latest 1000 returned with `expenseHistoryTruncated` flag; do not treat a truncated or irregular history as a complete year                  |
| Payments                                     | not read                                                                                  | Payments do not carry reliable rent/deposit/other classification; never used as clean rent observations                                                                                             |

Acquisition fees, furnishing/rehab costs, debt terms/rate/points, other income, vacancy, growth, expenses, reserve policy, holding period, exit costs, discount rate and model start date remain **missing** until explicitly supplied. No sample financing, 3% appreciation, empty-history zero expenses or current-date model start is inserted. Explicit zero assumptions are accepted. `missingData(payload)` identifies the public engine's required fields; optional expense dollar overrides remain optional when the required percentage estimate is supplied.

Engine monetary units are dollars (or another single explicitly managed currency; there is no FX). Rent and other income, HOA and utilities are **monthly**. Property tax, insurance, maintenance, CapEx, management, leasing and other expenses are **annual**. A manager converting a complete 12-month utility budget to `utilitiesMonthly` divides by 12 once; a monthly tax budget must be multiplied by 12 for `propertyTax`. The adapter deliberately does not annualize raw expense history. Percent input fields use percentage points: `vacancyRate: 5` means 5%, `downPaymentPercent: 20` means 20%. `options.discountRate: 0.08` means 8%. Return ratios/IRR from the engine are fractions; benchmark CAGR, yield and volatility are percentage points. Do not sum returns or average cap rates for a portfolio.

Draft `evidence` records path, source (`property`, `lease`, `expense`, `manager`), optional source ID, observedAt ISO timestamp and note. Initial price, loan and scheduled rent evidence is generated from scoped reads. Preserve it and append manager evidence describing edits/confirmations and budget periods. Evidence in a saved payload is an editable assumption annotation, not a tamperproof audit log or a fresh database assertion. Audit timestamps are independent database fields.

## Versions, validation and calculation

Envelope `version: 1`, engine identity `rocketrental-roi-v1:<SOURCE_COMMIT>`, and input `schemaVersion: 1` are separate fields. `SOURCE_COMMIT` is the pinned RealROI source identity exported by the public engine. `ENGINE_ID` stamps this application boundary. Unknown envelope/engine/input versions are rejected, not silently migrated. The current engine contract is `docs/analysis/realroi-integration.md`; required integrated candidate ancestry was verified locally.

`payload.options` holds explicit fractional discountRate and ISO startDate, plus optional complete tax assumptions. `input.purchase.acquisitionDate` is also ISO when supplied. `rehydrateInput` converts acquisition date; `calculatePayload` converts model start and scenario-option dates before calling only public ROI exports. `createdAt`/`updatedAt` are real database clock values. The engine's reproducible computedAt echoes model start and must not be displayed as an audit time.

The current public facade accepts CUID property IDs but its internal pipeline still checks UUIDs. The adapter verifies property identity in the envelope/input, then **omits the numerical engine's irrelevant propertyId** for calculation. It never invents another ID. Use the envelope propertyId for UI navigation; this workaround changes no numerical assumptions and touches no engine internals.

Payload schemas reject unknown keys, mismatched property identities, numeric strings, null financial numbers, NaN/Infinity, invalid/out-of-range dates and excessive numeric values. Full public engine validation runs before saving READY, including merged scenario calculations and benchmark comparisons. Incomplete DRAFT is resumable but not calculable; callers must use `missing` and catch calculation validation errors. Complete DRAFT is validated through the engine too.

Up to 20 named scenarios carry unique IDs and one-section-deep financial overrides. They cannot override property identity or metadata. Optional scenario options are complete, not partial; omitted options inherit the base. Up to two benchmarks carry unique types, explicit source/as-of description, CAGR [-100,100], yield, volatility, name, description and chart color. No historical market defaults are selected. Benchmark CAGR already includes reinvested distributions. Source/as-of text is manager supplied and not a live quote. Results/projections are recomputed, not persisted; engine upgrades require a future explicit version migration.

## Frontend usage

```ts
import { PayloadSchema, calculatePayload } from '@/lib/analysis';
import {
  loadRoiDraftAction,
  loadSavedRoiAnalysisAction,
  saveRoiAnalysisAction,
} from '@/app/(manager)/roi-analysis/actions';

async function openProperty(propertyId: string) {
  // Clear prior property form/projections immediately; discard late requests
  // using a request token or keyed component when property selection changes.
  const saved = await loadSavedRoiAnalysisAction(propertyId);
  if (!saved.ok) return saved;
  if (saved.data)
    return {
      ok: true as const,
      payload: saved.data.payload,
      revision: saved.data.revision,
      missing: saved.data.missing,
    };
  const draft = await loadRoiDraftAction(propertyId);
  if (!draft.ok) return draft;
  return {
    ok: true as const,
    payload: draft.data.payload,
    revision: 0,
    missing: draft.data.missing,
  };
}

// After manager completes/validates the selected property's form:
const validated = PayloadSchema.parse(editedPayload);
const result = await saveRoiAnalysisAction({
  propertyId: selectedPropertyId,
  expectedRevision: loadedRevision,
  status: 'READY',
  payload: validated,
});
if (result.ok) {
  const charts = calculatePayload(result.data.payload);
  // Retain result.data.revision for the next save; preserve null ratios in charts.
}
// For partial edits, status:'DRAFT'; render MISSING_DATA issues, and reload on CONFLICT.
```

Never merge a previous property's form into a new draft. Both the request propertyId and payload/input identity are checked server-side. Selection is shared with Rent Analysis; rent-setting mutations remain the existing authorized comps workflow, outside these actions.

## Focused verification

`node --import ./prisma/os-userinfo.mjs tests/analysis/run-isolated.mjs` starts a fresh embedded PostgreSQL cluster under ignored `.data/` on port 55439 (override `ANALYSIS_TEST_PORT`), deploys the pre-analysis migrations, inserts an existing-property sentinel, applies the additive migration, verifies the sentinel and migration status, and runs `tests/analysis`. It stops that cluster and retains test data on disk. It does not read a running app's database URL or reset/reseed user data. Requires local dependencies and the optional `prisma/package.json` embedded-postgres dependency. On Windows a sandbox may prevent initdb's restricted token creation; run with the permitted process capability.

`node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/analysis/contract.test.ts` runs pure boundary checks without a database. Persistence tests run only under the isolated harness (`RUN_ANALYSIS_DB=1`), not against the default application database. Also run Prisma generate/validate, project typecheck and ESLint over the owned TypeScript/test paths.

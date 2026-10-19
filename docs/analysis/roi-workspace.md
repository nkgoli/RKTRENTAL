# ROI summary workspace and extension contract

## Implemented boundary

`/roi-analysis` opens explicit, searchable active-property selection. `?property=<id>` opens only an identity in the authorized selection result; unknown, archived and foreign identities remain unavailable, with no fallback property. Every action independently authenticates and scopes organization/property access. Returns stays in Money alongside the new ROI Analysis entry. No property, unit, lease, rent or expense mutation is performed.

`PropertySelector` accepts the successful selection DTO and an explicit selection callback. Future Rent Analysis can reuse it without importing ROI assumptions. ROI always models the whole property; units are not silently blended into a rent-comparison subject.

The page uses `loadAnalysisSelectionAction`. The client loads saved state and the current source draft in parallel, installs the saved payload when present, and displays current facts separately. `loadRoiDraftAction` supplies property acquisition facts, only unambiguous complete current lease rent, provenance and dated expense observations. Expense observations and recorded annual debt service are explanatory facts, never annual forecast budgets or inferred financing terms. Missing assumptions remain blank. Zero stays zero.

All purchase/financing, income, expense/reserve, growth/exit, projection date/discount and optional tax fields are editable. Labels specify monthly versus annual dollars and percentage points versus fractional discount. Fixed maintenance, reserve and management amounts override percentages; clearing an optional fixed amount returns to percentage mode. The public contract still requires the percentage fields. All-cash explicitly sets loan amount to zero and down payment to 100%; remaining required financing assumptions must still be entered consciously. There are no financial sample defaults.

`fields.ts` owns field descriptions and the lossless blank/string-to-payload conversion. Invalid strings stay in form state until corrected. `PayloadSchema`, `missingData` and `calculatePayload` are the only numerical/validation boundaries. The summary reads engine metrics, income/expense breakdowns and annual cash flows directly, including reserves below NOI. NPV shows its explicit discount assumption. Null ratios remain unavailable. Optional tax output is labeled a simplified estimate. An accessible annual table accompanies the compact cash-flow overview.

## State for subsequent panel builders

The current client state lives in `RoiWorkspace`:

- `selected` is the envelope property identity; it is never an inferred first property.
- `payload` is the last loaded/saved envelope; `values` holds entered strings, including incomplete or invalid edits. Preserve scenarios, benchmarks, engine/version identity and source evidence when adding panels.
- `revision` is the last successful saved revision. Save uses that exact expected revision. A conflict retains edits and disables further saves until explicit reload/reconciliation.
- `result` is the last successful public adapter base result. `stale` becomes true on any edit or calculation error. Never present that prior result as a fresh calculation. Recalculate validates and replaces it; incomplete draft saves remain resumable.
- `dirty` controls save/discard/keep-editing on property change and reload; successful saves clear it. Draft and ready use the same action with distinct statuses. Failures preserve values.
- `token` invalidates late load/save replies. Property switches clear the previous property's inputs/results immediately. Saves disable input editing and property changes while pending.
- `facts` are fresh recorded observations, independent of editable saved evidence annotations. Edited fields receive manager assumption evidence on save.

Lift this state into a shared provider/hook when another panel actually needs it. That provider must retain the same lifecycle and identity invariants. Add panels against the public adapter result, never the engine's internal barrels or copied formulas. Preserve this summary's draft fields, dirty guard, revision and request token across panel changes. Add no inactive tab or dead link as a placeholder.

Detailed cash flow/equity/expenses/amortization/exit/sensitivity charts, named scenario editing, benchmark provenance and comparisons remain separate implementation slices. Existing stored scenarios and benchmarks are retained and validated by the adapter but are not exposed as editable panels here. The small overview and exact annual table are summary scope only; this is not the full chart/scenario feature.

## Isolated review runtime

Runtime identity: **roi-summary-review**. Its launcher is `tests/analysis/review-runtime.mjs`; PostgreSQL uses port **55443**, database **roi_summary_review**, and retained data under `.data/roi-summary-review/postgres`. Storage is isolated under `.data/roi-summary-review/storage`; the Next production app uses port **3143**. It is a local review server, not a Managed Preview publication. No output binding or existing user configuration is replaced.

The launcher ignores ambient DATABASE_URL, sets its own local demo authentication/storage configuration, applies the additive migration only to this database, and seeds only when its demo organization is absent. Reusing it preserves saved analyses. Do not point the seed at another database. Run from this Task's checkout after installing the existing locked dependencies and the optional embedded-postgres dependency:

```powershell
npm.cmd ci --cache .data/npm-cache
npm.cmd install --prefix prisma --cache .data/npm-cache --package-lock=false
npm.cmd run build
node --import ./prisma/os-userinfo.mjs tests/analysis/review-runtime.mjs
```

`--database-only` starts just the isolated database. Type `q` to stop the launcher. Windows initdb requires a process capability outside the restricted-token sandbox; the ordinary sandbox attempt failed with restricted-token error 87, and the permitted execution succeeded. No default application database was read or migrated. Demo sign-in uses the existing seed's manager account.

## Verification observed so far

The baseline includes engine candidate `535e1688d89bb81d0267c4f94660a8983b485579` and persistence candidate `df9647745138cd5a1e9b460ec861f632132f391b`; both ancestry checks succeeded. Historical submission identifiers in project memory are not Git commit IDs.

- TypeScript check passed.
- Owned TypeScript/test ESLint passed after correcting the initial effect dependency warning.
- UI/contract/shell checks passed: 45 tests across 3 files, including explicit selection, invalid property URLs, edit/recalculate/stale results, incomplete draft, ready save, conflict/transport recovery, dirty property switch and late response protection. A subsequent focused workspace run passed all 6 tests after adding keyboard selection, modal focus containment/Escape and opening a closed disclosure to focus the invalid field.
- The isolated harness passed 34 analysis tests, including migration preservation over a populated pre-analysis schema, manager/organization authorization and revision concurrency. It retained its database under `.data/analysis-postgres-1a9f3188-e448-4c30-bd1b-0415156a91fe` and stopped that cluster.
- The dedicated review database was initialized and all 19 migrations applied, then the existing demo seed populated 4 properties/45 units. The dedicated cluster and launcher were stopped with demo data retained. Existing user databases/configuration were untouched.
- The coordinated foundation correction `f90c4e4e281381c34d4a8441f7715cd7a3895f02` was merged non-destructively into this retained candidate. Its calculation/public-schema corrections are preserved.
- The manager explicitly transferred the minimal engine import-resolution correction to this Task. Relative engine import/export specifiers now omit `.js`, consistently resolving TypeScript sources for Next's browser bundle. No generated JS, type suppression, formula change or Next/global-config workaround was introduced.
- The affected ROI, UI, contract and shell run passed **80 tests across 5 files** after the foundation merge/import correction. Typecheck, scoped lint and engine formatting passed. `npm.cmd run build` passed, including compilation, lint/type validation, static generation and the dynamic `/roi-analysis` route. The earlier failed build is superseded by this observed successful build.
- The isolated runtime was restarted on port 3143 using its retained database. `tests/analysis/prepare-review.ts` optionally creates one explicitly annotated illustrative Maple Court DRAFT via the authorized service, only in the hardcoded isolated database and only when no saved analysis exists. It never presents fixture assumptions as fresh property facts. Run with `node --import ./prisma/os-userinfo.mjs --import tsx tests/analysis/prepare-review.ts`. It preserves an existing review analysis.
- Native verification subsequently passed after the explicit holder-release acknowledgement and a granted 600-second desktop lease. Windows MCP drove the existing Edge session against this production runtime. A temporary review tab was closed, device emulation disabled, DevTools closed and the original GitHub tab restored before `release_desktop` confirmed release. The separate Rent runtime was not changed. No publication is claimed.

### Native Edge verification

Tested routes: `/roi-analysis`, `?property=seed-property-maple`, `?property=seed-property-cedar` and `?property=foreign-property`, all on the isolated app at `localhost:3143`.

- Desktop: entered from the Money sidebar with Returns retained, searched Maple, used Tab/Enter to select it, and loaded the explicitly annotated review draft. Entering purchase price 0 focused the field with an error and marked the prior results out of date. Correcting it to 2,800,000 and recalculating changed cap rate/cash-on-cash/IRR; draft save succeeded at revision 2, ready save at revision 3, and explicit reload showed ready revision 3 with the edited price. A later unsaved edit triggered the property-change dialog; Shift+Tab wrapped to Discard and Enter returned to selection. A foreign property URL displayed unavailable with no fallback property, and returning to the valid Maple URL recovered the saved workspace.
- Phone: Edge Responsive device emulation was explicitly set to **390 × 844**. The stacked summary, wrapping actions and metrics were readable without visible page clipping. Draft/ready save and reload reached ready revision 5. Change property opened the reusable selection flow; choosing Cedar showed missing assumptions and unavailable metrics. Its incomplete draft saved at revision 1 and reloaded; ready validation focused its empty closing-cost field with a linked error. Returning to Maple reloaded ready revision 5. The mobile menu opened and closed with Escape.
- Native screenshots were captured from the granted desktop and visually inspected: `tests/analysis/evidence/roi-desktop.png`, `tests/analysis/evidence/roi-phone.png`, and `tests/analysis/evidence/roi-phone-incomplete.png`. These are evidence files, not a generated/static app or a Managed Preview.
- A read-only Prisma check against the isolated database confirmed Maple's recorded purchase price remains 2,830,000 while its saved READY analysis uses the entered 2,800,000 at revision 5; Cedar's property price remains 1,470,000 with DRAFT revision 1. No property/lease/rent writes were introduced.
- Revision-conflict, transport failure, late responses, all-cash and fixed-zero override cases are covered by the focused interaction/service tests. Native checks exercised validation recovery; they did not inject a network outage or concurrent save. Optional tax inputs are implemented and schema validated, but were not individually filled in the native session.

Focused commands are `node node_modules/typescript/bin/tsc --noEmit`, owned-path ESLint, and `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/analysis/contract.test.ts tests/analysis/workspace.test.tsx tests/ui/manager-shell.test.tsx`. The migration/authorization command is `node --import ./prisma/os-userinfo.mjs tests/analysis/run-isolated.mjs`. Reuse valid database evidence; rerun affected UI checks after edits.

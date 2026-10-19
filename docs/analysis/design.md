# ROI Analysis and Rent Analysis design handoff

The six screens in **Designs/rocketrental-analysis, revision 27** replace the heading-only companion with property-selected dashboards in RocketRental’s compact manager shell. The linked walkthrough uses Maple Court, with ROI at property scope and Rent Analysis at Unit 4B scope.

This is a design deliverable. It does not implement routes, calculations, persistence, provider integrations or lease mutations. The sole repository deliverable is this document.

## Design and source baseline

- Companion starting point: Designs/rocketrental-analysis revision 1.
- Main reference: Designs/rocketrental-app revision 337. Read manager-dashboard, returns, rent-comps, property-listing and sfh-listing, including their shared stylesheet. Rendered manager-dashboard as the visual reference. No screen, stylesheet or token in that main design was written by this task.
- Diagram: Diagrams/rocketrental-mindmap revision 4, branches f-returns and f-comps and their children. Neither branch points to additional files.
- RocketRental checkout inspected at `17e17da48df8cd851427e69e69526da2f43e357c`.
- RealROI source inspected using GitHub fetch/fetch_file at pinned commit [0b12c76fea3958b98f4a722f5acf3336f1fd7d45](https://github.com/nkgoli/RealROI/tree/0b12c76fea3958b98f4a722f5acf3336f1fd7d45). It is a separate source repository, not a local dependency added by this task.
- No input attachments were listed. No running application database was queried; fixtures are labeled examples, not observations of a user’s live portfolio.

The companion retains its token record: primary `#1e3a8a`, white background/surface, text `#17142b`, muted `#64748b`, accent `#e0a283`, danger `#dc2626`, Inter, Space Grotesk headings, 8 px radius and spacing unit. The sidebar uses the existing navy `#0b2545`; the layout uses flat borders, restrained status colors, a 240 px sidebar and 32 px desktop content gutters. Phone gutters are 16 px. Body text is 14 px, notes generally 12 px, and phone inputs are 16 px with 44 px actions. There are no new image assets or dependencies.

## Screen and state map

All coordinates below refer to Designs/rocketrental-analysis. Native radio groups switch panels without scripts; native details expose additional states. The screen links stay inside these six screens.

| Screen             | Primary view                                                                                                                                              | Additional designed states and controls                                                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| analysis-selection | Searchable portfolio presentation, Maple Court selected, separate Open ROI Analysis and Open Rent Analysis actions                                        | No matches, no properties, loading, unavailable/archived property; phone link                                                                                                                                                                                                            |
| roi-summary        | Selected property, named Planning base, Year 1 cash flow/cap rate/cash-on-cash, hold-period leveraged IRR, income-to-cash-flow statement, cash-flow chart | Editable purchase/financing, income/vacancy, expenses/reserves, appreciation/exit and tax groups; monthly amounts; total cash required; advanced metrics; what-if inputs; save/reload/loading/missing-input/error states                                                                 |
| roi-projections    | Cash Flow panel                                                                                                                                           | Native Cash Flow, Equity, Expenses, Amortization, Exit Analysis and Sensitivity panels; exact tables; monthly amortization; cash-only payback; cash returned versus profit; sensitivity controls and values; all-cash/balloon and calculation-error states                               |
| roi-scenarios      | Base, Optimistic and Conservative cases with explicit assumptions, metrics and equity growth                                                              | Native Scenarios, Benchmarks and Compare panels; Best/Worst/Custom details; absolute and delta metrics; historical-reference data table; indexed/dollar views; reference risk scatter; two-asset comparison; multidimensional comparison; loading/errors                                 |
| rent-analysis      | Maple Court / Unit 4B, source banner, filters, schematic map, nearest comps, rent summary, apply action and comparable table                              | All 12 units; optional unit and single-family behavior; excluded rows; formula explanation; Listing and renewal handoffs; applying/success/invalid/error; provider unavailable/configuration/demo/cache/refresh failure; no matches/all excluded/low confidence/missing features/loading |
| analysis-phone     | ROI Summary at 390 px                                                                                                                                     | Native Property, ROI, Rent and Menu views. ROI contains Summary, Charts, Scenarios, Benchmarks and Compare; Charts contains all six panels. Rent places summary/apply ahead of the map and tables. Assumptions, filters, provider and error states remain expandable.                    |

Desktop ROI navigation groups Scenarios, Benchmarks and Compare under “Scenarios & comparisons”; these remain separate selectable panels. Phone labels wrap instead of truncating. Wide tables scroll within a labeled, focusable region; the page itself should not acquire horizontal overflow. Chart data has textual or tabular alternatives, and color is not the sole indicator of selection, risk or series.

The design walkthrough has a fixed Maple Court fixture. Portfolio search, selecting another property, changing assumptions/filters, scenario checkboxes, recalculation and persistence require application bindings. The existing non-analysis sidebar items are contextual text in the companion; their production navigation remains in the manager shell. Listing and lease destinations are modeled as disclosures because their screens belong to the main design. This avoids broken cross-design screen links.

## Intended application routes

These are implementation contracts, not routes created by this task.

| Route or query                                                                   | Behavior                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/roi-analysis`                                                                  | Property selection; do not silently choose the first portfolio property                                |
| `/roi-analysis?property=<propertyId>&tab=summary`                                | Load the selected property and its saved analysis or missing-input state                               |
| `/roi-analysis?property=<propertyId>&tab=charts&chart=cashflow`                  | Cash Flow; other chart keys: `equity`, `expenses`, `amortization`, `exit`, `sensitivity`               |
| `/roi-analysis?property=<propertyId>&tab=scenarios`                              | Scenario comparison; sibling tabs `benchmarks` and `compare`                                           |
| `/rent-analysis`                                                                 | Property selection, retaining Rent Analysis as the destination                                         |
| `/rent-analysis?property=<propertyId>`                                           | Multi-unit overview of saved rents; no blended property-wide comp estimate                             |
| `/rent-analysis?property=<propertyId>&unit=<unitId>`                             | Unit workbench; preserve `radius`, `beds`, `baths`, `minSqft`, `maxSqft`, `days`, `status`             |
| `/properties/<propertyId>?tab=listing`                                           | Preserve existing property Listing. Single-family resolves its implicit unit and hides the unit picker |
| `/properties/<propertyId>/units/<unitId>?tab=listing`                            | Preserve existing unit Listing; Open in Listing carries selected scope and filters                     |
| `/rent-comps?unit=<unitId>&…`                                                    | Retain the current compatibility redirect to unit Listing; do not repurpose it as Rent Analysis        |
| `/leases/new?unit=<unitId>`                                                      | Existing renewal/create-lease destination; preserve unit and review rent/terms in that flow            |
| `/returns`, `/properties/<propertyId>?tab=returns`, `/payments`, `/integrations` | Existing recorded reports, rent roll/delinquency and provider configuration remain reachable           |

Add **ROI Analysis** and **Rent Analysis** as distinct visible entries in the Money sidebar group, retaining Returns. Each no-property entry begins at its own property-selection route. Preserve the chosen destination when a property is selected.

Every loader/action must require the manager role, scope the property to the current organization and verify that a selected unit belongs to that property. Do not fall back to another organization’s or another property’s first unit. Archived/unavailable property or unit produces an explicit recovery state. A property change resets unit-specific filter/exclusion state; prompt to save or discard unsaved ROI assumptions before replacing them.

## Source-to-panel coverage

RealROI paths below are relative to its pinned repository.

| Inspected source                                                                                                                                                                                                                 | Adaptation and coverage                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/pages/AnalysisPage.tsx`                                                                                                                                                                                            | Replace acquisition Search with existing-property selection. Retain Summary, Charts, Scenarios, Benchmarks and Compare. Adapt save/reset and saved-input detection to a property-scoped analysis rather than RealROI’s separate library. Love/favorites, free-plan limits and duplicate-address creation do not belong in this manager workflow                                                                               |
| `apps/web/src/components/PropertyForm/PropertyForm.tsx` and `packages/core/src/domain/schemas/deal-input.schema.ts`                                                                                                              | All financial groups appear in Summary disclosures: purchase, ARV, closing/rehab/furnishing/acquisition date; down payment/loan/rate/term/amortization/type/points/fees; rent/other income/vacancy/growth; all expense types and fixed-dollar overrides; appreciation/hold/selling costs/sale override; optional tax/depreciation/land share. Property identity is displayed from the selection rather than freely re-entered |
| `apps/web/src/components/summary/SummaryReturnsPanel.tsx`                                                                                                                                                                        | Deal snapshot, annual/monthly values, investment breakdown, DSCR/risk, cash-flow/equity/return distinctions, targets and what-if levers are adapted into the statement, metric details and editable what-if group. Retain negative outcomes and explicit time horizons                                                                                                                                                        |
| `apps/web/src/components/charts/ChartsPanel.tsx`                                                                                                                                                                                 | CashFlowCumulativeChart + IncomeBridgeChart → Cash Flow; EquityDebtChart + EquityChart → Equity; ExpenseBreakdownPanel → Expenses; LoanAmortizationChart + AmortizationTable → Amortization; ExitAnalysisPanel → Exit; SensitivityAnalysisPanel → Sensitivity. These component connections were read in ChartsPanel                                                                                                           |
| `apps/web/src/components/charts/ExitAnalysisPanel.tsx`                                                                                                                                                                           | Separate total cash returned from profit, compare exit years and expose selling-cost/payoff assumptions. Do not show years beyond the modeled hold                                                                                                                                                                                                                                                                            |
| `apps/web/src/components/charts/SensitivityAnalysisPanel.tsx`                                                                                                                                                                    | Rent × vacancy matrix, Year 1/Stabilized/Year 5 controls, min/max/steps, readable values and an accessible palette. Base cell outlined; negative cells remain explicit                                                                                                                                                                                                                                                        |
| `apps/web/src/components/scenarios/ScenarioComparisonPanel.tsx` and `packages/core/src/scenarios/presets.ts`                                                                                                                     | Base/Optimistic/Conservative, Best/Worst/Custom, assumptions, Year 1 versus hold-period metrics, equity curves, deltas and errors                                                                                                                                                                                                                                                                                             |
| `apps/web/src/components/scenarios/BenchmarkComparisonPanel.tsx` and `packages/benchmarks/src/data/market-data.ts`                                                                                                               | Historical reference presets, source periods, growth, dollar/indexed presentation and property risk context. Cash-flow matching is visibly unavailable pending actual calculation support                                                                                                                                                                                                                                     |
| `apps/web/src/components/comparison/AssetComparisonPanel.tsx` and `packages/benchmarks/src/calculations/asset-comparison.ts`                                                                                                     | Selected property plus one or two benchmarks; same starting cash/horizon; absolute/delta metrics, growth, annualized-return bars, return/growth/risk dimensions. Do not invent measured property volatility or a risk-adjusted score                                                                                                                                                                                          |
| `packages/core/src/pipeline/analysis-pipeline.ts`                                                                                                                                                                                | NOI, cash flow, cap rate, cash-on-cash, DSCR, leveraged/unleveraged IRR, NPV/discount rate, profitability index, equity multiple, total/simple-average ROI, break-even occupancy, payback and optional tax metrics                                                                                                                                                                                                            |
| `packages/core/src/calculations/metrics/noi.ts`, `packages/core/src/calculations/metrics/advanced-returns.ts`, `packages/core/src/calculations/projections/cashflows.ts`, `packages/core/src/calculations/projections/equity.ts` | Definitions and illustrative fixture arithmetic; annual growth timing, explicit expenses, equity versus proceeds and selling costs                                                                                                                                                                                                                                                                                            |

RocketRental files inspected:

| Source                                                    | Implementation consequence                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(manager)/rent-comps/page.tsx`                   | Existing route redirects to Listing, retaining filters. The new analysis route must be separate                                                                            |
| `src/components/rent-comps/RentCompsPanel.tsx`            | Reuse selected subject, settings, load/error handling and workbench; make route/context configurable rather than hard-code `/rent-comps`                                   |
| `src/app/(manager)/rent-comps/CompsWorkbench.tsx`         | Preserve included/excluded comps, schematic map, nearest list, market summary, editable apply amount, audit feedback, cache/source labels and renewal/create-lease entry   |
| `src/app/(manager)/rent-comps/FilterBar.tsx`              | Reuse radius/bed/bath/size/time/status filters. Preserve property and unit in every submission; UnitPicker should list only the selected property’s units in Rent Analysis |
| `src/app/(manager)/rent-comps/actions.ts`                 | Reuse manager-authorized apply/refresh behavior and extend revalidation to the new route without losing Listing updates                                                    |
| `src/lib/comps/core.ts`, `src/lib/comps/service.ts`       | Reuse parseFilters, summarize, suggestRent, mapPins, cache and applyMarketRent semantics                                                                                   |
| `src/lib/providers/index.ts`, `src/lib/providers/mock.ts` | Comps are sandbox-only. A Rentometer label can still be a mock response; provider name is insufficient to claim live data                                                  |
| `src/lib/returns/core.ts`, `src/lib/returns/queries.ts`   | Keep recorded-period reporting distinct. Income comes from succeeded payments and expenses by incurred date; current Returns ROI includes assumed appreciation             |
| `prisma/schema.prisma`, `prisma/seed.ts`                  | Available property/financing/unit/lease fields and demonstration values; missing ROI inputs cannot be inferred from a complete DealInput                                   |
| `src/components/shell/nav.ts`                             | Add two analysis entries without exposing the legacy Rent comps redirect or removing Returns                                                                               |

The f-returns branch is covered by projected income/expenses/NOI/cash flow, return metrics and trends, plus explicit navigation back to existing recorded reports. Rent roll, occupancy and delinquency remain existing report concepts, not newly invented projection metrics. The f-comps branch is covered by location/bed/bath/size filtering, provider provenance, range/suggestion and safe unit/renewal handoffs.

## Data, assumptions and metric labels

Use four distinct categories in the product:

1. **Recorded / From property:** persisted property/unit/lease inputs, with scope and an as-of date. Record values can seed assumptions after review; they are not a promise that the projection matches recorded performance.
2. **Assumption / Projected:** editable model inputs and computed forecasts, including horizon and before/after-tax status.
3. **Saved market rent:** the stored unit estimate and actor/time; distinct from lease rent and listed rent.
4. **Demo comps / Reference assumptions:** sandbox rental data and bundled historical benchmark constants; neither is a live feed.

Minimum ROI persistence needs an organization/property association, schema version, named base, editable input snapshot, source/as-of metadata, save version and actor/time. Scenarios should store explicit overrides against a known base. Reopen the saved snapshot rather than silently replacing reviewed assumptions with fresh defaults. Retain unsaved edits on save failure, expose saving/saved/error feedback and protect against stale concurrent saves. Reload is an explicit discard action.

The current Property model has purchasePrice, downPayment, loanAmount and annualDebtService, but not the full rate/term/growth/expense/tax assumption set. Current Unit/Lease data can seed rent; an aggregate full-occupancy baseline must identify how vacant units are treated. Do not infer loan rate/term from annualDebtService or silently import generic RealROI example values.

Keep currency conversions at an explicit adapter boundary: existing returns helpers use cents, RealROI DealInput uses dollar amounts, and displayed percentages may originate as ratio fractions. RocketRental IDs are not RealROI’s optional UUID-shaped propertyId; use the application’s authorized foreign key and omit/map the engine’s optional ID rather than passing an incompatible identifier.

Metric definitions must stay visible:

- Year 1 cap rate: modeled NOI / purchase price.
- Cash-on-cash: annual cash flow after debt / total cash required, including closing and applicable acquisition costs.
- IRR: annualized cash-flow-timed return including sale proceeds. Leveraged and unleveraged IRR are separate.
- Total ROI: total profit / initial cash over the entire hold, not an annual percentage.
- Equity: projected property value less debt, before selling costs. Net sale proceeds deduct selling costs and payoff.
- NPV: show the discount rate; the inspected pipeline defaults to 8%.
- Compare’s annualized value growth uses ending equity plus accumulated cash, before sale costs. It must not be labeled as the Summary IRR.
- Existing recorded Returns ROI uses cash flow plus assumed appreciation. Do not combine it into the projection series or silently rename it as IRR.
- Missing/undefined/non-finite outcomes display “—” with a reason. All-cash DSCR is “Not applicable”; no cash-flow payback within the hold is “Beyond hold,” not zero.

### Demonstration fixture

Maple Court identity, 12 units, 11 occupied, purchase price $2,830,000, down payment $850,000 and loan $1,980,000 come from the inspected seed. The rent baseline is $23,000/month: $21,400 occupied lease rent plus $1,600 listed for vacant Unit 3A. Main design occupancy figures may differ; this companion is labeled as an illustrative sample.

Planning base assumptions are 6.5% interest, 30-year amortization/term, $56,600 closing costs, 5% vacancy, 2% rent growth, 2% expense growth, 3% appreciation, 10-year hold and 6% selling costs. Annual taxes are $30,000, insurance $9,600, maintenance/CapEx each 5% of gross rent, and management 8% of effective income. Other modeled costs are zero; taxes are off. These are editable examples, not values read from a live account.

Illustrative arithmetic yields $906,600 initial cash, $174,024 Year 1 NOI, about $150,179 annual modeled debt service, $23,845 annual cash flow, 6.1% cap rate, 2.6% cash-on-cash and 10.7% leveraged IRR. The seed’s annualDebtService is $36,000; the UI expressly distinguishes that record from the new amortized model. These figures were checked by independent arithmetic using the inspected formulas, not by executing or certifying the RealROI package. Engine rounding may produce small differences.

The rent fixture uses the linked main design’s 2 bd / 2 ba / 950 sqft subject because those optional features are not populated by the inspected seed. It is labeled “Demo subject”; production must review missing features. Six comps were reproduced from MockCompsProvider’s deterministic search for postal code 78704, 2 beds, 950 sqft, a 2-mile radius, Any baths, 808–1093 sqft and 90 days. The generated bath values are 1 or 1.5; selecting 2 baths would return no matches. Their rents are $2,050, $2,050, $2,175, $2,100, $2,300 and $2,350. Existing core formulas produce a $2,145 suggestion, $2,065–$2,270 range, median rent $2,138 and Medium confidence. Unit 4B’s seed lease/listed/saved-market values are each $1,850. The example sync timestamp and confirmation are illustrative.

## Rent Analysis behavior to preserve

- Multi-unit property scope lists units and their saved estimates. A selected unit is required for a comps suggestion. Single-family uses the implicit unit directly.
- Default radius comes from integration settings; standard controls offer 1/2/3/5 miles and 30/90/180 days. Existing parsing can accept other valid configured radii. Size defaults are ±15% when known. Baths defaults to Any in current core.
- Suggestion uses median price per sqft × subject size, otherwise median rent, rounded to $5. The range uses included rents’ interquartile spread and includes the suggestion.
- Confidence is Low with fewer than four included comps, Medium with at least four, and Medium-high with at least seven and at least three within one mile. Do not market this heuristic as statistical certainty.
- No included comps means no suggestion and no apply action. Explain how to widen/reset filters or include a row. Missing size must disclose the median-rent fallback.
- Caveated rows start excluded. Exclusion updates the map/nearest list/summary and is local to the view; the current workbench resets it after filter/refresh remounts. Do not claim saved exclusions.
- Comps cache keys include organization, unit and filters; daily/weekly TTL comes from settings. Display source, fetched time and cache status. Distinguish loading, failed refresh and any retained stale data.
- applyMarketRent validates $1–$100,000, updates marketRent and actor/time, and does not update Lease.monthlyRent or Unit.listedRent. Despite a whole-dollar comment, the actual parser accepts up to two decimal places. Preserve parser behavior and its error message.
- Occupied units offer Use for renewal; vacant units offer Create lease. The current destination carries only the unit ID. Do not assume that clicking this link forwards or commits the suggestion into a lease: the implementation must verify how the lease form initializes rent and require review there.
- For archived properties/units and stale selections, the new route/action should recheck active property scope, not only rely on a previously rendered selection.
- Demo results stay conspicuously labeled, even if the selected provider is called Rentometer or RentRange. Outside an enabled sandbox, current source throws instead of using a live adapter.

## Validation and recovery

Validate with the imported schema plus application guards. Required purchase price must be positive; costs/rent cannot be negative; down payment/vacancy/rates and percentage fields have defined ranges; loan term is a positive integer; hold is 1–50 years; selling costs are 0–30%; growth fields allow negative growth within schema bounds. Validate size min ≤ max, positive/known location inputs and percentage-versus-fixed-expense exclusivity. Preserve legitimate zero values and distinguish them from missing entries.

Do not calculate misleading partial returns while required financing inputs are absent. Keep property context visible during loading; focus the first invalid input and associate errors with it. Saving and applying disable only their related action while pending. Failure keeps the entered values and offers retry. A calculation error marks prior results out of date rather than presenting them as the new calculation.

The production tab implementation should provide appropriate tab semantics and keyboard behavior, visible focus and announced active panels. The design’s radios/details provide native static interaction, not a substitute for production accessibility tests. A native selectable panel or disclosure must not depend on hover for its only explanation.

## Source limits and intentional adaptations

1. The inspected provider registry contains no live rent comps adapter. No provider endpoint, credential, integration status or live market result was invented.
2. RealROI’s ScenarioComparisonPanel explanatory strings disagree with SCENARIO_PRESETS. The design uses the engine: Optimistic 3% vacancy / 4% rent growth / 4% appreciation; Conservative 8% / 2% / 2%; Best 2% / 5% / 5% with 3% maintenance; Worst 15% / 0% / 0% with 10% maintenance. Base retains saved values.
3. Benchmark rates and source periods are bundled historical constants, not independently verified or current data. The design labels that provenance explicitly.
4. The benchmark component’s match-cashflows state is presented in UI copy but is not used to change its calculation. It is disabled in the design until a real calculation exists.
5. The source’s property volatility proxy is not measured market volatility. The property is omitted from the reference risk scatter; unsupported risk/stability/risk-adjusted radar scores become a dimension table with missing-data labels.
6. The imported engine includes CapEx reserves in its expense total and modeled NOI. Preserve that visible definition or explicitly resolve a metric-contract change; do not silently equate it with recorded operating NOI.
7. Tax output is a simplified model with assumptions including depreciation and recapture; it is optional and labeled an estimate. No tax rates were asserted as applicable to the user. Review the engine’s basis/exit logic before enabling tax output as a production feature.
8. A distinct loan term/amortization period and sale override need adapter verification. The source schema alone does not prove balloon/override behavior is coherent across every panel.
9. No RealROI app build, package import, database migration, live provider call or application regression suite was run for this design-only task.

## Implementation slices

1. **Navigation and selected scope:** add the two sidebar entries, separate selection routes, authorized loaders, property context and unit/all-units/SFH behavior. Preserve existing Listing and recorded Returns entry points.
2. **ROI input adapter and persistence:** map reviewed property values to a versioned DealInput, add missing assumptions, save/reload/error handling, numeric/unit validation and stale-save protection. Do not copy the source library/account system.
3. **ROI calculation and summary:** adapt the engine and lock metric definitions with meaningful fixture tests, including invalid/missing values, zero-interest/all-cash, negative cash flow, exit costs and rounding. Bind forms and what-if changes to results without mutating source property or lease records.
4. **Charts and comparison:** implement all six chart panels, accessible exact data, hold limits, scenario engine values and benchmark provenance. Keep unsupported cash-flow matching and risk measurements unavailable.
5. **Rent Analysis:** reuse the comps service/workbench/filters with route-aware context and revalidation. Test exclusions, empty results, sandbox labels, cache/refresh, missing features, cross-property IDs and safe apply/renewal handoffs.
6. **Responsive and integration validation:** use the phone screen as the 390 px reference; test panel keyboard navigation, form feedback, internal table scrolling and both new routes from sidebar/Listing. Existing app tests should be scoped to the actual implementation changes.

## Verification evidence

Every final assigned screen was rendered and visually inspected with design_screenshot against **revision 27**. These coordinates are reproducible design evidence; screenshots are in the task’s tool trace, not fabricated repository image paths.

| Screen             | Width   | Final screenshot revision | Observed result                                                                               |
| ------------------ | ------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| analysis-selection | 1280 px | 27                        | Complete portfolio/selection/actions; no visible clipping                                     |
| roi-summary        | 1280 px | 27                        | Metrics, statement, chart and assumption column readable; year-end label repaired             |
| roi-projections    | 1280 px | 27                        | Cash-flow chart, bar labels and exact table readable; clipped bar captions repaired           |
| roi-scenarios      | 1280 px | 27                        | Scenario controls, assumptions, cards and chart readable                                      |
| rent-analysis      | 1280 px | 27                        | Filters, summary/apply/table fit; map price-label overlaps repaired                           |
| analysis-phone     | 390 px  | 27                        | Stacked ROI, wrapping tabs, readable chart labels and 44 px actions; no visible page overflow |

Additional design_screenshot inspections: Equity revision 11, Expenses 12, Amortization 13, Exit 14, Sensitivity 15; Benchmarks 17 and Compare 18; phone Rent 19, phone property selection 20 and phone Cash Flow 26. The panel content remains in the final design. Final refinements enlarged small chart labels, corrected the negative sensitivity cell and numbered the phone map/table consistently. Temporary revision 25 had an invalid default-selection toggle during screenshot setup; it was immediately repaired in 26 and the final ROI default restored in 27.

A static navigation audit found **68 screen links**, all targeting one of the six submitted screens, no duplicate element IDs and no label targets missing their input. Native radio panels and details were inspected in rendered alternate states. This checks design structure; it does not prove application routing, calculation or persistence.

Configured Playwright successfully opened the private Charts design target at 1280 px and returned its accessibility snapshot, including the rewritten internal screen links, selected Cash Flow radio and all six chart controls. Subsequent evaluation, click and browser-code requests hung without returning and were terminated. Therefore keyboard/click behavior and measured DOM-overflow checks are **inconclusive**, not reported as passing. No Preview publication or live-app interaction was claimed. Private design-target URLs are intentionally not recorded.

Repository validation is limited to Markdown formatting and Git diff/ownership checks on this handoff. No application source, dependencies or main-design tokens were changed by this task.

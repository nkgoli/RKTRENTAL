# Fictional ROI examples

These three whole-property budgets are entirely invented teaching examples, not market observations, valuations or recommendations. Names, addresses and every assumption evidence entry explicitly identify fictional/demo data. They use the existing public calculation and authorized save/load service without changing either engine or UI.

## Load and identify

After creating a **synthetic demo database** with the existing demo workflow, run this additive companion in PowerShell:

```powershell
$env:DATABASE_URL = '<your synthetic demo PostgreSQL URL>'
$env:ROCKETRENTAL_SANDBOX = 'true'
npm run demo:roi
```

The existing `seed-rocket-rental` organization must exist; no organization or login is created by this loader. `demo:roi` refuses production, remote non-demo hosts and missing sandbox opt-in. It never invokes `demo:seed`, which is destructive. Do not rerun `demo:seed` to refresh these examples. The additive loader leaves existing property/unit rows and saved analyses unchanged, including user-edited drafts. It creates a missing READY analysis only at revision zero; a concurrent create conflict is preserved. Identifier/organization/name/archive collisions fail rather than overwriting records. A partial failed run can be retried. Deleting an example's saved analysis deliberately causes the next load to recreate that analysis.

| Selector name (all prefixed “Fictional Demo —”) | Property ID            |    Price | Acquisition loan |    Down payment | Rate | Monthly whole-property rent |
| ----------------------------------------------- | ---------------------- | -------: | ---------------: | --------------: | ---: | --------------------------: |
| Financed Rental                                 | `demo-roi-v1-financed` | $240,000 |         $180,000 |   $60,000 / 25% |   6% |                      $2,200 |
| Cash Purchase                                   | `demo-roi-v1-cash`     | $180,000 |               $0 | $180,000 / 100% |   0% |                      $1,600 |
| Tight Cash Flow                                 | `demo-roi-v1-tight`    | $280,000 |         $224,000 |   $56,000 / 20% |   7% |                      $1,900 |

Unit IDs are `<property ID>-unit`, named Demo 1, vacant with a fictional listed rent. There are no invented signed leases, collections or expense ledger observations. Saved ROI rent is an explicit forecast budget. Recorded Returns fields are not projection outputs; in particular no historical debt service is fabricated. Open **ROI Analysis**, select a Fictional Demo property, review Summary/Assumptions, Recalculate, then Save ready or Save draft. Reload saved analysis or navigate back to the property to resume.

## Shared assumption inputs

| Section         | Explicit fictional assumptions                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purchase        | Closing costs 2% of price in dollars; rehab $5,000; furnishings $0; acquisition 2026-01-01; ARV omitted (engine uses price)                                                                       |
| Finance         | Explicit acquisition loan above; conventional; 30-year term and amortization; points 0%; fees $0. Cash example retains explicit harmless term/type with zero principal/rate                       |
| Income          | Other income $50/month; economic vacancy 5% of rent plus other income; annual rent/other-income growth 2%                                                                                         |
| Operating costs | Tax $2,400/year; insurance $1,200/year; HOA $0/month; maintenance 5% of gross rent; management 8% of effective income; utilities $50/month; leasing $300/year; other $200/year; expense growth 2% |
| Reserve         | CapEx 5% of gross rent, below NOI; no fixed overrides or terminal reserve recovery                                                                                                                |
| Hold/exit       | Appreciation 2%/year; hold 10 years; selling costs 6%; no sale override                                                                                                                           |
| Options         | Model start 2026-01-01 UTC; fractional discount rate 0.08; tax analysis omitted; no scenarios or benchmarks                                                                                       |

Currency values are dollars, never cents. Financial percentage fields are percentage points; discount rate alone is fractional. Every supplied input field and both calculation options carry a fixed synthetic provenance annotation. Database audit timestamps remain actual timestamps.

## Expected and observed calculations

Independent test equations: effective income = `(rent + 50) × 12 × .95`; operating costs = `4700 + rent × 12 × .05 + effective income × .08`; NOI = effective income minus operating costs. Monthly payment is the standard 360-payment annuity at annual rate / 1200, rounded to cents. Annual spendable cash = NOI minus 12 monthly debt payments minus `rent × 12 × .05` reserve. These independently expected values matched the public engine:

| Metric                    |   Financed |        Cash |       Tight |
| ------------------------- | ---------: | ----------: | ----------: |
| Effective annual income   |    $25,650 |     $18,810 |     $22,230 |
| Annual operating expenses |     $8,072 |   $7,164.80 |   $7,618.40 |
| NOI                       |    $17,578 |  $11,645.20 |  $14,611.60 |
| Monthly debt payment      |  $1,079.19 |          $0 |   $1,490.28 |
| Annual reserve            |     $1,320 |        $960 |      $1,140 |
| Annual spendable cash     |  $3,307.72 |  $10,685.20 |  −$4,411.76 |
| Initial cash required     |    $69,800 |    $188,600 |     $66,600 |
| Engine leveraged IRR      |   11.1595% |     6.8206% |     3.2226% |
| NPV at explicit 8%        | $18,880.78 | −$15,531.07 | −$29,271.01 |

Summary annual cash reconciles the annual budget; summed individually rounded monthly flows may differ by pennies. Undefined ratios (cash DSCR, unavailable tax returns/payback) remain null. Tight cash flow is negative despite a positive modeled sale-driven IRR. No output implies a guaranteed return.

## Verification and environment record

Accepted UX source was the exact initial HEAD `47eb2d16354f94d11a7967db076743dec1f46b5e`; `git merge-base --is-ancestor` passed before editing and at verification. No other Task changes were present.

Only this Task's synthetic runtime received data: `.data/fictional-roi-demo/postgres`, PostgreSQL database `fictional_roi_demo` on loopback port 55579, Next development app on port 3179, local storage beneath `.data/fictional-roi-demo/storage`. No application `.env` or live database URL was used by the runtime. The first run deployed migrations, used `prisma/seed.ts` only to initialize its fresh synthetic organization/login, and created all three examples. Later `npm run demo:roi` returned three `preserved` outcomes. The runtime data remains on disk.

Reproduce with `node --import ./prisma/os-userinfo.mjs tests/analysis/roi-demo-runtime.mjs` after `npm ci` and `npm install --prefix prisma`. The runtime launches development mode, requires no production build, and reuses its own synthetic data. In an interactive terminal, enter `q` to stop its app/database. Ports must be free. Windows sandbox restricted-token initialization failed; the admitted process capability successfully initialized the dedicated cluster. Prisma engine download likewise required the admitted process capability.

Checks observed passing:

- `node --import ./prisma/os-userinfo.mjs node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/analysis/roi-examples.test.ts tests/analysis/contract.test.ts`, with `RUN_ROI_DEMO_DB=1` and the dedicated runtime URL: **16/16 passed**. Includes independently reconciled budgets/loan payments, complete payload validation, selector/save/resume, two repeated loads, unchanged property/unit/lease/payment/expense records, and unchanged saved analyses after an ordinary user-style rent edit. The synthetic rent edit was restored through the revision API.
- Prisma generate and validate; project TypeScript check; ESLint for the three added TypeScript files; scoped Prettier; `git diff --check`.
- Browser through the configured Playwright profile: selector displayed all three names; each was selected, recalculated, saved READY and reloaded successfully. Financed saved/resumed revision 6, cash revision 2, tight revision 2. Each also survived a fresh page navigation. Browser annual cash was respectively **$3,308**, **$10,685**, **−$4,412**, matching rounded expected values; displayed cap rates 7.3%, 6.5%, 5.2% and IRRs 11.2%, 6.8%, 3.2% also matched. Later preservation tests incremented only the financed analysis revision through normal saves.

Browser evidence: [selector](roi-demo-evidence/selector.png), [financed resumed](roi-demo-evidence/financed-resumed.png), [cash resumed](roi-demo-evidence/cash-resumed.png), [tight resumed](roi-demo-evidence/tight-resumed.png). The tight screenshot was visually inspected. An initial login with the wrong demo email failed; using the actual Prisma-seed login succeeded. A favicon 404 was incidental; all required flows passed.

Runtime ownership/release: this Task started and exclusively owned both processes and storage. After checks, the exact owned app launcher was stopped, triggering its runtime cleanup; the runtime exited successfully. A process/port check found no owned app/runtime/PostgreSQL processes and no listeners on 3179 or 55579. The configured browser used its isolated profile; no native desktop ownership was taken. No Preview publication, deployment, root integration or push is claimed.

# Actual demo ROI investigation — resolved

Observed and resolved 2026-10-20 in the user's running demo app. The earlier browser-custody
blocker is cleared; the full flow below was performed in the authenticated app.

## Environment

- Browser origin: http://localhost:3100, signed in as the seed demo manager Jordan Mills
  (jordan.mills@rocketrental.example, organization seed-rocket-rental), the account shown in the
  admitted screenshot.
- App: Next PID 60368 running the root checkout's `next start -p 3100`, launched by
  `scripts/start.ps1 -Port 3100 -DbPort 5433`. Root HEAD 2baf757b56fd8d74b355d5db06ca1d283b804614,
  `.next/BUILD_ID` xGPw1-iniRu859GLdczxJ. The app was not rebuilt or restarted; this task changed no
  runtime source, so the running build is the one verified.
- Database: PostgreSQL on localhost:5433, database rocketrental, schema public. PID 60368 holds
  established connections to 5433; nothing listens on 5432 (the `.env` default), which
  `start.ps1` overrides with `-DbPort`. Credentials are not recorded here.

## Reproduction and cause

Signed in and opened `/roi-analysis?property=seed-property-maple`: Maple Court, 214 Maple Ave,
Whole property, Revision 0, purchase price 2830000 and loan 1980000 filled, "19 assumptions to
review", all outputs Unavailable — identical to the screenshot (live-maple-before.png).

Cause: the four `prisma/seed.ts` properties carry only canonical price/debt columns; their
optional `Property.roiInputs` was null and no `RoiAnalysisState` existed. The existing
`npm run demo:roi` loader only creates three separate `demo-roi-v1-*` example properties (loaded
into a different isolated database earlier) and never populated the seed properties. The app
behaved correctly: new drafts map recorded price/debt only, and unknown assumptions stay unknown
(Maple's scheduled rent is also absent because unit 3A has no active lease, so the lease schedule
is incomplete). No mapping, persistence or saved-analysis precedence defect was found.

## Fix and data change

`prisma/seed-roi-inputs.ts` defines fictional/demo v1 forecast assumptions (`seed-roi-inputs-v1`)
for the four seed properties; monthly rent is the sum of the seed's fictional unit rents. It is
applied by `npm run demo:roi` (and alone via `npm run demo:roi -- --seed-inputs-only`). Under the
property row lock, it writes only when the record has the seed organization, name and street, is
not archived, and `roiInputs` is still null. It never writes price/debt, units, leases or saved
analyses. A second run reported `preserved: existing ROI inputs` for all four.

Applied with `--seed-inputs-only` to the live database:

| Property | Before roiInputs | After (price/debt unchanged) |
| --- | --- | --- |
| seed-property-maple | null | rent 23000/mo, tax 52000, insurance 14000, rate 6.5% |
| seed-property-harbor | null | rent 42490/mo, tax 88000, insurance 24000, rate 6.75% |
| seed-property-cedar | null | rent 13200/mo, tax 27000, insurance 8000, rate 6.25% |
| seed-property-elm | null | rent 1690/mo, tax 7600, insurance 1900, rate 6.5% |

Common values: closing 25000, rehab 15000, furnishing 0; 30-year conventional, points 0, lender
fees 3500; other income 0, vacancy 5%, rent growth 2%; HOA/utilities/leasing/other 0, maintenance
5%, capex 5%, management 8%, expense growth 2.5%; appreciation 3%, hold 10 years, selling 6%;
start 2026-01-01, discount rate 0.08.

Preservation: before/after snapshots show unchanged price/loan columns, unit and lease table
hashes (98289b85… and 8990da31…), `RoiAnalysisState` still empty, and the unrelated
maintenance-pages-property (organization maintenance-pages-synthetic-20261019) untouched.

## Live browser results

| Property | Annual cash flow | Cap rate | Cash-on-cash | Leveraged IRR |
| --- | ---: | ---: | ---: | ---: |
| Maple Court | -$2,555 | 5.7% | -0.3% | 8.4% |
| Harbor View Lofts | $21,911 | 6.4% | 1.5% | 9.9% |
| Cedar Row Townhomes | $11,499 | 6.5% | 2.4% | 10.1% |
| 18 Elm Street | -$15,723 | 1.8% | -9.4% | -2.1% |

Each showed "Calculated automatically from your current assumptions". Maple checks: gross
potential income $276,000 (23000 × 12), debt service $150,179 (1.98M, 6.5%, 30 years), cash
required $893,500 (850000 down + 25000 + 15000 + 3500). Harbor stayed calculated after a page
reload; switching Harbor → Maple through Change property gave the same Maple results.
Screenshots: live-maple-after.png, live-harbor-after-reload.png.

Customer entry through the dedicated pages:

- Add page, test property `cmvgvmcno0001b9kw3fw52wgl` "TEST ROI Verification (fictional)
  2026-10-20": price 321000, closing 0, loan 240000, rate 6.125, rent 2345, vacancy 4. The Edit page
  reloaded exactly those values with every other field blank. Adding loan term 30 through Edit
  persisted. ROI prefilled all seven values as property source and listed 16 remaining assumptions
  with no calculation (live-test-property-partial-roi.png).
- Add page with no ROI details, test property `cmvgvn4n10005b9kw0prz2dx3` "TEST No-ROI
  Verification (fictional) 2026-10-20": saved normally, stored roiInputs empty and price/debt null.

Both test properties are left in the demo organization, clearly labeled, for review; archive them
from the property page if not wanted. No demo analysis was saved, so no saved override was created.

## Isolated check

`tests/roi/seed-roi-inputs.test.ts` confirms the four input sets omit price/debt, combine with
the seed columns with no missing data, and give Maple the same -$2,555 annual cash flow seen live.

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

## Demo provenance (review follow-up)

Review found the fictional values were labeled "property source - review for forecast" with no
demo identification. The loader now records the values it writes in the additive
`PropertyRoiProvenance` table (migration `20261023000000_property_roi_provenance`); the contract
is in property-roi-inputs.md, "Fictional demo provenance".

Why a separate table: the running 3100 build validates `Property.roiInputs` strictly. A
provenance key inside that JSON would make that build ignore the stored inputs, and an edit there
could drop them. The table is invisible to that build.

How customized values are handled:

- A value is labeled demo only while it equals the recorded value and is not cleared.
- Supplying or clearing a value through property create/update or the ROI property patch removes
  its provenance in the same transaction, so a re-entered identical number stays the customer's.
- Records with existing inputs and no provenance get labels only for still-matching values. The
  inputs themselves are never rewritten, and a record with no matching values gets no row.
- Saved analyses keep their own evidence. Values the manager edits are recorded as manager
  evidence, without `demo`.

Live application, 2026-10-20 16:2x UTC, database localhost:5433/rocketrental:

- `prisma migrate status` listed only `20261023000000_property_roi_provenance` as pending, and
  `migrate deploy` applied just that migration.
- `demo:roi -- --seed-inputs-only` reported `provenance added for 28 unchanged demo values` for
  seed-property-maple, -harbor, -cedar and -elm; a rerun reported `preserved: existing ROI inputs
  and provenance`.
- Those four Property rows kept `updatedAt` 2026-10-20T16:05:42Z, price/debt and identical
  `roiInputs`. The two TEST properties and maintenance-pages-property got no provenance row.
  `RoiAnalysisState` stayed empty.

Browser capture. The candidate was built from this checkout and served temporarily on
localhost:3101 against the same database and the Jordan Mills account, because the user's 3100
app runs the root checkout's existing build. That temporary server and the browser were stopped
afterwards.

- Maple ROI: "Sample data: 28 assumptions are fictional demo values (seed-roi-inputs-v1), not
  recorded actuals" appears, and each demo field reads "Fictional demo value - not a recorded
  actual". Purchase price and loan keep "property source - review for forecast". Still calculated
  automatically, -$2,555 (live-maple-demo-provenance.png).
- Customized, unsaved: rent 24000 changes that field to "Manager assumption", the count drops to
  27 and the result recalculates to $6,733 (live-maple-customized-unsaved.png). Reload discarded
  it and restored 28, rent 23000 and -$2,555.
- Switching to Harbor View Lofts via Change property shows 28 and calculates
  (live-harbor-demo-provenance-switch.png).
- Non-demo TEST property `cmvgvmcno0001b9kw3fw52wgl`: no notice and no demo labels; its entered
  values stay "property source", with 16 assumptions to review (live-test-property-no-demo-label.png).
- Maple Edit page: notice plus 28 field labels. Editing rent removed only that field's label (27),
  and vacancy kept its label (live-maple-edit-demo-labels.png). Left without saving.
- The user's 3100 app still calculated Maple at -$2,555 after the migration. It shows the
  designation once it runs a build that includes this change.

Isolated database tests: `tests/roi/demo-provenance-db.test.ts`, run through
`tests/analysis/property-inputs-runtime.mjs` on embedded PostgreSQL, covers populate, partial
backfill around a customized value, skipping genuine and renamed records, idempotency, and release
on edit/clear with matching property and draft output.

## Recurrence 2026-10-20 12:13 PDT — app relaunched on a new, empty database

Screenshot: Maple Court, Revision 0, 19 assumptions missing, recorded income $215,850 /
expenses $80,000, no demo labels. Reproduced at http://localhost:3100 as Jordan Mills
(live-5434-maple-before.png).

Cause: at 11:57 PDT the app was relaunched from a Windows Terminal with
`scripts\start.ps1 -Port 3100 -DbPort 5434` instead of the RocketRentalLive3100 task (5433;
its last run ended at 11:29). start.ps1 keeps one data dir per port, so this initialised a new
`.data\postgres-5434`, ran only `prisma/seed.ts`, and served that. The seed has never set
`Property.roiInputs`; the demo inputs only existed in 5433 via a manual `demo:roi` run. 5434
had null `roiInputs`, no provenance and no saved analysis, and nothing was written after
seeding (latest row 18:57:30Z). Loading and precedence code behaved correctly. The earlier
verification was right for 5433 but could not cover a database created later. The different
actuals ($215,850 vs $79,000 on 5433) come from the two databases being seeded on different dates.

Fix (scripts/start.ps1): when start.ps1 seeds a new data dir it now also runs
`load-roi-examples.ts --seed-inputs-only` (sandbox only). It also warns which existing
`.data\postgres-*` dirs a new -DbPort is not using.

Data:

- 5434: the loader reported `populated seed-roi-inputs-v1` for all four seed properties and
  `preserved` on rerun. Price/loan unchanged, no saved analysis. The data dir is kept.
- 5433: untouched. It still has 28 provenance values per seed property, the Elm saved draft and
  both TEST properties.

Live app: the terminal copy was stopped (its Postgres shut down cleanly). RocketRentalLive3100
(3100 / 5433, build QzQCdwr0mLAaF-TF0TJpQ) was started. Then app and Postgres were stopped
manually (`Stop-ScheduledTask` alone leaves them running) and the task restarted.

- Maple: calculated automatically; 28 demo values labeled; -$2,555 / 5.7% / -0.3% / 8.4%.
  The table agrees: 276,000 − 13,800 − 100,776 = 161,424 NOI, minus 13,800 reserves and
  150,179 debt service = −2,555. Same after reload, after the restart, and at 390 px with no
  overflow (live-5433-maple-after-desktop.png, live-5433-maple-after-390.png).
- Harbor (switched with Change property): $21,911. Cedar: $11,499. Elm: −$15,723.
- TEST properties: no demo labels, still 16 / 20 assumptions to review.

## Isolated check

`tests/roi/seed-roi-inputs.test.ts` confirms the four input sets omit price/debt, combine with
the seed columns with no missing data, and give Maple the same -$2,555 annual cash flow seen live.

# Preserved local ROI dataset

The screenshot supplied on October 20, 2026 belongs to the embedded database in
`.data/postgres-5434`, not `.data/postgres-5433`. These are separate datasets.
Keep both directories; do not copy, merge, reseed or reset them to switch the app.

Use the explicit launcher from the project checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-live.ps1 -SkipInstall
```

It pins `http://localhost:3100` to `localhost:5434/rocketrental` on every run,
overriding stale port settings. The redacted effective connection is
`postgresql://[redacted]@localhost:5434/rocketrental?schema=public`.
Use `-StopExisting` for a deliberate restart and `-Rebuild` when needed.
The logon task `RocketRentalLive3100` (`scripts/register-live-task.ps1`, default
`-DbPort 5434`) serves the same dataset and survives restarts; see
`realroi-chart-parity.md` §12.5 and §12.7.
The root checkout's local `.env` also records the selected app/database ports.
The older untracked `start-rocketrental.ps1` is a separate Preview launcher;
use `scripts/start-live.ps1` for this dataset.

## Same-period actuals and coverage

For November 1, 2025 through October 20, 2026, inclusive:

| Dataset                       | Recorded operating income | Recorded operating expenses | Recorded NOI |
| ----------------------------- | ------------------------: | --------------------------: | -----------: |
| Screenshot dataset, port 5434 |                  $215,850 |                     $80,000 |     $135,850 |
| Separate dataset, port 5433   |                   $79,000 |                     $24,000 |      $55,000 |

These totals are observed records, not the fictional ROI forecast assumptions.
“Partial” describes the records' coverage of that reporting period:

- Rent has 324 evidenced days out of 354. November 1–30, 2025 is not evidenced
  by a lease term with a rent charge.
- Expenses have 293 evidenced days out of 354. November–December 2025 has no
  recorded expense. Missing months are not treated as confirmed zero spending.
- Actual loan payments are not recorded. Actual cash flow and actual
  cash-on-cash therefore remain unavailable; modeled loan payments are projections.

The stored Maple loan is $1,980,000. Its modeled annual debt service is
$150,179.40; the cash-purchase button changes the unsaved assumption to $0.
Its label now states that action explicitly. It does not describe the current
financing status.

## Isolated initial startup check

The actual `scripts/start.ps1` path was run with `-Dev -Port 3191 -DbPort 5541
-SkipInstall` in the task checkout, initially with a new, empty data directory.
It initialized PostgreSQL, applied migrations, seeded the four properties,
ran `load-roi-examples.ts --seed-inputs-only`, created `.demo-seeded` and served
`/sign-in` successfully. No startup code failure was found.

All four seed properties had zero missing calculation inputs and 28 assumptions
labeled `seed-roi-inputs-v1`. For preservation testing only, the isolated Maple
rent was changed to $23,456/month and a $123.45 expense was added. A real second
startup skipped seeding, retained the marker timestamp and preserved the hashes
of every row in all 32 application tables. The edited rent no longer received
a demo label; the other 27 assumptions retained theirs.

`start.ps1` now separates its default logs by app/database port pair and accepts
`-LogDirectory` for checks with separate initial/repeat logs. Test data stays in
its isolated directory; neither live database is used for initial seed tests.

## Live verification

The production build was rebuilt and served at the URL above, then the app and
database were stopped and restarted using the pinned launcher without supplying
ports. The repeat run reused the same production build, applied no migrations
and skipped seeding. Both live database directories remain intact. All row
hashes in all 32 application tables matched each database's own baseline after
the repair; the isolated helpers were stopped while the live app remained up.

Browser checks at 1440px and 390px confirmed populated Maple assumptions, the
demo notice and the same-period actuals above. There was no horizontal page
overflow. Switching from Maple to Harbor and back loaded each property's own
loan and inputs. A full reload and the real restart retained Maple's inputs and
actuals. The chart and exact table agree: year 1 cash flow is -$2,555.40, year 2
is -$175.80 and year 2 cumulative cash flow is -$2,731.20. Year 1 debt service
is $150,179.40.

The cash action was tried on an unsaved Maple draft only: loan became $0,
modeled debt service $0 and annual cash flow $147,624. The draft was discarded
by a full reload, restoring the stored $1,980,000 loan. No save was performed
and no database rows changed. Maple has no saved analysis revision in this
dataset; “Reload saved analysis” reports the new-analysis state when none exists.
The positive loan is a saved property detail.

Focused ROI seed, actual-comparison and workspace tests, TypeScript, component
lint, PowerShell parsing and the production build were checked. Browser console
checks after the rebuild reported no errors. The record coverage gaps and the
absence of actual loan payments described above are the remaining missing data;
they are not filled with forecast assumptions.

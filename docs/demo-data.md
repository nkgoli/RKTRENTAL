# Demo data

Run an embedded local PostgreSQL server, apply migrations, then reset and seed the demo database:

```powershell
npm run db:local
# In another PowerShell window:
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:5432/rocketrental?schema=public'
npm run db:migrate
npm run demo:seed
npm run dev
```

`npm run demo:seed -- --seed 42` chooses the deterministic random sequence (42 is the default). The command **truncates application tables** before inserting demo rows. It preserves Prisma migration history and never calls `prisma/seed.ts`. It always refuses `NODE_ENV=production`. It also refuses a database host outside `localhost`, `127.0.0.1`, `::1`, `demo`, or `*.demo` unless `--force-demo` is supplied. `--force-demo` does not bypass the production guard. A database connection is required; the command does not start PostgreSQL itself.

The generator keeps 18 Elm Street, Maple Court, Cedar Row Townhomes, and Harbor View Lofts, then adds four Austin properties. It builds 69 units with about five years of sequential lease history and upcoming lease drafts. Renewals increase rent by 2–6%. Signed leases contain a copy of the lease template version current at signing: the 2021 edition for older terms and the standard version 2 for newer terms. Ledger charges and payments follow the application's setup, rent due date, late fee, balance, and refund rules. It adds applications with screening summaries, several years of expenses and maintenance, and locally generated placeholder pictures through the configured storage adapter. Tenant and applicant contact data uses `example.com` and 555-01xx numbers.

Each new lease household has a selected application group whose approved applicants have the same names and email addresses as its tenants. A competing group accompanies each turnover. Older competing groups have archived screening reports; newer ones show declined, in-progress, or completed screening states. Vacant units and active leases ending within 90 days also have open invited or in-progress groups. Every group has 1–3 applicants. The current database stores individual applications, so the shared `demo-group-…` prefix in application IDs identifies a group; the trailing `-applicant-N` identifies its members. The unit Applications tab lists those members as rows.

Pictures are locally generated PNG placeholder cards with a gradient, simple icon, and short label. No photos or fonts are downloaded. Every property has one cover and three to six gallery cards; every unit has one to three cards. Roughly half of historical maintenance requests have one to three issue-labelled pictures, including tenant-submitted requests. The generator writes each file through the configured storage adapter and creates a Document record; repair pictures also have MaintenancePhoto attachments. Repair Documents use lease targets, matching tenant uploads, so they do not consume a unit's gallery photo limit. Property and unit cards have explicit cover and sort order. The seed stops if configured photo limits cannot accommodate these galleries.

Run the database audit after seeding to check photo counts, ordering, cover selection, limits, repair attachments, and the existence and size of every stored Document file:

```powershell
$env:DEMO_SEED_VERIFY = '1'
npm run test -- scripts/demo-seed/database.test.ts
```

Demo manager login: `jordan.mills@example.com` / `JordanDemo#2026`.

The seed prints total and per-type picture counts, elapsed time, and a per-property, per-year table of leases, charges, payments, application groups, and applicants. Years use lease start dates, charge due dates, payment paid dates (or creation dates for unpaid rows), and group/application dates. Re-running with the same seed and date recreates the same property, unit, tenant, lease, charge, applicant, maintenance, and document IDs and content. Server-generated metadata such as `updatedAt` can differ between runs.

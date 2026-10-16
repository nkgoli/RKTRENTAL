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

The generator keeps 18 Elm Street, Maple Court, Cedar Row Townhomes, and Harbor View Lofts, then adds four Austin properties. It builds 69 units with about five years of sequential lease history and upcoming lease drafts. Renewals increase rent by 2–6%. Signed leases contain a copy of the lease template version current at signing: the 2021 edition for older terms and the standard version 2 for newer terms. Ledger charges and payments follow the application's setup, rent due date, late fee, balance, and refund rules. It adds applications with screening summaries, several years of expenses and maintenance, and original procedural PNG illustrations through the configured storage adapter. Tenant and applicant contact data uses `example.com` and 555-01xx numbers.

Each new lease household has a selected application group whose approved applicants have the same names and email addresses as its tenants. A competing group accompanies each turnover. Older competing groups have archived screening reports; newer ones show declined, in-progress, or completed screening states. Vacant units and active leases ending within 90 days also have open invited or in-progress groups. Every group has 1–3 applicants. The current database stores individual applications, so the shared `demo-group-…` prefix in application IDs identifies a group; the trailing `-applicant-N` identifies its members. The unit Applications tab lists those members as rows.

Demo manager login: `jordan.mills@example.com` / `JordanDemo#2026`.

The seed prints total counts, elapsed time, and a per-property, per-year table of leases, charges, payments, application groups, and applicants. Years use lease start dates, charge due dates, payment paid dates (or creation dates for unpaid rows), and group/application dates. Re-running with the same seed and date recreates the same property, unit, tenant, lease, charge, applicant, maintenance, and document IDs and content. Server-generated metadata such as `updatedAt` can differ between runs.

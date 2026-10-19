# Rent Analysis integration contract

Contract for the standalone, property-selected Rent Analysis dashboard at
`/rent-analysis`. This slice makes the existing rent-comparison controls
context-aware; it does not add the dashboard page, sidebar entry or visuals.
The numerical engine (`src/lib/comps/core.ts`) and persistence service
(`src/lib/comps/service.ts`) are unchanged and out of scope here.

## Navigation context

`src/lib/comps/navigation.ts` is the single source of truth. The surface is
chosen by the host page in code â€” never from a query value â€” and no return URL
is accepted from the request.

| Export | Meaning |
| --- | --- |
| `CompsSurface` | `'legacy' \| 'listing' \| 'rent-analysis'` (allowlist: `COMPS_SURFACES`, guard: `isCompsSurface`) |
| `CompsNavContext` | `{ surface, propertyId, unitId }`; constructors trim ids; empty becomes `null` |
| `legacyContext(unitId?)` | Historical behaviour: `/rent-comps?unit=â€¦`, which redirects into the unit Listing |
| `listingContext(propertyId, unitId?)` | `/properties/<propertyId>/listing?unit=â€¦` |
| `rentAnalysisContext(propertyId, unitId?)` | `/rent-analysis?property=â€¦&unit=â€¦` |
| `parseCompsContext(params, surface)` | Reads only `property`/`unit` from a query; `returnTo`/`next`/`redirect` are ignored. Returns `null` for a property-scoped surface without a property |
| `buildCompsHref(context, filters?)` | Full href carrying property, unit and filters |
| `compsSurfacePath(context)` | Base path only; a `listing` context without a property falls back to `/rent-comps` |
| `unitsForProperty(units, propertyId)` | Units of the selected property only |
| `resolveContextUnit(units, context)` | The selected unit, or `null` when it belongs to another property/organization â€” never a fallback to another property's unit |
| `isAllowedCompsPath(value)` | True only for `/rent-comps`, `/rent-analysis`, `/properties/â€¦`; absolute and protocol-relative URLs are rejected |
| `COMPS_REVALIDATION_PATHS` | `['/rent-comps', '/rent-analysis']` |

Property/unit identity follows the existing organization-scoped contract:
the shared `loadAnalysisSelectionAction()` returns authorized nonarchived
properties and units (see [data-contract.md](data-contract.md)); the panel
uses `listPricingUnits(organizationId)`,
so another organization's property or unit reads as not found, and a selected
unit is always re-checked against the selected property before use.

## Query keys

Selection keys: `property`, `unit`. Filter keys (written by `filtersToQuery`,
parsed and validated by `parseFilters` via `filtersFromQuery`):

| Key | Values |
| --- | --- |
| `radius` | Miles; default from comps integration settings, standard options 1/2/3/5 |
| `beds` | 0 (studio) â€“ 4+; default from the subject unit |
| `baths` | `any`, 1, 1.5, 2, 2.5; default `any` |
| `minSqft` / `maxSqft` | Default Â±15% of subject size when known |
| `days` | 30 / 90 / 180; default 90 |
| `status` | `all` / `listed` / `leased`; default `all` |

Filter parsing follows the existing `parseFilters` contract. Empty size bounds
are serialized explicitly so an unbounded search survives unit selection.

## Component API

`RentCompsPanel` (`src/components/rent-comps/RentCompsPanel.tsx`) accepts an
optional `context?: CompsNavContext`. Without it, behaviour is exactly the
legacy one: forms post to `/rent-comps` and the picker offers every pricing
unit in the organization. With a property-scoped context:

- the picker offers only the selected property's units,
- the unit picker preserves property and current filters as hidden fields,
- the filter bar preserves property and unit as hidden fields,
- forms post to `compsSurfacePath(context)` (`/rent-analysis` or the Listing path),
- the workbench "Reset filters" link keeps property/unit on the same surface
  (`resetHref` prop on `CompsWorkbench`, defaulting to the legacy href).

`FilterBar` / `UnitPicker` (`src/app/(manager)/rent-comps/FilterBar.tsx`) accept
optional `propertyId` (hidden `property` field) and, for the picker, `filters`
(hidden filter fields). All new props are optional; existing callers are
unchanged.

## Actions and revalidation

`src/app/(manager)/rent-comps/actions.ts` keeps the existing manager-authorized
behaviour. Both `applyRentAction` and `refreshCompsAction` scope every lookup
and cache clear to `session.organizationId` â€” form-supplied organization or
return values are never read â€” and then revalidate `/rent-comps`,
`/rent-analysis` and `/properties` (layout), so the Listing and the standalone
dashboard both reflect a refresh or an applied rent.

`applyMarketRent` updates only the unit's saved market rent plus actor/time.
It does not change `Lease.monthlyRent`, `Unit.listedRent` or any active lease
term; occupied units continue to "Use for renewal" and vacant units to
"Create lease" in the lease flow, where rent is reviewed.

## Integration example

The dashboard page (next slice) loads the authorized scope and renders:

```tsx
import { RentCompsPanel } from '@/components/rent-comps/RentCompsPanel';
import { parseCompsContext, resolveContextUnit } from '@/lib/comps/navigation';
import { listPricingUnits } from '@/lib/comps/service';
import { loadAnalysisSelectionAction } from '@/app/(manager)/roi-analysis/actions';

const context = parseCompsContext(query, 'rent-analysis');
if (!context) return <PropertySelection />; // no property selected yet
// Validate property independently, including properties with no pricing units.
const selection = await loadAnalysisSelectionAction();
if (!selection.ok || !selection.data.some((p) => p.id === context.propertyId))
  return <SelectionRecovery />;
const units = await listPricingUnits(session.organizationId);
const unit = context.unitId ? resolveContextUnit(units, context) : null;
if (!unit) return <SelectionRecovery />; // stale/cross-property unit
return (
  <RentCompsPanel
    organizationId={session.organizationId}
    unitId={unit.id}
    searchParams={query}
    context={context}
  />
);
```

A property change resets unit, filter and exclusion state (the workbench
remounts on unit/filters, as today). Archived property/unit and stale
selections produce the host's explicit recovery state, not a silent fallback.

## Regression coverage

- `tests/comps/navigation.test.ts` â€” surface allowlist, legacy default,
  property/unit/filter preservation, cross-property unit rejection, arbitrary
  return-URL rejection.
- `tests/comps/filter-bar.test.tsx` â€” hidden property/unit/filter fields on the
  standalone surface and the unchanged legacy form shape.
- `tests/comps/actions.test.ts` â€” session-organization scoping for apply and
  refresh, revalidation of Listing and Rent Analysis, no revalidation on a
  rejected apply, submitted return values ignored.

Existing Listing controls keep the legacy context, so their coverage remains
`tests/rent-comps/` plus manual verification of the Listing screens; the
standalone dashboard itself is covered once its page lands in the next slice.

## Verification for this slice

Focused Vitest checks cover navigation and empty size-bound round trips, form
fields, panel rejection before provider access for inconsistent property/unit
contexts, action organization scope and revalidation, and exact market-rent-only
persistence writes (no listed rent or lease update). Existing comps calculations
and workbench regressions also pass. Scoped ESLint passes.

Full `npm.cmd run typecheck` failed outside these paths: installed dependencies
lack `zod`, and the available Prisma client lacks `roiAnalysisState`. No type
errors were reported in this slice's files.

Native Windows MCP verification took desktop ownership and used the human's
existing Edge window against this checkout's temporary Next dev server on port
3000. `/rent-comps` reached sign-in; submitting the documented demo manager login
returned the application error state. The dev server reported
`PrismaClientInitializationError`: database unreachable at `localhost:5432`.
Existing Listing interaction, keyboard, phone-width, refresh and apply mutation
coverage are therefore **unavailable**, not passed. No business-data mutations
were performed. The original browser URL was restored, desktop ownership released,
and the temporary server stopped. Future standalone dashboard visual/interaction
coverage remains the next slice's responsibility.

## Validation completion (2026-10-19)

The follow-up validation supersedes the dependency/database limitations above.
Routing candidate `23b55f33a8b27196c66604968d5e1faf81a20384` is an ancestor of
the tested checkout at `e65385b66c308e11e8f4bd9974f3891b88064946`. No routing,
Listing, calculation or persistence implementation changes were needed.

### Reproducible isolated setup

Run from the assigned checkout in PowerShell. Use the committed lockfiles:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd ci --prefix prisma --ignore-scripts --no-audit --no-fund
$env:ROCKETRENTAL_DB_PORT='55435'
$env:ROCKETRENTAL_DB_DIR=Join-Path (Get-Location) '.orchestra/task-02a35c0b-db'
node --import ./prisma/os-userinfo.mjs prisma/local-postgres.mjs
```

Keep that process running. In a second PowerShell session set the isolated URL
explicitly; never substitute the shared/user database. Migrate and seed only a
**new Task-owned cluster**; keep an existing verification cluster as-is.

```powershell
$env:DATABASE_URL='postgresql://rocketrental:rocketrental@localhost:55435/rocketrental?schema=public'
npx.cmd prisma migrate deploy
$env:NODE_ENV='development'
node --import ./prisma/os-userinfo.mjs --import tsx prisma/seed.ts
node tests/comps/verification-database.mjs baseline
$env:ROCKETRENTAL_AUTH_SECRET='task-02a35c0b-isolated-verification-only-0123456789'
$env:ROCKETRENTAL_SANDBOX='true'
$env:ROCKETRENTAL_AUTH_COOKIE_SECURE='false'
node --import ./prisma/os-userinfo.mjs --import tsx tests/comps/verification-runtime.mjs
```

Observed identity: PostgreSQL 16.14, database `rocketrental`, port `55435`,
data directory `<assigned checkout>/.orchestra/task-02a35c0b-db`;
19 current migrations applied; existing seed produced 4 properties, 45 units,
41 occupied leases and 4 applications. Runtime listens only on
`http://127.0.0.1:3145`, with generated output in
`.next/verification-02a35c0b`. SQL `current_database()`, `inet_server_port()` and
`current_setting('data_directory')` confirmed database identity; `/sign-in`
returned HTTP 200 before desktop acquisition. No shared `.env` was modified.
The initial sandbox install failed with registry `EACCES`; elevated retry
succeeded. Embedded Postgres also required an elevated process because Windows
restricted-token initialization failed. No dependency versions/lockfiles changed.
`npm ci` generated Prisma Client 6.19.3, including the current ROI models.

### Final self-checks

All commands below passed in the prepared checkout:

```powershell
npm.cmd test -- tests/comps tests/rent-comps
npm.cmd run typecheck
npx.cmd eslint src/components/rent-comps 'src/app/(manager)/rent-comps' src/lib/comps/navigation.ts tests/comps --max-warnings=0
node --import ./prisma/os-userinfo.mjs --import tsx tests/comps/verification-isolation.ts
node tests/comps/verification-database.mjs verify
```

Focused Vitest: 7 files / 36 tests passed. Full project typecheck passed,
including the additional verification helper. Scoped lint passed. The database
helper asserts every lease field and every unit field against the pre-UI baseline:
native apply changed `seed-unit-maple-7` from $1,675 to $1,725, with
`marketRentSetById`, `marketRentSetByName`, `marketRentSetAt` and Prisma's
automatic `updatedAt`. Its listed rent remained $1,600; all 41 complete lease
rows and all other 44 complete unit rows were identical. The baseline remains
local under `.orchestra/`, not in Git. The service isolation helper uses this
database to reject a foreign organization lookup/write and checks cache-key and
refresh isolation with an injected deterministic provider. This complements the
focused action/session tests; it is not a second-organization browser login.

### Native Edge observations

Used Windows MCP with the existing human Edge session, under desktop ownership.
Screenshots are full Windows desktop captures made through Windows MCP using
`tests/comps/capture-native.ps1`; the phone viewport is Edge responsive device
emulation at **390 x 844 CSS pixels**, not physical-phone evidence.

| Flow | Observed result | Evidence under `tests/comps/evidence/` |
| --- | --- | --- |
| Demo manager login and legacy `/rent-comps?unit=seed-unit-maple-7` | Login succeeded; redirect through legacy unit entry to canonical property Listing with selected vacant Unit 3A | `native-listing-desktop.png` |
| Keyboard radius filter | Home/Enter on Radius selected 1 mile; URL kept unit and explicit empty size bounds; 6 comps became 3 | `native-apply-exclusion.png` (resulting 1-mile state) |
| Refresh and exclusion | Refresh updated synced time; unchecking first comp changed included count 3 to 2 and suggested rent $1,800 to $1,825 | `native-apply-exclusion.png` |
| Native apply | Typed 1725 and applied; success message, actor/time and $1,725 market rent shown; list price stayed $1,600; Create lease retained | `native-apply-exclusion.png` plus database comparison |
| Property Listing and keyboard unit change | All 12 Maple units shown; Down/Enter in Switch unit opened occupied Unit 1A Listing, with 6 comps | `native-property-listing.png`; phone summary/table show resulting occupied unit |
| Empty and reset | Min sqft 9999 + Enter yielded zero comps, no suggestion, Reset filters; Reset returned to same Unit 1A Listing with 6 comps | `native-empty.png`, `native-filters-map-390.png`, `native-table-390.png` |
| 390px Listing | Two-column filters, map, summary/apply and renewal controls fit the viewport and were reachable by vertical scrolling; comparison table retains horizontal scrolling | `native-filters-map-390.png`, `native-summary-390.png`, `native-table-390.png` |
| 390px property and unit navigation | Property table and navigation tabs retain horizontal scrolling; selecting Unit 1A link opened its overview | `native-property-390.png`, `native-unit-overview-390.png` |

An out-of-range min sqft 99999 was rejected by the existing parser before the
valid empty-state check with 9999. No defect in the routing candidate was exposed.
The existing provider fixture visibly includes pre-existing encoding artifacts
in its unit description; this validation does not claim a typography repair.
The temporary new tab was closed, the navigated tab returned to its prior Amazon
page, DevTools/emulation closed, and the original GitHub tab selected again
(seven tabs, matching the original window). Desktop ownership was released.
Only Task-owned runtime/database processes were stopped; database files remain
on disk for inspection. No user database reset, shared process stop, upstream
push, production build, publication or new `/rent-analysis` dashboard coverage
is claimed.

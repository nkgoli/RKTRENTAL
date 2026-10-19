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

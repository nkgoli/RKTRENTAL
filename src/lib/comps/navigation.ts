import { parseFilters, type CompFilters, type SubjectFacts } from './core';

/**
 * Navigation context for the rent-comparison controls.
 *
 * The same panel renders in three places: the legacy `/rent-comps` route (which
 * redirects into a unit's Listing), a property/unit Listing, and the standalone
 * property-selected Rent Analysis dashboard at `/rent-analysis`. The surface is
 * chosen by the host page in code, never from a query value, and no return URL
 * is ever accepted from the request: every href this module builds targets one
 * of the three known surfaces with the selected property, unit and filters.
 */

export type CompsSurface = 'legacy' | 'listing' | 'rent-analysis';

export const COMPS_SURFACES: readonly CompsSurface[] = ['legacy', 'listing', 'rent-analysis'];

export type CompsNavContext = {
  surface: CompsSurface;
  /** Selected property; required for `listing` and `rent-analysis`, null for `legacy`. */
  propertyId: string | null;
  /** Selected unit; must belong to `propertyId` when both are set. */
  unitId: string | null;
};

const cleanId = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function isCompsSurface(value: unknown): value is CompsSurface {
  return typeof value === 'string' && (COMPS_SURFACES as readonly string[]).includes(value);
}

/** Legacy context: the historical `/rent-comps?unit=â€¦` behaviour. */
export function legacyContext(unitId?: string | null): CompsNavContext {
  return { surface: 'legacy', propertyId: null, unitId: cleanId(unitId) };
}

export function listingContext(propertyId: string, unitId?: string | null): CompsNavContext {
  return { surface: 'listing', propertyId: cleanId(propertyId), unitId: cleanId(unitId) };
}

export function rentAnalysisContext(propertyId: string, unitId?: string | null): CompsNavContext {
  return { surface: 'rent-analysis', propertyId: cleanId(propertyId), unitId: cleanId(unitId) };
}

/**
 * Builds a context from raw query values. Only `property` and `unit` are read;
 * `returnTo`, `next`, `redirect` and any other keys are ignored, and the surface
 * always comes from the caller. Returns null when a property-scoped surface has
 * no property, so the host can show its property-selection state instead of
 * guessing one.
 */
export function parseCompsContext(
  params: Record<string, string | undefined>,
  surface: CompsSurface,
): CompsNavContext | null {
  if (!isCompsSurface(surface)) return null;
  const propertyId = cleanId(params.property);
  const unitId = cleanId(params.unit);
  if (surface !== 'legacy' && !propertyId) return null;
  return { surface, propertyId: surface === 'legacy' ? null : propertyId, unitId };
}

/** Base path for a surface, without any query string. */
export function compsSurfacePath(context: CompsNavContext): string {
  switch (context.surface) {
    case 'listing':
      return context.propertyId ? `/properties/${encodeURIComponent(context.propertyId)}/listing` : '/rent-comps';
    case 'rent-analysis':
      return '/rent-analysis';
    case 'legacy':
      return '/rent-comps';
  }
}

/** Query keys for the comparison filters; the inverse of `parseFilters`. */
export function filtersToQuery(filters: CompFilters): Record<string, string> {
  return {
    radius: String(filters.radiusMiles),
    beds: String(filters.bedrooms),
    baths: filters.bathrooms === null ? 'any' : String(filters.bathrooms),
    minSqft: filters.minSqft === null ? '' : String(filters.minSqft),
    maxSqft: filters.maxSqft === null ? '' : String(filters.maxSqft),
    days: String(filters.days),
    status: filters.status,
  };
}

/** Parses the filter keys of a query back into validated filters for a subject. */
export function filtersFromQuery(
  params: Record<string, string | undefined>,
  subject: SubjectFacts,
): CompFilters {
  return parseFilters(params, subject);
}

/**
 * Href for a surface carrying the selected property, unit and (when given) the
 * comparison filters. A `listing` context without a property falls back to the
 * legacy path rather than inventing a property URL.
 */
export function buildCompsHref(context: CompsNavContext, filters?: CompFilters): string {
  const query = new URLSearchParams();
  if (context.surface === 'rent-analysis' && context.propertyId)
    query.set('property', context.propertyId);
  if (context.unitId) query.set('unit', context.unitId);
  if (filters) for (const [key, value] of Object.entries(filtersToQuery(filters))) query.set(key, value);
  const search = query.toString();
  return search ? `${compsSurfacePath(context)}?${search}` : compsSurfacePath(context);
}

type UnitWithProperty = { id: string; property: { id: string } };

/** Units of the selected property only; the picker never offers another property's units. */
export function unitsForProperty<T extends UnitWithProperty>(
  units: readonly T[],
  propertyId: string | null,
): T[] {
  if (!propertyId) return [];
  return units.filter((unit) => unit.property.id === propertyId);
}

export function isUnitInProperty(unit: UnitWithProperty, propertyId: string | null): boolean {
  return propertyId !== null && unit.property.id === propertyId;
}

/**
 * Resolves the selected unit for a context. A unit that belongs to another
 * property (or another organization, whose units are absent from the caller's
 * organization-scoped list) resolves to null; this never falls back to a
 * different property's unit.
 */
export function resolveContextUnit<T extends UnitWithProperty>(
  units: readonly T[],
  context: CompsNavContext,
): T | null {
  if (!context.unitId) return null;
  const unit = units.find((candidate) => candidate.id === context.unitId) ?? null;
  if (!unit) return null;
  if (context.surface !== 'legacy' && !isUnitInProperty(unit, context.propertyId)) return null;
  return unit;
}

/** Checks known surface paths only; request return URLs are never consumed. */
export function isAllowedCompsPath(value: unknown): boolean {
  if (typeof value !== 'string' || /[\\\r\n]/.test(value)) return false;
  const path = value.split('?')[0];
  if (path.split('/').some((part) => part === '.' || part === '..')) return false;
  return path === '/rent-comps' || path === '/rent-analysis' ||
    /^\/properties\/[^/?#%]+\/listing$/.test(path);
}

/** Paths refreshed after comps are refreshed or a market rent is applied. */
export const COMPS_REVALIDATION_PATHS = ['/rent-comps', '/rent-analysis'] as const;

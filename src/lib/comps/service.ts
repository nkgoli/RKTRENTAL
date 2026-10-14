import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { activeIntegration } from '@/lib/integrations/active';
import { compsProvider } from '@/lib/providers';
import type { Comparable, CompsProvider } from '@/lib/providers';
import { TtlCache } from './cache';
import {
  filtersKey,
  parseRent,
  toRows,
  toSearch,
  type CompFilters,
  type CompRow,
  type SubjectFacts,
} from './core';

const HOUR = 3_600_000;
const REFRESH_TTL: Record<string, number> = { daily: 24 * HOUR, weekly: 7 * 24 * HOUR };

export type CompsResult = {
  rows: CompRow[];
  providerName: string;
  fetchedAt: Date;
  /** True when the rows came from the per-unit cache instead of the provider. */
  cached: boolean;
};

type CachedComps = { comps: Comparable[]; providerName: string };

const globalForComps = globalThis as unknown as { rentCompsCache?: TtlCache<CachedComps> };
const cache = (globalForComps.rentCompsCache ??= new TtlCache<CachedComps>());

const cachePrefix = (organizationId: string, unitId: string) => `${organizationId}:${unitId}:`;

export function clearUnitComps(organizationId: string, unitId: string) {
  cache.deletePrefix(cachePrefix(organizationId, unitId));
}

/**
 * Comps for one unit and filter set. Repeat views within the refresh window (daily or weekly, from
 * the comps integration settings) are served from memory without calling the provider.
 */
export async function fetchComps(
  organizationId: string,
  unitId: string,
  subject: SubjectFacts,
  filters: CompFilters,
  options: { provider?: CompsProvider; ttlMs?: number } = {},
): Promise<CompsResult> {
  const key = `${cachePrefix(organizationId, unitId)}${filtersKey(filters)}`;
  const ttlMs =
    options.ttlMs ??
    REFRESH_TTL[(await activeIntegration(organizationId, 'comps')).settings.refresh] ??
    24 * HOUR;
  const hit = cache.get(key, ttlMs);
  if (hit)
    return {
      rows: toRows(hit.value.comps),
      providerName: hit.value.providerName,
      fetchedAt: new Date(hit.storedAt),
      cached: true,
    };
  const provider = options.provider ?? (await compsProvider(organizationId));
  const comps = await provider.search(toSearch(subject, filters));
  const entry = cache.set(key, { comps, providerName: provider.name });
  return {
    rows: toRows(comps),
    providerName: provider.name,
    fetchedAt: new Date(entry.storedAt),
    cached: false,
  };
}

export async function compsSettings(organizationId: string) {
  return (await activeIntegration(organizationId, 'comps')).settings;
}

const unitInclude = { property: true } satisfies Prisma.UnitInclude;
export type CompsUnit = Prisma.UnitGetPayload<{ include: typeof unitInclude }>;

/** Units a manager can price: not archived, in active properties of the organization. */
export async function listPricingUnits(organizationId: string) {
  return db.unit.findMany({
    where: { organizationId, status: { not: 'ARCHIVED' }, property: { archivedAt: null } },
    include: unitInclude,
    orderBy: [{ property: { name: 'asc' } }, { number: 'asc' }],
  });
}

export function subjectFacts(unit: CompsUnit, defaultRadiusMiles: number): SubjectFacts {
  return {
    postalCode: unit.property.postalCode,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms == null ? null : Number(unit.bathrooms),
    squareFeet: unit.squareFeet,
    defaultRadiusMiles,
  };
}

export type ApplyResult = { ok: true; rent: number } | { ok: false; error: string };

/**
 * Sets the unit's market rent and records the user and time. The update is scoped to the
 * organization, so another organization's unit reads as not found.
 */
export async function applyMarketRent(
  organizationId: string,
  unitId: string,
  rentInput: unknown,
  actor: { id: string; name: string },
  now = new Date(),
): Promise<ApplyResult> {
  const rent = parseRent(rentInput);
  if (rent === null) return { ok: false, error: 'Enter a monthly rent between $1 and $100,000.' };
  const result = await db.unit.updateMany({
    where: { id: unitId, organizationId, status: { not: 'ARCHIVED' } },
    data: {
      marketRent: rent,
      marketRentSetById: actor.id,
      marketRentSetByName: actor.name,
      marketRentSetAt: now,
    },
  });
  if (result.count !== 1) return { ok: false, error: 'Unit not found.' };
  return { ok: true, rent };
}

import type { PropertySelectionResult } from './service';
import type { PrismaClient } from '@prisma/client';
import type { AuthSession } from '../auth/session';

export type RentProperty = Extract<PropertySelectionResult, { ok: true }>['data'][number];

/** Public selection DTO without loading the ROI calculation engine into this route. */
export async function loadRentProperties(
  session: AuthSession,
  db: PrismaClient,
): Promise<RentProperty[]> {
  if (session.role !== 'MANAGER' || !session.organizationId.trim()) return [];
  const rows = await db.property.findMany({
    where: { organizationId: session.organizationId, archivedAt: null },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      street: true,
      city: true,
      state: true,
      postalCode: true,
      units: {
        where: { organizationId: session.organizationId, status: { not: 'ARCHIVED' } },
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
          bedrooms: true,
          bathrooms: true,
          squareFeet: true,
          status: true,
          listedRent: true,
          marketRent: true,
        },
      },
    },
  });
  return rows.map((p) => ({
    ...p,
    units: p.units.map((u) => ({
      ...u,
      bathrooms: u.bathrooms === null ? null : Number(u.bathrooms),
      listedRent: u.listedRent === null ? null : Number(u.listedRent),
      marketRent: u.marketRent === null ? null : Number(u.marketRent),
    })),
  }));
}

/** Resolve only against the authorized selection DTO; never choose a fallback. */
export function resolveRentSelection(
  properties: RentProperty[],
  propertyId?: string,
  unitId?: string,
) {
  if (!propertyId) {
    if (unitId) return { kind: 'invalid' } as const;
    return { kind: 'selection' } as const;
  }
  const property = properties.find((p) => p.id === propertyId);
  if (!property) return { kind: 'invalid' } as const;
  const unit = unitId ? property.units.find((u) => u.id === unitId) : undefined;
  if (unitId && !unit) return { kind: 'invalid' } as const;
  return { kind: 'property', property, unit } as const;
}

export function rentGap(market: number | null, baseline: number | null) {
  return market === null || baseline === null ? null : market - baseline;
}

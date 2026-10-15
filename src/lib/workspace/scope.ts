import { db } from '@/lib/db/client';
import type { WorkspaceScope } from '@/components/workspace/Workspace';

/** The ?propertyId=&unitId= contract the workspace tabs link with. */
export type ScopeFilter = { propertyId?: string; unitId?: string };

type Raw = string | string[] | undefined;
const one = (value: Raw) => {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim() : undefined;
};

export function scopeFilterFrom(params: { propertyId?: Raw; unitId?: Raw }): ScopeFilter {
  return { propertyId: one(params.propertyId), unitId: one(params.unitId) };
}

export const hasScope = (scope: ScopeFilter) => Boolean(scope.propertyId || scope.unitId);

/** Prisma `where` fragment for rows that carry propertyId/unitId columns directly. */
export function directScopeWhere(scope: ScopeFilter) {
  return {
    ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
    ...(scope.unitId ? { unitId: scope.unitId } : {}),
  };
}

/** Prisma `where` fragment for rows that reach the property through `unit`. */
export function unitScopeWhere(scope: ScopeFilter) {
  if (!hasScope(scope)) return {};
  return {
    unit: {
      ...(scope.unitId ? { id: scope.unitId } : {}),
      ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
    },
  };
}

/** In-memory match for rows already loaded with their ids. */
export function matchesScope(row: { propertyId?: string | null; unitId?: string | null }, scope: ScopeFilter) {
  if (scope.propertyId && row.propertyId !== scope.propertyId) return false;
  if (scope.unitId && row.unitId !== scope.unitId) return false;
  return true;
}

/** Query string that carries the scope through a page's own links. */
export function scopeQuery(scope: ScopeFilter): URLSearchParams {
  const query = new URLSearchParams();
  if (scope.propertyId) query.set('propertyId', scope.propertyId);
  if (scope.unitId) query.set('unitId', scope.unitId);
  return query;
}

/** Resolve the workspace header scope; null when unscoped or the ids are not in this organization. */
export async function loadWorkspaceScope(
  organizationId: string,
  filter: ScopeFilter,
): Promise<WorkspaceScope | null> {
  if (!hasScope(filter)) return null;
  const unit = filter.unitId
    ? await db.unit.findFirst({
        where: {
          id: filter.unitId,
          organizationId,
          ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
        },
        include: { property: true },
      })
    : null;
  if (filter.unitId && !unit) return null;
  const property = unit?.property
    ?? (await db.property.findFirst({ where: { id: filter.propertyId, organizationId } }));
  if (!property) return null;
  const activeUnitCount = await db.unit.count({
    where: { propertyId: property.id, organizationId, status: { not: 'ARCHIVED' } },
  });
  return {
    propertyId: property.id,
    propertyName: property.name,
    propertyType: property.type,
    propertyArchived: Boolean(property.archivedAt),
    activeUnitCount,
    ...(unit
      ? { unitId: unit.id, unitNumber: unit.number, unitIsImplicit: unit.isImplicit, unitStatus: unit.status }
      : {}),
  };
}

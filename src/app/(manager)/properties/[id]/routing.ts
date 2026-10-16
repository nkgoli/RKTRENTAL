import type { WorkspaceTab } from '@/components/workspace/Workspace';
import { workspaceTabHref } from '@/components/workspace/routes';

export type WorkspaceSearch = Record<string, string | string[] | undefined>;

export const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function legacyTabDestination(propertyId: string, query: WorkspaceSearch, unitId?: string) {
  const tab = first(query.tab);
  const valid: WorkspaceTab = tab === 'listing' || tab === 'returns' ? tab : 'overview';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'tab' && key !== 'unit' && first(value) !== undefined) search.set(key, first(value)!);
  }
  const unit = unitId ?? first(query.unit);
  if (unit) search.set('unit', unit);
  const path = workspaceTabHref(propertyId, valid);
  return `${path}${search.size ? `?${search}` : ''}`;
}

export function documentsDestination(propertyId: string, query: WorkspaceSearch) {
  return legacyTabDestination(propertyId, { ...query, tab: 'overview' });
}

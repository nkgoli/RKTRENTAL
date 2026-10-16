import type { WorkspaceTab } from './Workspace';

export function workspaceTabHref(propertyId: string, tab: WorkspaceTab, unitId?: string) {
  const path = `/properties/${propertyId}${tab === 'overview' ? '' : `/${tab}`}`;
  return unitId ? `${path}?unit=${encodeURIComponent(unitId)}` : path;
}

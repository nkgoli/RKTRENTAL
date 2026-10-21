import type { WorkspaceTab } from './Workspace';

export function workspaceTabHref(
  propertyId: string,
  tab: WorkspaceTab,
  unitId?: string,
  period?: { get(name: string): string | null },
) {
  const path = `/properties/${propertyId}${tab === 'overview' ? '' : `/${tab}`}`;
  const dates = new URLSearchParams();
  for (const name of ['period', 'from', 'to']) {
    const value = period?.get(name);
    if (value) dates.set(name, value);
  }
  const query = [unitId ? `unit=${encodeURIComponent(unitId)}` : '', dates.toString()]
    .filter(Boolean)
    .join('&');
  return `${path}${query ? `?${query}` : ''}`;
}

export type TabSearch = Record<string, string | string[] | undefined>;

/** Property workspace scope for a tab: the route's property plus the optional ?unit= selection. */
export function tabScope(propertyId: string, query: TabSearch) {
  const unit = Array.isArray(query.unit) ? query.unit[0] : query.unit;
  return { propertyId, unitId: unit?.trim() || undefined };
}

export function withUnit(path: string, unitId?: string, extra: Record<string, string> = {}) {
  const search = new URLSearchParams(extra);
  if (unitId) search.set('unit', unitId);
  return search.size ? `${path}?${search}` : path;
}

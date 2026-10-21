/** Keep directory state without allowing a return link outside the tenant workspace. */
export function tenantReturnHref(value: unknown): string {
  if (typeof value !== 'string') return '/tenants?view=directory';
  try {
    const url = new URL(value, 'http://tenant-workspace.local');
    if (url.origin !== 'http://tenant-workspace.local' || url.pathname !== '/tenants') {
      return '/tenants?view=directory';
    }
    const query = new URLSearchParams();
    for (const key of ['view', 'q', 'property', 'status', 'period', 'page', 'needsPaymentMethod']) {
      const item = url.searchParams.get(key);
      if (item) query.set(key, item);
    }
    return `/tenants${query.size ? `?${query}` : ''}`;
  } catch {
    return '/tenants?view=directory';
  }
}

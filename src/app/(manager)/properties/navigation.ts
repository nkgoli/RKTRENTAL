/** Only the property directory is an admissible return destination for a new property. */
export function directoryReturn(value?: string) {
  if (!value || (value !== '/properties' && !value.startsWith('/properties?')))
    return '/properties';
  const query = new URLSearchParams(value.split('?')[1]);
  const safe = new URLSearchParams();
  for (const key of ['q', 'filter', 'view']) {
    const v = query.get(key);
    if (v) safe.set(key, v);
  }
  return `/properties${safe.size ? `?${safe}` : ''}`;
}

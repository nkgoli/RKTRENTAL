/**
 * The Edit Property → Returns & ROI round trip. A return address is accepted only when it is
 * this app's ROI route for the same property; it is rebuilt from known parameters so nothing
 * else in the submitted text can redirect the manager.
 */
const ROI_PATH = '/roi-analysis';
const PERIOD = /^[A-Za-z0-9_-]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function roiReturnPath(raw: unknown, propertyId: string): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.length > 500)
    return null;
  let url: URL;
  try {
    url = new URL(raw, 'http://local.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'http://local.invalid' || url.pathname !== ROI_PATH || url.hash) return null;
  if (!propertyId || url.searchParams.get('property') !== propertyId) return null;
  const query = new URLSearchParams({ property: propertyId });
  if (url.searchParams.get('view') === 'actual') query.set('view', 'actual');
  const period = url.searchParams.get('period');
  if (period && PERIOD.test(period)) {
    query.set('period', period);
    for (const name of ['from', 'to']) {
      const day = url.searchParams.get(name);
      if (day && DAY.test(day)) query.set(name, day);
    }
  }
  return `${ROI_PATH}?${query}`;
}

/** The Edit Property address that edits ROI assumptions and returns to `returnTo`. */
export function assumptionsEditPath(propertyId: string, returnTo: string, field?: string) {
  const query = new URLSearchParams({ returnTo });
  if (field && /^(input|options)\.[A-Za-z.]+$/.test(field)) query.set('field', field);
  return `/properties/${encodeURIComponent(propertyId)}/edit?${query}#roi-details`;
}

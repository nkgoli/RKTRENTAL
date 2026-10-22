/**
 * The Edit Property → Returns & ROI round trip. A return address is accepted only when it is
 * this app's ROI route for the same property; it is rebuilt from known parameters so nothing
 * else in the submitted text can redirect the manager.
 */
const ROI_PATH = '/roi-analysis';
const PERIOD = /^[A-Za-z0-9_-]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** ROI sections an address may name; Summary is the default and is left out of the address. */
export const ROI_VIEWS = ['summary', 'actual', 'charts', 'benchmarks', 'compare'];
/**
 * Retired sections and where their content lives now. Scenarios became the shared What if
 * panel; its saved-case comparison sits on Compare, so old links still land on it.
 */
const LEGACY_VIEWS: Record<string, string> = { scenarios: 'compare' };
export function isLegacyScenariosView(query: { get(name: string): string | null } | null) {
  return query?.get('view') === 'scenarios';
}
/** Charts sub-tabs; Equity is the default and is left out of the address. */
export const CHART_PANELS = [
  'equity',
  'cash-flow',
  'expenses',
  'amortization',
  'exit',
  'sensitivity',
];

export function roiViewFrom(query: { get(name: string): string | null } | null) {
  const view = query?.get('view') ?? '';
  return ROI_VIEWS.includes(view) ? view : (LEGACY_VIEWS[view] ?? 'summary');
}
export function chartPanelFrom(query: { get(name: string): string | null } | null) {
  const chart = query?.get('chart') ?? '';
  return CHART_PANELS.includes(chart) ? chart : 'equity';
}
/** Writes a supported section, and on Charts a non-default sub-tab, into `query`. */
export function setRoiView(query: URLSearchParams, view: string, chart: string) {
  if (view === 'summary' || !ROI_VIEWS.includes(view)) return;
  query.set('view', view);
  if (view === 'charts' && chart !== 'equity' && CHART_PANELS.includes(chart))
    query.set('chart', chart);
}

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
  setRoiView(query, roiViewFrom(url.searchParams), chartPanelFrom(url.searchParams));
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

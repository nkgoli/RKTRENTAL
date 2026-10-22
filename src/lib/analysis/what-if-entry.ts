/**
 * Rent analysis → Returns & ROI: the address that opens What if for one unit's suggested rent.
 * Kept free of the calculation engine so the comps page stays light.
 */

/**
 * Returns & ROI address that opens What if for one unit's suggested rent. The change is the
 * unit's monthly difference; it is applied to the whole-property rent as a temporary override.
 */
export function rentWhatIfHref(propertyId: string, unitId: string, monthlyChange: number | null) {
  const query = new URLSearchParams({ property: propertyId, whatif: 'rent', unit: unitId });
  if (monthlyChange != null && Number.isFinite(monthlyChange))
    query.set('rentChange', String(Math.round(monthlyChange)));
  return `/roi-analysis?${query}`;
}

export type WhatIfEntry = { open: true; unitId: string | null; rentChange: number | null };

/** Reads a What if entry from an address; invalid amounts are ignored, never guessed. */
export function whatIfEntryFrom(
  query: { get(name: string): string | null } | null,
): WhatIfEntry | null {
  const kind = query?.get('whatif');
  if (kind !== 'rent' && kind !== 'open') return null;
  const unit = query?.get('unit') ?? '';
  const raw = query?.get('rentChange') ?? '';
  const change = /^-?\d{1,7}$/.test(raw) ? Number(raw) : null;
  return {
    open: true,
    unitId: /^[A-Za-z0-9_-]{1,64}$/.test(unit) ? unit : null,
    rentChange: kind === 'rent' ? change : null,
  };
}

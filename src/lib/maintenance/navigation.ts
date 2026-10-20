export function maintenanceReturn(value?: string) {
  if (
    !value ||
    !/^\/(?:maintenance|properties\/[^/?#]+\/maintenance)(?:[?#]|$)/.test(value) ||
    value.includes('\\')
  )
    return '/maintenance';
  return value;
}
export function maintenanceFormHref(
  propertyId?: string,
  unitId?: string,
  returnTo = '/maintenance',
  requestId?: string,
) {
  const query = new URLSearchParams({ returnTo });
  if (propertyId) query.set('propertyId', propertyId);
  if (unitId) query.set('unitId', unitId);
  return `/maintenance/${requestId ? `${encodeURIComponent(requestId)}/edit` : 'new'}?${query}`;
}

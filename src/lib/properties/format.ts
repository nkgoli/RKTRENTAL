const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const formatMoney = (value: number | null | undefined) =>
  value == null ? '—' : usd.format(value);

export const formatDate = (date: Date | null | undefined) =>
  date
    ? date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

export const formatMonth = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const formatAddress = (p: {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}) => `${p.street}, ${p.city} ${p.state} ${p.postalCode}`;

export const propertyTypeLabel = (type: string) =>
  type === 'MULTI_UNIT' ? 'Multi-unit building' : 'Single-unit home';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function unitLabel(
  property: { name: string },
  unit: { number: string; isImplicit: boolean },
) {
  return unit.isImplicit ? property.name : `${property.name} · Unit ${unit.number}`;
}

export function bedBath(u: { bedrooms: number | null; bathrooms: number | null }): string {
  if (u.bedrooms == null && u.bathrooms == null) return 'Details not set';
  return `${u.bedrooms ?? '—'} bd / ${u.bathrooms ?? '—'} ba`;
}

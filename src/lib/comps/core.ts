import type { Comparable, CompsSearch, CompStatus } from '@/lib/providers/types';

/**
 * Pure rent-comps logic. Pricing uses property features only (location, size, beds, baths, age
 * of the comp) and never tenant or applicant characteristics.
 */

export const RADIUS_OPTIONS = [1, 2, 3, 5] as const;
export const DAYS_OPTIONS = [30, 90, 180] as const;
export const STATUS_OPTIONS = ['all', 'listed', 'leased'] as const;
export type StatusFilter = (typeof STATUS_OPTIONS)[number];

export type CompFilters = {
  radiusMiles: number;
  bedrooms: number;
  /** null = any */
  bathrooms: number | null;
  minSqft: number | null;
  maxSqft: number | null;
  days: number;
  status: StatusFilter;
};

export type SubjectFacts = {
  postalCode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  defaultRadiusMiles: number;
};

export type CompRow = Comparable & { id: string };

const MAX_SQFT = 20000;

function whole(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function oneOf<T extends number>(value: string | undefined, options: readonly T[]): T | null {
  const parsed = Number(value);
  return value !== undefined && options.includes(parsed as T) ? (parsed as T) : null;
}

/** Defaults come from the subject unit; any valid query value overrides them. */
export function parseFilters(
  params: Record<string, string | undefined>,
  subject: SubjectFacts,
): CompFilters {
  const sqft = subject.squareFeet;
  const baths = params.baths === 'any' ? null : Number(params.baths);
  const bathsValid = params.baths !== undefined && (params.baths === 'any' || baths! > 0);
  const radius = Number(params.radius);
  return {
    radiusMiles:
      params.radius !== undefined && radius > 0 && radius <= 25
        ? radius
        : subject.defaultRadiusMiles,
    bedrooms: whole(params.beds, 0, 10) ?? subject.bedrooms ?? 1,
    bathrooms: bathsValid ? baths : null,
    minSqft: params.minSqft !== undefined ? whole(params.minSqft, 0, MAX_SQFT) : null,
    maxSqft: params.maxSqft !== undefined ? whole(params.maxSqft, 0, MAX_SQFT) : null,
    days: oneOf(params.days, DAYS_OPTIONS) ?? 90,
    status: STATUS_OPTIONS.includes(params.status as StatusFilter)
      ? (params.status as StatusFilter)
      : 'all',
    ...(sqft && params.minSqft === undefined ? { minSqft: Math.round(sqft * 0.85) } : {}),
    ...(sqft && params.maxSqft === undefined ? { maxSqft: Math.round(sqft * 1.15) } : {}),
  };
}

export function filtersKey(filters: CompFilters): string {
  return [
    filters.radiusMiles,
    filters.bedrooms,
    filters.bathrooms ?? 'any',
    filters.minSqft ?? '',
    filters.maxSqft ?? '',
    filters.days,
    filters.status,
  ].join('|');
}

export function toSearch(subject: SubjectFacts, filters: CompFilters): CompsSearch {
  return {
    postalCode: subject.postalCode,
    bedrooms: filters.bedrooms,
    squareFeet: subject.squareFeet ?? undefined,
    radiusMiles: filters.radiusMiles,
    withinDays: filters.days,
    limit: 10,
    ...(filters.bathrooms !== null ? { bathrooms: filters.bathrooms } : {}),
    ...(filters.minSqft !== null ? { minSquareFeet: filters.minSqft } : {}),
    ...(filters.maxSqft !== null ? { maxSquareFeet: filters.maxSqft } : {}),
    ...(filters.status !== 'all' ? { status: filters.status as CompStatus } : {}),
  };
}

export function toRows(comps: Comparable[]): CompRow[] {
  return comps.map((comp, index) => ({
    ...comp,
    id: comp.id ?? `${comp.address}#${index}`,
  }));
}

export const dollars = (cents: number) => Math.round(cents / 100);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

export type Confidence = 'none' | 'low' | 'medium' | 'medium-high' | 'high';

export type CompsSummary = {
  count: number;
  lowRent: number;
  medianRent: number;
  highRent: number;
  medianPerSqft: number | null;
  medianAgeDays: number | null;
  withinOneMile: number;
};

export type RentSuggestion = {
  rent: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: Confidence;
};

/** Whole-dollar summary of the included comps, or null when none are included. */
export function summarize(rows: CompRow[], now = Date.now()): CompsSummary | null {
  if (!rows.length) return null;
  const rents = rows.map((row) => dollars(row.monthlyRentCents));
  const perSqft = rows
    .filter((row) => row.squareFeet > 0)
    .map((row) => row.monthlyRentCents / 100 / row.squareFeet);
  const ages = rows
    .filter((row) => row.observedAt)
    .map((row) => Math.max(0, Math.round((now - Date.parse(row.observedAt!)) / 86_400_000)));
  return {
    count: rows.length,
    lowRent: Math.min(...rents),
    medianRent: Math.round(median(rents)!),
    highRent: Math.max(...rents),
    medianPerSqft: median(perSqft),
    medianAgeDays: median(ages),
    withinOneMile: rows.filter((row) => row.distanceMiles <= 1).length,
  };
}

const roundTo5 = (value: number) => Math.round(value / 5) * 5;

/**
 * Median $/sqft applied to the subject's size when known, else the median rent. The range is the
 * interquartile spread of the included comps, so one premium comp does not move the suggestion.
 */
export function suggestRent(
  rows: CompRow[],
  subjectSqft: number | null,
  summary: CompsSummary | null = summarize(rows),
): RentSuggestion | null {
  if (!summary) return null;
  const rents = rows.map((row) => dollars(row.monthlyRentCents));
  const bySize =
    summary.medianPerSqft && subjectSqft ? summary.medianPerSqft * subjectSqft : summary.medianRent;
  const rent = roundTo5(bySize);
  const low = rows.length > 1 ? roundTo5(quantile(rents, 0.25)) : rent;
  const high = rows.length > 1 ? roundTo5(quantile(rents, 0.75)) : rent;
  const confidence: Confidence =
    rows.length >= 7 && summary.withinOneMile >= 3
      ? 'medium-high'
      : rows.length >= 4
        ? 'medium'
        : 'low';
  return { rent, rangeLow: Math.min(low, rent), rangeHigh: Math.max(high, rent), confidence };
}

export type MapPin = {
  id: string;
  x: number;
  y: number;
  label: string;
  included: boolean;
};

export const MAP = { width: 640, height: 300, cx: 320, cy: 150, ringRadius: 130 } as const;

/** Polar placement around the subject: distance sets the radius, bearing the angle. */
export function mapPins(
  rows: CompRow[],
  excluded: ReadonlySet<string>,
  radiusMiles: number,
): MapPin[] {
  const scale = MAP.ringRadius / radiusMiles;
  return rows.map((row) => {
    const bearing = ((row.bearingDegrees ?? 0) * Math.PI) / 180;
    const distance = Math.min(row.distanceMiles, radiusMiles) * scale;
    return {
      id: row.id,
      x: Math.round(MAP.cx + Math.sin(bearing) * distance),
      y: Math.round(MAP.cy - Math.cos(bearing) * distance),
      label: `$${dollars(row.monthlyRentCents).toLocaleString('en-US')}`,
      included: !excluded.has(row.id),
    };
  });
}

/** Accepts whole dollars between $1 and $100,000. */
export function parseRent(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return null;
  const parsed = Number(text);
  return parsed >= 1 && parsed <= 100_000 ? parsed : null;
}

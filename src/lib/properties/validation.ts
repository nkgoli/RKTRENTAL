export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

export const PROPERTY_TYPES = ['SINGLE_UNIT', 'MULTI_UNIT'] as const;
export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number];

export const UNIT_STATUSES = ['OCCUPIED', 'VACANT', 'TURNOVER', 'ARCHIVED'] as const;
export type UnitStatusValue = (typeof UNIT_STATUSES)[number];

export const IMPLICIT_UNIT_NUMBER = 'Whole property';
export const MAX_UNITS_ON_CREATE = 200;

export type PropertyInput = {
  name: string;
  type: PropertyTypeValue;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  yearBuilt: number | null;
  ownerId: string | null;
  /** Units to create alongside a new multi-unit property. */
  unitCount: number;
};

export type UnitInput = {
  number: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  listedRent: number | null;
  marketRent: number | null;
  floor: number | null;
  amenities: string[];
  status: UnitStatusValue;
};

type Raw = Record<string, unknown>;

/** Flattens FormData (or any record) into trimmed strings; files and missing keys become ''. */
export function toRaw(source: FormData | Raw): Raw {
  if (source instanceof FormData) {
    const out: Raw = {};
    for (const [key, value] of source.entries()) out[key] = typeof value === 'string' ? value : '';
    return out;
  }
  return source;
}

function text(raw: Raw, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function optionalInt(
  raw: Raw,
  key: string,
  label: string,
  min: number,
  max: number,
  errors: FieldErrors,
): number | null {
  const value = text(raw, key);
  if (!value) return null;
  if (!/^\d+$/.test(value)) {
    errors[key] = `${label} must be a whole number`;
    return null;
  }
  const n = Number(value);
  if (n < min || n > max) {
    errors[key] = `${label} must be between ${min} and ${max}`;
    return null;
  }
  return n;
}

export function parsePropertyInput(
  source: FormData | Raw,
  opts: { now?: Date } = {},
): Parsed<PropertyInput> {
  const raw = toRaw(source);
  const errors: FieldErrors = {};
  const maxYear = (opts.now ?? new Date()).getFullYear() + 2;

  const name = text(raw, 'name');
  if (!name) errors.name = 'Property name is required';
  else if (name.length > 120) errors.name = 'Property name must be 120 characters or fewer';

  const type = text(raw, 'type') as PropertyTypeValue;
  if (!PROPERTY_TYPES.includes(type)) errors.type = 'Choose a property type';

  const street = text(raw, 'street');
  if (!street) errors.street = 'Street address is required';
  else if (street.length > 200) errors.street = 'Street address is too long';

  const city = text(raw, 'city');
  if (!city) errors.city = 'City is required';
  else if (city.length > 100) errors.city = 'City is too long';

  const state = text(raw, 'state').toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) errors.state = 'Use a two-letter state, e.g. TX';

  const postalCode = text(raw, 'postalCode');
  if (!/^\d{5}(-\d{4})?$/.test(postalCode))
    errors.postalCode = 'Use a ZIP like 78704 or 78704-1234';

  const yearBuilt = optionalInt(raw, 'yearBuilt', 'Year built', 1800, maxYear, errors);

  const ownerId = text(raw, 'ownerId') || null;

  let unitCount = 0;
  if (type === 'MULTI_UNIT') {
    unitCount =
      optionalInt(raw, 'unitCount', 'Number of units', 0, MAX_UNITS_ON_CREATE, errors) ?? 0;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: { name, type, street, city, state, postalCode, yearBuilt, ownerId, unitCount },
  };
}

export function parseUnitInput(
  source: FormData | Raw,
  opts: { implicit?: boolean } = {},
): Parsed<UnitInput> {
  const raw = toRaw(source);
  const errors: FieldErrors = {};

  let number = opts.implicit ? IMPLICIT_UNIT_NUMBER : text(raw, 'number');
  if (!number) errors.number = 'Unit number is required';
  else if (number.length > 40) errors.number = 'Unit number must be 40 characters or fewer';
  number = number.replace(/\s+/g, ' ');

  const bedrooms = optionalInt(raw, 'bedrooms', 'Bedrooms', 0, 20, errors);
  const squareFeet = optionalInt(raw, 'squareFeet', 'Size', 1, 100000, errors);

  let bathrooms: number | null = null;
  const bathText = text(raw, 'bathrooms');
  if (bathText) {
    const n = Number(bathText);
    if (!/^\d+(\.\d)?$/.test(bathText) || n > 20 || (n * 2) % 1 !== 0) {
      errors.bathrooms = 'Bathrooms must be a number like 1 or 1.5';
    } else bathrooms = n;
  }

  const rent = (key: 'listedRent' | 'marketRent', label: string): number | null => {
    const value = text(raw, key).replace(/^\$/, '').replace(/,/g, '');
    if (!value) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 1_000_000) {
      errors[key] = `${label} must be a dollar amount up to $1,000,000`;
      return null;
    }
    return Number(value);
  };
  const listedRent = rent('listedRent', 'Rent');
  const marketRent = rent('marketRent', 'Market rent');
  const floor = optionalInt(raw, 'floor', 'Floor', 0, 200, errors);
  const amenities = [
    ...new Set(
      text(raw, 'amenities')
        .split(/[,\n]/)
        .map((a) => a.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
    ),
  ];
  if (amenities.length > 30 || amenities.some((a) => a.length > 60))
    errors.amenities = 'List up to 30 amenities, each 60 characters or fewer';

  const statusText = text(raw, 'status') || 'VACANT';
  const status = statusText as UnitStatusValue;
  if (!UNIT_STATUSES.includes(status)) errors.status = 'Choose a status';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      number,
      bedrooms,
      bathrooms,
      squareFeet,
      listedRent,
      marketRent,
      floor,
      amenities,
      status,
    },
  };
}

/**
 * Status can't contradict the lease: a unit with an active lease is OCCUPIED and
 * can't be archived; a unit without one can't be marked OCCUPIED.
 */
export function resolveUnitStatus(
  requested: UnitStatusValue,
  hasActiveLease: boolean,
): Parsed<UnitStatusValue> {
  if (hasActiveLease) {
    if (requested === 'ARCHIVED') {
      return {
        ok: false,
        errors: { status: 'End or terminate the active lease before archiving this unit' },
      };
    }
    return { ok: true, data: 'OCCUPIED' };
  }
  if (requested === 'OCCUPIED') {
    return { ok: false, errors: { status: 'A unit is occupied once it has an active lease' } };
  }
  return { ok: true, data: requested };
}

/** Switching types is only allowed when the unit count fits the new type. */
export function checkTypeChange(
  next: PropertyTypeValue,
  currentUnitCount: number,
): FieldErrors | null {
  if (next === 'SINGLE_UNIT' && currentUnitCount > 1) {
    return {
      type: 'A single-unit property can only have one unit; archive or remove extra units first',
    };
  }
  return null;
}

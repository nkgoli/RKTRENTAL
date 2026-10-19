import { describe, expect, it } from 'vitest';
import { parseFilters, type SubjectFacts } from '../../src/lib/comps/core';
import {
  buildCompsHref,
  compsSurfacePath,
  filtersFromQuery,
  filtersToQuery,
  isAllowedCompsPath,
  isCompsSurface,
  legacyContext,
  listingContext,
  parseCompsContext,
  rentAnalysisContext,
  resolveContextUnit,
  unitsForProperty,
} from '../../src/lib/comps/navigation';

const subject: SubjectFacts = {
  postalCode: '78704',
  bedrooms: 2,
  bathrooms: 2,
  squareFeet: 950,
  defaultRadiusMiles: 2,
};

const units = [
  { id: 'u-4a', property: { id: 'maple' } },
  { id: 'u-4b', property: { id: 'maple' } },
  { id: 'u-cedar-1', property: { id: 'cedar' } },
];

describe('comps navigation context', () => {
  it('keeps the legacy default surface and href', () => {
    const context = legacyContext('u-4b');
    expect(compsSurfacePath(context)).toBe('/rent-comps');
    expect(buildCompsHref(context)).toBe('/rent-comps?unit=u-4b');
  });

  it('preserves property, unit and filters on the standalone surface', () => {
    const filters = parseFilters(
      { radius: '3', beds: '2', baths: '2', minSqft: '800', maxSqft: '1100', days: '30', status: 'listed' },
      subject,
    );
    const href = buildCompsHref(rentAnalysisContext('maple', 'u-4b'), filters);
    const url = new URL(href, 'https://example.test');
    expect(url.pathname).toBe('/rent-analysis');
    expect(url.searchParams.get('property')).toBe('maple');
    expect(url.searchParams.get('unit')).toBe('u-4b');
    expect(filtersFromQuery(Object.fromEntries(url.searchParams), subject)).toEqual(filters);
    expect(filtersToQuery(filters)).toMatchObject({ radius: '3', status: 'listed' });
  });

  it('builds the existing Listing href for a property/unit scope', () => {
    expect(buildCompsHref(listingContext('maple', 'u-4b'))).toBe(
      '/properties/maple/listing?unit=u-4b',
    );
    expect(compsSurfacePath(listingContext('', 'u-4b'))).toBe('/rent-comps');
  });

  it('limits unit choices to the selected property', () => {
    expect(unitsForProperty(units, 'maple').map((unit) => unit.id)).toEqual(['u-4a', 'u-4b']);
    expect(unitsForProperty(units, null)).toEqual([]);
  });

  it('rejects a unit from another property instead of falling back', () => {
    const context = rentAnalysisContext('maple', 'u-cedar-1');
    expect(resolveContextUnit(units, context)).toBeNull();
    expect(resolveContextUnit(units, rentAnalysisContext('maple', 'u-4b'))?.id).toBe('u-4b');
    expect(resolveContextUnit(units, legacyContext('u-cedar-1'))?.id).toBe('u-cedar-1');
    expect(resolveContextUnit(units, rentAnalysisContext('maple', 'missing'))).toBeNull();
  });

  it('preserves explicitly unbounded size filters', () => {
    const filters = parseFilters({ minSqft: '', maxSqft: '' }, subject);
    expect(filtersFromQuery(filtersToQuery(filters), subject)).toEqual(filters);
  });

  it('requires a property for property-scoped surfaces parsed from a query', () => {
    expect(parseCompsContext({ unit: 'u-4b' }, 'rent-analysis')).toBeNull();
    expect(parseCompsContext({ property: 'maple', unit: 'u-4b' }, 'rent-analysis')).toEqual({
      surface: 'rent-analysis',
      propertyId: 'maple',
      unitId: 'u-4b',
    });
  });

  it('never accepts an arbitrary return URL or surface', () => {
    const context = parseCompsContext(
      { property: 'maple', unit: 'u-4b', returnTo: 'https://evil.example', next: '//evil.example' },
      'rent-analysis',
    )!;
    expect(buildCompsHref(context)).not.toContain('evil');
    expect(isCompsSurface('rent-analysis')).toBe(true);
    expect(isCompsSurface('https://evil.example')).toBe(false);
    for (const bad of ['https://evil.example/rent-comps', '//evil.example', '/admin', '/rent-analysis-evil', '/properties/maple/payments', '/properties/../listing', '', null, 42])
      expect(isAllowedCompsPath(bad)).toBe(false);
    for (const good of ['/rent-comps?unit=u-4b', '/rent-analysis?property=maple', '/properties/maple/listing?unit=u-4b'])
      expect(isAllowedCompsPath(good)).toBe(true);
  });
});

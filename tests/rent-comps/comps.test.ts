import { describe, expect, it, vi } from 'vitest';
import {
  mapPins,
  parseFilters,
  parseRent,
  suggestRent,
  summarize,
  toRows,
  toSearch,
  type CompRow,
  type SubjectFacts,
} from '../../src/lib/comps/core';
import { TtlCache } from '../../src/lib/comps/cache';
import { fetchComps } from '../../src/lib/comps/service';
import { MockCompsProvider } from '../../src/lib/providers/mock';

const subject: SubjectFacts = {
  postalCode: '78704',
  bedrooms: 1,
  bathrooms: 1,
  squareFeet: 700,
  defaultRadiusMiles: 2,
};

const row = (id: string, dollars: number, sqft: number, miles: number): CompRow => ({
  id,
  address: id,
  monthlyRentCents: dollars * 100,
  bedrooms: 1,
  squareFeet: sqft,
  distanceMiles: miles,
  bearingDegrees: 90,
});

describe('parseFilters', () => {
  it('defaults from the subject unit', () => {
    expect(parseFilters({}, subject)).toEqual({
      radiusMiles: 2,
      bedrooms: 1,
      bathrooms: null,
      minSqft: 595,
      maxSqft: 805,
      days: 90,
      status: 'all',
    });
  });

  it('accepts valid overrides and ignores invalid ones', () => {
    const filters = parseFilters(
      {
        radius: '1',
        beds: '2',
        baths: '1.5',
        minSqft: '',
        maxSqft: '900',
        days: '30',
        status: 'leased',
      },
      subject,
    );
    expect(filters).toMatchObject({
      radiusMiles: 1,
      bedrooms: 2,
      bathrooms: 1.5,
      minSqft: null,
      maxSqft: 900,
      days: 30,
      status: 'leased',
    });
    expect(
      parseFilters({ radius: '-3', beds: 'x', days: '7', status: 'sold', maxSqft: '-5' }, subject),
    ).toMatchObject({ radiusMiles: 2, bedrooms: 1, days: 90, status: 'all', maxSqft: null });
  });

  it('builds a provider search from the filters only', () => {
    const search = toSearch(subject, parseFilters({ status: 'listed', baths: '1' }, subject));
    expect(search).toMatchObject({
      postalCode: '78704',
      bedrooms: 1,
      bathrooms: 1,
      radiusMiles: 2,
      withinDays: 90,
      status: 'listed',
      limit: 10,
    });
    expect(Object.keys(search).sort()).not.toContain('tenant');
  });
});

describe('summary and suggested rent', () => {
  const rows = [
    row('a', 1625, 690, 0.3),
    row('b', 1680, 720, 0.4),
    row('c', 1525, 650, 0.6),
    row('d', 1710, 745, 0.8),
    row('e', 1795, 705, 1.1),
    row('f', 1640, 760, 1.3),
    row('g', 1575, 680, 1.6),
  ];

  it('summarises included comps', () => {
    const summary = summarize(rows)!;
    expect(summary).toMatchObject({
      count: 7,
      lowRent: 1525,
      medianRent: 1640,
      highRent: 1795,
      withinOneMile: 4,
    });
    expect(summary.medianPerSqft).toBeCloseTo(2.34, 1);
    expect(summarize([])).toBeNull();
  });

  it('suggests a rounded rent scaled to the unit size', () => {
    const suggestion = suggestRent(rows, 700)!;
    expect(suggestion.rent % 5).toBe(0);
    expect(suggestion.rent).toBeGreaterThan(1550);
    expect(suggestion.rent).toBeLessThan(1700);
    expect(suggestion.rangeLow).toBeLessThanOrEqual(suggestion.rent);
    expect(suggestion.rangeHigh).toBeGreaterThanOrEqual(suggestion.rent);
    expect(suggestion.confidence).toBe('medium-high');
    expect(suggestRent(rows.slice(0, 2), null)!.confidence).toBe('low');
    expect(suggestRent([], 700)).toBeNull();
  });

  it('excluding a premium comp lowers the suggestion', () => {
    const without = rows.filter((r) => r.id !== 'e');
    expect(suggestRent(without, 700)!.rent).toBeLessThanOrEqual(suggestRent(rows, 700)!.rent);
  });
});

describe('map pins and rent input', () => {
  it('places comps by distance and bearing inside the radius ring', () => {
    const [east] = mapPins([row('a', 1600, 700, 1)], new Set(), 2);
    expect(east).toMatchObject({ x: 385, y: 150, label: '$1,600', included: true });
    expect(mapPins([row('a', 1600, 700, 1)], new Set(['a']), 2)[0]!.included).toBe(false);
  });

  it('accepts whole-dollar rents only within bounds', () => {
    expect(parseRent('1,650')).toBe(1650);
    expect(parseRent('$1650.50')).toBe(1650.5);
    for (const bad of ['', '0', 'abc', '-5', '1e5', '100001', '12.345', null, {}])
      expect(parseRent(bad)).toBeNull();
  });
});

describe('sandbox comps provider filters', () => {
  const provider = new MockCompsProvider(5);

  it('returns rich, filterable comparables', async () => {
    const all = await provider.search({
      postalCode: '78704',
      bedrooms: 1,
      squareFeet: 700,
      limit: 10,
    });
    expect(all).toHaveLength(10);
    expect(
      all.every((c) => c.id && c.status && c.observedAt && c.bearingDegrees !== undefined),
    ).toBe(true);
    const near = await provider.search({
      postalCode: '78704',
      bedrooms: 1,
      limit: 10,
      radiusMiles: 1,
    });
    expect(near.every((c) => c.distanceMiles <= 1)).toBe(true);
    const leased = await provider.search({
      postalCode: '78704',
      bedrooms: 1,
      limit: 10,
      status: 'leased',
    });
    expect(leased.length).toBeGreaterThan(0);
    expect(leased.every((c) => c.status === 'leased')).toBe(true);
    const recent = await provider.search({
      postalCode: '78704',
      bedrooms: 1,
      limit: 10,
      withinDays: 30,
    });
    expect(recent.length).toBeLessThan(all.length);
    const sized = await provider.search({
      postalCode: '78704',
      bedrooms: 1,
      squareFeet: 700,
      limit: 10,
      minSquareFeet: 650,
      maxSquareFeet: 750,
    });
    expect(sized.every((c) => c.squareFeet >= 650 && c.squareFeet <= 750)).toBe(true);
  });
});

describe('per-unit comps cache', () => {
  it('serves repeat views from memory and refetches for new filters', async () => {
    const provider = new MockCompsProvider(5);
    const search = vi.spyOn(provider, 'search');
    const filters = parseFilters({}, subject);
    const call = (f = filters) =>
      fetchComps('org-cache', 'unit-cache', subject, f, { provider, ttlMs: 60_000 });

    const first = await call();
    const second = await call();
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.rows).toEqual(first.rows);
    expect(search).toHaveBeenCalledTimes(1);

    await call({ ...filters, radiusMiles: 1 });
    expect(search).toHaveBeenCalledTimes(2);
    await fetchComps('org-cache', 'other-unit', subject, filters, { provider, ttlMs: 60_000 });
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('expires entries after the ttl and evicts the oldest', () => {
    let now = 0;
    const cache = new TtlCache<number>(2, () => now);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a', 100)).toBeNull();
    expect(cache.get('b', 100)?.value).toBe(2);
    now = 100;
    expect(cache.get('b', 100)).toBeNull();
    cache.set('unit:1:x', 1);
    cache.set('unit:1:y', 2);
    cache.deletePrefix('unit:1:');
    expect(cache.get('unit:1:x', 100)).toBeNull();
  });
});

describe('toRows', () => {
  it('assigns stable ids to comps without one', () => {
    expect(
      toRows([
        { address: '1 A St', monthlyRentCents: 1, bedrooms: 1, squareFeet: 1, distanceMiles: 1 },
      ])[0]!.id,
    ).toBe('1 A St#0');
  });
});

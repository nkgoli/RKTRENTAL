import { describe, expect, it } from 'vitest';
import { propertyListingMode } from '@/components/properties/listing';

describe('property listing scope', () => {
  it('uses property-level comps only when exactly one active unit is present', () => {
    expect(propertyListingMode(1)).toBe('single-family-comps');
  });

  it('uses a market-rent-by-unit table for multi-unit properties and empty properties', () => {
    expect(propertyListingMode(2)).toBe('unit-market-table');
    expect(propertyListingMode(0)).toBe('unit-market-table');
  });
});

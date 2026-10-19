import { describe, expect, it } from 'vitest';
import { resolveRentSelection, rentGap, type RentProperty } from '../../src/lib/analysis/rent';

const properties = [
  { id: 'maple', units: [{ id: 'u1' }] },
  { id: 'elm', units: [{ id: 'u2' }] },
] as RentProperty[];
describe('authorized rent selection', () => {
  it('requires explicit property selection and never falls back', () => {
    expect(resolveRentSelection(properties).kind).toBe('selection');
    expect(resolveRentSelection(properties, undefined, 'u1').kind).toBe('invalid');
    for (const id of ['missing', 'foreign', 'archived'])
      expect(resolveRentSelection(properties, id).kind).toBe('invalid');
  });
  it('keeps property overview distinct from a scoped subject', () => {
    expect(resolveRentSelection(properties, 'maple')).toMatchObject({
      kind: 'property',
      unit: undefined,
    });
    expect(resolveRentSelection(properties, 'maple', 'u1')).toMatchObject({
      kind: 'property',
      unit: { id: 'u1' },
    });
    expect(resolveRentSelection(properties, 'maple', 'u2').kind).toBe('invalid');
    expect(resolveRentSelection(properties, 'maple', 'archived').kind).toBe('invalid');
  });
  it('labels absent rent rather than treating it as zero', () => {
    expect(rentGap(null, 1000)).toBeNull();
    expect(rentGap(1200, null)).toBeNull();
    expect(rentGap(1200, 1000)).toBe(200);
    expect(rentGap(900, 1000)).toBe(-100);
  });
});

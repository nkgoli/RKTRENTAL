import { describe, expect, it } from 'vitest';
import { tabScope, withUnit } from '@/components/workspace/panels/leasing/scope';

describe('leasing tab scope', () => {
  it('scopes to the property and optional ?unit=', () => {
    expect(tabScope('p1', {})).toEqual({ propertyId: 'p1', unitId: undefined });
    expect(tabScope('p1', { unit: 'u1' })).toEqual({ propertyId: 'p1', unitId: 'u1' });
    expect(tabScope('p1', { unit: ['u2', 'u3'] }).unitId).toBe('u2');
    expect(tabScope('p1', { unit: ' ' }).unitId).toBeUndefined();
  });

  it('builds tab links that keep the unit', () => {
    expect(withUnit('/properties/p1/payments')).toBe('/properties/p1/payments');
    expect(withUnit('/properties/p1/payments', 'u1', { record: '1' })).toBe('/properties/p1/payments?record=1&unit=u1');
  });
});

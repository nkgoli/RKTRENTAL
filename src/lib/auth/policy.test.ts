import { describe, expect, it } from 'vitest';
import {
  buildLeaseAccessWhere,
  canAccessRole,
  requiredRoleForRoute,
  roleHome,
  safeRedirectTarget,
} from './policy';

describe('authentication access policy', () => {
  it('allows only managers and owners into manager routes', () => {
    expect(canAccessRole('MANAGER', 'MANAGER')).toBe(true);
    expect(canAccessRole('OWNER', 'MANAGER')).toBe(true);
    expect(canAccessRole('TENANT', 'MANAGER')).toBe(false);
  });

  it('keeps tenant routes distinct from manager routes', () => {
    expect(requiredRoleForRoute('/lease/seed-lease-maple-1')).toBe('TENANT');
    expect(requiredRoleForRoute('/payments')).toBe('MANAGER');
    expect(canAccessRole('MANAGER', 'TENANT')).toBe(false);
  });

  it('scopes tenant lease lookups to the session tenant and organization', () => {
    expect(
      buildLeaseAccessWhere(
        { role: 'TENANT', organizationId: 'org-1', tenantId: 'tenant-1' },
        'lease-1',
      ),
    ).toEqual({
      id: 'lease-1',
      organizationId: 'org-1',
      tenants: { some: { tenantId: 'tenant-1', organizationId: 'org-1' } },
    });
    expect(
      buildLeaseAccessWhere({ role: 'TENANT', organizationId: 'org-1' }, 'lease-1'),
    ).toBeNull();
    expect(
      buildLeaseAccessWhere({ role: 'TENANT', organizationId: 'org-1' }, 'lease-1'),
    ).not.toEqual(expect.objectContaining({ id: 'lease-1' }));
  });

  it('rejects cross-role and external post-login destinations', () => {
    expect(safeRedirectTarget('/dashboard/properties', 'MANAGER')).toBe('/dashboard/properties');
    expect(safeRedirectTarget('/dashboard', 'TENANT')).toBe('/home');
    expect(safeRedirectTarget('//attacker.example', 'TENANT')).toBe('/home');
    expect(safeRedirectTarget('/sign-in', 'MANAGER')).toBe('/dashboard');
    expect(roleHome('ADMIN')).toBe('/sign-out');
  });
});

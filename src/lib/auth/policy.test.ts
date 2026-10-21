import { describe, expect, it } from 'vitest';
import {
  buildLeaseAccessWhere,
  canAccessRole,
  requiredRoleForRoute,
  roleHome,
  safeRedirectTarget,
} from './policy';

describe('authentication access policy', () => {
  it('allows only managers into manager routes', () => {
    expect(canAccessRole('MANAGER', 'MANAGER')).toBe(true);
    expect(canAccessRole('OWNER', 'MANAGER')).toBe(false);
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
    expect(safeRedirectTarget('/dashboard', 'OWNER')).toBe('/sign');
    expect(safeRedirectTarget('//attacker.example', 'TENANT')).toBe('/home');
    expect(safeRedirectTarget('/sign-in', 'MANAGER')).toBe('/dashboard');
    expect(roleHome('OWNER')).toBe('/sign');
    expect(roleHome('ADMIN')).toBe('/sign-out');
  });

  it('allows owners to return only to signing surfaces while preserving manager restrictions', () => {
    expect(safeRedirectTarget('/sign', 'OWNER')).toBe('/sign');
    expect(safeRedirectTarget('/sign/leases/lease-1', 'OWNER')).toBe('/sign/leases/lease-1');
    expect(safeRedirectTarget('/sign/leases/lease-1/other', 'OWNER')).toBe('/sign');
    expect(safeRedirectTarget('/api/leases/lease-1/signing', 'OWNER')).toBe(
      '/api/leases/lease-1/signing',
    );
    expect(safeRedirectTarget('/api/files', 'OWNER')).toBe('/sign');
    expect(safeRedirectTarget('/api/leases/lease-1/signing/other', 'OWNER')).toBe('/sign');
    expect(safeRedirectTarget('/api/leases/lease-1/signing', 'ADMIN')).toBe('/sign-out');
    expect(canAccessRole('OWNER', 'MANAGER')).toBe(false);
  });
});

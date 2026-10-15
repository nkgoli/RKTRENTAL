import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn<(args: unknown) => Promise<unknown[]>>(async () => []);
vi.mock('@/lib/db/client', () => ({
  db: { maintenanceRequest: { findMany: (args: unknown) => findMany(args) } },
}));

import { listMaintenanceBoard } from '@/lib/maintenance/service';
import { loadPaymentsOverview } from '@/lib/ledger';
import { filterLibraryDocuments, type LibraryDocument } from '@/lib/documents/library';
import {
  directScopeWhere,
  matchesScope,
  scopeFilterFrom,
  scopeQuery,
  unitScopeWhere,
} from '@/lib/workspace/scope';

beforeEach(() => findMany.mockClear());

describe('scope contract', () => {
  it('reads propertyId and unitId, ignoring blanks and taking the first array value', () => {
    expect(scopeFilterFrom({ propertyId: ' p1 ', unitId: ['u1', 'u2'] })).toEqual({ propertyId: 'p1', unitId: 'u1' });
    expect(scopeFilterFrom({ propertyId: '', unitId: undefined })).toEqual({ propertyId: undefined, unitId: undefined });
  });

  it('builds where fragments for direct and unit-relation columns', () => {
    expect(directScopeWhere({})).toEqual({});
    expect(directScopeWhere({ propertyId: 'p1', unitId: 'u1' })).toEqual({ propertyId: 'p1', unitId: 'u1' });
    expect(unitScopeWhere({})).toEqual({});
    expect(unitScopeWhere({ propertyId: 'p1' })).toEqual({ unit: { propertyId: 'p1' } });
    expect(unitScopeWhere({ propertyId: 'p1', unitId: 'u1' })).toEqual({ unit: { id: 'u1', propertyId: 'p1' } });
  });

  it('matches loaded rows and round-trips the query string', () => {
    expect(matchesScope({ propertyId: 'p1', unitId: 'u1' }, { propertyId: 'p1' })).toBe(true);
    expect(matchesScope({ propertyId: 'p2', unitId: 'u1' }, { propertyId: 'p1' })).toBe(false);
    expect(matchesScope({ propertyId: 'p1', unitId: 'u2' }, { unitId: 'u1' })).toBe(false);
    expect(scopeQuery({ propertyId: 'p1', unitId: 'u1' }).toString()).toBe('propertyId=p1&unitId=u1');
  });
});

describe('scoped Maintenance', () => {
  it('queries requests for the property and unit only', async () => {
    await listMaintenanceBoard('org-1', { propertyId: 'p1', unitId: 'u1' });
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: { organizationId: 'org-1', propertyId: 'p1', unitId: 'u1' } });
  });

  it('stays organization-wide without a scope', async () => {
    await listMaintenanceBoard('org-1');
    expect((findMany.mock.calls[0]?.[0] as { where: object }).where).toEqual({ organizationId: 'org-1' });
  });
});

describe('scoped Payments', () => {
  const leaseFindMany = vi.fn<(args: unknown) => Promise<unknown[]>>(async () => []);
  const client = {
    lease: { findMany: (args: unknown) => leaseFindMany(args) },
    property: { findMany: async () => [] },
    payout: { findMany: async () => [] },
  } as unknown as Parameters<typeof loadPaymentsOverview>[3];

  it('restricts the rent roll to the unit and property', async () => {
    await loadPaymentsOverview('org-1', '2026-10', new Date('2026-10-14'), client, { propertyId: 'p1', unitId: 'u1' });
    expect(leaseFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-1', unit: { id: 'u1', propertyId: 'p1' } },
    });
  });

  it('does not add a unit filter when unscoped', async () => {
    leaseFindMany.mockClear();
    await loadPaymentsOverview('org-1', '2026-10', new Date('2026-10-14'), client);
    expect((leaseFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where).not.toHaveProperty('unit');
  });
});

describe('scoped Documents', () => {
  const doc = (id: string, unitId: string, propertyId: string): LibraryDocument => ({
    id, name: id, kind: 'OTHER', mimeType: 'application/pdf', sizeBytes: 1, createdAt: new Date('2026-01-01'),
    leaseId: null, propertyId, unitId, lease: null,
    property: { id: propertyId, name: 'P' },
    unit: { id: unitId, number: unitId, isImplicit: false, property: { id: propertyId, name: 'P' } },
  });
  const files = [doc('a', 'u1', 'p1'), doc('b', 'u2', 'p1'), doc('c', 'u3', 'p2')];

  it('filters by unitId and combines with propertyId', () => {
    expect(filterLibraryDocuments(files, { unitId: 'u2' }).map((f) => f.id)).toEqual(['b']);
    expect(filterLibraryDocuments(files, { propertyId: 'p1' }).map((f) => f.id).sort()).toEqual(['a', 'b']);
    expect(filterLibraryDocuments(files, { propertyId: 'p2', unitId: 'u1' })).toEqual([]);
  });
});

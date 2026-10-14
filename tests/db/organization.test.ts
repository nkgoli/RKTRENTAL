import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { organizationDb } from '../../src/lib/db/organization';

function mockClient() {
  const calls = {
    property: { findMany: vi.fn(), findFirst: vi.fn() },
    unit: { findMany: vi.fn(), findFirst: vi.fn() },
    tenant: { findMany: vi.fn(), findFirst: vi.fn() },
    lease: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    document: { findMany: vi.fn() },
    charge: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    maintenanceRequest: { findMany: vi.fn() },
  };
  return { calls, client: calls as unknown as PrismaClient };
}

describe('organization data access', () => {
  it('rejects a missing organization', () => {
    const { client } = mockClient();
    expect(() => organizationDb('  ', client)).toThrow('organizationId is required');
  });

  it('scopes every read by organization, including ID and parent filters', async () => {
    const { calls, client } = mockClient();
    const scoped = organizationDb('org-a', client);
    await scoped.listProperties();
    await scoped.getProperty('prop-b');
    await scoped.listUnits('prop-b');
    await scoped.getUnit('unit-b');
    await scoped.listTenants();
    await scoped.getTenant('tenant-b');
    await scoped.listLeases();
    await scoped.getLease('lease-b');
    await scoped.listDocuments();
    await scoped.listCharges('lease-b');
    await scoped.listPayments('lease-b');
    await scoped.listMaintenanceRequests();

    for (const model of Object.values(calls)) {
      for (const [name, method] of Object.entries(model)) {
        if (name === 'create') continue;
        expect(method, name).toHaveBeenCalledOnce();
        expect(method.mock.calls[0][0].where.organizationId, name).toBe('org-a');
      }
    }
    expect(calls.property.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'prop-b' });
    expect(calls.unit.findMany.mock.calls[0][0].where).toMatchObject({ propertyId: 'prop-b' });
    expect(calls.charge.findMany.mock.calls[0][0].where).toMatchObject({ leaseId: 'lease-b' });
  });

  it('sets organization on lease creation and rejects an invalid term', async () => {
    const { calls, client } = mockClient();
    const scoped = organizationDb('org-a', client);
    const input = {
      unitId: 'unit-a',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      monthlyRent: 1850,
      deposit: 1850,
      status: 'ACTIVE' as const,
    };
    await scoped.createLease(input);
    expect(calls.lease.create.mock.calls[0][0].data).toMatchObject({
      ...input,
      organizationId: 'org-a',
    });
    expect(() => scoped.createLease({ ...input, startDate: new Date('2027-01-01') })).toThrow(
      'Lease end date precedes start date',
    );
    expect(calls.lease.create).toHaveBeenCalledOnce();
  });
});

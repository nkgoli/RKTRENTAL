import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { defaultLeaseEnd, initials } from './format';
import { buildTenantWhere, organizationTenants } from './queries';
import {
  createTenant,
  moveInTenant,
  moveOutTenant,
  TenantServiceError,
  updateTenant,
} from './service';
import { balanceCents, deriveStatus, matchesStatusFilter, parseStatusFilter } from './status';
import { parseNewTenantInput, parseNoteInput, parseTenantInput } from './validation';

const form = (values: Record<string, string>) => new Map(Object.entries(values));

describe('parseTenantInput', () => {
  it('trims, lowercases email and nulls blanks', () => {
    const result = parseTenantInput(
      form({ name: '  Jamie Doe ', email: ' Jamie@Email.com ', phone: '' }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        name: 'Jamie Doe',
        email: 'jamie@email.com',
        phone: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelationship: null,
      },
    });
  });

  it('requires a name and rejects bad email and phone', () => {
    const result = parseTenantInput(form({ name: ' ', email: 'nope', phone: 'abc' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['email', 'name', 'phone']);
  });

  it('accepts formatted phone numbers', () => {
    const result = parseTenantInput(form({ name: 'A', phone: '(555) 010-2030' }));
    expect(result.ok).toBe(true);
  });
});

describe('parseNewTenantInput', () => {
  it('parses an optional unit and move-in date', () => {
    const result = parseNewTenantInput(form({ name: 'A', unitId: 'u1', moveInDate: '2026-11-01' }));
    expect(result.ok && result.data.moveInDate?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('rejects impossible dates and dates without a unit', () => {
    const bad = parseNewTenantInput(form({ name: 'A', unitId: 'u1', moveInDate: '2026-02-31' }));
    expect(!bad.ok && bad.errors.moveInDate).toBeTruthy();
    const noUnit = parseNewTenantInput(form({ name: 'A', moveInDate: '2026-11-01' }));
    expect(!noUnit.ok && noUnit.errors.unitId).toBeTruthy();
  });
});

describe('status helpers', () => {
  it('derives status from lease states and balance', () => {
    expect(deriveStatus(['ACTIVE'], 0)).toBe('CURRENT');
    expect(deriveStatus(['ACTIVE', 'ENDED'], 100)).toBe('LATE');
    expect(deriveStatus(['ENDED'], 0)).toBe('PAST');
    expect(deriveStatus(['DRAFT'], 0)).toBe('PROSPECT');
    expect(deriveStatus([], 0)).toBe('PROSPECT');
  });

  it('computes balances without going negative', () => {
    expect(balanceCents([185000, 185000], [185000])).toBe(185000);
    expect(balanceCents([100], [500])).toBe(0);
  });

  it('parses and matches filters', () => {
    expect(parseStatusFilter('late')).toBe('late');
    expect(parseStatusFilter('bogus')).toBe('all');
    expect(matchesStatusFilter('LATE', 'late')).toBe(true);
    expect(matchesStatusFilter('PAST', 'current')).toBe(false);
  });

  it('formats helpers', () => {
    expect(initials('Alex Rivera')).toBe('AR');
    expect(defaultLeaseEnd(new Date('2025-12-01T00:00:00Z')).toISOString()).toBe(
      '2026-11-30T00:00:00.000Z',
    );
  });
});

describe('organization scoping', () => {
  it('always includes the organization in list filters', () => {
    expect(buildTenantWhere('org-1')).toEqual({ organizationId: 'org-1' });
    const where = buildTenantWhere('org-1', { q: 'alex', propertyId: 'p1' });
    expect(where.organizationId).toBe('org-1');
    expect(JSON.stringify(where.AND)).toContain('"organizationId":"org-1"');
  });

  it('refuses a blank organization', () => {
    expect(() => organizationTenants(' ')).toThrow('organizationId is required');
  });

  it('scopes detail and list reads', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const findMany = vi.fn().mockResolvedValue([]);
    const client = { tenant: { findFirst, findMany } } as unknown as PrismaClient;
    const tenants = organizationTenants('org-1', client);
    expect(await tenants.detail('t1')).toBeNull();
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: 't1', organizationId: 'org-1' });
    await tenants.list({ q: 'x' });
    expect(findMany.mock.calls[0][0].where.organizationId).toBe('org-1');
  });
});

function fakeTx(overrides: Record<string, unknown>) {
  const tx = {
    tenant: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 't-new' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    unit: { findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    leaseTenant: { create: vi.fn() },
    lease: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'l-new' }),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
  const client = {
    $transaction: (fn: (t: unknown) => unknown) => fn(tx),
  } as unknown as PrismaClient;
  return { tx, client };
}

describe('createTenant', () => {
  const input = { name: 'A', email: 'a@x.com', phone: null, unitId: null, moveInDate: null };

  it('creates a tenant in the caller organization', async () => {
    const { tx, client } = fakeTx({});
    expect(await createTenant('org-1', input, client)).toEqual({
      tenantId: 't-new',
      leaseId: null,
    });
    expect(tx.tenant.create.mock.calls[0][0].data.organizationId).toBe('org-1');
    expect(tx.tenant.findFirst.mock.calls[0][0].where.organizationId).toBe('org-1');
  });

  it('rejects duplicate emails', async () => {
    const { tx, client } = fakeTx({});
    tx.tenant.findFirst.mockResolvedValue({ id: 'other' });
    await expect(createTenant('org-1', input, client)).rejects.toBeInstanceOf(TenantServiceError);
    expect(tx.tenant.create).not.toHaveBeenCalled();
  });

  it('rejects a unit outside the organization', async () => {
    const { tx, client } = fakeTx({});
    tx.unit.findFirst.mockResolvedValue(null);
    await expect(createTenant('org-1', { ...input, unitId: 'u-other' }, client)).rejects.toThrow(
      'Unit not found',
    );
    expect(tx.unit.findFirst.mock.calls[0][0].where.organizationId).toBe('org-1');
  });

  it('drafts a lease for a vacant unit', async () => {
    const { tx, client } = fakeTx({});
    tx.unit.findFirst.mockResolvedValue({ id: 'u1', listedRent: { toString: () => '1850.00' } });
    tx.lease.findFirst.mockResolvedValue(null);
    const result = await createTenant(
      'org-1',
      { ...input, unitId: 'u1', moveInDate: new Date('2026-11-01T00:00:00Z') },
      client,
    );
    expect(result.leaseId).toBe('l-new');
    expect(tx.leaseTenant.create.mock.calls[0][0].data).toMatchObject({
      organizationId: 'org-1',
      tenantId: 't-new',
      isPrimary: true,
    });
    const data = tx.lease.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      unitId: 'u1',
      status: 'DRAFT',
      monthlyRent: 1850,
    });
  });

  it('rejects a unit that already has a lease', async () => {
    const { tx, client } = fakeTx({});
    tx.unit.findFirst.mockResolvedValue({ id: 'u1', listedRent: null });
    tx.lease.findFirst.mockResolvedValue({ id: 'l1' });
    await expect(createTenant('org-1', { ...input, unitId: 'u1' }, client)).rejects.toThrow(
      'already has a lease',
    );
  });
});

describe('updateTenant', () => {
  it('scopes the update and fails when nothing matches', async () => {
    const { tx, client } = fakeTx({});
    tx.tenant.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateTenant('org-1', 't1', { name: 'A', email: null, phone: null }, client),
    ).rejects.toThrow('Tenant not found');
    expect(tx.tenant.updateMany.mock.calls[0][0].where).toEqual({
      id: 't1',
      organizationId: 'org-1',
    });
  });
});

describe('move-in and move-out', () => {
  const lease = (status: string) => ({
    id: 'l1',
    unitId: 'u1',
    status,
    startDate: new Date('2025-12-01T00:00:00Z'),
    endDate: new Date('2026-11-30T00:00:00Z'),
  });

  it('activates a draft lease and occupies the unit', async () => {
    const { tx, client } = fakeTx({});
    tx.lease.findFirst.mockResolvedValueOnce(lease('DRAFT')).mockResolvedValueOnce(null);
    await moveInTenant('org-1', 't1', 'l1', client);
    expect(tx.lease.findFirst.mock.calls[0][0].where.organizationId).toBe('org-1');
    expect(tx.lease.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { status: 'ACTIVE' },
    });
    expect(tx.unit.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'u1', organizationId: 'org-1' },
      data: { status: 'OCCUPIED' },
    });
  });

  it('refuses to move in a lease that is not a draft or whose unit is taken', async () => {
    const a = fakeTx({});
    a.tx.lease.findFirst.mockResolvedValueOnce(lease('ACTIVE'));
    await expect(moveInTenant('org-1', 't1', 'l1', a.client)).rejects.toThrow('draft');
    const b = fakeTx({});
    b.tx.lease.findFirst
      .mockResolvedValueOnce(lease('DRAFT'))
      .mockResolvedValueOnce({ id: 'other' });
    await expect(moveInTenant('org-1', 't1', 'l1', b.client)).rejects.toThrow('active lease');
  });

  it('ends an active lease and vacates the unit', async () => {
    const { tx, client } = fakeTx({});
    tx.lease.findFirst.mockResolvedValue(lease('ACTIVE'));
    await moveOutTenant('org-1', 't1', 'l1', client, new Date('2026-06-15T00:00:00Z'));
    expect(tx.lease.update.mock.calls[0][0].data).toEqual({
      status: 'ENDED',
      endDate: new Date('2026-06-15T00:00:00Z'),
    });
    expect(tx.unit.updateMany.mock.calls[0][0].data).toEqual({ status: 'VACANT' });
  });

  it('keeps the unit occupied when another lease is active, and rejects other orgs', async () => {
    const a = fakeTx({});
    a.tx.lease.findFirst.mockResolvedValue(lease('ACTIVE'));
    a.tx.lease.count.mockResolvedValue(1);
    await moveOutTenant('org-1', 't1', 'l1', a.client);
    expect(a.tx.unit.updateMany).not.toHaveBeenCalled();
    const b = fakeTx({});
    b.tx.lease.findFirst.mockResolvedValue(null);
    await expect(moveOutTenant('org-2', 't1', 'l1', b.client)).rejects.toThrow('Lease not found');
  });
});

describe('tenant notes and emergency contacts', () => {
  it('parses emergency contact fields', () => {
    const result = parseTenantInput(
      form({
        name: 'Alex',
        emergencyContactName: ' Maria ',
        emergencyContactPhone: '(512) 555-0142',
        emergencyContactRelationship: 'Mother',
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      data: { emergencyContactName: 'Maria', emergencyContactRelationship: 'Mother' },
    });
  });

  it('rejects an invalid emergency phone and blank notes', () => {
    const bad = parseTenantInput(form({ name: 'Alex', emergencyContactPhone: 'abc' }));
    expect(bad.ok).toBe(false);
    expect(parseNoteInput(form({ body: '   ' })).ok).toBe(false);
    expect(parseNoteInput(form({ body: ' Called ' }))).toEqual({
      ok: true,
      data: { body: 'Called' },
    });
  });
});

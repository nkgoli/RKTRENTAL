import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { propertiesDb } from './data';

const ORG = 'org-a';
const unitInput = {
  number: '6A',
  bedrooms: 2,
  bathrooms: 1,
  squareFeet: null,
  listedRent: 1750,
  marketRent: null,
  floor: null,
  amenities: [] as string[],
  status: 'VACANT' as const,
};

function fakeClient(overrides: Record<string, unknown> = {}) {
  const client = {
    property: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'p1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    unit: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'u1' }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    lease: { count: vi.fn().mockResolvedValue(0) },
    user: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    document: { findMany: vi.fn().mockResolvedValue([]) },
    maintenanceRequest: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(),
    ...overrides,
  };
  client.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(client));
  return client;
}
const asPrisma = (c: unknown) => c as PrismaClient;

describe('propertiesDb scoping', () => {
  it('requires an organization id', () => {
    expect(() => propertiesDb(' ', asPrisma(fakeClient()))).toThrow();
  });

  it('scopes list queries to the organization and hides archived by default', async () => {
    const c = fakeClient();
    await propertiesDb(ORG, asPrisma(c)).listProperties();
    expect(c.property.findMany.mock.calls[0]![0].where).toMatchObject({
      organizationId: ORG,
      archivedAt: null,
    });
    await propertiesDb(ORG, asPrisma(c)).listProperties({ filter: 'archived' });
    expect(c.property.findMany.mock.calls[1]![0].where.archivedAt).toEqual({ not: null });
  });

  it('looks up details by id AND organization, so other orgs read as missing', async () => {
    const c = fakeClient();
    expect(await propertiesDb(ORG, asPrisma(c)).getProperty('p-other')).toBeNull();
    expect(c.property.findFirst.mock.calls[0]![0].where).toEqual({
      id: 'p-other',
      organizationId: ORG,
    });
    expect(await propertiesDb(ORG, asPrisma(c)).getUnit('p1', 'u-other')).toBeNull();
    expect(c.unit.findFirst.mock.calls[0]![0].where).toEqual({
      id: 'u-other',
      propertyId: 'p1',
      organizationId: ORG,
    });
  });

  it('refuses to add a unit to a property in another organization', async () => {
    const c = fakeClient();
    const r = await propertiesDb(ORG, asPrisma(c)).createUnit('p-other', unitInput);
    expect(r.ok).toBe(false);
    expect(c.unit.create).not.toHaveBeenCalled();
  });

  it('stamps new properties and implicit units with the session organization', async () => {
    const c = fakeClient();
    const r = await propertiesDb(ORG, asPrisma(c)).createProperty({
      name: 'Elm',
      type: 'SINGLE_UNIT',
      street: '1 Elm',
      city: 'Austin',
      state: 'TX',
      postalCode: '78745',
      yearBuilt: null,
      ownerId: null,
      unitCount: 0,
    });
    expect(r).toEqual({ ok: true, id: 'p1' });
    expect(c.property.create.mock.calls[0]![0].data.organizationId).toBe(ORG);
    expect(c.unit.create.mock.calls[0]![0].data).toMatchObject({
      organizationId: ORG,
      propertyId: 'p1',
      isImplicit: true,
    });
  });

  it('creates numbered units for a multi-unit property', async () => {
    const c = fakeClient();
    await propertiesDb(ORG, asPrisma(c)).createProperty({
      name: 'Oak',
      type: 'MULTI_UNIT',
      street: '1 Oak',
      city: 'Austin',
      state: 'TX',
      postalCode: '78704',
      yearBuilt: null,
      ownerId: null,
      unitCount: 3,
    });
    const data = c.unit.createMany.mock.calls[0]![0].data as {
      number: string;
      organizationId: string;
    }[];
    expect(data.map((u) => u.number)).toEqual(['1', '2', '3']);
    expect(data.every((u) => u.organizationId === ORG)).toBe(true);
  });

  it('rejects an owner from another organization', async () => {
    const c = fakeClient();
    const r = await propertiesDb(ORG, asPrisma(c)).createProperty({
      name: 'Oak',
      type: 'MULTI_UNIT',
      street: '1 Oak',
      city: 'Austin',
      state: 'TX',
      postalCode: '78704',
      yearBuilt: null,
      ownerId: 'owner-elsewhere',
      unitCount: 0,
    });
    expect(r).toMatchObject({ ok: false, errors: { ownerId: expect.any(String) } });
    expect(c.user.findFirst.mock.calls[0]![0].where).toMatchObject({
      organizationId: ORG,
      role: 'OWNER',
    });
    expect(c.property.create).not.toHaveBeenCalled();
  });

  it('will not add a second unit to a single-unit property', async () => {
    const c = fakeClient();
    c.property.findFirst.mockResolvedValue({
      id: 'p1',
      type: 'SINGLE_UNIT',
      archivedAt: null,
      units: [{ status: 'VACANT' }],
    });
    const r = await propertiesDb(ORG, asPrisma(c)).createUnit('p1', unitInput);
    expect(r.ok).toBe(false);
    expect(c.unit.create).not.toHaveBeenCalled();
  });

  it('will not archive a property with an active lease', async () => {
    const c = fakeClient();
    c.property.findFirst.mockResolvedValue({ id: 'p1' });
    c.lease.count.mockResolvedValue(2);
    const r = await propertiesDb(ORG, asPrisma(c)).setPropertyArchived('p1', true);
    expect(r.ok).toBe(false);
    expect(c.property.updateMany).not.toHaveBeenCalled();
    expect(c.lease.count.mock.calls[0]![0].where).toMatchObject({
      organizationId: ORG,
      status: 'ACTIVE',
    });
  });

  it('archives and restores within the organization', async () => {
    const c = fakeClient();
    c.property.findFirst.mockResolvedValue({ id: 'p1' });
    const db = propertiesDb(ORG, asPrisma(c));
    expect((await db.setPropertyArchived('p1', true)).ok).toBe(true);
    expect(c.property.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: 'p1', organizationId: ORG },
      data: { archivedAt: expect.any(Date) },
    });
    await db.setPropertyArchived('p1', false);
    expect(c.property.updateMany.mock.calls[1]![0].data).toEqual({ archivedAt: null });
  });

  it('keeps a leased unit occupied and blocks archiving it', async () => {
    const c = fakeClient();
    c.unit.findFirst.mockResolvedValue({
      id: 'u1',
      number: '4B',
      isImplicit: false,
      leases: [{ id: 'l1' }],
    });
    const db = propertiesDb(ORG, asPrisma(c));
    expect((await db.updateUnit('p1', 'u1', { ...unitInput, status: 'ARCHIVED' })).ok).toBe(false);
    expect((await db.updateUnit('p1', 'u1', { ...unitInput, status: 'VACANT' })).ok).toBe(true);
    expect(c.unit.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: 'u1', propertyId: 'p1', organizationId: ORG },
      data: { status: 'OCCUPIED' },
    });
  });
});

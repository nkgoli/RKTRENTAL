import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import {
  IMPLICIT_UNIT_NUMBER,
  checkTypeChange,
  resolveUnitStatus,
  type FieldErrors,
  type PropertyInput,
  type PropertyTypeValue,
  type UnitInput,
  type UnitStatusValue,
} from './validation';

export type PropertyFilter = 'all' | 'multi' | 'single' | 'vacancies' | 'archived';
export const PROPERTY_FILTERS: PropertyFilter[] = [
  'all',
  'multi',
  'single',
  'vacancies',
  'archived',
];

export type WriteResult = { ok: true; id: string } | { ok: false; errors: FieldErrors };

const num = (value: Prisma.Decimal | number | null | undefined) =>
  value == null ? null : Number(value);

export function propertyFilterFrom(value: string | undefined): PropertyFilter {
  return PROPERTY_FILTERS.includes(value as PropertyFilter) ? (value as PropertyFilter) : 'all';
}

const activeLeaseInclude = {
  where: { status: 'ACTIVE' as const },
  orderBy: { endDate: 'asc' as const },
  include: { tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' as const } } },
  take: 1,
};

/**
 * Org-scoped data access for properties, units and their files. Every query and
 * write carries organizationId, and ids from the URL are always re-checked
 * against it so another organization's rows read as "not found".
 */
export function propertiesDb(organizationId: string, client: PrismaClient = db) {
  if (!organizationId.trim()) throw new Error('organizationId is required');

  async function listOwners() {
    const owners = await client.user.findMany({
      where: { organizationId, role: 'OWNER' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return owners;
  }

  async function ownerError(ownerId: string | null): Promise<FieldErrors | null> {
    if (!ownerId) return null;
    const owner = await client.user.findFirst({
      where: { id: ownerId, organizationId, role: 'OWNER' },
      select: { id: true },
    });
    return owner ? null : { ownerId: 'Choose an owner from your organization' };
  }

  async function listProperties(opts: { q?: string; filter?: PropertyFilter } = {}) {
    const filter = opts.filter ?? 'all';
    const q = opts.q?.trim();
    const rows = await client.property.findMany({
      where: {
        organizationId,
        archivedAt: filter === 'archived' ? { not: null } : null,
        ...(filter === 'multi' ? { type: 'MULTI_UNIT' as const } : {}),
        ...(filter === 'single' ? { type: 'SINGLE_UNIT' as const } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { street: { contains: q, mode: 'insensitive' as const } },
                { city: { contains: q, mode: 'insensitive' as const } },
                { postalCode: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        units: {
          include: { leases: { where: { status: 'ACTIVE' }, select: { monthlyRent: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    const ids = rows.map((r) => r.id);
    const photos = ids.length
      ? await client.document.findMany({
          where: { organizationId, kind: 'PHOTO', propertyId: { in: ids } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, propertyId: true },
        })
      : [];
    const coverByProperty = new Map<string, string>();
    for (const p of photos)
      if (p.propertyId && !coverByProperty.has(p.propertyId))
        coverByProperty.set(p.propertyId, p.id);

    const summaries = rows
      .map((p) => {
        const units = p.units.filter((u) => u.status !== 'ARCHIVED');
        const occupied = units.filter((u) => u.status === 'OCCUPIED').length;
        const monthlyRent = units.reduce(
          (sum, u) => sum + u.leases.reduce((s, l) => s + Number(l.monthlyRent), 0),
          0,
        );
        return {
          id: p.id,
          name: p.name,
          type: p.type as PropertyTypeValue,
          street: p.street,
          city: p.city,
          state: p.state,
          postalCode: p.postalCode,
          archived: p.archivedAt != null,
          unitCount: units.length,
          occupied,
          vacant: units.length - occupied,
          monthlyRent,
          coverPhotoId: coverByProperty.get(p.id) ?? null,
        };
      })
      .filter((p) => (filter === 'vacancies' ? p.vacant > 0 : true));

    const totals = summaries.reduce(
      (t, p) => ({
        units: t.units + p.unitCount,
        occupied: t.occupied + p.occupied,
        vacant: t.vacant + p.vacant,
      }),
      { units: 0, occupied: 0, vacant: 0 },
    );
    return { properties: summaries, totals };
  }

  async function countByFilter() {
    const [active, multi, single, archived] = await Promise.all([
      client.property.count({ where: { organizationId, archivedAt: null } }),
      client.property.count({ where: { organizationId, archivedAt: null, type: 'MULTI_UNIT' } }),
      client.property.count({ where: { organizationId, archivedAt: null, type: 'SINGLE_UNIT' } }),
      client.property.count({ where: { organizationId, archivedAt: { not: null } } }),
    ]);
    return { all: active, multi, single, archived };
  }

  async function getProperty(id: string) {
    const property = await client.property.findFirst({
      where: { id, organizationId },
      include: {
        owner: { select: { id: true, name: true } },
        units: {
          orderBy: { number: 'asc' },
          include: { leases: activeLeaseInclude },
        },
      },
    });
    if (!property) return null;

    const [documents, leaseDocuments, repairs, expiring] = await Promise.all([
      client.document.findMany({
        where: { organizationId, propertyId: id },
        orderBy: { createdAt: 'desc' },
      }),
      client.document.findMany({
        where: { organizationId, lease: { unit: { propertyId: id } } },
        include: { lease: { include: { tenants: { include: { tenant: true } }, unit: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      client.maintenanceRequest.count({
        where: { organizationId, propertyId: id, status: { notIn: ['DONE', 'CANCELLED'] } },
      }),
      client.lease.count({
        where: {
          organizationId,
          status: 'ACTIVE',
          unit: { propertyId: id },
          endDate: { lte: new Date(Date.now() + 90 * 24 * 3600 * 1000) },
        },
      }),
    ]);

    const live = property.units.filter((u) => u.status !== 'ARCHIVED');
    const occupied = live.filter((u) => u.status === 'OCCUPIED').length;
    const units = property.units.map((u) => {
      const lease = u.leases[0] ?? null;
      const tenant = lease?.tenants[0]?.tenant ?? null;
      return {
        id: u.id,
        number: u.number,
        isImplicit: u.isImplicit,
        bedrooms: u.bedrooms,
        bathrooms: num(u.bathrooms),
        squareFeet: u.squareFeet,
        listedRent: num(u.listedRent),
        status: u.status as UnitStatusValue,
        leaseId: lease?.id ?? null,
        rent: lease ? Number(lease.monthlyRent) : null,
        tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
      };
    });
    const monthlyRent = units.reduce(
      (s, u) => s + (u.status === 'ARCHIVED' ? 0 : (u.rent ?? 0)),
      0,
    );

    return {
      id: property.id,
      name: property.name,
      type: property.type as PropertyTypeValue,
      street: property.street,
      city: property.city,
      state: property.state,
      postalCode: property.postalCode,
      yearBuilt: property.yearBuilt,
      archived: property.archivedAt != null,
      owner: property.owner,
      units,
      stats: {
        unitCount: live.length,
        occupied,
        occupancy: live.length ? Math.round((occupied / live.length) * 100) : 0,
        monthlyRent,
        openRepairs: repairs,
        expiringLeases: expiring,
      },
      photos: documents.filter((d) => d.kind === 'PHOTO').map(fileView),
      files: documents.filter((d) => d.kind !== 'PHOTO').map(fileView),
      leaseDocuments: leaseDocuments.map((d) => ({
        ...fileView(d),
        leaseId: d.leaseId!,
        unitNumber: d.lease?.unit.number ?? '',
        tenantName: d.lease?.tenants[0]?.tenant.name ?? null,
      })),
    };
  }

  async function getUnit(propertyId: string, unitId: string) {
    const unit = await client.unit.findFirst({
      where: { id: unitId, propertyId, organizationId },
      include: {
        property: { select: { id: true, name: true, type: true, archivedAt: true } },
        leases: {
          orderBy: { startDate: 'desc' },
          include: { tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } } },
        },
        maintenanceRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!unit) return null;

    const documents = await client.document.findMany({
      where: { organizationId, unitId },
      orderBy: { createdAt: 'desc' },
    });
    const current = unit.leases.find((l) => l.status === 'ACTIVE') ?? null;
    const primary = (l: (typeof unit.leases)[number]) => l.tenants[0]?.tenant ?? null;

    return {
      id: unit.id,
      number: unit.number,
      isImplicit: unit.isImplicit,
      bedrooms: unit.bedrooms,
      bathrooms: num(unit.bathrooms),
      squareFeet: unit.squareFeet,
      listedRent: num(unit.listedRent),
      status: unit.status as UnitStatusValue,
      property: {
        id: unit.property.id,
        name: unit.property.name,
        type: unit.property.type as PropertyTypeValue,
        archived: unit.property.archivedAt != null,
      },
      currentLease: current
        ? {
            id: current.id,
            startDate: current.startDate,
            endDate: current.endDate,
            monthlyRent: Number(current.monthlyRent),
            deposit: Number(current.deposit),
            status: current.status,
            tenant: primary(current)
              ? {
                  id: primary(current)!.id,
                  name: primary(current)!.name,
                  email: primary(current)!.email,
                }
              : null,
          }
        : null,
      leaseHistory: unit.leases.map((l) => ({
        id: l.id,
        tenantName: primary(l)?.name ?? 'No tenant',
        startDate: l.startDate,
        endDate: l.endDate,
        monthlyRent: Number(l.monthlyRent),
        status: l.status,
      })),
      maintenance: unit.maintenanceRequests.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        priority: m.priority,
        createdAt: m.createdAt,
      })),
      openRepairs: unit.maintenanceRequests.filter(
        (m) => m.status !== 'DONE' && m.status !== 'CANCELLED',
      ).length,
      photos: documents.filter((d) => d.kind === 'PHOTO').map(fileView),
      files: documents.filter((d) => d.kind !== 'PHOTO').map(fileView),
    };
  }

  async function createProperty(input: PropertyInput): Promise<WriteResult> {
    const ownerErr = await ownerError(input.ownerId);
    if (ownerErr) return { ok: false, errors: ownerErr };

    const { unitCount, ...fields } = input;
    const created = await client.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: { ...fields, organizationId },
        select: { id: true },
      });
      if (input.type === 'SINGLE_UNIT') {
        await tx.unit.create({
          data: {
            organizationId,
            propertyId: property.id,
            number: IMPLICIT_UNIT_NUMBER,
            isImplicit: true,
            status: 'VACANT',
          },
        });
      } else if (unitCount > 0) {
        await tx.unit.createMany({
          data: Array.from({ length: unitCount }, (_, i) => ({
            organizationId,
            propertyId: property.id,
            number: String(i + 1),
            status: 'VACANT' as const,
          })),
        });
      }
      return property;
    });
    return { ok: true, id: created.id };
  }

  async function updateProperty(id: string, input: PropertyInput): Promise<WriteResult> {
    const existing = await client.property.findFirst({
      where: { id, organizationId },
      include: { units: { select: { id: true, status: true } } },
    });
    if (!existing) return { ok: false, errors: { _form: 'Property not found' } };

    const liveUnits = existing.units.filter((u) => u.status !== 'ARCHIVED').length;
    const typeErr = existing.type === input.type ? null : checkTypeChange(input.type, liveUnits);
    if (typeErr) return { ok: false, errors: typeErr };
    const ownerErr = await ownerError(input.ownerId);
    if (ownerErr) return { ok: false, errors: ownerErr };

    const { unitCount: _unitCount, ...fields } = input;
    void _unitCount;
    await client.$transaction(async (tx) => {
      await tx.property.updateMany({ where: { id, organizationId }, data: fields });
      if (existing.type !== input.type) {
        if (input.type === 'MULTI_UNIT') {
          await tx.unit.updateMany({
            where: { propertyId: id, organizationId },
            data: { isImplicit: false },
          });
        } else if (existing.units.length) {
          const only = existing.units.find((u) => u.status !== 'ARCHIVED') ?? existing.units[0];
          await tx.unit.updateMany({
            where: { id: only.id, organizationId },
            data: { isImplicit: true, number: IMPLICIT_UNIT_NUMBER },
          });
        } else {
          await tx.unit.create({
            data: {
              organizationId,
              propertyId: id,
              number: IMPLICIT_UNIT_NUMBER,
              isImplicit: true,
            },
          });
        }
      }
    });
    return { ok: true, id };
  }

  async function setPropertyArchived(id: string, archived: boolean): Promise<WriteResult> {
    const existing = await client.property.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return { ok: false, errors: { _form: 'Property not found' } };
    if (archived) {
      const active = await client.lease.count({
        where: { organizationId, status: 'ACTIVE', unit: { propertyId: id } },
      });
      if (active > 0) {
        return {
          ok: false,
          errors: {
            _form: `${active} active ${active === 1 ? 'lease' : 'leases'} must end before this property can be archived`,
          },
        };
      }
    }
    await client.property.updateMany({
      where: { id, organizationId },
      data: { archivedAt: archived ? new Date() : null },
    });
    return { ok: true, id };
  }

  async function createUnit(propertyId: string, input: UnitInput): Promise<WriteResult> {
    const property = await client.property.findFirst({
      where: { id: propertyId, organizationId },
      include: { units: { select: { status: true } } },
    });
    if (!property) return { ok: false, errors: { _form: 'Property not found' } };
    if (property.archivedAt)
      return { ok: false, errors: { _form: 'Restore this property before adding units' } };
    if (property.type === 'SINGLE_UNIT' && property.units.some((u) => u.status !== 'ARCHIVED')) {
      return { ok: false, errors: { _form: 'A single-unit property already has its one unit' } };
    }
    const status = resolveUnitStatus(input.status, false);
    if (!status.ok) return status;
    try {
      const unit = await client.unit.create({
        data: {
          ...input,
          status: status.data,
          organizationId,
          propertyId,
          isImplicit: property.type === 'SINGLE_UNIT',
        },
        select: { id: true },
      });
      return { ok: true, id: unit.id };
    } catch (e) {
      if (isUniqueViolation(e))
        return {
          ok: false,
          errors: { number: 'This property already has a unit with that number' },
        };
      throw e;
    }
  }

  async function updateUnit(
    propertyId: string,
    unitId: string,
    input: UnitInput,
  ): Promise<WriteResult> {
    const unit = await client.unit.findFirst({
      where: { id: unitId, propertyId, organizationId },
      include: { leases: { where: { status: 'ACTIVE' }, select: { id: true } } },
    });
    if (!unit) return { ok: false, errors: { _form: 'Unit not found' } };
    const status = resolveUnitStatus(input.status, unit.leases.length > 0);
    if (!status.ok) return status;
    try {
      await client.unit.updateMany({
        where: { id: unitId, propertyId, organizationId },
        data: {
          ...input,
          number: unit.isImplicit ? unit.number : input.number,
          status: status.data,
        },
      });
      return { ok: true, id: unitId };
    } catch (e) {
      if (isUniqueViolation(e))
        return {
          ok: false,
          errors: { number: 'This property already has a unit with that number' },
        };
      throw e;
    }
  }

  return {
    listOwners,
    listProperties,
    countByFilter,
    getProperty,
    getUnit,
    createProperty,
    updateProperty,
    setPropertyArchived,
    createUnit,
    updateUnit,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function fileView(d: {
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  sizeBytes: bigint;
  createdAt: Date;
}) {
  return {
    id: d.id,
    name: d.name,
    kind: d.kind,
    mimeType: d.mimeType,
    sizeBytes: Number(d.sizeBytes),
    createdAt: d.createdAt,
  };
}

export type PropertyDetail = NonNullable<
  Awaited<ReturnType<ReturnType<typeof propertiesDb>['getProperty']>>
>;
export type UnitDetail = NonNullable<
  Awaited<ReturnType<ReturnType<typeof propertiesDb>['getUnit']>>
>;
export type PropertySummary = Awaited<
  ReturnType<ReturnType<typeof propertiesDb>['listProperties']>
>['properties'][number];

import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  dateInput,
  nextLeaseStart,
  overlaps,
  parseLeaseDate,
  renewalEnd,
  terminationEnd,
} from '@/lib/leases/core';
import {
  activateLease,
  createLease,
  renewLease,
  terminateLease,
  updateLeaseTerms,
} from '@/lib/leases/service';

const day = (value: string) => parseLeaseDate(value)!;
const terms = {
  startDate: day('2026-01-01'),
  endDate: day('2026-12-31'),
  monthlyRent: '1850.00',
  deposit: '1850.00',
  lateFee: '75.00',
  graceDays: 5,
};

function fakeDb() {
  const leases: Array<{
    id: string;
    organizationId: string;
    unitId: string;
    startDate: Date;
    endDate: Date;
    status: 'ACTIVE' | 'DRAFT' | 'TERMINATED';
    monthlyRent: string;
    deposit: string;
    lateFee: string;
    graceDays: number;
    tenants: { tenantId: string; organizationId: string; isPrimary: boolean }[];
  }> = [];
  const unitUpdates: Array<Record<string, unknown>> = [];
  const tx = {
    $executeRaw: async () => 0,
    charge: {
      findMany: async () => [],
      createMany: async () => ({ count: 1 }),
    },
    unit: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; organizationId: string };
        data: Record<string, unknown>;
      }) => {
        if (where.id !== 'unit-1' || where.organizationId !== 'org-1') return { count: 0 };
        unitUpdates.push(data);
        return { count: 1 };
      },
    },
    tenant: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        where.id === 'tenant-1' ? { id: where.id } : null,
    },
    lease: {
      findMany: async ({
        where,
      }: {
        where: { organizationId: string; unitId: string; status: string; id?: { not: string } };
      }) =>
        leases
          .filter(
            (l) =>
              l.organizationId === where.organizationId &&
              l.unitId === where.unitId &&
              l.status === where.status &&
              l.id !== where.id?.not,
          )
          .map(({ startDate, endDate }) => ({ startDate, endDate })),
      findFirst: async ({
        where,
      }: {
        where: { id: string; organizationId: string; status?: string };
      }) =>
        leases.find(
          (l) =>
            l.id === where.id &&
            l.organizationId === where.organizationId &&
            (!where.status || l.status === where.status),
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: `lease-${leases.length + 1}`,
          organizationId: String(data.organizationId),
          unitId: String(data.unitId),
          startDate: data.startDate as Date,
          endDate: data.endDate as Date,
          status: data.status as 'ACTIVE' | 'DRAFT',
          monthlyRent: String(data.monthlyRent),
          deposit: String(data.deposit),
          lateFee: String(data.lateFee ?? '0'),
          graceDays: Number(data.graceDays ?? 0),
          tenants: [] as { tenantId: string; organizationId: string; isPrimary: boolean }[],
        };
        leases.push(created);
        return { id: created.id };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; organizationId: string };
        data: Record<string, unknown>;
      }) => {
        const lease = leases.find(
          (l) => l.id === where.id && l.organizationId === where.organizationId,
        );
        if (!lease) return { count: 0 };
        Object.assign(lease, data);
        return { count: 1 };
      },
      count: async ({
        where,
      }: {
        where: { organizationId: string; unitId: string; status: string };
      }) =>
        leases.filter(
          (l) =>
            l.organizationId === where.organizationId &&
            l.unitId === where.unitId &&
            l.status === where.status,
        ).length,
    },
    leaseEvent: { createMany: async () => ({ count: 0 }) },
    leaseTenant: {
      create: async ({
        data,
      }: {
        data: { leaseId: string; tenantId: string; organizationId: string; isPrimary: boolean };
      }) => {
        leases.find((l) => l.id === data.leaseId)!.tenants.push(data);
      },
      createMany: async ({
        data,
      }: {
        data: { leaseId: string; tenantId: string; organizationId: string; isPrimary: boolean }[];
      }) => {
        for (const link of data) leases.find((l) => l.id === link.leaseId)!.tenants.push(link);
      },
    },
  };
  return {
    leases,
    unitUpdates,
    client: {
      $transaction: async (run: (client: unknown) => Promise<unknown>) => run(tx),
    } as unknown as PrismaClient,
  };
}

describe('lease dates', () => {
  it('uses inclusive overlap boundaries and allows the day after', () => {
    expect(overlaps(terms, { startDate: day('2026-12-31'), endDate: day('2027-01-31') })).toBe(
      true,
    );
    expect(overlaps(terms, { startDate: day('2027-01-01'), endDate: day('2027-12-31') })).toBe(
      false,
    );
    expect(dateInput(nextLeaseStart(terms.endDate))).toBe('2027-01-01');
    expect(dateInput(renewalEnd(day('2027-01-01')))).toBe('2027-12-31');
  });

  it('clamps termination to the lease term', () => {
    expect(dateInput(terminationEnd(terms, day('2026-06-15')))).toBe('2026-06-15');
    expect(dateInput(terminationEnd(terms, day('2025-12-01')))).toBe('2026-01-01');
  });
});

describe('lease mutations', () => {
  it('rejects overlapping active creation, activation and edits with a clear field error', async () => {
    const db = fakeDb();
    await createLease('org-1', 'unit-1', 'tenant-1', terms, 'ACTIVE', db.client);
    await expect(
      createLease(
        'org-1',
        'unit-1',
        'tenant-1',
        {
          ...terms,
          startDate: day('2026-12-31'),
          endDate: day('2027-12-30'),
        },
        'ACTIVE',
        db.client,
      ),
    ).rejects.toMatchObject({
      field: 'startDate',
      message: expect.stringContaining('active lease'),
    });
    const draft = await createLease('org-1', 'unit-1', 'tenant-1', terms, 'DRAFT', db.client);
    await expect(activateLease('org-1', draft.id, db.client)).rejects.toMatchObject({
      field: 'startDate',
    });
    const future = await createLease(
      'org-1',
      'unit-1',
      'tenant-1',
      { ...terms, startDate: day('2027-01-01'), endDate: day('2027-12-31') },
      'ACTIVE',
      db.client,
    );
    await expect(
      updateLeaseTerms('org-1', future.id, { ...terms, startDate: day('2026-12-31') }, db.client),
    ).rejects.toMatchObject({ field: 'startDate' });
    expect(db.leases).toHaveLength(3);
  });

  it('renews into a draft for the same unit and tenants with the next annual term', async () => {
    const db = fakeDb();
    const original = await createLease('org-1', 'unit-1', 'tenant-1', terms, 'ACTIVE', db.client);
    const renewal = await renewLease('org-1', original.id, undefined, db.client);
    const row = db.leases.find((l) => l.id === renewal.id)!;
    expect(row).toMatchObject({
      status: 'DRAFT',
      unitId: 'unit-1',
      tenants: [{ tenantId: 'tenant-1', isPrimary: true }],
    });
    expect(dateInput(row.startDate)).toBe('2027-01-01');
    expect(dateInput(row.endDate)).toBe('2027-12-31');
    await expect(
      renewLease('org-1', original.id, { ...terms, startDate: day('2026-12-01') }, db.client),
    ).rejects.toMatchObject({ field: 'startDate' });
  });

  it('terminates an active lease, truncates its end and releases the unit', async () => {
    const db = fakeDb();
    const original = await createLease('org-1', 'unit-1', 'tenant-1', terms, 'ACTIVE', db.client);
    await terminateLease('org-1', original.id, db.client, day('2026-06-15'));
    expect(db.leases[0].status).toBe('TERMINATED');
    expect(dateInput(db.leases[0].endDate)).toBe('2026-06-15');
    expect(db.unitUpdates.at(-1)).toEqual({ status: 'VACANT' });
    await expect(terminateLease('org-1', original.id, db.client)).rejects.toThrow(
      'Only an active lease',
    );
  });
});

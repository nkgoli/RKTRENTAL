import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { organizationTenants } from '@/lib/tenants/queries';

describe('tenant directory pagination', () => {
  it('keeps the default size and supports compact pages without dropping tenants', async () => {
    const rows = Array.from({ length: 31 }, (_, index) => ({
      id: `tenant-${index}`,
      name: `Tenant ${index}`,
      email: null,
      phone: null,
      leases: [],
    }));
    const client = {
      tenant: { findMany: vi.fn().mockResolvedValue(rows) },
    } as unknown as PrismaClient;
    const tenants = organizationTenants('org', client);
    expect((await tenants.list()).rows).toHaveLength(25);
    const second = await tenants.list({ page: 2, pageSize: 10 });
    expect(second.total).toBe(31);
    expect(second.rows).toHaveLength(10);
    expect(second.rows[0].id).toBe('tenant-10');
    expect((await tenants.list({ page: 4, pageSize: 10 })).rows.map((row) => row.id)).toEqual([
      'tenant-30',
    ]);
  });
});

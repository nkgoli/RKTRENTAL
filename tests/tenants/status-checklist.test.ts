import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { deriveSetupChecklist } from '@/lib/tenants/status';
import { organizationTenants } from '@/lib/tenants/queries';

describe('tenant setup checklist', () => {
  it('derives bank, autopay and card from persisted methods and lease settings', () => {
    expect(deriveSetupChecklist([{ type: 'ach' }], true)).toEqual({
      invited: 'not-applicable',
      accepted: 'not-applicable',
      bankAdded: 'complete',
      bankVerified: 'not-applicable',
      autopayOn: 'complete',
      cardOnFile: 'not-applicable',
    });
    expect(deriveSetupChecklist([{ type: 'card' }], false)).toMatchObject({
      bankAdded: 'incomplete',
      autopayOn: 'incomplete',
      cardOnFile: 'complete',
    });
    expect(deriveSetupChecklist([], false)).toMatchObject({
      bankAdded: 'incomplete',
      autopayOn: 'incomplete',
      cardOnFile: 'incomplete',
    });
  });

  it('keeps setup scoped to the organization and to each tenant on a lease', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'lease-1',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        unit: {
          id: 'unit-1',
          number: '4B',
          isImplicit: false,
          property: { id: 'property-1', name: 'Maple Court' },
        },
        tenants: [
          {
            tenant: {
              id: 'alex',
              name: 'Alex',
              email: 'alex@example.com',
              phone: null,
              paymentMethods: [{ type: 'ach' }],
            },
          },
          {
            tenant: {
              id: 'sam',
              name: 'Sam',
              email: null,
              phone: null,
              paymentMethods: [{ type: 'card' }],
            },
          },
        ],
        autopaySettings: [{ tenantId: 'alex' }],
      },
    ]);
    const client = { lease: { findMany } } as unknown as PrismaClient;
    const rows = await organizationTenants('org-1', client, new Date('2026-10-01')).setupRows();
    expect(findMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      status: { in: ['ACTIVE', 'DRAFT'] },
    });
    expect(
      findMany.mock.calls[0][0].include.tenants.include.tenant.include.paymentMethods.where
        .organizationId,
    ).toBe('org-1');
    expect(rows).toHaveLength(2);
    expect(rows[0].checklist.autopayOn).toBe('complete');
    expect(rows[1].checklist.autopayOn).toBe('incomplete');
    expect(rows[1].checklist.cardOnFile).toBe('complete');
  });
});

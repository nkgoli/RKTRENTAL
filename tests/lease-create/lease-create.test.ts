import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { emptyDraft } from '@/lib/lease-create/types';
import {
  dueAtSigning,
  hasOverlap,
  renewalWindow,
  suggestedEndDate,
  validateClausesAndDocuments,
  validateRentAndDeposit,
  validateReview,
  validateStep,
  validateTerms,
  validateUnitAndTenants,
} from '@/lib/lease-create/validation';
import {
  createLeaseFromWizard,
  createRenewalFromWizard,
  renewalDefaults,
} from '@/lib/lease-create/service';
import { MockEsignProvider, resetMockEsign } from '@/lib/esign/mock';
import { buildLeasePdf } from '@/lib/esign/pdf';
import { parseLeaseDate } from '@/lib/leases/core';

const day = (v: string) => parseLeaseDate(v)!;
const base = () =>
  emptyDraft({
    unitId: 'unit-1',
    tenantIds: ['tenant-1'],
    primaryTenantId: 'tenant-1',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    monthlyRent: '1600',
    deposit: '1600',
  });

describe('wizard step validation', () => {
  it('requires a unit and a primary tenant from the selected tenants', () => {
    expect(validateUnitAndTenants(emptyDraft()).unitId).toContain('Select a unit');
    expect(validateUnitAndTenants(emptyDraft()).tenantIds).toContain('at least one tenant');
    expect(validateUnitAndTenants(base(), {}).primaryTenantId).toBeUndefined();
    expect(
      validateUnitAndTenants({ ...base(), primaryTenantId: 'other' }).primaryTenantId,
    ).toContain('primary tenant');
    expect(validateStep(0, emptyDraft()).unitId).toBeTruthy();
  });

  it('rejects inverted and renewal-early terms, and bad rent values', () => {
    expect(validateTerms({ ...base(), endDate: '2026-01-01' }).endDate).toContain('on or after');
    expect(validateTerms(base(), { renewalSourceEnd: day('2027-06-30') }).startDate).toContain(
      'after the current lease ends',
    );
    expect(validateRentAndDeposit({ ...base(), monthlyRent: '0' }).monthlyRent).toContain(
      'greater than zero',
    );
    expect(validateRentAndDeposit({ ...base(), graceDays: 40 }).graceDays).toContain('0 to 31');
    expect(validateRentAndDeposit(base())).toEqual({});
  });

  it('requires a clause and blocks duplicate documents', () => {
    expect(validateClausesAndDocuments({ ...base(), clauses: [] }).clauses).toContain(
      'at least one',
    );
    expect(
      validateClausesAndDocuments({ ...base(), documentNames: ['A.pdf', 'a.pdf'] }).documentNames,
    ).toContain('only once');
  });

  it('blocks sending when the primary tenant has no email, and computes due at signing', () => {
    const errors = validateReview(base(), {
      tenants: [{ id: 'tenant-1', name: 'No Email', email: null }],
    });
    expect(errors.primaryTenantId).toContain('email address');
    expect(dueAtSigning(base())).toBe(3200);
  });
});

describe('renewal dates', () => {
  it('starts the day after the source ends and runs one year', () => {
    const w = renewalWindow(day('2026-11-30'));
    expect(w.startDate.toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(w.endDate.toISOString().slice(0, 10)).toBe('2027-11-30');
    expect(suggestedEndDate(day('2027-01-01'), 'fixed').toISOString().slice(0, 10)).toBe(
      '2027-12-31',
    );
    expect(suggestedEndDate(day('2027-01-15'), 'month-to-month').toISOString().slice(0, 10)).toBe(
      '2027-02-14',
    );
  });

  it('prefills renewal defaults from the source lease', () => {
    const draft = renewalDefaults({
      endDate: day('2026-11-30'),
      monthlyRent: '1850.00',
      deposit: '1850.00',
      lateFee: '75.00',
      graceDays: 5,
      unitId: 'unit-9',
      tenants: [{ tenantId: 'tenant-1', isPrimary: true }],
    });
    expect(draft).toMatchObject({
      unitId: 'unit-9',
      startDate: '2026-12-01',
      endDate: '2027-11-30',
      monthlyRent: '1850.00',
      primaryTenantId: 'tenant-1',
    });
  });

  it('treats adjacent terms as non-overlapping and shared days as overlapping', () => {
    const existing = [{ startDate: day('2026-01-01'), endDate: day('2026-12-31') }];
    expect(hasOverlap({ startDate: day('2027-01-01'), endDate: day('2027-12-31') }, existing)).toBe(
      false,
    );
    expect(hasOverlap({ startDate: day('2026-12-31'), endDate: day('2027-12-31') }, existing)).toBe(
      true,
    );
  });
});

function fakeDb() {
  const leases: Array<Record<string, unknown> & { tenants: string[] }> = [
    {
      id: 'lease-source',
      organizationId: 'org-1',
      unitId: 'unit-1',
      startDate: day('2026-01-01'),
      endDate: day('2026-11-30'),
      status: 'ACTIVE',
      monthlyRent: '1850.00',
      deposit: '1850.00',
      lateFee: '75.00',
      graceDays: 5,
      tenants: ['tenant-1'],
    },
  ];
  const tx = {
    unit: {
      updateMany: async ({ where }: { where: { id: string } }) => ({
        count: where.id === 'unit-1' ? 1 : 0,
      }),
    },
    tenant: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => id.startsWith('tenant-')).map((id) => ({ id })),
    },
    lease: {
      findMany: async () =>
        leases
          .filter((l) => l.status === 'ACTIVE')
          .map((l) => ({ startDate: l.startDate as Date, endDate: l.endDate as Date })),
      findFirst: async ({ where }: { where: { id: string } }) =>
        leases.find((l) => l.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          ...data,
          id: `lease-${leases.length + 1}`,
          tenants: [] as string[],
        } as (typeof leases)[number];
        leases.push(row);
        return { id: row.id as string };
      },
    },
    leaseEvent: { createMany: async () => ({ count: 0 }) },
    leaseTenant: {
      createMany: async ({ data }: { data: { leaseId: string; tenantId: string }[] }) => {
        for (const d of data) leases.find((l) => l.id === d.leaseId)?.tenants.push(d.tenantId);
        return { count: data.length };
      },
    },
  };
  // Source lease tenants shape used by renewLease lookup.
  (leases[0] as unknown as { tenants: unknown }).tenants = [
    { tenantId: 'tenant-1', isPrimary: true },
  ];
  return {
    leases,
    client: {
      $transaction: async (run: (c: unknown) => Promise<unknown>) => run(tx),
    } as unknown as PrismaClient,
  };
}

describe('wizard lease creation service', () => {
  it('creates a multi-tenant lease and rejects an overlapping active lease', async () => {
    const db = fakeDb();
    const draft = {
      ...base(),
      tenantIds: ['tenant-1', 'tenant-2'],
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    };
    const { id } = await createLeaseFromWizard('org-1', draft, 'ACTIVE', db.client);
    expect(db.leases.find((l) => l.id === id)?.tenants).toEqual(['tenant-1', 'tenant-2']);
    await expect(createLeaseFromWizard('org-1', draft, 'ACTIVE', db.client)).rejects.toMatchObject({
      field: 'startDate',
    });
  });

  it('renews into the following term for the same unit and tenants', async () => {
    const db = fakeDb();
    const { id } = await createRenewalFromWizard(
      'org-1',
      'lease-source',
      renewalDefaults({
        endDate: day('2026-11-30'),
        monthlyRent: '1900.00',
        deposit: '1850.00',
        lateFee: '75.00',
        graceDays: 5,
        unitId: 'unit-1',
        tenants: [{ tenantId: 'tenant-1', isPrimary: true }],
      }),
      'DRAFT',
      db.client,
    );
    const row = db.leases.find((l) => l.id === id)!;
    expect((row.startDate as Date).toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(row.unitId).toBe('unit-1');
  });
});

describe('mock e-signature provider', () => {
  it('sends, reports status, and completes signing idempotently', async () => {
    resetMockEsign();
    const provider = new MockEsignProvider();
    const sent = await provider.sendForSignature({
      leaseId: 'lease-1',
      documentName: 'Signed lease agreement.pdf',
      signers: [{ name: 'Alex Rivera', email: 'alex@example.com' }],
      summaryLines: [],
    });
    expect(sent.status).toBe('SENT');
    expect((await provider.getStatus(sent.id))?.status).toBe('SENT');
    const signed = await provider.completeSigning('lease-1', day('2027-01-02'));
    expect(signed.status).toBe('SIGNED');
    expect((await provider.completeSigning('lease-1')).status).toBe('SIGNED');
    await expect(provider.handleCallback({ envelopeId: 'bogus', event: 'signed' })).rejects.toThrow(
      'Unknown',
    );
  });

  it('builds a signed PDF with the PDF header', () => {
    const pdf = buildLeasePdf(['Lease: lease-1', 'Signer: Alex Rivera - signed']);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    expect(new TextDecoder().decode(pdf)).toContain('Alex Rivera');
  });
});

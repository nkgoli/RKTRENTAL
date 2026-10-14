import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeMockSigning } from '../../src/lib/esign/service';
import { getEsignProvider } from '../../src/lib/esign/mock';
import { isSandboxEnabled } from '../../src/lib/providers/sandbox';
import { serverPaymentIdempotencyKey } from '../../src/lib/tenant-pay/service';

vi.mock('../../src/lib/db/client', () => ({ db: {} }));

afterEach(() => vi.unstubAllEnvs());

describe('sandbox-only mock integration selection', () => {
  it('requires an explicit sandbox flag even outside production', () => {
    expect(isSandboxEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isSandboxEnabled({ NODE_ENV: 'production', ROCKETRENTAL_SANDBOX: 'true' })).toBe(true);
    vi.stubEnv('ROCKETRENTAL_SANDBOX', 'false');
    expect(() => getEsignProvider()).toThrow(/sandbox-only/);
    vi.stubEnv('ROCKETRENTAL_SANDBOX', 'true');
    expect(getEsignProvider().name).toBe('mock');
  });

  it('refuses mock signing when the explicit sandbox flag is absent', async () => {
    vi.stubEnv('ROCKETRENTAL_SANDBOX', 'false');
    await expect(
      completeMockSigning(
        'org-1',
        { subjectId: 'manager-1', organizationId: 'org-1', role: 'MANAGER' },
        'lease-1',
      ),
    ).rejects.toThrow('Mock signing requires ROCKETRENTAL_SANDBOX=true');
  });
});

describe('server-generated payment idempotency', () => {
  it('is stable for one server ledger snapshot and changes when that state changes', () => {
    const request = {
      organizationId: 'org-1',
      tenantId: 'tenant-1',
      leaseId: 'lease-1',
      amountCents: 25_000,
      method: 'card' as const,
      charges: [{ id: 'charge-1', amountCents: 25_000, dueDate: new Date('2026-10-01T00:00:00Z') }],
      payments: [],
    };
    expect(serverPaymentIdempotencyKey(request)).toBe(serverPaymentIdempotencyKey(request));
    expect(serverPaymentIdempotencyKey(request)).not.toBe(
      serverPaymentIdempotencyKey({ ...request, payments: [{ id: 'payment-1', amountCents: 25_000, status: 'PENDING' }] }),
    );
  });
});

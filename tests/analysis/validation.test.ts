import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { analysisService } from '../../src/lib/analysis/service';
import { payload } from './fixture';

describe('save request validation before database access', () => {
  const service = analysisService(
    { organizationId: 'trusted', role: 'MANAGER' },
    {} as PrismaClient,
  );
  it.each([-1, 0.5, NaN, Infinity, 2147483647, '1'])(
    'rejects invalid revision %s',
    async (expectedRevision) => {
      expect(
        await service.save({
          propertyId: 'property-a',
          expectedRevision,
          status: 'DRAFT',
          payload: payload(),
        }),
      ).toMatchObject({ ok: false, code: 'INVALID' });
    },
  );
  it('rejects client organization/role injection and mismatched envelope before reads', async () => {
    expect(
      await service.save({
        propertyId: 'property-a',
        expectedRevision: 0,
        status: 'READY',
        payload: payload(),
        organizationId: 'foreign',
        role: 'MANAGER',
      }),
    ).toMatchObject({ ok: false, code: 'INVALID' });
    expect(
      await service.save({
        propertyId: 'other',
        expectedRevision: 0,
        status: 'READY',
        payload: payload(),
      }),
    ).toMatchObject({ ok: false, code: 'INVALID' });
  });
});

import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { actualReturnsService } from '../../src/lib/returns/actual-service';

// Any query would throw: guards must reject before touching the database.
const noDb = new Proxy(
  {},
  {
    get() {
      throw new Error('database must not be queried');
    },
  },
) as unknown as PrismaClient;

describe('actual returns service guards', () => {
  it('forbids non-manager sessions and sessions without an organization', async () => {
    for (const session of [
      { organizationId: 'org', role: 'TENANT' as const },
      { organizationId: 'org', role: 'OWNER' as const },
      { organizationId: ' ', role: 'MANAGER' as const },
    ])
      expect(
        await actualReturnsService(session, noDb).load({
          propertyId: 'p',
          from: '2026-01-01',
          to: '2026-01-31',
        }),
      ).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('rejects missing properties and invalid periods with field issues', async () => {
    const service = actualReturnsService({ organizationId: 'org', role: 'MANAGER' }, noDb);
    expect(await service.load({ from: '2026-02-01', to: '2026-01-01' })).toEqual({
      ok: false,
      code: 'INVALID',
      issues: [
        { path: 'propertyId', message: 'Choose a property.' },
        { path: 'to', message: 'The end date must be on or after the start date.' },
      ],
    });
    expect(await service.load(null)).toMatchObject({ ok: false, code: 'INVALID' });
  });

  it('ignores an organizationId supplied in the request body', async () => {
    const queried: unknown[] = [];
    const client = {
      property: {
        findFirst: async (args: unknown) => {
          queried.push(args);
          return null;
        },
      },
    } as unknown as PrismaClient;
    const result = await actualReturnsService(
      { organizationId: 'mine', role: 'MANAGER' },
      client,
    ).load({
      propertyId: 'p1',
      organizationId: 'theirs',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(queried).toEqual([
      expect.objectContaining({ where: { id: 'p1', organizationId: 'mine', archivedAt: null } }),
    ]);
  });
});

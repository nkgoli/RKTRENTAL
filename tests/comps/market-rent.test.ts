import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ db: { unit: { updateMany: mocks.updateMany } } }));
import { applyMarketRent } from '../../src/lib/comps/service';
beforeEach(() => vi.clearAllMocks());
describe('market-rent-only persistence contract', () => {
  it('scopes the write and changes only market rent and its audit fields', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const now = new Date('2026-10-19T00:00:00Z');
    expect(await applyMarketRent('org', 'occupied-unit', '2100', { id: 'manager', name: 'Manager' }, now))
      .toEqual({ ok: true, rent: 2100 });
    expect(mocks.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'occupied-unit', organizationId: 'org', status: { not: 'ARCHIVED' } },
      data: { marketRent: 2100, marketRentSetById: 'manager', marketRentSetByName: 'Manager', marketRentSetAt: now },
    });
  });
  it('rejects a missing, archived or foreign unit', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(await applyMarketRent('org', 'foreign', '2100', { id: 'm', name: 'M' }))
      .toEqual({ ok: false, error: 'Unit not found.' });
  });
});

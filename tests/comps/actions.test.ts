import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  units: vi.fn(),
  clear: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: vi.fn(async () => ({
    organizationId: 'org-session',
    subjectId: 'manager-1',
    name: 'Manager One',
  })),
}));
vi.mock('@/lib/comps/service', () => ({
  applyMarketRent: mocks.apply,
  listPricingUnits: mocks.units,
  clearUnitComps: mocks.clear,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { requireManagerRole } from '@/lib/auth/access';
import { applyRentAction, refreshCompsAction } from '../../src/app/(manager)/rent-comps/actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireManagerRole).mockResolvedValue({
    organizationId: 'org-session',
    subjectId: 'manager-1',
    name: 'Manager One',
  } as Awaited<ReturnType<typeof requireManagerRole>>);
  mocks.units.mockResolvedValue([{ id: 'u-4b' }]);
  mocks.apply.mockResolvedValue({ ok: true, rent: 2100 });
});

describe('recoverable market rent application', () => {
  it('returns a confirmed non-write when the pricing lookup fails', async () => {
    mocks.units.mockRejectedValueOnce(new Error('database connection unavailable'));
    await expect(
      applyRentAction({}, form({ unitId: 'u-4b', rent: ' $2,100.50 ' })),
    ).resolves.toMatchObject({
      ok: false,
      outcome: 'rejected',
      message: expect.stringContaining('No rent was changed'),
    });
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('reports an uncertain outcome when the write acknowledgement is lost', async () => {
    mocks.apply.mockRejectedValueOnce(new Error('connection lost after write'));
    const result = await applyRentAction({}, form({ unitId: 'u-4b', rent: ' $2,100.50 ' }));
    expect(result).toMatchObject({
      ok: false,
      outcome: 'unknown',
      message: expect.stringContaining('may have been saved'),
    });
    expect(result.message).not.toMatch(/unchanged|no rent was changed/i);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it('retains confirmed save status when view revalidation fails', async () => {
    mocks.revalidate.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    await expect(
      applyRentAction({}, form({ unitId: 'u-4b', rent: '2100' })),
    ).resolves.toMatchObject({ ok: true, rent: 2100, message: expect.stringContaining('saved') });
  });

  it('allows a rejected value to be corrected using the same authorized unit', async () => {
    mocks.apply.mockResolvedValueOnce({
      ok: false,
      error: 'Enter a monthly rent between $1 and $100,000.',
    });
    const rejected = await applyRentAction({}, form({ unitId: 'u-4b', rent: ' $0.00 ' }));
    expect(rejected.ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    const corrected = await applyRentAction(
      rejected,
      form({ unitId: 'u-4b', rent: ' $2,100.50 ' }),
    );
    expect(corrected.ok).toBe(true);
    expect(mocks.apply.mock.calls[1]).toEqual([
      'org-session',
      'u-4b',
      ' $2,100.50 ',
      { id: 'manager-1', name: 'Manager One' },
    ]);
  });

  it('preserves authentication and authorization redirects', async () => {
    for (const path of ['/sign-in', '/tenant']) {
      const redirect = Object.assign(new Error('NEXT_REDIRECT'), {
        digest: `NEXT_REDIRECT;replace;${path};307;`,
      });
      vi.mocked(requireManagerRole).mockRejectedValueOnce(redirect);
      await expect(applyRentAction({}, form({ unitId: 'u-4b', rent: '2100' }))).rejects.toBe(
        redirect,
      );
    }
    expect(mocks.units).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});

describe('comps actions authorization and revalidation', () => {
  it('denies both mutations before accessing data when the manager gate rejects', async () => {
    vi.mocked(requireManagerRole).mockRejectedValueOnce(new Error('Forbidden'));
    await expect(applyRentAction({}, form({ unitId: 'u', rent: '2100' }))).rejects.toThrow(
      'Forbidden',
    );
    vi.mocked(requireManagerRole).mockRejectedValueOnce(new Error('Forbidden'));
    await expect(refreshCompsAction(form({ unitId: 'u' }))).rejects.toThrow('Forbidden');
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('applies market rent in the session organization and refreshes Listing and Rent Analysis', async () => {
    const result = await applyRentAction(
      {},
      form({ unitId: 'u-4b', rent: '2100', returnTo: 'https://evil.example' }),
    );
    expect(result).toEqual({ ok: true, rent: 2100, message: 'Market rent updated.' });
    expect(mocks.apply).toHaveBeenCalledWith('org-session', 'u-4b', '2100', {
      id: 'manager-1',
      name: 'Manager One',
    });
    const paths = mocks.revalidate.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(expect.arrayContaining(['/rent-comps', '/rent-analysis']));
    expect(mocks.revalidate).toHaveBeenCalledWith('/properties', 'layout');
    expect(paths.join(' ')).not.toContain('evil');
  });

  it('does not revalidate or report success when the unit is outside the organization', async () => {
    mocks.apply.mockResolvedValue({ ok: false, error: 'Unit not found.' });
    const result = await applyRentAction({}, form({ unitId: 'other-org-unit', rent: '2100' }));
    expect(result).toMatchObject({ ok: false, outcome: 'rejected', message: 'Unit not found.' });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it('refresh clears only the session organization cache and refreshes both views', async () => {
    await refreshCompsAction(form({ unitId: 'u-4b', organizationId: 'other-org' }));
    expect(mocks.clear).toHaveBeenCalledWith('org-session', 'u-4b');
    const paths = mocks.revalidate.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(expect.arrayContaining(['/rent-comps', '/rent-analysis']));
  });
});

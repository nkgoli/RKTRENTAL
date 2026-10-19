import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
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
  vi.clearAllMocks();
  mocks.apply.mockResolvedValue({ ok: true, rent: 2100 });
});

describe('comps actions authorization and revalidation', () => {
  it('denies both mutations before accessing data when the manager gate rejects', async () => {
    vi.mocked(requireManagerRole).mockRejectedValueOnce(new Error('Forbidden'));
    await expect(applyRentAction({}, form({ unitId: 'u', rent: '2100' }))).rejects.toThrow('Forbidden');
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
    expect(result).toEqual({ ok: false, message: 'Unit not found.' });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it('refresh clears only the session organization cache and refreshes both views', async () => {
    await refreshCompsAction(form({ unitId: 'u-4b', organizationId: 'other-org' }));
    expect(mocks.clear).toHaveBeenCalledWith('org-session', 'u-4b');
    const paths = mocks.revalidate.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(expect.arrayContaining(['/rent-comps', '/rent-analysis']));
  });
});

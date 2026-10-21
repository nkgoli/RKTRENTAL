import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeScopedReturns } from '@/lib/metrics/scoped';
import { resolvePeriod } from '@/lib/returns/period';

const mocks = vi.hoisted(() => ({
  property: vi.fn(),
  unit: vi.fn(),
  returns: vi.fn(),
  period: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org' }),
}));
vi.mock('@/lib/properties/data', () => ({
  propertiesDb: (org: string) => {
    expect(org).toBe('org');
    return { getProperty: mocks.property, getUnit: mocks.unit };
  },
}));
vi.mock('@/lib/metrics', () => ({ loadPropertyWorkspaceReturns: mocks.returns }));
vi.mock('@/lib/returns/queries', () => ({ resolveReturnsPeriod: mocks.period }));
import PropertyReturnsPage from '@/app/(manager)/properties/[id]/returns/page';

const period = resolvePeriod('CUSTOM', new Date('2026-10-21T00:00:00Z'), {
  from: '2026-01',
  to: '2026-06',
});
const base = {
  property: { purchasePriceCents: 30000000, downPaymentCents: 6000000, annualDebtServiceCents: 0 },
  units: [
    {
      id: 'u1',
      number: 'Townhome 1',
      status: 'OCCUPIED',
      monthlyRentCents: 165000,
      listedRentCents: 165000,
    },
  ],
  payments: [],
  expenses: [],
  period,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.property.mockResolvedValue({ id: 'p1', name: 'Cedar Row' });
  mocks.unit.mockImplementation(async (_property, id) => (id === 'u1' ? { id: 'u1' } : null));
  mocks.period.mockResolvedValue(period);
  mocks.returns.mockResolvedValue({
    property: computeScopedReturns(base),
    units: [computeScopedReturns({ ...base, unitId: 'u1' })],
  });
});

describe('scoped report and analysis access', () => {
  it('renders whole-property reporting inside the workspace instead of redirecting', async () => {
    const html = renderToStaticMarkup(
      await PropertyReturnsPage({
        params: Promise.resolve({ id: 'p1' }),
        searchParams: Promise.resolve({ period: 'CUSTOM', from: '2026-01', to: '2026-06' }),
      }),
    );
    expect(html).toContain('Income statement');
    expect(html).toContain('Compare Cedar Row with projections');
    expect(html).toContain(
      '/roi-analysis?property=p1&amp;view=actual&amp;period=CUSTOM&amp;from=2026-01&amp;to=2026-06',
    );
    expect(mocks.unit).not.toHaveBeenCalled();
    expect(mocks.returns).toHaveBeenCalledWith('org', 'p1', period);
  });

  it('retains unit reporting and explains that projections use the whole property', async () => {
    const html = renderToStaticMarkup(
      await PropertyReturnsPage({
        params: Promise.resolve({ id: 'p1' }),
        searchParams: Promise.resolve({ unit: 'u1' }),
      }),
    );
    expect(html).toContain('Unit income follows settled payments');
    expect(html).toContain('Projections cover the whole property.');
    expect(html).toContain('unit=u1&amp;period=YTD');
    expect(html).toContain('name="unit" value="u1"');
    expect(mocks.unit).toHaveBeenCalledWith('p1', 'u1');
  });

  it('rejects a unit that does not belong to the selected property', async () => {
    await expect(
      PropertyReturnsPage({
        params: Promise.resolve({ id: 'p1' }),
        searchParams: Promise.resolve({ unit: 'another-property-unit' }),
      }),
    ).rejects.toThrow('not found');
  });
});

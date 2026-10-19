import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const mocks = vi.hoisted(() => ({ units: vi.fn(), fetch: vi.fn(), settings: vi.fn() }));
vi.mock('@/lib/comps/service', () => ({ listPricingUnits: mocks.units, fetchComps: mocks.fetch, compsSettings: mocks.settings }));
vi.mock('@/app/(manager)/rent-comps/actions', () => ({ refreshCompsAction: vi.fn() }));
import { RentCompsPanel } from '../../src/components/rent-comps/RentCompsPanel';
import { rentAnalysisContext } from '../../src/lib/comps/navigation';

describe('panel context authorization boundary', () => {
  it.each([
    rentAnalysisContext('maple', 'cedar-unit'),
    rentAnalysisContext('', 'cedar-unit'),
    rentAnalysisContext('cedar', 'different-unit'),
  ])('rejects inconsistent context before settings or provider access', async (context) => {
    mocks.units.mockResolvedValue([{ id: 'cedar-unit', property: { id: 'cedar' } }]);
    const output = await RentCompsPanel({ organizationId: 'org', unitId: 'cedar-unit', context });
    expect(renderToStaticMarkup(output)).toContain('No rent comps available');
    expect(mocks.units).toHaveBeenCalledWith('org');
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { documentsDestination, legacyTabDestination } from '@/app/(manager)/properties/[id]/routing';

describe('property workspace compatibility routes', () => {
  it('keeps unit scope and pricing filters when opening the canonical listing', () => {
    expect(legacyTabDestination('maple', { tab: 'listing', radius: '1', beds: '2', status: 'leased' }, '4b'))
      .toBe('/properties/maple/listing?radius=1&beds=2&status=leased&unit=4b');
  });

  it('keeps the selected unit and date range on returns', () => {
    expect(legacyTabDestination('maple', { tab: 'returns', unit: '4b', period: 'ytd' }))
      .toBe('/properties/maple/returns?period=ytd&unit=4b');
  });

  it('keeps documents in the property overview with its unit context', () => {
    expect(documentsDestination('maple', { unit: '4b', notice: 'uploaded' }))
      .toBe('/properties/maple?notice=uploaded&unit=4b');
  });
});

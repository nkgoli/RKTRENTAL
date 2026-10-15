import { describe, expect, it } from 'vitest';
import { applicationsRedirectUrl } from '@/lib/screening/redirect';

describe('applicationsRedirectUrl', () => {
  it('keeps the property and unit scope through screening redirects', () => {
    const url = applicationsRedirectUrl('app 1', 'screening', { propertyId: 'p1', unitId: 'u1' });
    const query = new URL(url, 'http://x').searchParams;
    expect(url.startsWith('/applications?')).toBe(true);
    expect(query.get('propertyId')).toBe('p1');
    expect(query.get('unitId')).toBe('u1');
    expect(query.get('applicant')).toBe('app 1');
    expect(query.get('notice')).toBe('screening');
  });

  it('omits scope params when unscoped', () => {
    expect(applicationsRedirectUrl('a', 'approved', {})).toBe(
      '/applications?applicant=a&notice=approved',
    );
  });
});

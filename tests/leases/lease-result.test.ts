import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  manager: vi.fn(),
  find: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  terms: vi.fn(),
  notice: vi.fn(),
  activate: vi.fn(),
  terminate: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({ requireManagerRole: mocks.manager }));
vi.mock('@/lib/db/client', () => ({ db: { lease: { findFirst: mocks.find } } }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('@/app/(manager)/leases/actions', () => ({
  editTermsAction: mocks.terms,
  recordNoticeAction: mocks.notice,
  activateLeaseAction: mocks.activate,
  terminateLeaseAction: mocks.terminate,
}));

import {
  editDetailTermsAction,
  recordDetailNoticeAction,
  activateDetailLeaseAction,
  terminateDetailLeaseAction,
} from '@/app/(manager)/leases/[id]/actions';
import { GET } from '@/app/(manager)/leases/[id]/result/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.manager.mockResolvedValue({ organizationId: 'org-1' });
  mocks.find.mockResolvedValue({
    id: 'lease-1',
    unitId: 'unit-1',
    unit: { propertyId: 'property-1' },
  });
  mocks.redirect.mockImplementation(() => {
    throw new Error('redirect');
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error('not found');
  });
  for (const action of [mocks.terms, mocks.notice, mocks.activate, mocks.terminate])
    action.mockResolvedValue({ ok: true });
});

describe('lease action completion', () => {
  it.each([
    [editDetailTermsAction, mocks.terms, 'terms'],
    [recordDetailNoticeAction, mocks.notice, 'notice'],
    [activateDetailLeaseAction, mocks.activate, 'activated'],
    [terminateDetailLeaseAction, mocks.terminate, 'terminated'],
  ] as const)(
    'retains the original action and completes successful %s',
    async (action, original, saved) => {
      const form = new FormData();
      form.set('leaseId', 'lease-1');
      form.set('returnScope', 'unit');
      form.set('returnTo', 'https://untrusted.example');
      await expect(action({}, form)).rejects.toThrow('redirect');
      expect(original).toHaveBeenCalledExactlyOnceWith({}, form);
      expect(mocks.redirect).toHaveBeenCalledWith(
        `/leases/lease-1/result?saved=${saved}&scope=unit`,
      );
    },
  );

  it('returns validation and eligibility failures without navigation or a second mutation', async () => {
    const failure = { message: 'Only a draft lease can be activated.', errors: {} };
    mocks.activate.mockResolvedValueOnce(failure);
    expect(await activateDetailLeaseAction({}, new FormData())).toEqual(failure);
    expect(mocks.activate).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

const request = (query = '', rsc = false) =>
  new NextRequest(`http://localhost:3234/leases/lease-1/result?${query}`, {
    headers: rsc ? { RSC: '1' } : {},
  });
const params = () => ({ params: Promise.resolve({ id: 'lease-1' }) });

describe('authorized lease result route', () => {
  it('authenticates even the internal Flight request', async () => {
    mocks.manager.mockRejectedValueOnce(new Error('sign in'));
    await expect(GET(request('', true), params())).rejects.toThrow('sign in');
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('does not expose a missing or other-organization lease', async () => {
    mocks.find.mockResolvedValueOnce(null);
    await expect(GET(request('scope=unit', true), params())).rejects.toThrow('not found');
    expect(mocks.find.mock.calls[0][0].where).toEqual({ id: 'lease-1', organizationId: 'org-1' });
  });

  it('returns uncached non-Flight content for the authorized internal request', async () => {
    const response = await GET(request('saved=terms&scope=unit', true), params());
    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Vary')).toBe('RSC');
    expect(response.headers.get('Content-Type')).toBeNull();
  });

  it.each([
    ['unit', 'propertyId=property-1&unitId=unit-1&'],
    ['property', 'propertyId=property-1&'],
    ['invalid', ''],
  ])(
    'derives %s scope from the authorized lease and preserves the browser origin',
    async (scope, prefix) => {
      const response = await GET(
        request(
          `scope=${scope}&saved=terms&propertyId=wrong&unitId=wrong&returnTo=https://untrusted.example`,
        ),
        params(),
      );
      expect(response.status).toBe(303);
      expect(response.headers.get('Location')).toBe(
        `/leases/lease-1?${prefix}tab=agreement&saved=terms#edit-terms`,
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    },
  );

  it('does not forward unrecognized feedback or prototype keys', async () => {
    const response = await GET(request('saved=__proto__'), params());
    expect(response.headers.get('Location')).toBe('/leases/lease-1?tab=agreement#lease-agreement');
  });
});

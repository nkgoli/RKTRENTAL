import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { create, save, update } = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/components/maintenance/request-actions', () => ({
  createRequest: create,
  saveRequestDetails: save,
  updateRequest: update,
}));
import { POST } from '@/app/(manager)/maintenance/form/route';
beforeEach(() => {
  vi.clearAllMocks();
});
function request(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return new NextRequest('http://localhost/maintenance/form', { method: 'POST', body: data });
}
it('returns created result and a safe scoped destination', async () => {
  create.mockResolvedValue({ message: 'Repair request created.', requestId: 'r' });
  const response = await POST(
    request({
      unitId: 'u',
      propertyId: 'p',
      scopeUnitId: 'u',
      returnTo: '/properties/p/maintenance?unit=u',
    }),
  );
  expect(await response.json()).toMatchObject({
    requestHref: '/properties/p/maintenance?unit=u#request-r',
  });
  expect(create).toHaveBeenCalledWith(expect.any(FormData), 'p', 'u');
});
it('routes edits through the scoped existing service', async () => {
  save.mockResolvedValue({ message: 'Repair request saved.' });
  const response = await POST(request({ requestId: 'r', propertyId: 'p', scopeUnitId: 'u' }));
  expect(await response.json()).toEqual({ message: 'Repair request saved.' });
  expect(save).toHaveBeenCalledWith(expect.any(FormData), 'r', 'p', 'u');
  expect(create).not.toHaveBeenCalled();
});
it('keeps validation errors in the JSON response', async () => {
  save.mockResolvedValue({ error: 'Request not found in this scope' });
  expect(await (await POST(request({ requestId: 'foreign', propertyId: 'p' }))).json()).toEqual({
    error: 'Request not found in this scope',
  });
});

it('keeps retained actions on the same scoped service', async () => {
  update.mockResolvedValue({ message: 'Vendor assigned.' });
  const response = await POST(
    request({
      requestId: 'r',
      operation: 'assign',
      propertyId: 'p',
      scopeUnitId: 'u',
      vendorId: 'v',
    }),
  );
  expect(await response.json()).toEqual({ message: 'Vendor assigned.' });
  expect(update).toHaveBeenCalledWith('assign', expect.any(FormData), 'p', 'u');
  expect(save).not.toHaveBeenCalled();
});

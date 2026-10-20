import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  db: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({ requireManagerRole: mocks.auth }));
vi.mock('@/lib/properties/data', () => ({ propertiesDb: mocks.db }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { createPropertyAction, savePropertyPageAction } from '@/app/(manager)/properties/actions';
function data() {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    propertyId: 'owned-home',
    name: 'Home',
    type: 'SINGLE_UNIT',
    street: '1 Test',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    changedBasics: '["name"]',
    roiInputs: JSON.stringify({
      version: 1,
      input: {},
      options: {},
      cleared: ['input.purchase.purchasePrice'],
    }),
  }))
    result.set(key, value);
  return result;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ organizationId: 'trusted-org' });
  mocks.db.mockReturnValue({ createProperty: mocks.create, updateProperty: mocks.update });
  mocks.create.mockResolvedValue({ ok: true, id: 'created-home' });
  mocks.update.mockResolvedValue({ ok: true, id: 'owned-home' });
});
it('returns a committed destination after creation so the dedicated form can leave its static route', async () => {
  expect(await createPropertyAction({}, data())).toEqual({
    ok: true,
    destination: '/properties/created-home',
  });
  expect(mocks.db).toHaveBeenCalledWith('trusted-org');
  expect(mocks.revalidate).toHaveBeenCalledWith('/roi-analysis');
});
it('sends only admitted changed basics with explicit clears and returns to the edited property', async () => {
  expect(await savePropertyPageAction({}, data())).toEqual({
    ok: true,
    destination: '/properties/owned-home',
  });
  expect(mocks.update).toHaveBeenCalledWith(
    'owned-home',
    expect.objectContaining({
      roiInputs: expect.objectContaining({ cleared: ['input.purchase.purchasePrice'] }),
    }),
    ['name'],
  );
});
it('retains validation errors without writing or navigating', async () => {
  const invalid = data();
  invalid.set('name', '');
  const result = await savePropertyPageAction({}, invalid);
  expect(result.errors?.name).toBeTruthy();
  expect(result.destination).toBeUndefined();
  expect(mocks.update).not.toHaveBeenCalled();
  invalid.set('name', 'Valid');
  invalid.set('changedBasics', '["organizationId"]');
  expect((await savePropertyPageAction({}, invalid)).ok).not.toBe(true);
  expect(mocks.update).not.toHaveBeenCalled();
});

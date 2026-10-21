import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewReminder, dispatchReminder } from '@/app/(manager)/notifications/actions';
import { PaymentReminders } from '@/lib/notifications/reminders';

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/auth/server-session', () => auth);
const actor = { subjectId: 'manager', organizationId: 'organization', role: 'MANAGER' };
const draft = {
  recipients: [{ tenantId: 'tenant', subject: 'Reviewed subject', body: 'Reviewed body' }],
};
afterEach(() => vi.restoreAllMocks());

describe('reviewed reminder action boundary', () => {
  it('returns an auth error without redirecting away from the draft', async () => {
    auth.getSession.mockResolvedValue(null);
    expect(await previewReminder('lease', 'EMAIL', draft)).toEqual({
      ok: false,
      error: 'AUTH_REQUIRED',
    });
    for (const role of ['TENANT', 'OWNER', 'ADMIN']) {
      auth.getSession.mockResolvedValue({ ...actor, role });
      expect(await dispatchReminder('preview', crypto.randomUUID())).toEqual({
        ok: false,
        error: 'MANAGER_REQUIRED',
      });
    }
  });
  it('passes only reviewed tenant IDs/content to the scoped service, rejecting arbitrary addresses', async () => {
    auth.getSession.mockResolvedValue(actor);
    const spy = vi
      .spyOn(PaymentReminders.prototype, 'preview')
      .mockResolvedValue({ id: 'preview' } as never);
    expect(await previewReminder('lease', 'EMAIL', draft)).toEqual({
      ok: true,
      value: { id: 'preview' },
    });
    expect(spy).toHaveBeenCalledExactlyOnceWith(actor, 'lease', 'EMAIL', draft);
    expect(
      await previewReminder('lease', 'EMAIL', {
        recipients: [{ ...draft.recipients[0], recipient: 'injected@example.invalid' }],
      } as never),
    ).toEqual({ ok: false, error: 'INVALID_REQUEST' });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

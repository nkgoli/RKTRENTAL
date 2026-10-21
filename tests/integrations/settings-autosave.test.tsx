// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AutoSaveSettings } from '@/app/(manager)/integrations/AutoSaveSettings';
import { FeeSwitch } from '@/app/(manager)/integrations/FeeSwitch';
import { ToastProvider } from '@/components/ui';

const save = vi.hoisted(() => vi.fn());
vi.mock('@/app/(manager)/integrations/actions', () => ({ saveSettingsInlineAction: save }));
beforeEach(() => { save.mockReset(); save.mockResolvedValue({ ok: true, message: 'Payment settings updated' }); });
afterEach(cleanup);

it('saves selections and the new switch value immediately with toast feedback', async () => {
  render(<ToastProvider><AutoSaveSettings group="payments" title="Payment settings" description="Provider defaults.">
    <label>Payout schedule<select name="payoutSchedule" defaultValue="monthly"><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></label>
    <FeeSwitch name="passProcessingFees" initial={false} label="Pass processing fees" />
  </AutoSaveSettings></ToastProvider>);
  expect(screen.queryByRole('button', { name: 'Save settings' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Payout schedule'), { target: { value: 'weekly' } });
  await waitFor(() => expect(screen.getByText('Payment settings updated')).toBeTruthy());
  expect(save.mock.calls[0][1].get('payoutSchedule')).toBe('weekly');
  expect(save.mock.calls[0][1].get('group')).toBe('payments');
  fireEvent.click(screen.getByRole('switch', { name: 'Pass processing fees' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][1].get('passProcessingFees')).toBe('true');
});

it('keeps an actionable error visible when the save is rejected', async () => {
  save.mockResolvedValue({ ok: false, message: 'Choose a supported payout schedule.' });
  render(<ToastProvider><AutoSaveSettings group="payments" title="Payment settings" description="Provider defaults.">
    <label>Payout schedule<select name="payoutSchedule" defaultValue="monthly"><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></label>
  </AutoSaveSettings></ToastProvider>);
  fireEvent.change(screen.getByLabelText('Payout schedule'), { target: { value: 'weekly' } });
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Choose a supported payout schedule.'));
  expect((screen.getByLabelText('Payout schedule') as HTMLSelectElement).disabled).toBe(false);
});

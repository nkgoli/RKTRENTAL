// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AutoSaveSettings } from '@/app/(manager)/integrations/AutoSaveSettings';
import { ToastProvider } from '@/components/ui';

const save = vi.hoisted(() => vi.fn());
vi.mock('@/app/(manager)/integrations/actions', () => ({ saveSettingsInlineAction: save }));
afterEach(cleanup);

it('retains rapid settings changes and acknowledges only after queued saves finish', async () => {
  let finishFirst!: (value: unknown) => void;
  let finishSecond!: (value: unknown) => void;
  save
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSecond = resolve;
        }),
    );
  render(
    <ToastProvider>
      <AutoSaveSettings
        group="comps"
        title="Rent comps settings"
        description="Defaults beside reminder setup."
      >
        <label>
          Radius
          <select name="radiusMiles" defaultValue="2">
            <option value="2">2 miles</option>
            <option value="3">3 miles</option>
          </select>
        </label>
        <label>
          Refresh
          <select name="refresh" defaultValue="daily">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      </AutoSaveSettings>
    </ToastProvider>,
  );
  act(() => {
    fireEvent.change(screen.getByLabelText('Radius'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Refresh'), { target: { value: 'weekly' } });
  });
  expect(save.mock.calls[0][1].get('radiusMiles')).toBe('3');
  await act(async () => finishFirst({ ok: true, message: 'Rent comps settings updated' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Rent comps settings updated')).toBeNull();
  expect(save.mock.calls[1][1].get('radiusMiles')).toBe('3');
  expect(save.mock.calls[1][1].get('refresh')).toBe('weekly');
  await act(async () => finishSecond({ ok: true, message: 'Rent comps settings updated' }));
  await screen.findByText('Rent comps settings updated');
  expect((screen.getByLabelText('Radius') as HTMLSelectElement).value).toBe('3');
  expect((screen.getByLabelText('Refresh') as HTMLSelectElement).value).toBe('weekly');
});

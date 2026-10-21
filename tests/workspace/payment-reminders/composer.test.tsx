// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderWorkspace } from '@/components/notifications/ReminderWorkspace';
import type { Channels, LeaseChoice, Preview } from '@/components/notifications/model';

const actions = vi.hoisted(() => ({
  previewReminder: vi.fn(),
  dispatchReminder: vi.fn(),
  reminderHistory: vi.fn(),
  reconcileReminder: vi.fn(),
}));
vi.mock('@/app/(manager)/notifications/actions', () => actions);
const snapshot = {
  asOf: '2026-10-21',
  amountCents: 85000,
  pendingCents: 10000,
  charges: [
    { id: 'rent', kind: 'RENT', dueDate: '2026-09-01', outstandingCents: 80000 },
    { id: 'fee', kind: 'LATE_FEE', dueDate: '2026-10-21', outstandingCents: 5000 },
  ],
  recipients: [
    {
      tenantId: 'tenant',
      recipient: 'synthetic@example.invalid',
      subject: 'Payment reminder',
      body: 'Synthetic original message',
    },
  ],
  excluded: [],
};
const choice: LeaseChoice = {
  id: 'lease',
  label: 'Synthetic Court · Unit 1 · Synthetic Tenant',
  tenants: [{ id: 'tenant', name: 'Synthetic Tenant' }],
  EMAIL: snapshot,
  SMS: { ...snapshot, recipients: [{ ...snapshot.recipients[0], recipient: '+15005550006' }] },
};
const channels: Channels = {
  EMAIL: { mode: 'sandbox', message: 'Sandbox only. No delivery.' },
  SMS: { mode: 'sandbox', message: 'Sandbox only. No delivery.' },
};
const preview: Preview = {
  id: 'preview',
  channel: 'EMAIL',
  createdAt: '2026-10-21T12:00:00Z',
  expiresAt: '2026-10-21T12:10:00Z',
  snapshot,
};
const recorded: Preview = {
  ...preview,
  dispatchedAt: '2026-10-21T12:01:00Z',
  attempts: [
    {
      id: 'attempt',
      recipient: 'synthetic@example.invalid',
      subject: 'Payment reminder',
      body: 'Edited synthetic message',
      status: 'MOCK_RECORDED',
      provider: 'mock',
      createdAt: '2026-10-21T12:01:00Z',
      updatedAt: '2026-10-21T12:01:00Z',
    },
  ],
};
const mount = (choices = [choice], config = channels) =>
  render(<ReminderWorkspace choices={choices} channels={config} storageKey="synthetic-reminder" />);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  actions.reminderHistory.mockResolvedValue({ ok: true, value: [] });
  actions.previewReminder.mockImplementation(async (_lease, channel, draft) => ({
    ok: true,
    value: {
      ...preview,
      channel,
      snapshot: {
        ...snapshot,
        recipients: draft.recipients.map((r: { tenantId: string }) => ({
          ...snapshot.recipients.find((original) => original.tenantId === r.tenantId),
          ...r,
        })),
      },
    },
  }));
  actions.dispatchReminder.mockResolvedValue({ ok: true, value: recorded });
});
afterEach(cleanup);

describe('payment reminder composer (synthetic recipients only)', () => {
  it('requires lease and recipient choices when ambiguous, then previews only the explicit choice', async () => {
    const user = userEvent.setup();
    const co = {
      tenantId: 'cotenant',
      recipient: 'cotenant@example.invalid',
      subject: 'Second',
      body: 'Second message',
    };
    const multi: LeaseChoice = {
      ...choice,
      tenants: [...choice.tenants, { id: co.tenantId, name: 'Synthetic Cotenant' }],
      EMAIL: { ...snapshot, recipients: [...snapshot.recipients, co] },
    };
    mount([multi, { ...choice, id: 'other', label: 'Synthetic Court · Unit 2' }]);
    expect((screen.getByLabelText('Lease') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByRole('button', { name: 'Preview reminder' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Lease'), 'lease');
    expect(
      (screen.getByRole('button', { name: 'Preview reminder' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /Synthetic Cotenant/ }));
    await user.click(screen.getByRole('button', { name: 'Preview reminder' }));
    await screen.findByRole('heading', { name: /Review before/ });
    expect(actions.previewReminder).toHaveBeenCalledWith('lease', 'EMAIL', {
      recipients: [expect.objectContaining({ tenantId: 'cotenant' })],
    });
  });

  it('preserves edits, previews exact content, prevents double send and reloads persistent sandbox history', async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.clear(screen.getByLabelText('Message', { exact: false, selector: 'textarea' }));
    await user.type(
      screen.getByLabelText('Message', { exact: false, selector: 'textarea' }),
      'Edited synthetic message',
    );
    await user.click(screen.getByRole('button', { name: 'Preview reminder' }));
    const heading = await screen.findByRole('heading', { name: /Review before/ });
    expect(document.activeElement).toBe(heading);
    const review = heading.closest('section')!;
    expect(within(review).getByText('Edited synthetic message')).toBeTruthy();
    let finish!: (value: unknown) => void;
    actions.dispatchReminder.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const send = within(review).getByRole('button', { name: /Record sandbox test/ });
    fireEvent.click(send);
    fireEvent.click(send);
    expect(actions.dispatchReminder).toHaveBeenCalledTimes(1);
    finish({ ok: true, value: recorded });
    await screen.findByText(/Sandbox test recorded/);
    expect(screen.getAllByText('Sandbox · not delivered', { selector: 'strong' }).length).toBe(2);
    view.unmount();
    actions.reminderHistory.mockResolvedValue({ ok: true, value: [recorded] });
    mount();
    await screen.findByText('Sandbox record only · no delivery.');
    expect(screen.getByText('synthetic@example.invalid', { selector: 'p' })).toBeTruthy();
    expect(sessionStorage.getItem('synthetic-reminder')).toBeNull();
  });

  it('supports SMS with separate contact selection and marks sandbox action explicitly', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('radio', { name: 'Text message (SMS)' }));
    expect(screen.getByRole('checkbox', { name: /\+15005550006/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Preview reminder' }));
    await screen.findByRole('heading', { name: /Review before/ });
    expect(actions.previewReminder).toHaveBeenCalledWith('lease', 'SMS', expect.anything());
    expect(screen.getByText(/SMS to/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Record sandbox test/ }));
    await screen.findByText(/Sandbox test recorded/);
  });

  it('preserves a failed draft and requires another preview after stale dispatch', async () => {
    const user = userEvent.setup();
    mount();
    actions.previewReminder.mockResolvedValueOnce({ ok: false, error: 'STALE_PREVIEW' });
    await user.clear(screen.getByLabelText('Subject'));
    await user.type(screen.getByLabelText('Subject'), 'Synthetic edited subject');
    await user.click(screen.getByRole('button', { name: 'Preview reminder' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe(
      'Synthetic edited subject',
    );
    await user.click(screen.getByRole('button', { name: 'Preview reminder' }));
    await screen.findByRole('heading', { name: /Review before/ });
    actions.dispatchReminder.mockResolvedValueOnce({ ok: false, error: 'STALE_PREVIEW' });
    await user.click(screen.getByRole('button', { name: /Record sandbox test/ }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /Review before/ })).toBeNull(),
    );
    expect(screen.queryByRole('button', { name: 'Check original send' })).toBeNull();
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe(
      'Synthetic edited subject',
    );
    expect(
      (screen.getByRole('button', { name: 'Preview reminder' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('retains an interrupted operation through reload and checks it with the same key', async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.click(screen.getByRole('button', { name: 'Preview reminder' }));
    await screen.findByRole('heading', { name: /Review before/ });
    actions.dispatchReminder.mockRejectedValueOnce(new Error('synthetic interruption'));
    await user.click(screen.getByRole('button', { name: /Record sandbox test/ }));
    await screen.findByText(/Send response was interrupted/);
    const args = actions.dispatchReminder.mock.calls[0];
    expect(
      (screen.getByRole('button', { name: 'Preview reminder' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    view.unmount();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Check original send' }));
    await screen.findByText(/Sandbox test recorded/);
    expect(actions.dispatchReminder.mock.calls[1]).toEqual(args);
  });

  it('explains opt-outs, invalid contacts and unconfigured channels without enabling submission', async () => {
    mount(
      [
        {
          ...choice,
          SMS: {
            ...snapshot,
            recipients: [],
            excluded: [
              { tenantId: 'tenant', reason: 'OPTED_OUT' },
              { tenantId: 'missing', reason: 'INVALID_CONTACT' },
            ],
          },
        },
      ],
      {
        ...channels,
        SMS: { mode: 'unavailable', message: 'Configure Twilio with your administrator.' },
      },
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Text message (SMS)' }));
    expect(screen.getByText(/opted out · ask/)).toBeTruthy();
    expect(screen.getByText(/missing or invalid contact/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open payment reminder setup' }).getAttribute('href'),
    ).toBe('/integrations#payment-reminders');
    expect(
      (screen.getByRole('button', { name: 'Preview reminder' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(actions.dispatchReminder).not.toHaveBeenCalled();
  });

  it('keeps paid-lease history and distinguishes supported outcomes without offering a reminder', async () => {
    actions.reminderHistory.mockResolvedValue({
      ok: true,
      value: [
        {
          ...recorded,
          attempts: [
            'READY',
            'SENDING',
            'ACCEPTED',
            'DELIVERED',
            'FAILED',
            'UNCERTAIN',
            'CANCELLED',
          ].map((status) => ({
            ...recorded.attempts![0],
            id: status,
            status,
            provider: 'synthetic',
          })),
        },
      ],
    });
    mount([{ ...choice, EMAIL: { ...snapshot, amountCents: 0, charges: [] } }]);
    await screen.findByText('Uncertain · may have been delivered');
    expect(screen.getByRole('heading', { name: 'All caught up' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview reminder' })).toBeNull();
    expect(screen.getByText('Accepted · delivery unconfirmed')).toBeTruthy();
    expect(screen.getByText('Delivered · confirmed by provider')).toBeTruthy();
    expect(screen.getByText('Failed · not delivered')).toBeTruthy();
    expect(screen.getByText('Pending · reserved')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ReminderWorkspace } from '@/components/notifications/ReminderWorkspace';
import type { Channels, LeaseChoice, ReminderSnapshot } from '@/components/notifications/model';

// Opening /notifications from a rent-roll row menu: synthetic choices only; the server actions are
// mocked, so nothing is previewed or sent by rendering.
const actions = vi.hoisted(() => ({
  previewReminder: vi.fn(),
  dispatchReminder: vi.fn(),
  reminderHistory: vi.fn(),
  reconcileReminder: vi.fn(),
}));
vi.mock('@/app/(manager)/notifications/actions', () => actions);

const message = (tenantId: string, recipient: string) => ({
  tenantId,
  recipient,
  subject: 'Payment reminder',
  body: `Synthetic message for ${tenantId}`,
});
const overdue = (recipients: ReminderSnapshot['recipients'], amountCents = 120000) => ({
  asOf: '2026-10-21',
  amountCents,
  pendingCents: 0,
  charges: amountCents
    ? [{ id: 'rent', kind: 'RENT', dueDate: '2026-10-01', outstandingCents: amountCents }]
    : [],
  recipients,
  excluded: [],
});
const shared: LeaseChoice = {
  id: 'lease-shared',
  label: 'Synthetic Court · Unit 1 · Avery, Blair',
  tenants: [
    { id: 'avery', name: 'Synthetic Avery' },
    { id: 'blair', name: 'Synthetic Blair' },
  ],
  EMAIL: overdue([
    message('avery', 'avery@example.invalid'),
    message('blair', 'blair@example.invalid'),
  ]),
  SMS: {
    ...overdue([message('avery', '+15005550006')]),
    excluded: [{ tenantId: 'blair', reason: 'INVALID_CONTACT' }],
  },
};
const coTenantOnly: LeaseChoice = {
  id: 'lease-co-tenant',
  label: 'Synthetic Court · Unit 2 · Casey, Drew',
  tenants: [
    { id: 'casey', name: 'Synthetic Casey' },
    { id: 'drew', name: 'Synthetic Drew' },
  ],
  EMAIL: {
    ...overdue([message('drew', 'drew@example.invalid')]),
    excluded: [{ tenantId: 'casey', reason: 'INVALID_CONTACT' }],
  },
  SMS: overdue([]),
};
const paid: LeaseChoice = {
  id: 'lease-paid',
  label: 'Synthetic Court · Unit 3 · Emery',
  tenants: [{ id: 'emery', name: 'Synthetic Emery' }],
  EMAIL: overdue([message('emery', 'emery@example.invalid')], 0),
  SMS: overdue([], 0),
};
const channels: Channels = {
  EMAIL: { mode: 'sandbox', message: 'Sandbox only. No delivery.' },
  SMS: { mode: 'unavailable', message: 'This channel is unavailable.' },
};
const mount = (leaseId: string, tenantId?: string) =>
  render(
    <ReminderWorkspace
      choices={[shared, coTenantOnly, paid]}
      channels={channels}
      initialLeaseId={leaseId}
      initialTenantId={tenantId}
      fromRentRoll
      storageKey="synthetic-rent-roll-reminder"
    />,
  );
const recipient = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  actions.reminderHistory.mockResolvedValue({ ok: true, value: [] });
});
afterEach(cleanup);

describe('reminder opened from a rent-roll row', () => {
  it('selects the row lease and tenant only, without previewing or sending', async () => {
    mount('lease-shared', 'avery');
    expect(screen.getByRole('combobox', { name: 'Lease' })).toHaveProperty('value', 'lease-shared');
    expect(screen.getByText(/Opened from the rent roll for Synthetic Avery/)).toBeTruthy();
    expect(recipient('Synthetic Avery')).toHaveProperty('checked', true);
    expect(recipient('Synthetic Blair')).toHaveProperty('checked', false);
    await waitFor(() => expect(actions.reminderHistory).toHaveBeenCalledWith('lease-shared'));
    expect(actions.previewReminder).not.toHaveBeenCalled();
    expect(actions.dispatchReminder).not.toHaveBeenCalled();
  });

  it('a different row selects its own tenant', () => {
    mount('lease-shared', 'blair');
    expect(recipient('Synthetic Blair')).toHaveProperty('checked', true);
    expect(recipient('Synthetic Avery')).toHaveProperty('checked', false);
  });

  it('never substitutes a co-tenant when the row tenant has no eligible contact', () => {
    mount('lease-co-tenant', 'casey');
    expect(recipient('Synthetic Drew')).toHaveProperty('checked', false);
    expect(screen.getByText(/Synthetic Casey: missing or invalid contact/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview reminder' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('explains a Late label the current ledger no longer supports', () => {
    mount('lease-paid', 'emery');
    expect(screen.getByRole('heading', { name: 'All caught up' })).toBeTruthy();
    expect(screen.getByText(/may have been paid since the rent roll loaded/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview reminder' })).toBeNull();
  });

  it('reports a lease that is no longer available and selects nothing', () => {
    mount('lease-gone', 'nobody');
    expect(screen.getByRole('alert').textContent).toMatch(/no longer available for reminders/);
    expect(screen.getByRole('combobox', { name: 'Lease' })).toHaveProperty('value', '');
  });
});

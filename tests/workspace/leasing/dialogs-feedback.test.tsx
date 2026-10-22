// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PaymentsBoard,
  type BoardGroup,
} from '@/components/workspace/panels/leasing/PaymentsBoard';
import { PaymentsPanel } from '@/components/workspace/panels/leasing/PaymentsPanel';
import { NewMaintenanceRequestDialog } from '@/components/workspace/panels/operations/NewMaintenanceRequestDialog';
import { ToastProvider } from '@/components/ui/Toast';

const mocks = vi.hoisted(() => ({
  charge: vi.fn(),
  payment: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  usePathname: () => '/properties/property/payments',
}));
vi.mock('@/components/workspace/panels/leasing/actions', () => ({
  createPropertyChargeAction: mocks.charge,
  recordPropertyPaymentAction: mocks.payment,
}));
vi.mock('@/lib/integrations/active', () => ({
  activeIntegration: async () => ({ connection: null }),
}));
vi.mock('@/lib/db/client', () => ({ db: { unit: { count: async () => 0 } } }));
vi.mock('@/lib/ledger', () => ({
  ensureRentCharges: vi.fn(),
  loadPropertyLedger: async () => ({
    groups: [],
    balanceCents: 0,
    lastPayment: null,
    endedBalanceCents: 0,
    activeLeaseCount: 0,
    tenants: [],
  }),
  paymentsProviderLabel: () => 'Not connected',
  summarizeUnits: vi.fn(),
}));
const group: BoardGroup = {
  leaseId: 'lease',
  label: 'Active lease',
  place: 'Unit 4B',
  active: true,
  tenantNames: 'Jamie Doe',
  balanceCents: 0,
  rows: [],
  payments: [],
};
const boardProps = {
  propertyId: 'property',
  unitId: 'unit',
  balanceCents: 0,
  providerLabel: 'Connected',
  providerConnected: true,
  tenants: [],
  groups: [group],
  summary: null,
  openRecord: false,
  today: '2026-10-21',
};
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);

describe('workspace action dialogs', () => {
  it('uses a shared charge dialog footer and submits the existing scope and fields', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...boardProps} />);
    await user.click(screen.getByRole('button', { name: 'Create a charge' }));
    const dialog = screen.getByRole('dialog', { name: 'Create a charge' });
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }).closest('.dialog-foot'),
    ).toBeTruthy();
    await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Pet fee');
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount' }), '150.00');
    await user.click(within(dialog).getByRole('button', { name: 'Create charge' }));
    await waitFor(() => expect(mocks.charge).toHaveBeenCalledOnce());
    const data = mocks.charge.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(data)).toMatchObject({
      propertyId: 'property',
      unitId: 'unit',
      leaseId: 'lease',
      amount: '150.00',
      description: 'Pet fee',
      dueDate: '2026-10-21',
    });
  });
  it('keeps record-payment scope and supports cancelling without submitting', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...boardProps} openRecord />);
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '200.00');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mocks.payment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '250.00');
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledOnce());
    expect(mocks.payment.mock.calls[0][0].get('leaseId')).toBe('lease');
    expect(mocks.payment.mock.calls[0][0].get('unitId')).toBe('unit');
  });
  it.each(['charge-created', 'payment-recorded'])(
    'shows a confirmed %s notice as a toast',
    async (notice) => {
      const { container } = render(
        <ToastProvider>
          {await PaymentsPanel({
            organizationId: 'org',
            scope: { propertyId: 'property', unitId: 'unit' },
            recording: false,
            notice,
          })}
        </ToastProvider>,
      );
      await waitFor(() =>
        expect(container.querySelector('.toast')?.textContent).toContain(
          notice === 'charge-created'
            ? 'Charge created.'
            : 'Payment recorded and applied to the ledger.',
        ),
      );
    },
  );
  it('creates a request in the selected unit and announces successful creation by toast', async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ message: 'Repair request created.', requestId: 'request' });
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <NewMaintenanceRequestDialog
          action={action}
          propertyName="Maple Court"
          units={[{ id: 'unit', number: '4B' }]}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: '+ New request' }));
    const dialog = screen.getByRole('dialog', { name: 'New repair request' });
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Request title' }),
      'Kitchen sink leak',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create request' }));
    await waitFor(() =>
      expect(container.querySelector('.toast')?.textContent).toContain('Repair request created.'),
    );
    expect(action.mock.calls[0][0].get('unitId')).toBe('unit');
    await user.click(within(dialog).getByRole('link', { name: 'Request created' }));
    expect(screen.queryByRole('dialog', { name: 'New repair request' })).toBeNull();
  });
});

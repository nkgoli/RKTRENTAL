// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  payRentAction: vi.fn(),
  addPaymentMethodAction: vi.fn(),
  setAutopayAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/app/(tenant)/pay/actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
import { AddPaymentMethods, PayForm } from '@/app/(tenant)/pay/PayForm';
import { AutopayToggle } from '@/app/(tenant)/pay/AutopayToggle';
import { PaymentNotice } from '@/app/(tenant)/pay/PaymentNotice';
import { ToastProvider } from '@/components/ui/Toast';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const renderPay = () =>
  render(<PayForm leaseId="isolated-demo-lease" totalDueCents={185000} passFees methods={[]} />);

describe('payment review and validation', () => {
  it('shows one payment-method entry point until its chooser is opened', async () => {
    render(<AddPaymentMethods />);
    expect(screen.queryByRole('button', { name: 'Add bank account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add card' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add a payment method' }));
    const chooser = screen.getByRole('dialog', { name: 'Add a payment method' });
    expect(within(chooser).getByRole('button', { name: 'Add bank account' })).toBeTruthy();
    expect(within(chooser).getByRole('button', { name: 'Add card' })).toBeTruthy();
  });

  it('announces successful payment through the shared toast without hiding receipt feedback', () => {
    render(
      <ToastProvider>
        <PaymentNotice
          tone="success"
          code="pending"
          text="Bank payment started."
          toastText="Payment of $500 submitted"
        />
      </ToastProvider>,
    );
    expect(screen.getByText('Payment of $500 submitted')).toBeTruthy();
    expect(screen.getByText('Bank payment started.')).toBeTruthy();
  });

  it('directs server amount errors to Amount and other failures to their alert', () => {
    const { rerender } = render(
      <>
        <input name="amount" aria-label="Amount" />
        <PaymentNotice tone="error" code="invalid-amount" text="Invalid amount" />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Amount' }));
    rerender(<PaymentNotice tone="error" code="payment-failed" text="Nothing was charged." />);
    expect(document.activeElement?.textContent).toBe('Nothing was charged.');
    expect(screen.getByRole('alert').textContent).toBe('Nothing was charged.');
  });

  it('locks native submission synchronously and restores review after browser Back', async () => {
    const user = userEvent.setup();
    renderPay();
    await user.click(screen.getByRole('button', { name: 'Pay $1,850' }));
    const confirm = within(screen.getByRole('dialog', { name: 'Confirm payment' })).getByRole(
      'button',
      { name: 'Pay $1,850' },
    );
    const form = confirm.closest('form')!;
    const first = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: confirm,
    });
    fireEvent(form, first);
    expect(first.defaultPrevented).toBe(false);
    const submitting = screen.getByRole('button', { name: /^Submitting payment/ });
    expect((submitting as HTMLButtonElement).disabled).toBe(true);
    expect(submitting.getAttribute('aria-busy')).toBe('true');
    const duplicate = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: submitting,
    });
    fireEvent(form, duplicate);
    expect(duplicate.defaultPrevented).toBe(true);
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
    expect(screen.getByRole('button', { name: 'Pay $1,850' })).toBeTruthy();
    expect(form.getAttribute('aria-busy')).toBe('false');
  });

  it('focuses invalid Amount on attempted submission and never submits', () => {
    renderPay();
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.submit(amount.closest('form')!);
    expect(document.activeElement).toBe(amount);
    expect(actions.payRentAction).not.toHaveBeenCalled();
  });

  it('keeps partial rent and provider total distinct with fees disabled', async () => {
    render(<PayForm leaseId="fixture" totalDueCents={97325} passFees={false} methods={[]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /^Card/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), {
      target: { value: '200.25' },
    });
    await user.click(screen.getByRole('button', { name: 'Pay $200.25' }));
    const review = screen.getByRole('dialog', { name: 'Confirm payment' });
    expect(review.textContent).toContain('Total charged$200.25');
    expect(review.textContent).not.toContain('Card fee');
  });

  it('Enter in Amount opens review focused on Cancel and never pays; Cancel restores the Pay trigger', async () => {
    const user = userEvent.setup();
    renderPay();
    await user.click(screen.getByRole('textbox', { name: 'Amount' }));
    await user.keyboard('{Enter}');
    const review = screen.getByRole('dialog', { name: 'Confirm payment' });
    expect(document.activeElement).toBe(within(review).getByRole('button', { name: 'Cancel' }));
    expect(review.textContent).toContain('bank transfer (ACH)');
    expect(actions.payRentAction).not.toHaveBeenCalled();
    await user.click(within(review).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pay $1,850' })),
    );
  });

  it('rejects invalid amounts and reviews the updated card fee after dismissal and method change', async () => {
    const user = userEvent.setup();
    renderPay();
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    for (const value of ['0', '1850.01', '1.234', 'bad']) {
      fireEvent.change(amount, { target: { value } });
      expect(amount.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('alert').textContent).toContain('two decimal places');
      expect((screen.getByRole('button', { name: /^Pay \$/ }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    }
    fireEvent.change(amount, { target: { value: '1000.00' } });
    await user.click(screen.getByRole('button', { name: 'Pay $1,000' }));
    fireEvent(
      screen.getByRole('dialog', { name: 'Confirm payment' }),
      new Event('cancel', { cancelable: true }),
    );
    await user.click(screen.getByRole('radio', { name: /^Card/ }));
    expect(screen.queryByRole('dialog', { name: 'Confirm payment' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Pay $1,029' }));
    expect(screen.getByRole('dialog', { name: 'Confirm payment' }).textContent).toContain(
      'Card fee (2.9%)$29',
    );
    expect(actions.payRentAction).not.toHaveBeenCalled();
  });

  it('allows a native POST only after explicit confirmation with the original payment fields', async () => {
    renderPay();
    const form = screen.getByRole('textbox', { name: 'Amount' }).closest('form')!;
    const implicit = new SubmitEvent('submit', { bubbles: true, cancelable: true });
    fireEvent(form, implicit);
    expect(implicit.defaultPrevented).toBe(true);
    const confirm = within(screen.getByRole('dialog', { name: 'Confirm payment' })).getByRole(
      'button',
      { name: 'Pay $1,850' },
    );
    const explicit = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: confirm,
    });
    fireEvent(form, explicit);
    expect(explicit.defaultPrevented).toBe(false);
    expect(form.getAttribute('action')).toBe('/pay/submit');
    expect(form.getAttribute('method')).toBe('post');
    const submitted = new FormData(form);
    expect(submitted.get('leaseId')).toBe('isolated-demo-lease');
    expect(submitted.get('amount')).toBe('1850.00');
    expect(submitted.get('confirmPayment')).toBe('yes');
    expect(actions.payRentAction).not.toHaveBeenCalled();
  });
});

describe('autopay feedback', () => {
  const props = {
    leaseId: 'isolated-demo-lease',
    enabled: false,
    monthlyRentCents: 185000,
    rentDueDay: 1,
  };
  it('explains whether the selected method is saved and updates its label when selection changes', async () => {
    render(
      <PayForm
        leaseId="isolated-demo-lease"
        totalDueCents={185000}
        passFees
        methods={[
          { id: 'bank', type: 'ach', label: 'Bank ••••6789', last4: '6789', provider: 'mock' },
        ]}
        autopay={{ ...props, paymentMethodId: null }}
      />,
    );
    expect(screen.getByText(/Turn on autopay with Bank ••••6789/)).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /^Card/ }));
    expect(screen.getByText(/Mock card ••••4242 is selected for this payment/)).toBeTruthy();
  });
  it('explains the missing method without submitting', async () => {
    render(<AutopayToggle {...props} paymentMethodId={null} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Autopay' }));
    expect(screen.getByRole('alert').textContent).toContain('Add a payment method');
    expect(actions.setAutopayAction).not.toHaveBeenCalled();
  });
  it('blocks duplicate toggles while saving and restores state on failure', async () => {
    let finish!: (value: { ok: boolean; error: string }) => void;
    actions.setAutopayAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<AutopayToggle {...props} paymentMethodId="demo-bank" />);
    const toggle = screen.getByRole('switch', { name: 'Autopay' });
    await userEvent.click(toggle);
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(toggle);
    expect(actions.setAutopayAction).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: false, error: 'Please try again.' }));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('alert').textContent).toBe('Please try again.');
  });
});

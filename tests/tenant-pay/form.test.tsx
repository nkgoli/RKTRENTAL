// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  payRentAction: vi.fn(),
  addPaymentMethodAction: vi.fn(),
  setAutopayAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/app/(tenant)/pay/actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
import { PayForm } from '@/app/(tenant)/pay/PayForm';
import { AutopayToggle } from '@/app/(tenant)/pay/AutopayToggle';
import { PaymentNotice } from '@/app/(tenant)/pay/PaymentNotice';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const renderPay = () =>
  render(<PayForm leaseId="isolated-demo-lease" totalDueCents={185000} passFees methods={[]} />);

describe('payment review and validation', () => {
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

  it('disables confirmation while the mocked provider action is pending', async () => {
    let finish!: () => void;
    actions.payRentAction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPay();
    await user.click(screen.getByRole('button', { name: 'Pay $1,850' }));
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
    const submitting = screen.getByRole('button', { name: 'Submitting payment…' });
    expect((submitting as HTMLButtonElement).disabled).toBe(true);
    expect(submitting.getAttribute('aria-busy')).toBe('true');
    await user.click(submitting);
    expect(actions.payRentAction).toHaveBeenCalledTimes(1);
    await act(async () => finish());
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
    const review = screen.getByRole('group', { name: 'Confirm payment' });
    expect(review.textContent).toContain('Total charged$200.25');
    expect(review.textContent).not.toContain('Card fee');
  });

  it('Enter in Amount opens review and never pays; Back restores focus', async () => {
    const user = userEvent.setup();
    renderPay();
    await user.click(screen.getByRole('textbox', { name: 'Amount' }));
    await user.keyboard('{Enter}');
    const review = screen.getByRole('group', { name: 'Confirm payment' });
    expect(document.activeElement).toBe(review);
    expect(actions.payRentAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pay $1,850' })),
    );
  });

  it('rejects invalid and excessive amounts and resets confirmation on method changes', async () => {
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
    await user.click(screen.getByRole('radio', { name: /^Card/ }));
    expect(screen.queryByRole('group', { name: 'Confirm payment' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Pay $1,029' }));
    expect(screen.getByRole('group', { name: 'Confirm payment' }).textContent).toContain(
      '$29 card fee',
    );
    expect(actions.payRentAction).not.toHaveBeenCalled();
  });

  it('only calls the mocked payment action after explicit confirmation', async () => {
    const user = userEvent.setup();
    renderPay();
    const form = screen.getByRole('textbox', { name: 'Amount' }).closest('form')!;
    fireEvent.submit(form);
    expect(actions.payRentAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
    await waitFor(() => expect(actions.payRentAction).toHaveBeenCalledTimes(1));
    const submitted = actions.payRentAction.mock.calls[0][0] as FormData;
    expect(submitted.get('leaseId')).toBe('isolated-demo-lease');
    expect(submitted.get('amount')).toBe('1850.00');
  });
});

describe('autopay feedback', () => {
  const props = {
    leaseId: 'isolated-demo-lease',
    enabled: false,
    monthlyRentCents: 185000,
    rentDueDay: 1,
  };
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

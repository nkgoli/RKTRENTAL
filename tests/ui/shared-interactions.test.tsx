// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, Input, Select, Textarea } from '@/components/ui/Forms';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { ToastProvider, useToast } from '@/components/ui/Toast';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/home',
}));

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
  vi.useRealTimers();
});

describe('shared field guidance', () => {
  it.each([
    <Input key="input" />,
    <Textarea key="textarea" />,
    <Select key="select">
      <option>Checking account</option>
    </Select>,
    <input key="native" />,
  ])('keeps the label separate from linked hint and validation feedback', (control) => {
    render(
      <Field label="Account" hint="Use the account on your lease." error="Choose an account.">
        {control}
      </Field>,
    );
    const field = screen.getByLabelText('Account');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const descriptions = field.getAttribute('aria-describedby')!.split(' ');
    expect(descriptions.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Use the account on your lease.',
      'Choose an account.',
    ]);
  });

  it('preserves caller-provided descriptions and accessible names', () => {
    render(
      <>
        <span id="currency">US dollars</span>
        <Field label="Amount" hint="Up to your balance.">
          <Input aria-label="Payment amount" aria-describedby="currency" />
        </Field>
      </>,
    );
    const control = screen.getByRole('textbox', { name: 'Payment amount' });
    expect(control.getAttribute('aria-describedby')?.split(' ')[0]).toBe('currency');
  });
});

describe('shared dialog focus and form ownership', () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Edit request</button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Edit request">
          <label>
            Title
            <input />
          </label>
        </Dialog>
      </>
    );
  }

  it('focuses the first field and returns focus to the opener after Escape', async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Edit request' });
    await user.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('uses unique forms for repeated confirmation titles and focuses Cancel', () => {
    const action = vi.fn();
    render(
      <>
        <ConfirmDialog
          open={false}
          onClose={() => {}}
          title="Remove photo?"
          confirmLabel="Remove"
          action={action}
          fields={{ id: 'first' }}
        />
        <ConfirmDialog
          open
          onClose={() => {}}
          title="Remove photo?"
          confirmLabel="Remove"
          action={action}
          fields={{ id: 'second' }}
        />
      </>,
    );
    const dialog = screen.getByRole('dialog');
    const button = within(dialog).getByRole('button', { name: 'Remove' }) as HTMLButtonElement;
    expect(button.form?.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe('second');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(new Set(Array.from(document.querySelectorAll('form'), (form) => form.id)).size).toBe(2);
  });

  it('wraps Tab and Shift+Tab across visible enabled controls without visiting the document', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Outside before</button>
        <Dialog
          open
          onClose={() => {}}
          title="Confirm payment"
          footer={
            <>
              <button data-autofocus>Cancel</button>
              <button>Pay</button>
              <button disabled>Disabled</button>
              <fieldset disabled>
                <button>Disabled by fieldset</button>
              </fieldset>
              <div hidden>
                <button>Hidden ancestor</button>
              </div>
              <button style={{ display: 'none' }}>Display none</button>
              <div style={{ display: 'none' }}>
                <button>Hidden by CSS ancestor</button>
              </div>
              <button style={{ visibility: 'hidden' }}>Invisible</button>
              <button tabIndex={-1}>Programmatic focus only</button>
              <input type="hidden" />
              <div inert>
                <button>Inert</button>
              </div>
            </>
          }
        />
        <button>Outside after</button>
      </>,
    );
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const pay = within(dialog).getByRole('button', { name: 'Pay' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.tab();
    expect(document.activeElement).toBe(pay);
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(pay);
  });
});

function ToastExample() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success('Payment saved.', { label: 'View', href: '/pay' })}>
        Save
      </button>
      <button onClick={() => toast.error('Payment failed.')}>Fail</button>
    </>
  );
}

describe('toast interaction time', () => {
  it('pauses expiry while an action has keyboard focus, then resumes remaining time', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastExample />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => vi.advanceTimersByTime(2000));
    act(() => screen.getByRole('link', { name: 'View' }).focus());
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole('status').textContent).toContain('Payment saved.');
    act(() => screen.getByRole('button', { name: 'Save' }).focus());
    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('pauses while hovered and keeps errors until they are explicitly dismissed', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastExample />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.mouseEnter(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByRole('status'));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    act(() => vi.advanceTimersByTime(60000));
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmButton, RowMenu } from '@/components/ui';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(cleanup);

function Rows({ action = vi.fn() }: { action?: (data: FormData) => void }) {
  return (
    <table>
      <tbody>
        {['Chloe Fisher', 'Lily Dixon'].map((name, i) => (
          <tr key={name} className="row-link">
            <td>
              <button type="button">Record payment {name}</button>
              <RowMenu label={`Actions for ${name}`}>
                <a href={`/leases/${i}`}>Open ledger</a>
                <ConfirmButton
                  label="Add late fee"
                  title={`Add late fee for ${name}?`}
                  confirmLabel="Add late fee"
                  action={action}
                  fields={{ leaseId: `lease-${i}` }}
                />
              </RowMenu>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const trigger = (name: string) => screen.getByRole('button', { name: `Actions for ${name}` });
const panel = (name: string) =>
  document.getElementById(trigger(name).getAttribute('aria-controls')!) as HTMLElement;

describe('RowMenu', () => {
  it('opens the controlled panel, keeps native roles and toggles aria-expanded', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    expect(trigger('Chloe Fisher').getAttribute('aria-expanded')).toBe('false');
    expect(panel('Chloe Fisher').hidden).toBe(true);
    await user.click(trigger('Chloe Fisher'));
    expect(trigger('Chloe Fisher').getAttribute('aria-expanded')).toBe('true');
    const group = panel('Chloe Fisher');
    expect(group.hidden).toBe(false);
    expect(document.activeElement).toBe(trigger('Chloe Fisher'));
    expect(within(group).getByRole('link', { name: 'Open ledger' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Add late fee' })).toBeTruthy();
    await user.click(trigger('Chloe Fisher'));
    expect(panel('Chloe Fisher').hidden).toBe(true);
  });

  it('keeps only one menu open and closes on an outside click', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    await user.click(trigger('Chloe Fisher'));
    await user.click(trigger('Lily Dixon'));
    expect(panel('Chloe Fisher').hidden).toBe(true);
    expect(panel('Lily Dixon').hidden).toBe(false);
    await user.click(document.body);
    expect(panel('Lily Dixon').hidden).toBe(true);
  });

  it('supports arrow keys, Home/End, Escape focus restore and Tab away', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    trigger('Chloe Fisher').focus();
    await user.keyboard('{ArrowDown}');
    const group = panel('Chloe Fisher');
    const ledger = within(group).getByRole('link', { name: 'Open ledger' });
    const fee = within(group).getByRole('button', { name: 'Add late fee' });
    expect(group.hidden).toBe(false);
    expect(document.activeElement).toBe(ledger);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(fee);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(ledger);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(fee);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(ledger);
    await user.keyboard('{Escape}');
    expect(group.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger('Chloe Fisher'));

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(fee);
    await user.tab();
    expect(group.hidden).toBe(true);
    expect(document.activeElement?.textContent).toBe('Record payment Lily Dixon');
  });

  it('keeps the menu behind a cancelled dialog, then closes it after confirming', async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<Rows action={action} />);
    await user.click(trigger('Lily Dixon'));
    const group = panel('Lily Dixon');
    const fee = within(group).getByRole('button', { name: 'Add late fee' });
    await user.click(fee);
    const dialog = screen.getByRole<HTMLDialogElement>('dialog', {
      name: 'Add late fee for Lily Dixon?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(group.hidden).toBe(false);
    expect(document.activeElement).toBe(fee);

    await user.click(fee);
    fireEvent.pointerDown(dialog);
    expect(group.hidden).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Add late fee' }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect((action.mock.calls[0][0] as FormData).get('leaseId')).toBe('lease-1');
    // The action finished: the dialog closes and the menu follows, focus back on the trigger.
    await act(async () => dialog.close());
    expect(group.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger('Lily Dixon'));
  });

  it('closes after following a link', async () => {
    const user = userEvent.setup();
    render(<Rows />);
    await user.click(trigger('Chloe Fisher'));
    const link = within(panel('Chloe Fisher')).getByRole('link', { name: 'Open ledger' });
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
    expect(panel('Chloe Fisher').hidden).toBe(true);
  });
});

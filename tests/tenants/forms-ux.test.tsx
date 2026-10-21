// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddTenantForm, MoveOutDialog } from '@/app/(manager)/tenants/TenantForms';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

afterEach(cleanup);
const properties = [
  { id: 'maple', name: 'Maple Court', units: [{ id: '4b', number: '4B' }] },
  { id: 'elm', name: 'Elm Street', units: [] },
];

describe('tenant form feedback', () => {
  it('requires confirmation before recording a move-out and explains today semantics', async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    render(
      <MoveOutDialog
        tenantName="Jamie Doe"
        unitLabel="Maple Court · Unit 4B"
        leaseId="lease"
        returnTo="/tenants"
        action={action}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Record move-out' }));
    expect(screen.getByRole('dialog', { name: 'Move Jamie Doe out?' })).toBeTruthy();
    expect(screen.getByText(/ends the active lease today for everyone/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(action).not.toHaveBeenCalled();
  });
  it('starts in the selected property and clears the unit when property changes', async () => {
    const user = userEvent.setup();
    render(<AddTenantForm properties={properties} initialPropertyId="maple" action={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Add tenant' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Full name' }));
    const unit = screen.getByRole('combobox', { name: 'Unit' }) as HTMLSelectElement;
    await user.selectOptions(unit, '4b');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Property' }), 'elm');
    expect((screen.getByRole('combobox', { name: 'Unit' }) as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('combobox', { name: 'Unit' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('No vacant units available')).toBeTruthy();
  });
  it('focuses the first rejected field and associates its returned error', async () => {
    const user = userEvent.setup();
    render(
      <AddTenantForm
        properties={properties}
        action={async () => ({
          errors: { email: 'Enter a valid email.' },
          values: { name: 'Demo Tenant', email: 'invalid' },
        })}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Full name' }), 'Demo Tenant');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'invalid');
    await user.click(screen.getByRole('button', { name: 'Save tenant' }));
    const email = screen.getByRole('textbox', { name: /Email/ });
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(email.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter a valid email.',
    );
  });
});

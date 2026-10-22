// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditTenantForm, MoveOutDialog } from '@/app/(manager)/tenants/TenantForms';
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
  it('keeps profile editing: prefills values and focuses the first rejected field', async () => {
    const user = userEvent.setup();
    render(
      <EditTenantForm
        tenant={{
          name: 'Demo Tenant',
          email: 'demo.tenant@example.test',
          phone: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          emergencyContactRelationship: null,
        }}
        cancelHref="/tenants/demo"
        action={async () => ({
          errors: { email: 'Enter a valid email.' },
          values: { name: 'Demo Tenant', email: 'invalid' },
        })}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveProperty(
      'value',
      'Demo Tenant',
    );
    const email = screen.getByRole('textbox', { name: 'Email' });
    await user.clear(email);
    await user.type(email, 'invalid');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /Email/ })),
    );
    const rejected = screen.getByRole('textbox', { name: /Email/ });
    expect(rejected.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(rejected.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter a valid email.',
    );
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/tenants/demo');
  });
  it('no longer offers a standalone add-tenant form', async () => {
    const forms = await import('@/app/(manager)/tenants/TenantForms');
    const actions = await import('@/app/(manager)/tenants/actions');
    expect('AddTenantForm' in forms).toBe(false);
    expect('addTenantAction' in actions).toBe(false);
  });
});

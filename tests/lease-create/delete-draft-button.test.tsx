// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteDraftLeaseAction = vi.fn();
vi.mock('@/app/(manager)/leases/actions', () => ({ deleteDraftLeaseAction }));

const { DeleteDraftButton } = await import('@/components/lease-create/DeleteDraftButton');

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
  vi.unstubAllGlobals();
  deleteDraftLeaseAction.mockReset();
});

const renderButton = (props: Partial<Parameters<typeof DeleteDraftButton>[0]> = {}) =>
  render(
    <DeleteDraftButton
      leaseId="lease-synthetic"
      placeLabel="Synthetic Court · Unit 2"
      tenantName="Synthetic Tenant"
      {...props}
    />,
  );

describe('Delete draft confirmation', () => {
  it('names the draft, focuses Cancel first and closes on Cancel without deleting', async () => {
    const user = userEvent.setup();
    renderButton({ renewal: true, fileCount: 2 });
    const trigger = screen.getByRole('button', {
      name: 'Delete draft lease for Synthetic Court · Unit 2',
    });
    expect(trigger).toHaveProperty('textContent', 'Delete draft');
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Delete draft lease for Synthetic Court · Unit 2?');
    expect(dialog.textContent).toContain('for Synthetic Tenant');
    expect(dialog.textContent).toContain('and 2 uploaded files');
    expect(dialog.textContent).toContain('The lease it renews stays active and unchanged.');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.keyboard('{Enter}');
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(deleteDraftLeaseAction).not.toHaveBeenCalled();
  });

  it('keeps a server refusal in the dialog and clears it after Cancel', async () => {
    deleteDraftLeaseAction.mockResolvedValue({
      message: 'This draft has been sent for signature, so its agreement history is kept.',
    });
    const user = userEvent.setup();
    renderButton({ returnTo: 'unit' });
    await user.click(screen.getByRole('button', { name: /Delete draft lease/ }));
    await user.click(screen.getByRole('button', { name: 'Delete draft' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('agreement history is kept');
    const form = deleteDraftLeaseAction.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(form)).toEqual({ leaseId: 'lease-synthetic', returnTo: 'unit' });
    expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: /Delete draft lease/ }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('locks the dialog in a pending state while the confirmed delete redirects', async () => {
    // Success redirects on the server, so the action never resolves on this page.
    deleteDraftLeaseAction.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderButton({ text: 'Delete' });
    await user.click(screen.getByRole('button', { name: /Delete draft lease/ }));
    await user.click(screen.getByRole('button', { name: 'Delete draft' }));
    const pending = await screen.findByRole('button', { name: 'Deleting…' });
    expect(pending).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

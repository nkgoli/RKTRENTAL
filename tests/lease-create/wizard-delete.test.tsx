// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyDraft } from '@/lib/lease-create/types';
import { withResolvedEnd } from '@/lib/lease-create/validation';
import { STANDARD_FEES, STANDARD_ITEMS } from '@/lib/lease-create/templates';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  send: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/app/(manager)/leases/new/actions', () => ({
  saveWizardStepAction: mocks.save,
  sendWizardLeaseAction: mocks.send,
}));
vi.mock('@/app/(manager)/leases/actions', () => ({ deleteDraftLeaseAction: mocks.deleteDraft }));
vi.mock('@/components/upload', () => ({ FileUploader: () => <div>Upload files</div> }));

import { LeaseBuilder, type LeaseBuilderProps } from '@/components/lease-builder/LeaseBuilder';

const template = {
  id: 'template-synthetic',
  name: 'Synthetic template',
  version: 1,
  items: STANDARD_ITEMS,
  defaultFees: STANDARD_FEES,
};
const props = (overrides: Partial<LeaseBuilderProps> = {}): LeaseBuilderProps => ({
  placeLabel: 'Synthetic Court · Unit 2',
  tenants: [{ id: 'tenant-synthetic', name: 'Synthetic Tenant', email: 'tenant@example.test' }],
  leaseId: 'draft-synthetic',
  renewId: null,
  draft: withResolvedEnd(
    emptyDraft({
      unitId: 'unit-synthetic',
      startDate: '2035-01-01',
      monthlyRent: '1600',
      deposit: '1600',
      tenantIds: ['tenant-synthetic'],
      primaryTenantId: 'tenant-synthetic',
      template,
    }),
  ),
  templates: [template],
  step: 0,
  furthestStep: 2,
  attachments: [{ id: 'doc-synthetic', name: 'Addendum.pdf', sizeBytes: 1000, kind: 'ADDENDUM' }],
  backHref: '/properties/property-synthetic/leases',
  exitHref: '/leases?tab=drafts',
  ...overrides,
});

const trigger = () =>
  screen.getByRole('button', { name: 'Delete draft lease for Synthetic Court · Unit 2' });

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  mocks.save.mockResolvedValue({ ok: true, leaseId: 'draft-synthetic', furthestStep: 2 });
});
afterEach(cleanup);

describe('Delete draft in the resumed lease wizard', () => {
  it('is offered only once the draft is persisted', async () => {
    const user = userEvent.setup();
    render(<LeaseBuilder {...props({ leaseId: null, furthestStep: 0 })} />);
    expect(screen.queryByRole('button', { name: /Delete draft lease/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // The first save created the draft; it can now be deleted from here.
    await waitFor(() => expect(trigger()).toBeTruthy());
  });

  it('names the place, tenant, files and kept renewal source, and Cancel keeps unsaved edits', async () => {
    const user = userEvent.setup();
    render(<LeaseBuilder {...props({ renewId: 'lease-source' })} />);
    const start = screen.getByLabelText(/^Start date/) as HTMLInputElement;
    fireEvent.input(start, { target: { value: '2035-04-01' } });
    expect(screen.getByRole('status').textContent).toBe('Unsaved changes');

    await user.click(trigger());
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Delete draft lease for Synthetic Court · Unit 2?');
    expect(dialog.textContent).toContain('for Synthetic Tenant');
    expect(dialog.textContent).toContain('and 1 uploaded file.');
    expect(dialog.textContent).toContain('The lease it renews stays active and unchanged.');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.keyboard('{Enter}');

    expect(dialog.hasAttribute('open')).toBe(false);
    expect(mocks.deleteDraft).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/^Start date/) as HTMLInputElement).value).toBe('2035-04-01');
    expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
    expect(screen.getByRole('heading', { name: 'Lease term' })).toBeTruthy();
  });

  it('cannot be opened while a save is still running', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.save.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<LeaseBuilder {...props()} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(trigger()).toHaveProperty('disabled', true));
    finish({ ok: true, leaseId: 'draft-synthetic', furthestStep: 2 });
    await waitFor(() => expect(trigger()).toHaveProperty('disabled', false));
  });

  it('holds every wizard write while a confirmed delete redirects', async () => {
    // Success redirects on the server, so the action does not settle while the page is up. It is
    // settled at the end only because React entangles pending actions across later tests.
    let settle: (value: unknown) => void = () => {};
    mocks.deleteDraft.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const user = userEvent.setup();
    render(<LeaseBuilder {...props()} />);
    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Delete draft' }));
    expect(Object.fromEntries(mocks.deleteDraft.mock.calls[0][1] as FormData)).toEqual({
      leaseId: 'draft-synthetic',
      returnTo: 'leases',
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Deleting draft…'));
    expect(screen.getByRole('button', { name: 'Save and exit' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Rent, deposit/ })).toHaveProperty('disabled', true);
    // Forcing a click on the disabled controls still writes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    settle({});
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Draft saved'));
  });

  it('keeps a server refusal in the dialog and leaves the wizard usable', async () => {
    mocks.deleteDraft.mockResolvedValue({
      message: 'This draft has been sent for signature, so its agreement history is kept.',
    });
    const user = userEvent.setup();
    render(<LeaseBuilder {...props()} />);
    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Delete draft' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('agreement history is kept');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('status').textContent).toBe('Draft saved');
    expect(screen.getByRole('button', { name: 'Save and exit' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaseDocumentGrid } from '@/app/(manager)/leases/[id]/LeaseDocumentGrid';
import { ToastProvider } from '@/components/ui/Toast';

const document = {
  id: 'file-1',
  name: 'Original.pdf',
  kind: 'lease',
  uploaded: 'Oct 19, 2026',
  mimeType: 'application/pdf',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

describe('confirmed lease document feedback', () => {
  it('retains a failed rename for retry and renders the server-confirmed name', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({ ok: true, name: 'Confirmed.pdf', message: 'Document renamed.' }),
      );
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<LeaseDocumentGrid leaseId="lease-1" documents={[document]} />);
    await user.click(screen.getByText('More actions'));
    await user.click(screen.getByText('Rename', { exact: true }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Proposed.pdf');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Please try again.');
    expect((input as HTMLInputElement).value).toBe('Proposed.pdf');
    expect(screen.getByText('Original.pdf', { selector: 'strong' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() =>
      expect(screen.getByText('Confirmed.pdf', { selector: 'strong' })).toBeTruthy(),
    );
    expect(screen.getByRole('status').textContent).toBe('Document renamed.');
    expect(fetch.mock.calls[1][0]).toBe('/leases/lease-1/documents/rename');
  });

  it('keeps a failed delete visible and removes it only after server confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );
    const user = userEvent.setup();
    render(<LeaseDocumentGrid leaseId="lease-1" documents={[document]} />);
    await user.click(screen.getByText('More actions'));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(screen.getByRole('dialog', { name: 'Delete Original.pdf?' })).toBeTruthy();
    expect(globalThis.document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Please try again.');
    expect(screen.getByRole('article')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Original.pdf deleted.');
  });
  it('announces deletion by toast only after the server confirms removal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <LeaseDocumentGrid leaseId="lease-1" documents={[document]} />
      </ToastProvider>,
    );
    await user.click(screen.getByText('More actions'));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(fetch).not.toHaveBeenCalled();
    expect(container.querySelector('.toast')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() =>
      expect(container.querySelector('.toast')?.textContent).toContain('Original.pdf deleted.'),
    );
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaseDocumentGrid } from '@/app/(manager)/leases/[id]/LeaseDocumentGrid';

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
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Please try again.');
    expect(screen.getByRole('article')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Original.pdf deleted.');
  });
});

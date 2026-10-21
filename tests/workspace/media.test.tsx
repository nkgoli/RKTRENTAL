// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropertyDetail } from '@/lib/properties/data';
import { WorkspaceMedia } from '@/components/workspace/WorkspaceMedia';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const photos = [{
  id: 'exterior', name: 'exterior.png', kind: 'PHOTO', mimeType: 'image/png',
  sizeBytes: 20, createdAt: new Date(), isCover: true, caption: 'Exterior',
}, {
  id: 'missing', name: 'missing.png', kind: 'PHOTO', mimeType: 'image/png',
  sizeBytes: 20, createdAt: new Date(), isCover: false, caption: null,
}] as PropertyDetail['photos'];

describe('Overview media card', () => {
  it('shows a compact photo grid, cover badge, document heading and one photo counter', () => {
    render(<WorkspaceMedia target={{ kind: 'property', id: 'elm' }} photos={photos} files={[]} />);
    expect(screen.getByLabelText('Property photos')).toBeTruthy();
    expect(screen.getByText('Cover')).toBeTruthy();
    expect(screen.getByText('Property documents')).toBeTruthy();
    expect(screen.getAllByText('2 of 20 photos')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Set missing.png as cover' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove missing.png' })).toBeTruthy();
    expect(screen.queryByText('Move down')).toBeNull();
  });

  it('replaces a broken thumbnail with a labeled placeholder', () => {
    render(<WorkspaceMedia target={{ kind: 'unit', id: '4b' }} photos={photos} files={[]} />);
    expect(screen.getByText('Unit documents')).toBeTruthy();
    fireEvent.error(screen.getByAltText('missing.png'));
    expect(screen.getByRole('img', { name: 'Preview unavailable for missing.png' })).toBeTruthy();
  });
  it('does not remove a photo until its named confirmation is accepted', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', request);
    render(<WorkspaceMedia target={{ kind: 'property', id: 'elm' }} photos={photos} files={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove missing.png' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove missing.png?' });
    expect(request).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove photo' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/files/missing', expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

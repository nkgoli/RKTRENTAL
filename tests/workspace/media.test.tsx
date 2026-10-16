// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropertyDetail } from '@/lib/properties/data';
import { WorkspaceMedia } from '@/components/workspace/WorkspaceMedia';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

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
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
import { RequestPhoto } from '@/components/maintenance/RequestPhoto';
import { RequestActionForm } from '@/components/maintenance/RequestActionForm';
import { OperationsError } from '@/components/maintenance/OperationsError';
afterEach(cleanup);
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
describe('maintenance recovery', () => {
  it('replaces a failed image with useful copy while keeping file actions', () => {
    render(<RequestPhoto documentId="photo-1" title="Leak" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('Photo preview unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Leak photo' }));
    expect(screen.getByRole('dialog', { name: 'Leak photo' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download' }).getAttribute('href')).toBe(
      '/api/files/photo-1/download',
    );
  });
  it('retains typed values after an action failure', async () => {
    render(
      <RequestActionForm
        action={async () => ({ error: 'Choose another vendor.' })}
        label="Update request"
      >
        <label>
          Comment
          <input name="comment" />
        </label>
        <button type="submit">Save</button>
      </RequestActionForm>,
    );
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Keep this update' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Update request' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Choose another vendor'),
    );
    expect((screen.getByLabelText('Comment') as HTMLInputElement).value).toBe('Keep this update');
  });
  it('offers retry and a list destination for route failures', () => {
    const reset = vi.fn();
    render(<OperationsError reset={reset} area="files" />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Open all files' }).getAttribute('href')).toBe(
      '/documents',
    );
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MaintenanceFilters } from '@/components/maintenance/MaintenanceListControls';
import { RequestPhotoUpload } from '@/components/maintenance/RequestPhotoUpload';
import { RequestActionForm } from '@/components/maintenance/RequestActionForm';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);
describe('maintenance quick controls', () => {
  it('confirms cancellation before submitting the selected request status', async () => {
    const action = vi.fn().mockResolvedValue({});
    render(
      <RequestActionForm action={action} label="Request status" confirmCancellation>
        <input type="hidden" name="requestId" value="request-1" />
        <select name="status" defaultValue="CANCELLED">
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button type="submit">Update</button>
      </RequestActionForm>,
    );
    fireEvent.submit(screen.getByRole('form', { name: 'Request status' }));
    expect(action).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Cancel this repair request?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0][0].get('requestId')).toBe('request-1');
    expect(action.mock.calls[0][0].get('status')).toBe('CANCELLED');
  });
  it('applies status and date changes while retaining scope and resetting pagination', () => {
    render(
      <MaintenanceFilters
        action="/maintenance"
        hidden={{ propertyId: 'property', unitId: 'unit' }}
        query={{ allHistory: true, page: 3 }}
      />,
    );
    const form = screen.getByRole('search', { name: 'Filter requests' }) as HTMLFormElement;
    form.requestSubmit = vi.fn();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-10-01' } });
    expect(form.requestSubmit).toHaveBeenCalledTimes(2);
    const data = new FormData(form);
    expect(data.get('propertyId')).toBe('property');
    expect(data.get('unitId')).toBe('unit');
    expect(data.get('history')).toBe('all');
    expect(data.has('page')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Apply filters' })).toBeNull();
  });
  it('submits a selected photo through the existing form once without an extra upload step', () => {
    render(
      <form aria-label="Upload">
        <RequestPhotoUpload />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Upload' }) as HTMLFormElement;
    form.requestSubmit = vi.fn();
    fireEvent.change(screen.getByLabelText('Add photo'), {
      target: { files: [new File(['photo'], 'leak.jpg', { type: 'image/jpeg' })] },
    });
    expect(form.requestSubmit).toHaveBeenCalledOnce();
  });
});

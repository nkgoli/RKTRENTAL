// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MaintenanceEditorData } from '@/lib/maintenance/editor';

const toast = vi.hoisted(() => ({ success: vi.fn(), push: vi.fn() }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => toast }));
import { MaintenanceEditor } from '@/components/maintenance/MaintenanceEditor';

const initial: MaintenanceEditorData = {
  id: 'request',
  title: 'Kitchen sink leak',
  description: 'Water beneath the sink.',
  priority: 'NORMAL',
  status: 'NEW',
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
  completedAt: null,
  propertyId: 'property',
  property: { id: 'property', name: 'Test Court' },
  unit: { id: 'unit', number: '4B' },
  vendorId: null,
  vendorName: null,
  vendor: null,
  photos: [],
  events: [],
};
const vendor = {
  id: 'vendor',
  name: 'Test Plumbing',
  trade: 'Plumbing',
  phone: null,
  email: null,
};
const draft = {
  title: 'Repair the kitchen sink',
  description: 'Water is pooling. Please call before entry.',
  priority: 'URGENT' as const,
  status: 'IN_PROGRESS' as const,
  vendorId: 'vendor',
};
const labels = {
  title: 'Request title',
  description: 'Description',
  priority: 'Priority',
  status: 'Status',
  vendorId: 'Assigned vendor',
};
const fetchMock = vi.fn();
const response = (body: unknown) => ({ ok: true, json: async () => body });
const saved = (values: Partial<MaintenanceEditorData> = {}): MaintenanceEditorData => ({
  ...initial,
  ...draft,
  updatedAt: '2026-10-21T12:05:00.000Z',
  vendor: { id: vendor.id, name: vendor.name },
  vendorName: vendor.name,
  ...values,
});
const editForm = () => screen.getByRole('form', { name: 'Edit repair request' });
const commentForm = () => screen.getByRole('form', { name: 'Add request comment' });
const getValue = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement).value;
const posted = (index = 0) => fetchMock.mock.calls[index][1].body as FormData;
const renderEditor = () =>
  render(
    <MaintenanceEditor
      initial={initial}
      vendors={[vendor]}
      returnTo="/properties/property/maintenance?unit=unit"
    />,
  );
function stage(values = draft) {
  for (const [key, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(labels[key as keyof typeof labels]), {
      target: { value },
    });
  }
}
function expectDraft() {
  for (const [key, value] of Object.entries(draft)) {
    expect(getValue(labels[key as keyof typeof labels])).toBe(value);
  }
  expect(screen.getByText('Unsaved changes')).toBeTruthy();
}
function deferResponse() {
  let resolve!: (result: ReturnType<typeof response>) => void;
  fetchMock.mockImplementationOnce(
    () => new Promise<ReturnType<typeof response>>((done) => (resolve = done)),
  );
  return async (body: unknown) => {
    await act(async () => resolve(response(body)));
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:selected-photo'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
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
});

describe('dedicated maintenance editor workflow', () => {
  it('populates saved fields and submits details, assignment and status in one scoped save', async () => {
    fetchMock.mockResolvedValue(response({ message: 'Repair request saved.', request: saved() }));
    renderEditor();
    expect(getValue('Request title')).toBe(initial.title);
    expect(getValue('Description')).toBe(initial.description);
    expect(getValue('Priority')).toBe(initial.priority);
    expect(getValue('Status')).toBe(initial.status);
    expect(getValue('Assigned vendor')).toBe('');
    expect(
      screen
        .getAllByRole('button', { name: 'Save request' })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    stage();
    fireEvent.submit(editForm());
    await screen.findByText('Repair request saved.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/maintenance/request/edit/data');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(Object.fromEntries(posted())).toEqual({
      ...draft,
      operation: 'save',
      propertyId: 'property',
      scopeUnitId: 'unit',
      updatedAt: initial.updatedAt,
    });
    expect(screen.getByText('All changes saved')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Repair request saved.');
  });

  it('retains staged fields across a posted comment and uses the original edit revision', async () => {
    const comment = 'Vendor can visit after 2 PM.';
    fetchMock.mockResolvedValueOnce(
      response({
        message: 'Comment added.',
        request: {
          ...initial,
          events: [
            {
              id: 'comment',
              kind: 'COMMENT',
              body: comment,
              createdAt: '2026-10-21T12:02:00.000Z',
              fromStatus: null,
              toStatus: null,
              actor: { name: 'Test Manager' },
            },
          ],
        },
      }),
    );
    renderEditor();
    stage();
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: comment } });
    fireEvent.submit(commentForm());
    await screen.findByText('Comment added.');
    expectDraft();
    expect(screen.getByText(comment)).toBeTruthy();
    expect(screen.getByText('Test Manager')).toBeTruthy();
    expect(getValue('Add a comment')).toBe('');
    expect(Object.fromEntries(posted())).toEqual({
      propertyId: 'property',
      scopeUnitId: 'unit',
      operation: 'comment',
      comment,
    });
    fetchMock.mockResolvedValueOnce(
      response({ message: 'Repair request saved.', request: saved() }),
    );
    fireEvent.submit(editForm());
    await screen.findByText('Repair request saved.');
    expect(posted(1).get('updatedAt')).toBe(initial.updatedAt);
    expect(posted(1).get('vendorId')).toBe(draft.vendorId);
    expect(posted(1).get('status')).toBe(draft.status);
  });

  it('adopts newer server fields after an immediate action only when the editor is clean', async () => {
    fetchMock.mockResolvedValueOnce(response({ message: 'Comment added.', request: saved() }));
    renderEditor();
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'An update' } });
    fireEvent.submit(commentForm());
    await screen.findByText('Comment added.');
    expect(getValue('Request title')).toBe(draft.title);
    expect(getValue('Status')).toBe(draft.status);
    expect(screen.getByText('All changes saved')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Request title'), { target: { value: 'Next edit' } });
    fetchMock.mockResolvedValueOnce(
      response({ message: 'Request saved.', request: saved({ title: 'Next edit' }) }),
    );
    fireEvent.submit(editForm());
    await screen.findByText('Request saved.');
    expect(posted(1).get('updatedAt')).toBe(saved().updatedAt);
  });

  it.each(['server', 'network'])(
    'retains the comment and all staged fields on %s failure',
    async (failure) => {
      if (failure === 'server')
        fetchMock.mockResolvedValue(response({ error: 'Comment could not be saved.' }));
      else fetchMock.mockRejectedValue(new Error('Connection interrupted'));
      renderEditor();
      stage();
      fireEvent.change(screen.getByLabelText('Add a comment'), {
        target: { value: 'Keep this update' },
      });
      fireEvent.submit(commentForm());
      await waitFor(() => expect(screen.getByRole('alert')).toBe(document.activeElement));
      expectDraft();
      expect(getValue('Add a comment')).toBe('Keep this update');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalled();
    },
  );

  it('prevents repeated saves and competing immediate actions while a save is pending', async () => {
    const finish = deferResponse();
    renderEditor();
    stage();
    fireEvent.change(screen.getByLabelText('Add a comment'), {
      target: { value: 'Unposted update' },
    });
    fireEvent.submit(editForm());
    fireEvent.submit(editForm());
    fireEvent.submit(commentForm());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(editForm().getAttribute('aria-busy')).toBe('true');
    await finish({ message: 'Repair request saved.', request: saved() });
    await screen.findByText('Repair request saved.');
    expect(getValue('Add a comment')).toBe('Unposted update');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('prevents a repeated comment submission from posting twice', async () => {
    const finish = deferResponse();
    renderEditor();
    stage();
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'One update' } });
    fireEvent.submit(commentForm());
    fireEvent.submit(commentForm());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await finish({ message: 'Comment added.', request: initial });
    await screen.findByText('Comment added.');
    expectDraft();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retains all values and focuses the error when saving fails', async () => {
    fetchMock.mockResolvedValue(response({ error: 'This request changed since you opened it.' }));
    renderEditor();
    stage();
    fireEvent.submit(editForm());
    await waitFor(() => expect(screen.getByRole('alert')).toBe(document.activeElement));
    expect(screen.getByRole('alert').textContent).toBe('This request changed since you opened it.');
    expectDraft();
    expect(
      screen
        .getAllByRole('button', { name: 'Save request' })
        .every((button) => !(button as HTMLButtonElement).disabled),
    ).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('focuses inline title validation before sending any request', () => {
    renderEditor();
    stage();
    fireEvent.change(screen.getByLabelText('Request title'), { target: { value: '   ' } });
    fireEvent.submit(editForm());
    const title = screen.getByLabelText('Request title');
    expect(title).toBe(document.activeElement);
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.getAttribute('aria-describedby')).toBe('title-error');
    expect(screen.getByText('Enter a request title.')).toBeTruthy();
    expect(getValue('Description')).toBe(draft.description);
    expect(getValue('Assigned vendor')).toBe(draft.vendorId);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows declining cancellation, then sends one combined save after confirmation', async () => {
    const finish = deferResponse();
    renderEditor();
    stage();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CANCELLED' } });
    fireEvent.submit(editForm());
    const firstDialog = screen.getByRole('dialog', { name: 'Cancel this repair request?' });
    expect(within(firstDialog).getByRole('button', { name: 'Cancel' })).toBe(
      document.activeElement,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(firstDialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getValue('Status')).toBe('CANCELLED');
    expect(getValue('Request title')).toBe(draft.title);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.submit(editForm());
    const confirm = within(
      screen.getByRole('dialog', { name: 'Cancel this repair request?' }),
    ).getByRole('button', { name: 'Save and cancel request' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(posted().get('status')).toBe('CANCELLED');
    expect(posted().get('title')).toBe(draft.title);
    expect(posted().get('vendorId')).toBe(draft.vendorId);
    await finish({ message: 'Repair request saved.', request: saved({ status: 'CANCELLED' }) });
    await screen.findByText('Repair request saved.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps unsaved fields and an unposted comment when discarding is declined', () => {
    renderEditor();
    stage();
    fireEvent.change(screen.getByLabelText('Add a comment'), {
      target: { value: 'Unposted update' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(within(dialog).getByText(/already saved will remain/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expectDraft();
    expect(getValue('Add a comment')).toBe('Unposted update');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('intercepts browser Back with unsaved changes and keeps the draft when staying', () => {
    window.history.replaceState({ editor: true }, '', '/maintenance/request/edit');
    const push = vi.spyOn(window.history, 'pushState');
    renderEditor();
    stage();
    fireEvent.change(screen.getByLabelText('Add a comment'), {
      target: { value: 'Unposted update' },
    });
    fireEvent.change(screen.getByLabelText('Choose request photo'), {
      target: { files: [new File(['photo'], 'repair.png', { type: 'image/png' })] },
    });
    expect(screen.getByText('repair.png')).toBeTruthy();
    // The browser has already moved to the previous entry when popstate fires.
    window.history.pushState({ list: true }, '', '/maintenance');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(push).toHaveBeenCalledWith(
      expect.anything(),
      '',
      'http://localhost:3000/maintenance/request/edit',
    );
    expect(window.location.pathname).toBe('/maintenance/request/edit');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expectDraft();
    expect(getValue('Add a comment')).toBe('Unposted update');
    expect(screen.getByText('repair.png')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('protects a selected photo even when no field changed', () => {
    window.history.replaceState({ editor: true }, '', '/maintenance/request/edit');
    renderEditor();
    fireEvent.change(screen.getByLabelText('Choose request photo'), {
      target: { files: [new File(['photo'], 'repair.png', { type: 'image/png' })] },
    });
    expect(screen.getByText('repair.png')).toBeTruthy();
    window.history.pushState({ list: true }, '', '/maintenance');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('repair.png')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('navigates to the intended destination after confirming a browser Back discard', () => {
    window.history.replaceState({ editor: true }, '', '/maintenance/request/edit');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderEditor();
    stage();
    window.history.pushState({ list: true }, '', '/maintenance');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves clean browser Back/Forward to the router', () => {
    window.history.replaceState({ editor: true }, '', '/maintenance/request/edit');
    const push = vi.spyOn(window.history, 'pushState');
    let reached = false;
    const listener = () => {
      reached = true;
    };
    window.addEventListener('popstate', listener);
    renderEditor();
    window.history.pushState({ list: true }, '', '/maintenance');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reached).toBe(true);
    expect(push).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      'http://localhost:3000/maintenance/request/edit',
    );
    window.removeEventListener('popstate', listener);
  });

  it('blocks browser Back while an action is pending and keeps the draft', async () => {
    window.history.replaceState({ editor: true }, '', '/maintenance/request/edit');
    const finish = deferResponse();
    renderEditor();
    stage();
    fireEvent.submit(editForm());
    expect(editForm().getAttribute('aria-busy')).toBe('true');
    window.history.pushState({ list: true }, '', '/maintenance');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toast.push).toHaveBeenCalledWith({
      message: 'Wait for the current action to finish before leaving.',
      tone: 'info',
    });
    expect(window.location.pathname).toBe('/maintenance/request/edit');
    expectDraft();
    await finish({ message: 'Repair request saved.', request: saved() });
    await screen.findByText('Repair request saved.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Once the save settles the editor is clean, so Back is no longer intercepted.
    window.history.pushState({ list: true }, '', '/maintenance');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

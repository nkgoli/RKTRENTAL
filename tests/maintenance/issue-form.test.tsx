// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
vi.mock('@/components/upload', () => ({
  FileUploader: () => <input type="file" name="photo" aria-label="Request photo" />,
}));
import { MaintenanceIssueForm } from '@/components/maintenance/MaintenanceIssueForm';
afterEach(cleanup);
it('retains all editable values and focuses feedback after a rejected save', async () => {
  const action = vi.fn(async () => ({ error: 'Title is required' }));
  render(
    <MaintenanceIssueForm
      action={action}
      returnTo="/maintenance?status=NEW"
      request={{
        title: 'Original',
        description: 'Original description',
        priority: 'NORMAL',
        location: 'Property / 4B',
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Retained draft' } });
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'HIGH' } });
  fireEvent.submit(screen.getByRole('form'));
  await waitFor(() => expect(screen.getByRole('alert')).toBe(document.activeElement));
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('   ');
  expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(
    'Retained draft',
  );
  expect((screen.getByLabelText('Priority') as HTMLSelectElement).value).toBe('HIGH');
  expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(
    '/maintenance?status=NEW',
  );
  expect(action).toHaveBeenCalledTimes(1);
});

const properties = [
  {
    id: 'maple',
    name: 'Maple Court',
    units: [
      { id: 'u4b', number: '4B' },
      { id: 'u2a', number: '2A' },
    ],
  },
  { id: 'elm', name: '18 Elm Street', units: [{ id: 'home', number: 'Home' }] },
];

it('chooses the unit from the selected property and starts with none chosen', () => {
  render(<MaintenanceIssueForm returnTo="/maintenance" properties={properties} />);
  const unit = screen.getByLabelText('Unit') as HTMLSelectElement;
  expect(unit.disabled).toBe(true);
  expect(screen.getByRole('option', { name: 'Choose a property first' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Property'), { target: { value: 'elm' } });
  const elmUnit = screen.getByLabelText('Unit') as HTMLSelectElement;
  expect(elmUnit.disabled).toBe(false);
  expect(elmUnit.value).toBe('home');
  expect(screen.queryByRole('option', { name: '4B' })).toBeNull();
  expect(screen.getByText('Photos · none added')).toBeTruthy();
});

it('preselects the scoped unit and assigns the optional vendor after creating', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Repair request created.',
        requestId: 'r1',
        requestHref: '/maintenance#request-r1',
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Vendor assigned.' }) });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MaintenanceIssueForm
      returnTo="/maintenance"
      properties={properties}
      vendors={[{ id: 'v1', name: 'Keyline Services' }]}
      selectedUnitId="u2a"
    />,
  );
  expect((screen.getByLabelText('Property') as HTMLSelectElement).value).toBe('maple');
  expect((screen.getByLabelText('Unit') as HTMLSelectElement).value).toBe('u2a');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Leak' } });
  fireEvent.change(screen.getByLabelText('Vendor (optional)'), { target: { value: 'v1' } });
  fireEvent.submit(screen.getByRole('form'));
  await screen.findByText(/Repair request created\. Vendor assigned\./);
  const created = fetchMock.mock.calls[0][1].body as FormData;
  expect(created.get('unitId')).toBe('u2a');
  expect(created.get('vendorId')).toBeNull();
  const assigned = fetchMock.mock.calls[1][1].body as FormData;
  expect(Object.fromEntries([...assigned.entries()])).toEqual({
    operation: 'assign',
    requestId: 'r1',
    vendorId: 'v1',
  });
  vi.unstubAllGlobals();
});

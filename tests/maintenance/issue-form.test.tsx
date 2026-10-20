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
      units={[]}
      request={{
        title: 'Original',
        description: 'Original description',
        priority: 'NORMAL',
        location: 'Property / 4B',
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText('Request title'), { target: { value: '   ' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Retained draft' } });
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'HIGH' } });
  fireEvent.submit(screen.getByRole('form'));
  await waitFor(() => expect(screen.getByRole('alert')).toBe(document.activeElement));
  expect((screen.getByLabelText('Request title') as HTMLInputElement).value).toBe('   ');
  expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(
    'Retained draft',
  );
  expect((screen.getByLabelText('Priority') as HTMLSelectElement).value).toBe('HIGH');
  expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(
    '/maintenance?status=NEW',
  );
  expect(action).toHaveBeenCalledTimes(1);
});

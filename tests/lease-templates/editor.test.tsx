// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STANDARD_FEES, INCLUDE_WHEN } from '@/lib/lease-create/templates';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  property: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/components/shell/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/app/(manager)/leases/templates/actions', () => ({
  saveLeaseTemplateAction: mocks.save,
  deleteLeaseTemplateAction: mocks.remove,
  setPropertyLeaseTemplateAction: mocks.property,
}));
import { TemplateEditor } from '@/app/(manager)/leases/templates/[id]/TemplateEditor';

const initial = {
  id: 'fixture',
  name: 'Fixture terms',
  version: 3,
  defaultFees: STANDARD_FEES,
  items: [
    {
      id: 'term',
      title: 'Long wording',
      body: 'Preserve the complete agreement wording.',
      section: 'CLAUSE' as const,
      order: 0,
      required: true,
      includeWhen: 'ALWAYS' as const,
    },
  ],
};
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it('exposes every condition and all six fees, with linked validation and retained edits on failure', async () => {
  const user = userEvent.setup();
  render(<TemplateEditor initial={initial} properties={[]} />);
  await user.click(screen.getByRole('button', { name: /1. Long wording/ }));
  expect(screen.getAllByRole('option')).toHaveLength(INCLUDE_WHEN.length);
  expect(screen.getAllByRole('spinbutton')).toHaveLength(6);
  const grace = screen.getByLabelText('Grace days');
  await user.clear(grace);
  await user.type(grace, '32');
  await user.click(screen.getByRole('button', { name: 'Save template' }));
  expect(grace.getAttribute('aria-invalid')).toBe('true');
  expect(grace.getAttribute('aria-describedby')).toBe('template-feedback');
  expect(document.activeElement?.textContent).toBe('Enter 0 to 31 grace days.');
  expect(mocks.save).not.toHaveBeenCalled();
  await user.clear(grace);
  await user.type(grace, '5');
  mocks.save.mockRejectedValueOnce(new Error('offline'));
  await user.click(screen.getByRole('button', { name: 'Save template' }));
  await screen.findByText('The template could not be saved. Your edits are still here; try again.');
  expect((screen.getByLabelText('Long wording wording') as HTMLTextAreaElement).value).toBe(
    initial.items[0].body,
  );
});

it('saves a version in the editor and duplicates to the returned identity', async () => {
  const user = userEvent.setup();
  mocks.save
    .mockResolvedValueOnce({ template: { ...initial, version: 4 } })
    .mockResolvedValueOnce({
      template: { ...initial, id: 'copy', name: 'Fixture terms copy', version: 1 },
    });
  render(<TemplateEditor initial={initial} properties={[]} />);
  await user.click(screen.getByRole('button', { name: 'Save template' }));
  await screen.findByText('Saved version 4.');
  expect(mocks.push).toHaveBeenLastCalledWith('/leases/templates/fixture');
  await user.click(screen.getByRole('button', { name: 'Duplicate' }));
  await waitFor(() => expect(mocks.push).toHaveBeenLastCalledWith('/leases/templates/copy'));
  expect(mocks.save.mock.calls[1][0].id).toBeUndefined();
});

it('sets property defaults and preserves deletion denial before an unused deletion returns to the library', async () => {
  const user = userEvent.setup();
  mocks.property.mockResolvedValue({ success: true });
  mocks.remove
    .mockResolvedValueOnce({ error: 'This template is used by a lease.' })
    .mockResolvedValueOnce({ success: true });
  render(
    <TemplateEditor
      initial={initial}
      properties={[{ id: 'home', name: 'Fixture home', defaultLeaseTemplateId: null }]}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Set as default for Fixture home' }));
  await screen.findByText('Property default updated.');
  expect(mocks.property).toHaveBeenCalledWith('home', 'fixture');
  await user.click(screen.getByRole('button', { name: 'Delete when unused' }));
  await screen.findByText('This template is used by a lease.');
  expect(mocks.push).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Delete when unused' }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/leases/templates'));
});

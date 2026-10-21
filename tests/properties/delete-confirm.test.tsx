// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DeleteUnitControl } from '@/components/units/DeleteUnitControl';
vi.mock('@/app/(manager)/properties/actions', () => ({ deleteEmptyUnitAction: vi.fn() }));
afterEach(cleanup);

it('names the unit in the shared dialog and retains its scoped form fields', () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  render(<DeleteUnitControl propertyId="p1" unitId="u1" unitLabel="Unit 4B" disabled={false} implicit={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete unit' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete Unit 4B?' });
  expect(dialog.querySelector<HTMLInputElement>('[name=propertyId]')?.value).toBe('p1');
  expect(dialog.querySelector<HTMLInputElement>('[name=unitId]')?.value).toBe('u1');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('explains why an implicit unit cannot be deleted', () => {
  render(<DeleteUnitControl propertyId="p1" unitId="u1" disabled implicit />);
  expect((screen.getByRole('button', { name: 'Delete unit' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('The single-family home unit cannot be deleted.')).toBeTruthy();
});

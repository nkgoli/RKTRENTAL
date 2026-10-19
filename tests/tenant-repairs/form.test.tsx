// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/components/upload', () => ({
  FileUploader: () => <input aria-label="Choose files" type="file" name="photos" />,
}));
import { RepairForm } from '@/app/(tenant)/repairs/RepairForm';
import { TenantPhoto } from '@/app/(tenant)/TenantPhoto';

afterEach(cleanup);

it('keeps selections and focuses the description when it contains only whitespace', () => {
  render(<RepairForm />);
  const category = screen.getByLabelText('Category') as HTMLSelectElement;
  const description = screen.getByRole('textbox', { name: /What needs fixing/ });
  fireEvent.change(category, { target: { value: 'Electrical' } });
  fireEvent.change(description, { target: { value: '   ' } });
  const event = new Event('submit', { bubbles: true, cancelable: true });
  fireEvent(description.closest('form')!, event);
  expect(event.defaultPrevented).toBe(true);
  expect(category.value).toBe('Electrical');
  expect(document.activeElement).toBe(description);
  expect(description.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByRole('alert').textContent).toContain('Describe what needs fixing');
  fireEvent.change(description, { target: { value: 'Bathroom fan rattles.' } });
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows an accessible fallback for an unavailable tenant photo', () => {
  render(<TenantPhoto src="/lease/photos/demo-missing" alt="Kitchen sink" />);
  fireEvent.error(screen.getByRole('img', { name: 'Kitchen sink' }));
  expect(
    screen.getByRole('img', { name: 'Kitchen sink — photo unavailable' }).textContent,
  ).toContain('Photo unavailable');
});

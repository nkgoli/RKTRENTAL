// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RepairForm } from '@/app/(tenant)/repairs/RepairForm';
afterEach(cleanup);
it('retains native multipart semantics, labelled choices and whitespace validation focus', () => {
  render(<RepairForm />);
  const description = screen.getByLabelText(/What needs fixing/);
  const form = description.closest('form')!;
  expect(form.method).toBe('post');
  expect(form.getAttribute('action')).toBe('/repairs/submit');
  expect(form.enctype).toBe('multipart/form-data');
  expect(form.noValidate).toBe(true);
  expect(screen.getByLabelText('Category').tagName).toBe('SELECT');
  expect(screen.getByLabelText('Urgency').getAttribute('aria-describedby')).toBe('urgency-help');
  expect(screen.getByLabelText('Vendor may enter with manager key')).toHaveProperty(
    'checked',
    true,
  );
  expect(screen.getByLabelText('Choose files').getAttribute('accept')).toContain('.heic');
  expect(screen.getByText('JPG, PNG or HEIC · up to 5 photos')).toBeTruthy();
  expect(screen.queryByText('0 of 5 photos')).toBeNull();
  fireEvent.change(description, { target: { value: '   ' } });
  expect(fireEvent.submit(form)).toBe(false);
  expect(document.activeElement).toBe(description);
  expect(description.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByRole('alert').textContent).toContain('Describe what needs fixing');
  fireEvent.change(description, { target: { value: 'Kitchen sink leaks' } });
  expect(description.getAttribute('aria-invalid')).toBe('false');
  // Prevent navigation while exercising the handler's duplicate-submit guard.
  form.addEventListener('submit', (event) => event.preventDefault());
  fireEvent.submit(form);
  expect(screen.getByRole('button', { name: /Sending request/ })).toHaveProperty('disabled', true);
  expect(form.getAttribute('aria-busy')).toBe('true');
});
it('retains uploader limit, failed-file retry and removal feedback', () => {
  URL.createObjectURL = vi.fn(() => 'blob:fixture');
  URL.revokeObjectURL = vi.fn();
  render(<RepairForm />);
  const input = screen.getByLabelText('Choose files');
  const file = new File(['x'], 'oversized.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: 26214401 });
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getAllByText(/File exceeds the 25 MB limit/).length).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry oversized.jpg' }));
  expect(screen.getAllByText(/File exceeds the 25 MB limit/).length).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Remove oversized.jpg' }));
  expect(screen.queryByText('oversized.jpg')).toBeNull();
  fireEvent.change(input, {
    target: {
      files: Array.from(
        { length: 6 },
        (_, i) => new File(['x'], `photo-${i}.jpg`, { type: 'image/jpeg' }),
      ),
    },
  });
  expect(screen.getAllByText('Ready to submit')).toHaveLength(5);
  expect(screen.getByRole('alert').textContent).toContain('1 file was not added');
});

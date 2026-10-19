// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/app/(auth)/sign-in/actions', () => ({ signInAction: vi.fn() }));
import { SignInForm } from '@/app/(auth)/sign-in/SignInForm';

afterEach(cleanup);
it('keeps the destination and reveals the password without submitting', async () => {
  render(<SignInForm next="/lease" invalid />);
  const password = screen.getByLabelText('Password') as HTMLInputElement;
  await userEvent.type(password, 'only-a-test');
  await userEvent.click(screen.getByRole('button', { name: 'Show characters' }));
  expect(password.type).toBe('text');
  expect(password.value).toBe('only-a-test');
  await userEvent.click(screen.getByRole('button', { name: 'Hide characters' }));
  expect(password.type).toBe('password');
  expect(password.getAttribute('aria-describedby')).toBe('sign-in-error');
  expect((document.querySelector('input[name="next"]') as HTMLInputElement).value).toBe('/lease');
});

// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/app/(auth)/sign-in/actions', () => ({ signInAction: vi.fn() }));
import { SignInForm } from '@/app/(auth)/sign-in/SignInForm';
import { signInAction } from '@/app/(auth)/sign-in/actions';
import { INVALID_CREDENTIALS } from '@/lib/auth/sign-in';

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

it('validates empty input inline and focuses the first field without calling the action', async () => {
  vi.mocked(signInAction).mockClear();
  render(<SignInForm next="/home" />);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('alert').textContent).toContain('Check your sign-in details.');
  expect(screen.getByLabelText('Email address').getAttribute('aria-describedby')).toBe(
    'email-error',
  );
  expect(screen.getByLabelText('Password').getAttribute('aria-describedby')).toBe('password-error');
  expect(document.activeElement).toBe(screen.getByLabelText('Email address'));
  expect(signInAction).not.toHaveBeenCalled();
});

it('keeps the email, clears and focuses the password after rejected credentials', async () => {
  vi.mocked(signInAction).mockResolvedValue({
    email: 'alex@example.com',
    message: INVALID_CREDENTIALS,
    attempt: 1,
  });
  render(<SignInForm next="/home" />);
  const email = screen.getByLabelText('Email address') as HTMLInputElement;
  const password = screen.getByLabelText('Password') as HTMLInputElement;
  await userEvent.type(email, 'alex@example.com');
  await userEvent.type(password, 'wrong-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(INVALID_CREDENTIALS));
  expect(email.value).toBe('alex@example.com');
  expect(password.value).toBe('');
  expect(password.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(password);
  expect(screen.getByRole('link', { name: 'Forgot password?' }).getAttribute('href')).toBe(
    '/recover',
  );
});

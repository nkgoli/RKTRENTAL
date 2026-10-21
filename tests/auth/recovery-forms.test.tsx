// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/app/(auth)/recover/actions', () => ({
  requestRecoveryAction: vi.fn(),
  resetPasswordAction: vi.fn(),
}));
import { RequestRecoveryForm } from '@/app/(auth)/recover/RequestRecoveryForm';
import { ResetPasswordForm } from '@/app/(auth)/recover/ResetPasswordForm';
import { requestRecoveryAction, resetPasswordAction } from '@/app/(auth)/recover/actions';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('validates an empty recovery request inline and focuses email', async () => {
  render(<RequestRecoveryForm />);
  await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(screen.getByRole('alert').textContent).toContain('Enter your email address.');
  expect(document.activeElement).toBe(screen.getByLabelText('Email address'));
  expect(requestRecoveryAction).not.toHaveBeenCalled();
});

it('announces the same conditional inbox confirmation without exposing a reset link', async () => {
  vi.mocked(requestRecoveryAction).mockResolvedValue({
    email: 'alex@example.com',
    sent: true,
    attempt: 1,
  });
  render(<RequestRecoveryForm />);
  await userEvent.type(screen.getByLabelText('Email address'), 'alex@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('If an account uses'),
  );
  expect(document.activeElement).toBe(screen.getByRole('status'));
  expect(screen.queryByRole('link', { name: 'Change password' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try another email' }));
  expect(document.activeElement).toBe(screen.getByLabelText('Email address'));
  expect(screen.queryByRole('status')).toBeNull();
});

it('focuses a mismatched confirmation and preserves the first password for correction', async () => {
  render(<ResetPasswordForm token="test-token" />);
  const password = screen.getByLabelText('New password') as HTMLInputElement;
  await userEvent.type(password, 'correct-length-password');
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'different-password');
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
  expect(screen.getByRole('alert').textContent).toContain('The passwords do not match.');
  expect(document.activeElement).toBe(screen.getByLabelText('Confirm new password'));
  expect(password.value).toBe('correct-length-password');
  expect(resetPasswordAction).not.toHaveBeenCalled();
});

it('clears entered passwords and focuses the server error when a token has been consumed', async () => {
  vi.mocked(resetPasswordAction).mockResolvedValue({
    error: 'This reset link has expired or has already been used. Request a new link.',
    attempt: 1,
  });
  render(<ResetPasswordForm token="test-token" />);
  const password = screen.getByLabelText('New password') as HTMLInputElement;
  const confirmation = screen.getByLabelText('Confirm new password') as HTMLInputElement;
  await userEvent.type(password, 'correct-length-password');
  await userEvent.type(confirmation, 'correct-length-password');
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('already been used'));
  expect(password.value).toBe('');
  expect(confirmation.value).toBe('');
  expect(document.activeElement).toBe(screen.getByRole('alert'));
});

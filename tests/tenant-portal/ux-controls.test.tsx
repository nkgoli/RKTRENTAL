// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AccountMenu } from '@/components/shell/AccountMenu';
import { RenewalNotice } from '@/app/(tenant)/home/RenewalNotice';

vi.mock('@/app/(auth)/sign-out/actions', () => ({ signOutAction: vi.fn() }));
afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('shows account context and returns focus when Escape closes the menu', () => {
  render(<AccountMenu initials="AR" name="Alex Rivera" description="Maple Court · Unit 4B" />);
  const trigger = screen.getByRole('button', { name: 'Account menu' });
  fireEvent.click(trigger);
  expect(screen.getByText('Maple Court · Unit 4B')).toBeTruthy();
  const signOut = screen.getByRole('button', { name: 'Sign out' });
  signOut.focus();
  fireEvent.keyDown(signOut, { key: 'Escape' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

it('persists a dismissal only for that lease term and uses the manager contact', () => {
  const props = {
    notice: { kind: 'renewal' as const, title: 'Renewal coming up', body: 'Your lease ends soon.' },
    storageKey: 'renewal:lease:2026',
    contactEmail: 'manager@example.com',
    managerName: 'Jordan',
  };
  const first = render(<RenewalNotice {...props} />);
  expect(screen.getByRole('link', { name: 'Ask about renewal' }).getAttribute('href')).toContain(
    'mailto:manager@example.com',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss renewal reminder' }));
  expect(screen.queryByText('Renewal coming up')).toBeNull();
  first.unmount();
  const next = render(<RenewalNotice {...props} />);
  expect(screen.queryByText('Renewal coming up')).toBeNull();
  next.rerender(<RenewalNotice {...props} storageKey="renewal:lease:2027" />);
  expect(screen.getByText('Renewal coming up')).toBeTruthy();
});

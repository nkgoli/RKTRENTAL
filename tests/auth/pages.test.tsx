import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const redirect = vi.fn();

vi.mock('@/lib/auth/server-session', () => ({ getSession: () => getSession() }));
vi.mock('next/navigation', () => ({ redirect: (href: string) => redirect(href) }));
vi.mock('@/app/(auth)/sign-in/actions', () => ({ signInAction: vi.fn() }));
vi.mock('@/app/(auth)/sign-out/actions', () => ({ signOutAction: vi.fn() }));

import SignInPage from '@/app/(auth)/sign-in/page';
import SignOutPage from '@/app/(auth)/sign-out/page';
import RecoverPage from '@/app/(auth)/recover/page';
import NotFound from '@/app/not-found';

beforeEach(() => {
  getSession.mockReset();
  redirect.mockReset();
});

it('keeps the credential error and safe next destination on the sign-in page', async () => {
  getSession.mockResolvedValue(null);
  const html = renderToStaticMarkup(
    await SignInPage({
      searchParams: Promise.resolve({ error: 'invalid', next: '/lease' }),
    }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain('Email or password was not recognized');
  expect(html).toContain('name="next" value="/lease"');
  expect(html).toContain('Welcome back');
  expect(html).toContain('Sign in to manage your rental account.');
});

it('shows signed-out feedback above the sign-in form', async () => {
  getSession.mockResolvedValue(null);
  const html = renderToStaticMarkup(
    await SignInPage({ searchParams: Promise.resolve({ loggedOut: '1' }) }),
  );
  expect(html).toContain('role="status"');
  expect(html).toContain('You have been signed out.');
});

it('redirects an existing session to its role home', async () => {
  getSession.mockResolvedValue({ name: 'Jordan Mills', role: 'MANAGER' });
  await SignInPage({ searchParams: Promise.resolve({}) });
  expect(redirect).toHaveBeenCalledWith('/dashboard');
});

it('shows the signed-in identity and both sign-out actions', async () => {
  getSession.mockResolvedValue({ name: 'Alex Rivera', role: 'TENANT' });
  const html = renderToStaticMarkup(await SignOutPage());
  expect(html).toContain('You are signed in as Alex Rivera.');
  expect(html).toContain('Sign out of RocketRental');
  expect(html).toContain('href="/home"');
  expect(html).toContain('Stay signed in');
});

it('offers sign-in when the visitor is already signed out', async () => {
  getSession.mockResolvedValue(null);
  const html = renderToStaticMarkup(await SignOutPage());
  expect(html).toContain('You are already signed out.');
  expect(html).toContain('href="/sign-in"');
  expect(html).toContain('Go to sign in');
});

it('offers the email recovery form and a return to sign-in', () => {
  const html = renderToStaticMarkup(<RecoverPage />);
  expect(html).toContain('Reset your password');
  expect(html).toContain('Send reset link');
  expect(html).toContain('autoComplete="email"');
  expect(html).toContain('href="/sign-in"');
  expect(html).toContain('<form');
});

it.each([
  [null, '/sign-in', 'Sign in'],
  ['TENANT', '/home', 'Back to home'],
  ['MANAGER', '/dashboard', 'Back to dashboard'],
])(
  'returns a %s visitor to the right destination from an unknown page',
  async (role, href, label) => {
    getSession.mockResolvedValue(role ? { role } : null);
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain(label);
    expect(html).toContain('Go back');
    expect(html).not.toContain('Page unavailable');
  },
);

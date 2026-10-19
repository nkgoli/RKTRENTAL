import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { EmptyState, LoadingState } from '@/components/RouteStates';
import { RouteError } from '@/components/RouteError';
import ManagerError from '@/app/(manager)/error';
import ManagerLoading from '@/app/(manager)/loading';
import ManagerNotFound from '@/app/(manager)/not-found';
import TenantError from '@/app/(tenant)/error';
import TenantLoading from '@/app/(tenant)/loading';
import TenantNotFound from '@/app/(tenant)/not-found';
import PublicError from '@/app/error';
import PublicLoading from '@/app/loading';
import PublicNotFound from '@/app/not-found';

const error = Object.assign(new Error('test failure'), { digest: 'test-digest' });
const reset = () => {};

it('renders the shared error state with retry and a boundary-specific return link', () => {
  const html = renderToStaticMarkup(
    <RouteError error={error} reset={reset} homeHref="/dashboard" homeLabel="Back to dashboard" />,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain('Page unavailable');
  expect(html).toContain('Something went wrong');
  expect(html).toContain('We couldn’t load this page. Please try again.');
  expect(html).toContain('Try again');
  expect(html).toContain('href="/dashboard"');
  expect(html).toContain('Back to dashboard');
});

it('renders the shared empty state with an optional eyebrow, icon and primary action', () => {
  const html = renderToStaticMarkup(
    <EmptyState
      eyebrow="Page unavailable"
      icon="folder"
      title="Page not found"
      description="This page is unavailable."
      action="Return to your account"
      href="/"
      variant="primary"
    />,
  );
  expect(html).toContain('Page unavailable');
  expect(html).toContain('Page not found');
  expect(html).toContain('This page is unavailable.');
  expect(html).toContain('href="/"');
  expect(html).toContain('btn-primary');
  expect(html).toContain('<svg');
});

it('announces loading with a visible label and skeleton regions', () => {
  const html = renderToStaticMarkup(<LoadingState />);
  expect(html).toContain('role="status"');
  expect(html).toContain('Loading page…');
  expect(html).toContain('aria-hidden="true"');
});

it('keeps manager, tenant and public recovery destinations distinct', () => {
  const managerError = renderToStaticMarkup(<ManagerError error={error} reset={reset} />);
  expect(managerError).toContain('href="/dashboard"');
  expect(managerError).toContain('Back to dashboard');

  const tenantError = renderToStaticMarkup(<TenantError error={error} reset={reset} />);
  expect(tenantError).toContain('href="/home"');
  expect(tenantError).toContain('Back to home');

  const publicError = renderToStaticMarkup(<PublicError error={error} reset={reset} />);
  expect(publicError).toContain('href="/"');
  expect(publicError).toContain('Return to your account');

  const managerNotFound = renderToStaticMarkup(<ManagerNotFound />);
  expect(managerNotFound).toContain('href="/dashboard"');
  expect(managerNotFound).toContain('Back to dashboard');

  const tenantNotFound = renderToStaticMarkup(<TenantNotFound />);
  expect(tenantNotFound).toContain('href="/home"');
  expect(tenantNotFound).toContain('Back to home');

  const publicNotFound = renderToStaticMarkup(<PublicNotFound />);
  expect(publicNotFound).toContain('href="/"');
  expect(publicNotFound).toContain('Return to your account');
});

it('renders loading states for every boundary', () => {
  for (const page of [
    renderToStaticMarkup(<ManagerLoading />),
    renderToStaticMarkup(<TenantLoading />),
    renderToStaticMarkup(<PublicLoading />),
  ]) {
    expect(page).toContain('role="status"');
    expect(page).toContain('Loading page…');
  }
});

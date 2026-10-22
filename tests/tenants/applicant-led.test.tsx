// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const setHeader = vi.fn();
const list = vi.fn();
const redirect = vi.fn((href: string) => {
  throw new Error(`NEXT_REDIRECT ${href}`);
});

vi.mock('next/navigation', () => ({
  redirect: (href: string) => redirect(href),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/tenants',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org-demo' }),
}));
vi.mock('@/components/shell/PageHeader', () => ({
  PageHeader: (props: unknown) => {
    setHeader(props);
    return null;
  },
}));
vi.mock('@/lib/tenants/queries', () => ({
  organizationTenants: () => ({
    list,
    stats: async () => ({
      activeTenants: 0,
      moveIns30: 0,
      endingSoon: 0,
      outstandingCents: 0,
      lateTenants: 0,
    }),
    formOptions: async () => [{ id: 'maple', name: 'Maple Court', units: [] }],
    setupRows: async () => [],
  }),
}));

const { default: TenantsPage } = await import('@/app/(manager)/tenants/page');

async function renderPage(params: Record<string, string>) {
  render(await TenantsPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  list.mockResolvedValue({ rows: [], total: 0 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('applicant-led tenant directory', () => {
  it('leads the header and empty state to Applications instead of a create form', async () => {
    await renderPage({ view: 'directory' });
    expect(setHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          {
            label: 'Review applications',
            href: '/applications',
            primary: true,
            icon: 'arrow-right',
          },
        ],
      }),
    );
    expect(screen.getByRole('heading', { name: 'No tenants yet' })).toBeTruthy();
    expect(screen.getByText(/approved applicant moves in/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review applications' }).getAttribute('href')).toBe(
      '/applications',
    );
    expect(screen.queryByRole('link', { name: /Add (a )?tenant/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the selected property on the Applications route', async () => {
    await renderPage({ view: 'directory', property: 'maple' });
    expect(setHeader.mock.calls[0][0].actions[0].href).toBe('/applications?propertyId=maple');
  });

  it('sends legacy ?add=1 links to Applications with property scope', async () => {
    await expect(renderPage({ property: 'maple', add: '1' })).rejects.toThrow(
      'NEXT_REDIRECT /applications?propertyId=maple',
    );
    await expect(renderPage({ view: 'status', add: '1' })).rejects.toThrow(
      'NEXT_REDIRECT /applications',
    );
    expect(list).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PromoteApplicant } from '@/components/applications/PromoteApplicant';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('tenant promotion UI', () => {
  it('confirms an existing match before linking and exposes the stable tenant and lease selection links', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'confirmation-required',
          tenant: { id: 'saved', name: 'Saved Name', email: 'saved@example.test', phone: null },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'promoted', tenantId: 'saved', reused: true }),
      });
    vi.stubGlobal('fetch', fetch);
    render(<PromoteApplicant applicationId="app" unitId="unit" tenantId={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Promote to tenant' }));
    await screen.findByText('Saved Name');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Create lease' })).toBeNull();
    // The existing-contact confirmation is a modal naming the matched email.
    const dialog = await screen.findByRole('dialog', {
      name: 'Promote to tenant · existing contact',
    });
    expect(within(dialog).getByText('saved@example.test')).toBeTruthy();
    expect(within(dialog).getByText('This email already belongs to a tenant')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use existing tenant' }));
    await screen.findByRole('link', { name: 'View tenant' });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ existingTenantId: 'saved' });
    expect(screen.getByRole('link', { name: 'Create lease' }).getAttribute('href')).toBe(
      '/leases/new?unit=unit&tenant=saved',
    );
  });
  it('retains a useful retry after server rejection without a false success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Only approved applicants can be promoted.' }),
      }),
    );
    render(<PromoteApplicant applicationId="app" unitId="unit" tenantId={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Promote to tenant' }));
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Promote to tenant' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.queryByRole('link', { name: 'Create lease' })).toBeNull();
  });
});

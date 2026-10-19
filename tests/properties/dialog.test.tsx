// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AddPropertyDialog } from '@/app/(manager)/properties/_components/AddPropertyDialog';
const nav = vi.hoisted(() => ({
  params: new URLSearchParams('view=list&filter=multi&q=Oak&add=1'),
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/properties',
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => nav.params,
}));
vi.mock('@/app/(manager)/properties/actions', () => ({
  createPropertyAction: vi.fn(async () => ({})),
  setPropertyArchivedAction: vi.fn(),
}));
beforeEach(() => {
  nav.params = new URLSearchParams('view=list&filter=multi&q=Oak&add=1');
  nav.replace.mockClear();
  vi.spyOn(window.history, 'replaceState').mockImplementation(nav.replace);
  vi.stubGlobal('location', { search: '?view=list&filter=multi&q=Oak&add=1' });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
});
it('focuses the first input, locks scrolling and removes only add on cancellation', async () => {
  render(<AddPropertyDialog owners={[]} />);
  const input = screen.getByRole('textbox', { name: 'Property name' });
  expect(document.activeElement).toBe(input);
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(nav.replace).toHaveBeenCalledWith(null, '', '/properties?view=list&filter=multi&q=Oak');
});
it('closes after URL navigation and resets cancelled values on the next opening', async () => {
  const { rerender } = render(<AddPropertyDialog owners={[]} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Property name' }), {
    target: { value: 'Unsaved fixture' },
  });
  nav.params = new URLSearchParams('view=list');
  rerender(<AddPropertyDialog owners={[]} />);
  await waitFor(() => expect(document.querySelector('dialog')?.open).toBe(false));
  expect(document.body.style.overflow).toBe('');
  nav.params = new URLSearchParams('view=list&add=1');
  rerender(<AddPropertyDialog owners={[]} />);
  expect((screen.getByRole('textbox', { name: 'Property name' }) as HTMLInputElement).value).toBe(
    '',
  );
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ value: '/tenants' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname.value,
}));

import { PageHeader } from '@/components/shell/PageHeader';
import { ManagerShell } from '@/components/shell/ManagerShell';
import {
  Button,
  ConfirmButton,
  ConfirmDialog,
  Dialog,
  Field,
  FilterBar,
  NoticeToast,
  RowMenu,
  SearchField,
  Table,
  Tabs,
  ToastProvider,
  useToast,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/RouteStates';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

beforeEach(() => {
  replace.mockClear();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('Table card mode and row links', () => {
  it('marks the table for card layout and keeps data-cell slots', () => {
    const out = html(
      <Table mobile="cards" className="table-sticky">
        <tbody>
          <tr className="row-link">
            <td data-cell="title">
              <a className="row-anchor" href="/leases/1">
                Alex
              </a>
            </td>
            <td data-cell="amount" className="num">
              $1,850
            </td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(out).toContain('class="table table-sticky"');
    expect(out).toContain('data-mobile="cards"');
    expect(out).toContain('data-cell="title"');
    expect(out).toContain('class="row-anchor"');
  });
});

describe('Button icon', () => {
  it('renders a stroked icon before the label instead of a typed plus', () => {
    const out = html(
      <Button variant="primary" icon="plus">
        Add tenant
      </Button>,
    );
    expect(out).toMatch(/<button class="btn btn-primary" type="button"><svg/);
    expect(out).toContain('Add tenant');
    expect(out).not.toContain('+ Add');
    expect(
      html(
        <Button href="/x" icon="arrow-right">
          Go
        </Button>,
      ),
    ).toContain('<svg');
  });
});

describe('Field', () => {
  it('renders label, optional tag, control, hint and error in order', () => {
    const out = html(
      <Field label="Phone" optional hint="Digits only" error="Enter a phone">
        <input name="phone" />
      </Field>,
    );
    const order = [
      'field-label',
      'Phone',
      'optional',
      '<input',
      'hint',
      'Digits only',
      'field-error',
    ];
    let at = -1;
    for (const token of order) {
      const next = out.indexOf(token, at + 1);
      expect(next, token).toBeGreaterThan(at);
      at = next;
    }
    expect(out).toContain('role="alert"');
  });
});

describe('Dialog and ConfirmDialog', () => {
  it('opens as a modal with title, close button and focused Cancel, and closes on cancel', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Refund $1,850?"
        description="The tenant is credited and the ledger reopens."
        confirmLabel="Refund"
        onConfirm={onConfirm}
      />,
    );
    const dialog = document.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.className).toContain('dialog-sm');
    expect(screen.getByRole('heading', { name: 'Refund $1,850?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Refund' });
    expect(confirm.className).toContain('btn-danger');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancel);
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(cancel);
    expect(onClose).toHaveBeenCalled();
  });

  it('ConfirmButton posts hidden fields through a form bound to the confirm button', () => {
    const action = vi.fn();
    render(
      <ConfirmButton
        label="Refund"
        title="Refund payment?"
        confirmLabel="Refund"
        action={action}
        fields={{ paymentId: 'pay-1', month: '2026-10' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    const form = document.querySelector('dialog form')!;
    expect(form.querySelector('input[name="paymentId"]')!.getAttribute('value')).toBe('pay-1');
    expect(form.querySelector('input[name="month"]')!.getAttribute('value')).toBe('2026-10');
    const submit = screen.getAllByRole('button', { name: 'Refund' }).at(-1)!;
    expect(submit.getAttribute('type')).toBe('submit');
    expect(submit.getAttribute('form')).toBe(form.id);
  });

  it('Dialog renders eyebrow, description and footer slots', () => {
    const out = html(
      <Dialog
        open={false}
        onClose={() => {}}
        title="Add unit"
        eyebrow="Maple Court"
        footer={<b>f</b>}
      >
        body
      </Dialog>,
    );
    expect(out).toContain('class="dialog dialog-md"');
    expect(out).toContain('Maple Court');
    expect(out).toContain('dialog-foot');
  });
});

describe('Toast', () => {
  function Push() {
    const toast = useToast();
    return (
      <button
        type="button"
        onClick={() => toast.success('Jamie Doe added', { label: 'View', href: '/t/1' })}
      >
        go
      </button>
    );
  }

  it('shows a toast with role status and dismisses it after the timeout', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Push />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Jamie Doe added');
    expect(toast.querySelector('a.toast-action')!.getAttribute('href')).toBe('/t/1');
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole('status')).toBeNull();
    vi.useRealTimers();
  });

  it('NoticeToast shows the message once and strips the notice param from the URL', () => {
    window.history.replaceState({}, '', '/tenants?view=directory&notice=added');
    render(
      <ToastProvider>
        <NoticeToast message="Tenant added" />
      </ToastProvider>,
    );
    expect(screen.getByRole('status').textContent).toContain('Tenant added');
    expect(replace).toHaveBeenCalledWith('/tenants?view=directory', { scroll: false });
  });
});

describe('SearchField and FilterBar', () => {
  it('debounces typing into a URL replace that drops the page param', () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/tenants?view=directory&page=3');
    render(<SearchField placeholder="Search tenants" />);
    const input = screen.getByRole('searchbox', { name: 'Search tenants' });
    fireEvent.change(input, { target: { value: 'ali' } });
    expect(replace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).toHaveBeenCalledWith('/tenants?view=directory&q=ali', { scroll: false });
    vi.useRealTimers();
  });

  it('FilterBar is a GET form with hidden params, count and clear link, never an Apply button', () => {
    const out = html(
      <FilterBar
        action="/tenants"
        hidden={{ view: 'directory', tab: undefined }}
        count="41 tenants"
        clearHref="/tenants"
      >
        <select name="property" />
      </FilterBar>,
    );
    expect(out).toContain('method="get"');
    expect(out).toContain('role="search"');
    expect(out).toContain('name="view" value="directory"');
    expect(out).not.toContain('name="tab"');
    expect(out).toContain('41 tenants');
    expect(out).toContain('Clear filters');
    expect(out).not.toMatch(/Apply/);
  });
});

describe('RowMenu, Tabs, EmptyState, LoadingState', () => {
  it('RowMenu is a details menu with a labelled summary', () => {
    const out = html(
      <RowMenu label="Lease actions">
        <a href="/x">Open</a>
      </RowMenu>,
    );
    expect(out).toContain('<details class="row-menu">');
    expect(out).toContain('aria-label="Lease actions"');
    expect(out).toContain('role="menu"');
  });

  it('Tabs render counts as pills and mark the active tab', () => {
    const out = html(
      <Tabs
        items={[
          { label: 'Active', href: '/leases', active: true, count: 41 },
          { label: 'Drafts', href: '/leases?tab=drafts', count: 1 },
        ]}
      />,
    );
    expect(out).toContain('aria-current="page"');
    expect(out).toContain('<span class="count">41</span>');
  });

  it('EmptyState inline is a sentence with a link, not a box', () => {
    const out = html(
      <EmptyState size="inline" title="No drafts" action="Create a lease" href="/leases/new" />,
    );
    expect(out).toMatch(/^<p/);
    expect(out).toContain('No drafts');
    expect(out).toContain('href="/leases/new"');
    expect(out).not.toContain('<h2');
  });

  it('LoadingState keeps the label for assistive tech only and offers variants', () => {
    const out = html(<LoadingState variant="analysis" />);
    expect(out).toContain('aria-label="Loading page"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('Loading page…');
    expect(html(<LoadingState variant="detail" />)).not.toContain('tabs');
  });
});

describe('PageHeader meta and back link in the manager shell', () => {
  it('renders the meta line and breadcrumb back link under one h1', () => {
    pathname.value = '/roi-analysis';
    render(
      <ManagerShell>
        <PageHeader
          eyebrow="Returns & ROI"
          title="Maple Court"
          meta="Whole property · Revision 0"
          back={{ href: '/properties/1', label: 'Maple Court' }}
          actions={[{ label: 'Add property', href: '/p', primary: true, icon: 'plus' }]}
        />
      </ManagerShell>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maple Court');
    expect(document.querySelector('.topbar-sub')!.textContent).toBe('Whole property · Revision 0');
    expect(document.querySelector('.topbar-back')!.getAttribute('href')).toBe('/properties/1');
    const action = screen.getByRole('link', { name: 'Add property' });
    expect(action.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });

  it('keeps a single compact sidebar foot with an accessible sign-out link', () => {
    pathname.value = '/dashboard';
    render(<ManagerShell>x</ManagerShell>);
    const signOut = screen.getByRole('link', { name: 'Sign out' });
    expect(signOut.className).toBe('sidebar-signout');
    expect(document.querySelector('.sidebar-foot strong')!.textContent).toBe('Jordan Mills');
  });
});

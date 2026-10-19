// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyDraft } from '@/lib/lease-create/types';
import { withResolvedEnd } from '@/lib/lease-create/validation';
import { STANDARD_FEES, STANDARD_ITEMS } from '@/lib/lease-create/templates';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  push: vi.fn(),
  saveTemplate: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/components/shell/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/app/(manager)/leases/new/actions', () => ({
  saveWizardStepAction: mocks.save,
  sendWizardLeaseAction: vi.fn(),
  completeSigningAction: vi.fn(),
  saveTemplateFromDraftAction: vi.fn(),
}));
vi.mock('@/app/(manager)/leases/templates/actions', () => ({
  saveLeaseTemplateAction: mocks.saveTemplate,
  deleteLeaseTemplateAction: vi.fn(),
  setPropertyLeaseTemplateAction: vi.fn(),
}));
vi.mock('@/components/upload', () => ({ FileUploader: () => <div>Upload files</div> }));

import { LeaseBuilder, type LeaseBuilderProps } from '@/components/lease-builder/LeaseBuilder';
import { UnitPicker } from '@/components/lease-builder/UnitPicker';
import { TemplateEditor } from '@/app/(manager)/leases/templates/[id]/TemplateEditor';

const template = {
  id: 'template-ux',
  name: 'Review template',
  version: 2,
  items: STANDARD_ITEMS,
  defaultFees: STANDARD_FEES,
};
const props = (): LeaseBuilderProps => ({
  placeLabel: 'Maple Court · Unit 3A',
  tenants: [],
  leaseId: 'draft-ux',
  renewId: null,
  draft: withResolvedEnd(
    emptyDraft({
      unitId: 'unit-ux',
      startDate: '2035-01-01',
      monthlyRent: '1600',
      deposit: '1600',
      template,
    }),
  ),
  templates: [template],
  step: 0,
  furthestStep: 0,
  attachments: [],
  backHref: '/properties/maple/leases',
  exitHref: '/leases?tab=drafts',
});

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.save.mockResolvedValue({ ok: true, leaseId: 'draft-ux', furthestStep: 1 });
});
afterEach(cleanup);

describe('lease workflow feedback', () => {
  it('announces unsaved work, saves on Next and moves keyboard focus to the new step', async () => {
    const user = userEvent.setup();
    render(<LeaseBuilder {...props()} />);
    fireEvent.input(screen.getByLabelText(/^Start date/), { target: { value: '2035-02-01' } });
    expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Rent, deposit & fees' }),
      ),
    );
    expect(screen.getByRole('status').textContent).toBe('Draft saved');
    expect(mocks.save.mock.calls[0][0].draft.startDate).toBe('2035-02-01');
    expect(screen.getByRole('button', { name: /Lease term/ })).toBeTruthy();
  });

  it('focuses a concrete validation summary and associates errors with the field', async () => {
    const user = userEvent.setup();
    const p = props();
    p.step = 1;
    p.furthestStep = 1;
    p.draft.monthlyRent = '';
    render(<LeaseBuilder {...p} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Enter a monthly rent greater than zero.',
    );
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    const rent = screen.getByRole('textbox', { name: /^Monthly rent/ });
    expect(rent.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(rent.getAttribute('aria-describedby')!)?.textContent).toContain(
      'greater than zero',
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('retains edits and permits a retry after a save failure', async () => {
    const user = userEvent.setup();
    mocks.save.mockRejectedValueOnce(new Error('connection lost'));
    render(<LeaseBuilder {...props()} />);
    fireEvent.input(screen.getByLabelText(/^Start date/), { target: { value: '2035-03-01' } });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('still here'));
    expect((screen.getByLabelText(/^Start date/) as HTMLInputElement).value).toBe('2035-03-01');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Rent, deposit & fees' })).toBeTruthy(),
    );
  });

  it('keeps the covered shell inert for the unit picker and restores it on exit', () => {
    const sidebar = document.createElement('aside');
    sidebar.id = 'manager-sidebar';
    sidebar.inert = false;
    document.body.append(sidebar);
    const { unmount } = render(
      <UnitPicker units={[]} backHref="/leases" context={{ tenant: 'tenant-ux' }} />,
    );
    expect(sidebar.inert).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Start lease' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('No units');
    expect(document.querySelector<HTMLInputElement>('input[name="tenant"]')?.value).toBe(
      'tenant-ux',
    );
    unmount();
    expect(sidebar.inert).toBe(false);
    sidebar.remove();
  });
});

describe('template editing', () => {
  it('reorders an added clause within its section even when another section was stored between them', async () => {
    const user = userEvent.setup();
    const initial = {
      ...template,
      items: [
        {
          id: 'first',
          title: 'First clause',
          body: 'First wording',
          order: 0,
          required: false,
          section: 'CLAUSE' as const,
          includeWhen: 'ALWAYS' as const,
        },
        {
          id: 'rule',
          title: 'Quiet hours',
          body: 'Rule wording',
          order: 1,
          required: false,
          section: 'RULE' as const,
          includeWhen: 'ALWAYS' as const,
        },
      ],
    };
    mocks.saveTemplate.mockImplementation(async (input) => ({
      template: { ...initial, ...input, version: 3 },
    }));
    render(<TemplateEditor initial={initial} properties={[]} />);
    await user.click(screen.getByRole('button', { name: '+ Add clause' }));
    await user.type(screen.getByRole('textbox', { name: 'New item title' }), 'Added clause');
    await user.type(screen.getByRole('textbox', { name: 'Added clause wording' }), 'Added wording');
    await user.click(screen.getByRole('button', { name: 'Move Added clause up' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(mocks.saveTemplate).toHaveBeenCalledOnce());
    expect(
      mocks.saveTemplate.mock.calls[0][0].items
        .filter((item: { section: string }) => item.section === 'CLAUSE')
        .map((item: { title: string }) => item.title),
    ).toEqual(['Added clause', 'First clause']);
    expect(screen.getByText('Saved version 3.')).toBeTruthy();
  });

  it('expands incomplete wording and recovers from a rejected save without discarding edits', async () => {
    const user = userEvent.setup();
    render(<TemplateEditor initial={{ ...template, items: [] }} properties={[]} />);
    await user.click(screen.getByRole('button', { name: '+ Add rule' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(screen.getByText(/Complete the title and wording/)).toBeTruthy();
    expect(mocks.saveTemplate).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: 'New item title' }), 'Quiet hours');
    await user.type(
      screen.getByRole('textbox', { name: 'Quiet hours wording' }),
      'Keep noise low.',
    );
    mocks.saveTemplate.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(screen.getByText(/Your edits are still here/)).toBeTruthy());
    expect(
      (screen.getByRole('textbox', { name: 'Quiet hours wording' }) as HTMLTextAreaElement).value,
    ).toBe('Keep noise low.');
    expect(
      (screen.getByRole('button', { name: 'Save template' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

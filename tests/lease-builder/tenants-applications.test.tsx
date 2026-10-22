// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emptyDraft, STEP } from '@/lib/lease-create/types';
import { withResolvedEnd } from '@/lib/lease-create/validation';
import { STANDARD_FEES, STANDARD_ITEMS } from '@/lib/lease-create/templates';

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/app/(manager)/leases/new/actions', () => ({
  saveWizardStepAction: mocks.save,
  sendWizardLeaseAction: vi.fn(),
}));
vi.mock('@/app/(manager)/leases/actions', () => ({ deleteDraftLeaseAction: vi.fn() }));
vi.mock('@/components/upload', () => ({ FileUploader: () => <div>Upload files</div> }));

import { LeaseBuilder, type LeaseBuilderProps } from '@/components/lease-builder/LeaseBuilder';

const template = {
  id: 'template-synthetic',
  name: 'Synthetic template',
  version: 1,
  items: STANDARD_ITEMS,
  defaultFees: STANDARD_FEES,
};
const tenant = { id: 'tenant-synthetic', name: 'Synthetic Tenant', email: 'tenant@example.test' };
const props = (overrides: Partial<LeaseBuilderProps> = {}): LeaseBuilderProps => ({
  placeLabel: 'Synthetic Court · Unit 2',
  tenants: [tenant],
  applicants: [
    {
      id: 'app-promoted',
      name: 'Synthetic Tenant',
      email: 'tenant@example.test',
      status: 'Approved',
      tenantId: tenant.id,
    },
    { id: 'app-new', name: 'Pending Applicant', email: 'pending@example.test', status: 'Approved' },
  ],
  leaseId: 'draft-synthetic',
  renewId: null,
  draft: withResolvedEnd(
    emptyDraft({
      unitId: 'unit-synthetic',
      startDate: '2035-01-01',
      monthlyRent: '1600',
      deposit: '1600',
      template,
    }),
  ),
  templates: [template],
  step: STEP.tenants,
  furthestStep: STEP.tenants,
  attachments: [],
  backHref: '/properties/property-synthetic/leases',
  exitHref: '/leases?tab=drafts',
  ...overrides,
});

const scoped = '/applications?propertyId=property-synthetic&unitId=unit-synthetic';
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.save.mockResolvedValue({ ok: true, leaseId: 'draft-synthetic', furthestStep: 2 });
  assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
});
afterEach(cleanup);

describe('Tenants step routes new people through Applications', () => {
  it('never links to standalone tenant creation', () => {
    const { container, unmount } = render(<LeaseBuilder {...props()} />);
    expect(container.querySelector('a[href*="/tenants"]')).toBeNull();
    expect(screen.queryByText(/Add (a new )?tenant/i)).toBeNull();
    unmount();
    const empty = render(<LeaseBuilder {...props({ tenants: [], applicants: [] })} />);
    expect(empty.container.querySelector('a[href*="/tenants"]')).toBeNull();
    expect(screen.getByText(/No tenants yet\. Tenants are added by approving/)).toBeTruthy();
  });

  it('scopes Applications links to the property and unit', () => {
    render(<LeaseBuilder {...props()} />);
    expect(
      screen.getByRole('link', { name: 'Review applicants for this unit' }).getAttribute('href'),
    ).toBe(scoped);
    expect(
      screen
        .getByRole('link', { name: "Review Pending Applicant's application" })
        .getAttribute('href'),
    ).toBe(`${scoped}&applicant=app-new#selected-applicant`);
  });

  it('keeps applicants distinct from tenants until promotion', () => {
    render(<LeaseBuilder {...props()} />);
    // The promoted applicant is selectable; the unpromoted one has no checkbox.
    expect(screen.getByRole('checkbox', { name: 'Synthetic Tenant' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Pending Applicant/ })).toBeNull();
    expect(screen.getByText(/Not a tenant yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Tenant' }));
    expect(screen.getByRole('button', { name: 'Remove Synthetic Tenant' })).toBeTruthy();
  });

  it('saves the draft progress before leaving for Applications', async () => {
    render(<LeaseBuilder {...props()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Synthetic Tenant' }));
    fireEvent.click(screen.getByRole('link', { name: 'Review applicants for this unit' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(scoped));
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseId: 'draft-synthetic',
        step: STEP.tenants,
        nextStep: STEP.tenants,
        strict: false,
        draft: expect.objectContaining({ tenantIds: [tenant.id], primaryTenantId: tenant.id }),
      }),
    );
  });

  it('stays in the wizard when the save fails', async () => {
    mocks.save.mockResolvedValue({ ok: false, message: 'Could not save.' });
    render(<LeaseBuilder {...props()} />);
    fireEvent.click(screen.getByRole('link', { name: "Review Pending Applicant's application" }));
    expect(await screen.findByText('Could not save.')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves modified clicks to the browser so a new tab keeps the wizard open', () => {
    render(<LeaseBuilder {...props()} />);
    fireEvent.click(screen.getByRole('link', { name: 'Review applicants for this unit' }), {
      ctrlKey: true,
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

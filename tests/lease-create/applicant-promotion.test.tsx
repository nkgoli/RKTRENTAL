// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { emptyDraft } from '@/lib/lease-create/types';
import { STANDARD_FEES, STANDARD_ITEMS } from '@/lib/lease-create/templates';
import type { LeaseBuilderProps } from '@/components/lease-builder/LeaseBuilder';
import { TenantsStep } from '@/components/lease-builder/steps';

const mocks = vi.hoisted(() => ({
  application: vi.fn(),
  applications: vi.fn(),
  options: vi.fn(),
  detail: vi.fn(),
  draft: vi.fn(),
  openDraft: vi.fn(),
  renewal: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('NOT_FOUND');
  },
  redirect: vi.fn(),
}));
vi.mock('@/components/lease-builder', () => ({ LeaseBuilder: () => null }));
vi.mock('@/components/lease-builder/UnitPicker', () => ({ UnitPicker: () => null }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org' }),
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    application: { findFirst: mocks.application, findMany: mocks.applications },
    organization: { findUnique: async () => ({ name: 'Manager' }) },
    document: { findMany: async () => [] },
  },
}));
vi.mock('@/lib/leases/queries', () => ({
  leasesDb: () => ({ formOptions: mocks.options, detail: mocks.detail }),
}));
vi.mock('@/lib/lease-create', async (original) => ({
  ...(await original<object>()),
  loadLeaseDraft: mocks.draft,
  findOpenDraft: mocks.openDraft,
  renewalDefaults: mocks.renewal,
}));
const template = {
  id: 'template',
  name: 'Standard',
  version: 1,
  items: STANDARD_ITEMS,
  defaultFees: STANDARD_FEES,
};
vi.mock('@/lib/lease-create/template-service', () => ({
  listTemplates: async () => ({ templates: [template], properties: [] }),
}));
const { default: NewLeasePage } = await import('@/app/(manager)/leases/new/page');
const tenants = [
  { id: 'saved', name: 'Promoted contact', email: 'edited@example.test' },
  { id: 'collision', name: 'Different contact', email: 'original@example.test' },
];
const unit = {
  id: 'unit',
  propertyId: 'property',
  number: '1',
  property: {
    name: 'Home',
    type: 'MULTI_UNIT',
    street: '1 Main',
    city: 'Test',
    state: 'CA',
    postalCode: '00000',
  },
};
const application = (status = 'APPROVED', promotedTenantId: string | null = 'saved') => ({
  id: 'app',
  organizationId: 'org',
  unitId: 'unit',
  applicantName: 'Original Applicant',
  applicantEmail: 'original@example.test',
  status,
  promotedTenantId,
});
async function page(params: Record<string, string> = {}) {
  const result = await NewLeasePage({
    searchParams: Promise.resolve({ unit: 'unit', fresh: '1', ...params }),
  });
  return result.props as LeaseBuilderProps;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.options.mockResolvedValue({ units: [unit], tenants });
  mocks.application.mockResolvedValue(application());
  mocks.applications.mockResolvedValue([application()]);
  mocks.draft.mockResolvedValue(null);
  mocks.openDraft.mockResolvedValue(null);
});
afterEach(cleanup);

describe('applicant-derived lease tenant identity', () => {
  it('uses the saved association in general selection after an email collision', async () => {
    const props = await page();
    expect(props.draft.tenantIds).toEqual([]);
    expect(props.applicants?.[0].tenantId).toBe('saved');
    expect(mocks.applications).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org', unitId: 'unit', status: { in: ['APPROVED', 'REVIEW'] } },
        select: expect.objectContaining({ promotedTenantId: true }),
      }),
    );
    const update = vi.fn();
    render(<TenantsStep {...props} update={update} errors={{}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Original Applicant' }));
    expect(update).toHaveBeenCalledWith({ tenantIds: ['saved'], primaryTenantId: 'saved' });
  });
  it('uses the saved association for legacy applicant URLs', async () => {
    const props = await page({ applicant: 'app' });
    expect(props.draft.tenantIds).toEqual(['saved']);
    expect(props.draft.primaryTenantId).toBe('saved');
    expect(mocks.application).toHaveBeenCalledWith({ where: { id: 'app', organizationId: 'org' } });
  });
  it.each(['REVIEW', 'DRAFT', 'SUBMITTED', 'SCREENING', 'DECLINED', 'INVITED'])(
    'does not infer promotion for %s applicants',
    async (status) => {
      mocks.application.mockResolvedValue(application(status));
      mocks.applications.mockResolvedValue([application(status)]);
      const props = await page({ applicant: 'app' });
      expect(props.draft.tenantIds).toEqual([]);
      expect(props.applicants?.[0].tenantId).toBeUndefined();
      expect(props.noticeApplicantId).toBe('app');
    },
  );
  it.each([null, 'foreign-tenant', 'missing-tenant'])(
    'does not link approved applicants without an available scoped promotion (%s)',
    async (id) => {
      mocks.application.mockResolvedValue(application('APPROVED', id));
      mocks.applications.mockResolvedValue([application('APPROVED', id)]);
      const props = await page({ applicant: 'app' });
      expect(props.draft.tenantIds).toEqual([]);
      expect(props.applicants?.[0].tenantId).toBeUndefined();
      expect(props.notice).toContain('explicit promotion');
      const onReviewApplicants = vi.fn();
      render(
        <TenantsStep
          {...props}
          update={vi.fn()}
          errors={{}}
          onReviewApplicants={onReviewApplicants}
        />,
      );
      expect(screen.queryByRole('checkbox', { name: 'Original Applicant' })).toBeNull();
      fireEvent.click(screen.getByRole('link', { name: 'Review application' }));
      expect(onReviewApplicants).toHaveBeenCalledWith(
        '/applications?unitId=unit&applicant=app#selected-applicant',
      );
    },
  );
  it('preserves deliberate tenant selection, including an unpromoted same-email applicant', async () => {
    mocks.application.mockResolvedValue(application('REVIEW', null));
    expect((await page({ applicant: 'app', tenant: 'collision' })).draft.tenantIds).toEqual([
      'collision',
    ]);
    expect((await page({ tenant: 'saved' })).draft.tenantIds).toEqual(['saved']);
    expect((await page({ tenant: 'foreign' })).draft.tenantIds).toEqual([]);
  });
  it('preserves saved draft selections and step despite applicant and tenant URL hints', async () => {
    mocks.draft.mockResolvedValue({
      leaseId: 'draft',
      unitId: 'unit',
      step: 2,
      furthestStep: 4,
      draft: emptyDraft({ tenantIds: ['collision'], primaryTenantId: 'collision' }),
    });
    const props = await page({ draft: 'draft', applicant: 'app', tenant: 'saved' });
    expect(props.draft.tenantIds).toEqual(['collision']);
    expect(props.draft.primaryTenantId).toBe('collision');
    expect(props.step).toBe(2);
    expect(props.furthestStep).toBe(4);
  });
  it('preserves renewal tenants despite applicant and tenant URL hints', async () => {
    mocks.detail.mockResolvedValue({
      id: 'renew',
      status: 'ACTIVE',
      unitId: 'unit',
      unit,
      tenants: [{ isPrimary: true, tenant: tenants[1] }],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      petDeposit: 0,
    });
    mocks.renewal.mockReturnValue(
      emptyDraft({ tenantIds: ['collision'], primaryTenantId: 'collision' }),
    );
    const props = await page({ renew: 'renew', applicant: 'app', tenant: 'saved' });
    expect(props.draft.tenantIds).toEqual(['collision']);
    expect(props.draft.primaryTenantId).toBe('collision');
  });
});

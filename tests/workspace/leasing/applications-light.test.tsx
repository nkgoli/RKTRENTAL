// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicationsPage from '@/app/(manager)/applications/page';
import { ApplicationsPanel } from '@/components/workspace/panels/leasing/ApplicationsPanel';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  findFirst: vi.fn(),
  connections: vi.fn(),
  integrations: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    application: {
      findMany: mocks.findMany,
      count: mocks.count,
      groupBy: mocks.groupBy,
      findFirst: mocks.findFirst,
    },
    providerConnection: { findMany: mocks.connections },
  },
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org' }),
}));
vi.mock('@/lib/integrations/service', () => ({ loadIntegrations: mocks.integrations }));
vi.mock('@/components/workspace/ScopedWorkspace', () => ({ ScopedWorkspace: () => null }));
vi.mock('@/components/shell/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/app/(manager)/applications/actions', () => ({
  recordDecision: vi.fn(),
  requestScreening: vi.fn(),
}));
vi.mock('@/components/workspace/panels/leasing/actions', () => ({
  saveApplicationSettingsAction: vi.fn(),
}));

const application = () => ({
  id: 'app',
  applicantName: 'Nina Park',
  applicantEmail: 'nina@example.com',
  unitId: 'unit',
  status: 'REVIEW',
  appliedAt: new Date(),
  unit: {
    id: 'unit',
    propertyId: 'property',
    number: '3A',
    isImplicit: false,
    property: { name: 'Maple Court' },
  },
  consents: [
    {
      provider: 'mock',
      consentedAt: new Date(Date.now() - 1000),
      revokedAt: null,
      consentVersion: '2026',
    },
  ],
  reports: [
    {
      provider: 'mock',
      status: 'complete',
      createdAt: new Date(),
      completedAt: new Date(),
      summary: { creditScore: 685, background: 'clear', eviction: 'clear' },
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  mocks.count.mockResolvedValue(1);
  mocks.groupBy.mockResolvedValue([]);
  mocks.connections.mockResolvedValue([]);
  mocks.findFirst.mockResolvedValue(null);
  mocks.integrations.mockResolvedValue({
    settings: {
      screening: { defaultPackage: 'smartmove-plus', applicantConsent: 'required-before-report' },
    },
  });
});
afterEach(cleanup);

describe('light application review preserves eligibility and context', () => {
  it.each(['consent', 'report', 'status'])(
    'blocks decisions when %s is unavailable',
    async (gate) => {
      const app = application();
      if (gate === 'consent') app.consents = [];
      if (gate === 'report') app.reports[0].status = 'failed';
      if (gate === 'status') app.status = 'SCREENING';
      mocks.findMany.mockResolvedValue([app]);
      render(await ApplicationsPage({ searchParams: Promise.resolve({ applicant: 'app' }) }));
      expect(screen.queryByLabelText('Decision reason')).toBeNull();
      expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect((screen.getByRole('button', { name: 'Decline' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      if (gate === 'consent')
        expect(
          (screen.getByRole('button', { name: 'Run screening again' }) as HTMLButtonElement)
            .disabled,
        ).toBe(true);
    },
  );

  it('retains filters on selection and only scope on action hidden fields', async () => {
    mocks.findMany.mockResolvedValue([application()]);
    const { container } = render(
      await ApplicationsPage({
        searchParams: Promise.resolve({
          q: 'Nina',
          status: 'REVIEW',
          propertyId: 'property',
          unitId: 'unit',
        }),
      }),
    );
    const selection = container.querySelector('a[aria-current]')!;
    expect(selection.getAttribute('href')).toContain(
      'q=Nina&status=REVIEW&propertyId=property&unitId=unit&applicant=app',
    );
    expect(
      screen.getByRole('link', { name: /Back to property applications/ }).getAttribute('href'),
    ).toBe('/properties/property/applications?unit=unit');
    expect(container.querySelector('input[name="applicationId"]')?.getAttribute('value')).toBe(
      'app',
    );
    expect(
      container.querySelector('input[name="unitId"][type="hidden"]')?.getAttribute('value'),
    ).toBe('unit');
    expect(screen.getByLabelText('Decision reason')).toBeTruthy();
  });
});

describe('property applicants', () => {
  it('shows archived-only recovery and keeps unit context on the toggle', async () => {
    mocks.findMany.mockResolvedValue([
      {
        ...application(),
        applicationGroupId: 'archived',
        applicationGroup: { status: 'DECLINED', archivedAt: new Date() },
      },
    ]);
    render(
      await ApplicationsPanel({
        organizationId: 'org',
        scope: { propertyId: 'property', unitId: 'unit' },
        hideArchived: true,
      }),
    );
    expect(screen.getByText('Nothing active')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Show archived' }).getAttribute('href')).toBe(
      '/properties/property/applications?unit=unit',
    );
  });

  it('paginates households rather than applicants and retains archive filtering', async () => {
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        ...application(),
        id: `app-${index}`,
        applicationGroupId: `household-${index}`,
        applicationGroup: { status: 'REVIEW', archivedAt: null },
      })),
    );
    const { container } = render(
      await ApplicationsPanel({
        organizationId: 'org',
        scope: { propertyId: 'property', unitId: 'unit' },
        hideArchived: true,
        page: '2',
      }),
    );
    expect(container.querySelectorAll('[data-application-group]').length).toBe(5);
    expect(screen.getByRole('link', { name: /Prev/ }).getAttribute('href')).toBe(
      '/properties/property/applications?hideArchived=1&unit=unit',
    );
  });

  it('keeps separate households sharing a unit and updates the package readout', async () => {
    const app = application();
    mocks.findMany.mockResolvedValue([
      {
        ...app,
        applicationGroupId: 'one',
        applicationGroup: { status: 'REVIEW', archivedAt: null },
      },
      {
        ...app,
        id: 'other',
        applicantName: 'Olivia Reed',
        applicationGroupId: 'two',
        applicationGroup: { status: 'APPROVED', archivedAt: null },
        status: 'APPROVED',
      },
    ]);
    const { container } = render(
      await ApplicationsPanel({
        organizationId: 'org',
        scope: { propertyId: 'property', unitId: 'unit' },
      }),
    );
    expect(container.querySelectorAll('[data-application-group]').length).toBe(2);
    expect(screen.getByRole('link', { name: /Nina Park/ }).getAttribute('href')).toBe(
      '/applications?propertyId=property&unitId=unit&applicant=app#selected-applicant',
    );
    const form = container.querySelector('form')!;
    expect(new FormData(form).get('applicantConsent')).toBe('required-before-report');
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'checkr-background');
    expect(screen.getByText('Checkr · background check', { selector: 'small' })).toBeTruthy();
    expect(new FormData(form).get('defaultPackage')).toBe('checkr-background');
  });
});

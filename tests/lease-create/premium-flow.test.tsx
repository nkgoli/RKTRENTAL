// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyDraft, STEP } from '@/lib/lease-create/types';
import { STANDARD_FEES } from '@/lib/lease-create/templates';
import { UnitPicker } from '@/components/lease-builder/UnitPicker';
import { TenantsStep } from '@/components/lease-builder/steps';
import { TemplateTermsStep } from '@/components/lease-builder/TemplateTermsStep';
import { LeaseBuilder } from '@/components/lease-builder/LeaseBuilder';

vi.mock('@/app/(manager)/leases/new/actions', () => ({
  saveWizardStepAction: vi.fn(),
  sendWizardLeaseAction: vi.fn(),
  completeSigningAction: vi.fn(),
  saveTemplateFromDraftAction: vi.fn(),
}));
vi.mock('@/components/upload', () => ({ FileUploader: () => null }));
afterEach(cleanup);
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const template = {
  id: 'terms',
  name: 'Standard',
  version: 1,
  defaultFees: STANDARD_FEES,
  items: [
    {
      id: 'aquarium',
      title: 'Aquariums',
      body: 'No aquariums over {{aquarium_gallons}} gallons.',
      order: 0,
      required: true,
      section: 'RULE' as const,
      includeWhen: 'ALWAYS' as const,
    },
  ],
};

it('presents a saved draft explicitly and preserves it when starting a separate lease', async () => {
  const user = userEvent.setup();
  render(
    <UnitPicker
      backHref="/leases"
      units={[
        {
          id: 'unit',
          label: 'Maple Court · Unit 3A',
          status: 'VACANT',
          draft: { id: 'draft', saved: 'Oct 21', step: 10 },
        },
      ]}
    />,
  );
  expect(screen.getByRole('option', { name: /Draft in progress/ })).toBeTruthy();
  await user.selectOptions(screen.getByRole('combobox'), 'unit');
  expect(screen.getByRole('link', { name: 'Resume draft' }).getAttribute('href')).toBe(
    '/leases/new?draft=draft',
  );
  expect(screen.getByRole('status').textContent).toContain('Step 10 of 10');
  expect(screen.getByRole('button', { name: 'Start a separate lease' })).toBeTruthy();
  expect(document.querySelector<HTMLInputElement>('input[name="fresh"]')?.value).toBe('1');
});

it('bounds directory search to eight results, surfaces unit applicants and keeps selected tenants', async () => {
  const user = userEvent.setup();
  const tenants = Array.from({ length: 41 }, (_, index) => ({
    id: `t${index}`,
    name: `Tenant ${index}`,
    email: `tenant${index}@example.com`,
  }));
  function Tenants() {
    const [draft, setDraft] = useState(emptyDraft());
    return (
      <TenantsStep
        draft={draft}
        update={(patch) => setDraft({ ...draft, ...patch })}
        errors={{ tenantIds: 'Select at least one tenant.' }}
        tenants={tenants}
        applicants={[
          {
            id: 'application',
            name: 'Tenant 40',
            email: 'tenant40@example.com',
            status: 'Approved',
            tenantId: 't40',
          },
        ]}
      />
    );
  }
  render(<Tenants />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  expect(screen.getByRole('group', { name: 'Tenants' }).getAttribute('aria-describedby')).toBe(
    'tenant-selection-error',
  );
  await user.type(screen.getByRole('searchbox'), 'Tenant');
  expect(screen.getAllByRole('checkbox')).toHaveLength(9);
  await user.click(screen.getByRole('checkbox', { name: /Tenant 0/ }));
  await user.clear(screen.getByRole('searchbox'));
  expect(screen.getByRole('button', { name: 'Remove Tenant 0' })).toBeTruthy();
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('t0');
});

it('keeps a fill-in editable after its first character and prevents sending unresolved wording', async () => {
  const user = userEvent.setup();
  function Terms() {
    const [draft, setDraft] = useState(emptyDraft({ template }));
    return (
      <TemplateTermsStep
        section="RULE"
        draft={draft}
        update={(patch) => setDraft({ ...draft, ...patch })}
        templates={[template]}
        isRenewal={false}
      />
    );
  }
  const { unmount } = render(<Terms />);
  expect(screen.queryByRole('combobox', { name: 'Lease template' })).toBeNull();
  await user.click(screen.getByRole('button', { name: /Aquariums/ }));
  await user.type(screen.getByRole('textbox', { name: 'Fill aquarium gallons' }), '25');
  expect(
    (screen.getByRole('textbox', { name: 'Fill aquarium gallons' }) as HTMLInputElement).value,
  ).toBe('25');
  expect(screen.queryByText(/terms have blanks to fill/)).toBeNull();
  unmount();
  render(
    <LeaseBuilder
      placeLabel="Maple Court"
      tenants={[]}
      leaseId="draft"
      renewId={null}
      draft={emptyDraft({ template })}
      templates={[template]}
      step={STEP.review}
      furthestStep={STEP.review}
      attachments={[]}
      backHref="/leases"
      exitHref="/leases"
    />,
  );
  expect(
    (screen.getByRole('button', { name: 'Send for e-signature' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByText('Complete the agreement before sending')).toBeTruthy();
});

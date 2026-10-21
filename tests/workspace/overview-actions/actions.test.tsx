// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { WorkspaceTabs } from '@/components/workspace/WorkspaceTabs';
import { PropertyFactsCard, UnitFactsCard } from '@/components/workspace/InlineFacts';
import { workspaceTabHref } from '@/components/workspace/routes';

const nav = vi.hoisted(() => ({ query: '', pathname: '/properties/p1', update: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.query),
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/app/(manager)/properties/actions', () => ({ updateUnitAction: nav.update }));

const scope = {
  propertyId: 'p1',
  propertyName: 'Cedar Row',
  propertyType: 'MULTI_UNIT',
  activeUnitCount: 2,
};
const units = [
  { id: 'u1', number: 'Townhome 1', isImplicit: false, status: 'OCCUPIED' },
  { id: 'u2', number: 'Townhome 2', isImplicit: false, status: 'VACANT' },
];
const facts = {
  number: 'Townhome 1',
  status: 'OCCUPIED',
  bedrooms: 2,
  bathrooms: 1.5,
  squareFeet: 900,
  floor: 1,
  listedRent: 1650,
  marketRent: 1725,
  amenities: ['Garage'],
};

afterEach(() => {
  cleanup();
  nav.query = '';
  nav.update.mockReset();
});

describe('overview actions', () => {
  it('has one property editor and one scoped Returns & ROI workspace entry', () => {
    nav.query = 'unit=u1';
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(
      <>
        <WorkspaceHeader scope={scope} units={units} />
        <WorkspaceTabs propertyId="p1" />
        <PropertyFactsCard
          propertyId="p1"
          initial={{
            name: 'Cedar Row',
            type: 'MULTI_UNIT',
            street: '9 Cedar Row',
            city: 'Austin',
            state: 'TX',
            postalCode: '78702',
            yearBuilt: 2000,
            ownerId: null,
          }}
          owners={[]}
          address="9 Cedar Row"
          typeLabel="Multi-unit"
          unitSummary="2 units"
          ownerName="No owner"
        />
        <UnitFactsCard
          propertyId="p1"
          unitId="u1"
          implicit={false}
          hasActiveLease
          initial={facts}
        />
      </>,
    );
    expect(screen.getAllByRole('link', { name: 'Edit property' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Edit property' }).getAttribute('href')).toBe(
      '/properties/p1/edit',
    );
    expect(screen.queryByRole('link', { name: 'Open ROI analysis' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit unit' })).toBeTruthy();
    expect(
      within(screen.getByRole('navigation', { name: 'Workspace sections' }))
        .getByRole('link', { name: /Returns & ROI/ })
        .getAttribute('href'),
    ).toBe('/properties/p1/returns?unit=u1');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Cedar Row · Unit Townhome 1',
    );
  });

  it('cancels unit changes and saves only the selected unit while keeping active-lease status locked', async () => {
    const user = userEvent.setup();
    nav.update.mockResolvedValue({ ok: true });
    render(
      <UnitFactsCard propertyId="p1" unitId="u1" implicit={false} hasActiveLease initial={facts} />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit unit' }));
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText('Occupied while a lease is active.')).toBeTruthy();
    await user.clear(screen.getByLabelText('Bedrooms'));
    await user.type(screen.getByLabelText('Bedrooms'), '3');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(nav.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Edit unit' }));
    expect((screen.getByLabelText('Bedrooms') as HTMLInputElement).value).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Edit unit' });
    const data = nav.update.mock.calls[0][1] as FormData;
    expect(data.get('propertyId')).toBe('p1');
    expect(data.get('unitId')).toBe('u1');
    expect(data.has('status')).toBe(false);
  });

  it('leaves invalid unit edits open with their field error', async () => {
    nav.update.mockResolvedValue({ errors: { bedrooms: 'Enter a valid bedroom count.' } });
    const user = userEvent.setup();
    render(
      <UnitFactsCard propertyId="p1" unitId="u1" implicit={false} hasActiveLease initial={facts} />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit unit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Enter a valid bedroom count.');
    expect(screen.getByLabelText('Bedrooms').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('carries report dates across tabs without carrying one-shot flags', () => {
    expect(
      workspaceTabHref(
        'p1',
        'returns',
        'u 1',
        new URLSearchParams('period=CUSTOM&from=2026-01&to=2026-06&notice=saved'),
      ),
    ).toBe('/properties/p1/returns?unit=u%201&period=CUSTOM&from=2026-01&to=2026-06');
  });
});

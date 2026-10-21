// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PropertyFactsCard, UnitFactsCard } from '@/components/workspace/InlineFacts';
import { updateUnitAction } from '@/app/(manager)/properties/actions';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/properties/saved-home',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/(manager)/properties/actions', () => ({
  updateUnitAction: vi.fn(async () => ({ ok: true })),
}));
afterEach(cleanup);

it('offers one dedicated property editor in the header and read-only property facts', () => {
  render(
    <>
      <WorkspaceHeader
        scope={{
          propertyId: 'saved-home',
          propertyName: 'Saved home',
          propertyType: 'MULTI_UNIT',
          activeUnitCount: 2,
        }}
        units={[]}
      />
      <PropertyFactsCard
        propertyId="saved-home"
        initial={{
          name: 'Saved home',
          type: 'MULTI_UNIT',
          street: '1 Main',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          yearBuilt: 2001,
          ownerId: null,
        }}
        owners={[]}
        address="1 Main"
        typeLabel="Multi-unit"
        unitSummary="2 units"
        ownerName="No owner"
      />
    </>,
  );
  expect(screen.getAllByRole('link', { name: 'Edit property' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Edit property' }).getAttribute('href')).toBe(
    '/properties/saved-home/edit',
  );
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  expect(document.querySelector('form')).toBeNull();
});

it('keeps unit facts editing inline and uses the unchanged unit action', async () => {
  render(
    <UnitFactsCard
      propertyId="saved-home"
      unitId="unit-a"
      implicit={false}
      hasActiveLease={false}
      initial={{
        number: 'A',
        status: 'VACANT',
        bedrooms: 1,
        bathrooms: 1,
        squareFeet: 500,
        listedRent: 1000,
        marketRent: null,
        floor: 0,
        amenities: [],
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit unit' }));
  fireEvent.change(screen.getByLabelText('Bedrooms'), { target: { value: '2' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
  await waitFor(() => expect(updateUnitAction).toHaveBeenCalledOnce());
  const data = vi.mocked(updateUnitAction).mock.calls[0][1];
  expect(data.get('unitId')).toBe('unit-a');
  expect(data.get('bedrooms')).toBe('2');
  expect(screen.getByRole('button', { name: 'Edit unit' })).toBeTruthy();
});

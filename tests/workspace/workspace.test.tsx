import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Workspace } from '@/components/workspace/Workspace';
import { ReturnsWorkspace } from '@/components/workspace/ReturnsWorkspace';
import { computeScopedReturns } from '@/lib/metrics/scoped';
import { resolvePeriod } from '@/lib/returns/period';
import type { PropertyDetail, UnitDetail } from '@/lib/properties/data';

vi.mock('@/app/(manager)/properties/_components/ManagedUploads', () => ({
  FilesUploader: () => <button type="button">Upload files</button>,
}));
vi.mock('@/components/units/DeleteUnitControl', () => ({
  DeleteUnitControl: () => <button type="button">Delete</button>,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/unscoped',
  useSearchParams: () => new URLSearchParams(),
}));

import { PropertyOverview, UnitOverview } from '@/components/workspace/WorkspaceOverview';

const period = resolvePeriod('12M', new Date('2026-10-15T00:00:00.000Z'));
const metrics = computeScopedReturns({
  property: { purchasePriceCents: 30_000_000, downPaymentCents: 6_000_000, annualDebtServiceCents: 900_000 },
  units: [{ id: 'unit-1', number: '4B', status: 'OCCUPIED', monthlyRentCents: 200_000, listedRentCents: 210_000 }],
  payments: [{ unitId: 'unit-1', amountCents: 1_800_000, paidAt: new Date('2026-10-01T00:00:00.000Z') }],
  expenses: [{ category: 'TAX', label: 'Property taxes', amountCents: 300_000, occurredOn: new Date('2026-10-01T00:00:00.000Z') }],
  period,
  unitId: 'unit-1',
});

const property = {
  id: 'property-1', name: 'Maple Court', type: 'MULTI_UNIT', street: '214 Maple Ave', city: 'Austin', state: 'TX', postalCode: '78704', yearBuilt: 2000,
  archived: false, owner: { id: 'owner-1', name: 'Taylor Morgan' },
  units: [{ id: 'unit-1', number: '4B', isImplicit: false, bedrooms: 2, bathrooms: 1.5, squareFeet: 900, listedRent: 2000, status: 'OCCUPIED', leaseId: 'lease-1', rent: 2000, tenant: { id: 'tenant-1', name: 'Alex Rivera' } }],
  stats: { unitCount: 1, occupied: 1, occupancy: 100, monthlyRent: 2000, openRepairs: 0, expiringLeases: 0 },
  photos: [], files: [], leaseDocuments: [],
} as unknown as PropertyDetail;

const unit = {
  id: 'unit-1', number: '4B', isImplicit: false, bedrooms: 2, bathrooms: 1.5, squareFeet: 900, listedRent: 2000, marketRent: 2100, floor: 4, amenities: ['Balcony'], status: 'VACANT',
  property: { id: 'property-1', name: 'Maple Court', type: 'MULTI_UNIT', archived: false },
  currentLease: null, leaseHistory: [], maintenance: [], openRepairs: 0, photos: [], files: [],
} as unknown as UnitDetail;

describe('property and unit workspace render', () => {
  it('renders the shared property header and tab destinations', () => {
    const html = renderToStaticMarkup(<Workspace
      scope={{ propertyId: 'property-1', propertyName: 'Maple Court', propertyType: 'MULTI_UNIT', activeUnitCount: 4, propertyAddress: '214 Maple Ave, Austin, TX' }}
      activeTab="listing"
      coverKind="apartment"
    />);

    expect(html).toContain('<h1>Maple Court</h1>');
    expect(html).not.toContain('Edit property');
    expect(html).not.toContain('Property workspace');
    expect(html).toContain('214 Maple Ave, Austin, TX');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/properties/property-1/listing"');
    expect(html).toContain('href="/properties/property-1/returns"');
    expect(html).toContain('Applications');
  });

  it('renders unit-specific scope and the returns chart and KPIs', () => {
    const header = renderToStaticMarkup(<Workspace
      scope={{ propertyId: 'property-1', propertyName: 'Maple Court', propertyType: 'MULTI_UNIT', activeUnitCount: 4, unitId: 'unit-1', unitNumber: '4B', unitStatus: 'OCCUPIED' }}
      activeTab="returns"
    />);
    const returns = renderToStaticMarkup(<ReturnsWorkspace returns={metrics} propertyId="property-1" propertyName="Maple Court" />);
    const html = `${header}${returns}`;

    expect(html).toContain('<h1>Maple Court · Unit 4B</h1>');
    expect(html).toContain('Net operating income');
    expect(html).toContain('Cash flow');
    expect(html).not.toContain('Collected vs due');
    expect(html).toContain('Unit 4B monthly income versus expenses over the last twelve months');
    expect(html).toContain('Income statement');
    expect(html).not.toContain('Expense breakdown');
  });

  it('renders the property overview grid from its supplied record', () => {
    const html = renderToStaticMarkup(<PropertyOverview property={property} />);

    expect(html).toContain('Property details');
    expect(html).toContain('Next steps');
    expect(html).toContain('Documents and photos');
    expect(html).not.toContain('Lease timeline');
    expect(html).not.toContain('Returns at a glance');
    expect(html).not.toContain('Payments by the numbers');
    expect(html).toContain('Property units');
    expect(html).toContain('Alex Rivera');
  });

  it('renders one lease card, read-only unit facts and empty-state next steps', () => {
    const html = renderToStaticMarkup(<UnitOverview unit={unit} canDelete />);

    expect(html).toContain('>Lease<');
    expect(html).not.toContain('Lease timeline');
    expect(html).not.toContain('Current lease');
    expect(html).not.toContain('Edit unit');
    expect(html).not.toContain('Maintenance at a glance');
    expect(html).not.toContain('<dt>Status</dt>');
    expect(html).toContain('Unit facts');
    expect(html).toContain('Balcony');
    expect(html).toContain('Create a lease for this unit');
    expect(html).toContain('Unit documents and photos');
    expect(html).toContain('No active lease on this unit.');
  });
});

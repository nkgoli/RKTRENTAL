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
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { PropertyOverview, UnitOverview, propertyNextSteps } from '@/components/workspace/WorkspaceOverview';

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
    expect(html).toContain('Edit property');
    expect(html).toContain('href="/properties/property-1/media"');
    expect(html).toContain('Returns &amp; ROI');
    expect(html).not.toContain('Property workspace');
    expect(html).toContain('214 Maple Ave, Austin, TX');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/properties/property-1/listing"');
    expect(html).toContain('href="/properties/property-1/payments"');
    expect(html).toContain('href="/properties/property-1/returns"');
    expect(html).toContain('Applications');
  });

  it('offers a unit switcher on multi-unit properties only', () => {
    const units = [
      { id: 'unit-1', number: '4B', isImplicit: false, status: 'OCCUPIED' },
      { id: 'unit-2', number: '5A', isImplicit: false, status: 'VACANT' },
    ];
    const multi = renderToStaticMarkup(<Workspace
      scope={{ propertyId: 'property-1', propertyName: 'Maple Court', propertyType: 'MULTI_UNIT', activeUnitCount: 2 }}
      units={units}
    />);
    expect(multi).toContain('aria-label="Switch unit"');
    expect(multi).toContain('Unit 5A');
    const single = renderToStaticMarkup(<Workspace
      scope={{ propertyId: 'property-2', propertyName: '18 Elm Street', propertyType: 'SINGLE_UNIT', activeUnitCount: 1 }}
      units={[{ id: 'home', number: 'Home', isImplicit: true, status: 'OCCUPIED' }]}
    />);
    expect(single).not.toContain('Switch unit');
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
    expect(html).toContain(`role="img" aria-label="Unit 4B: ${period.label}"`);
    expect(html).toContain(`aria-label="Unit 4B: ${period.label} chart" tabindex="0"`);
    expect(html).toContain(`aria-label="Unit 4B: ${period.label} amounts" tabindex="0"`);
    expect(html).toContain('<summary>View exact amounts</summary>');
    expect(html).toContain('Income, expenses and NOI · USD');
    expect(html).toContain('Oct ’26: income $18,000.00, expenses $3,000.00');
    expect(html).toContain('<th scope="row">Oct ’26</th><td class="num">$18,000.00</td><td class="num">$3,000.00</td><td class="num">$15,000.00</td>');
    expect(html).toContain('Income statement');
    expect(html).not.toContain('Expense breakdown');
  });

  it('renders the property overview grid from its supplied record', () => {
    const html = renderToStaticMarkup(<PropertyOverview property={property} />);

    expect(html).toContain('Property details');
    // The workspace header owns the address and type; the details card does not repeat them.
    expect(html).not.toContain('<dt>Address</dt>');
    expect(html).not.toContain('<dt>Type</dt>');
    expect(html).toContain('Next steps');
    expect(html).not.toContain('Photos &amp; documents');
    expect(html).not.toContain('Property documents');
    expect(html).not.toContain('Lease timeline');
    expect(html).not.toContain('Returns at a glance');
    expect(html).not.toContain('Payments by the numbers');
    expect(html).toContain('Property units');
    expect(html).toContain('Alex Rivera');
    expect(html).toContain('Units &amp; lease terms');
    expect(html).toContain('Payments this month');
    expect(html).toContain('Occupancy');
    expect(html).toContain('1 of 1 unit · fully occupied');
    expect(html).toContain('Rent roll');
    expect(html).toContain('All caught up');
    expect(html).toContain('Moves Maple Court to the Archived filter on Properties. Asks for confirmation first.');
  });

  it('derives next steps from live repairs, expiring leases and vacancies', () => {
    const live = {
      ...property,
      units: [
        { ...property.units[0], leaseEnd: new Date('2026-11-30T00:00:00.000Z') },
        { id: 'unit-2', number: '3A', isImplicit: false, bedrooms: 1, bathrooms: 1, squareFeet: 600, listedRent: 1600, status: 'VACANT', leaseId: null, rent: null, tenant: null },
      ],
      stats: { ...property.stats, openRepairs: 2, expiringLeases: 1 },
    } as unknown as PropertyDetail;
    const steps = propertyNextSteps(live, new Date('2026-10-22T00:00:00.000Z'), {
      repairs: { open: 2, urgent: 1, first: { title: 'Kitchen sink leak', unitNumber: '4B', priority: 'URGENT' } },
      applicants: { 'unit-2': { count: 1, first: { name: 'Rohan Das', appliedAt: new Date('2026-10-11T00:00:00.000Z'), status: 'SCREENING' } } },
    });
    expect(steps.map((step) => [step.eyebrow, step.heading, step.detail])).toEqual([
      ['Maintenance', '2 repairs need attention', '1 urgent · Kitchen sink leak, Unit 4B'],
      ['Renewals', '1 lease expiring soon', 'Alex Rivera, Unit 4B, ends on Nov 30'],
      ['Vacancy', 'Unit 3A · $1,600 asking', 'Rohan Das applied Oct 11 · in screening'],
    ]);
    expect(steps[2].href).toBe('/properties/property-1/applications?unit=unit-2');
    const soon = new Date(Date.now() + 20 * 86_400_000);
    const html = renderToStaticMarkup(<PropertyOverview property={{ ...live, units: [{ ...live.units[0], leaseEnd: soon }, live.units[1]] }} />);
    expect(html).toContain('Renewal due');
    expect(html).toContain('$1,600 asking');
  });

  it('renders one lease card, read-only unit facts and empty-state next steps', () => {
    const html = renderToStaticMarkup(<UnitOverview unit={unit} canDelete />);

    expect(html).toContain('Lease terms');
    expect(html).not.toContain('Current lease');
    expect(html).toContain('Asking rent');
    expect(html).toMatch(/<button class="action action-secondary" type="button" aria-label="Edit unit"[^>]*>.*?<span>Edit<\/span><\/button>/);
    expect(html).not.toContain('Maintenance at a glance');
    expect(html).not.toContain('<dt>Status</dt>');
    expect(html).toContain('Unit facts');
    expect(html).toContain('Balcony');
    expect(html).toContain('Create a lease for this unit');
    expect(html).not.toContain('Photos &amp; documents');
    expect(html).not.toContain('Unit documents');
    expect(html).toContain('No active lease on this unit.');
  });
});

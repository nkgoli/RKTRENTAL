import { notFound } from 'next/navigation';
import { PropertyListing } from '@/components/workspace/PropertyListing';
import { RentCompsPanel } from '@/components/rent-comps/RentCompsPanel';
import { requireManagerRole } from '@/lib/auth/access';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { propertiesDb } from '@/lib/properties/data';
import { resolvePeriod, periodKeyFrom } from '@/lib/returns/period';
import { first, type WorkspaceSearch } from '../routing';

export default async function PropertyListingPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  const unitId = first(query.unit);
  const period = resolvePeriod(periodKeyFrom(first(query.period)), new Date());
  const [property, workspaceReturns, unit] = await Promise.all([
    propertiesDb(session.organizationId).getProperty(id),
    loadPropertyWorkspaceReturns(session.organizationId, id, period),
    unitId ? propertiesDb(session.organizationId).getUnit(id, unitId) : Promise.resolve(null),
  ]);
  if (!property || !workspaceReturns || (unitId && !unit)) notFound();
  if (unit) return <RentCompsPanel organizationId={session.organizationId} unitId={unit.id} searchParams={query} />;
  return <PropertyListing property={property} returns={workspaceReturns} organizationId={session.organizationId} searchParams={query} />;
}

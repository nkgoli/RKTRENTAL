import { notFound } from 'next/navigation';
import { ReturnsWorkspace } from '@/components/workspace/ReturnsWorkspace';
import { requireManagerRole } from '@/lib/auth/access';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { propertiesDb } from '@/lib/properties/data';
import { resolvePeriod, periodKeyFrom } from '@/lib/returns/period';
import { first, type WorkspaceSearch } from '../routing';

export default async function PropertyReturnsPage({ params, searchParams }: {
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
  const returns = unit ? workspaceReturns.units.find((row) => row.unitId === unit.id) : workspaceReturns.property;
  if (!returns) notFound();
  return <ReturnsWorkspace returns={returns} propertyId={id} propertyName={property.name} />;
}

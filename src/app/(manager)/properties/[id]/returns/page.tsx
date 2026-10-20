import { notFound, redirect } from 'next/navigation';
import { ReturnsWorkspace } from '@/components/workspace/ReturnsWorkspace';
import { requireManagerRole } from '@/lib/auth/access';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { propertiesDb } from '@/lib/properties/data';
import { resolveReturnsPeriod } from '@/lib/returns/queries';
import { first, type WorkspaceSearch } from '../routing';

export default async function PropertyReturnsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  const unitId = first(query.unit);
  // Whole-property returns live in the combined Returns & ROI workspace, beside the
  // projection for the same period. Unit drill-downs keep this allocated report.
  if (!unitId) {
    if (!(await propertiesDb(session.organizationId).getProperty(id))) notFound();
    const target = new URLSearchParams({ property: id, view: 'actual' });
    for (const name of ['period', 'from', 'to'] as const) {
      const value = first(query[name]);
      if (value) target.set(name, name === 'period' ? value.toUpperCase() : value);
    }
    redirect(`/roi-analysis?${target}`);
  }
  const now = new Date();
  const period = await resolveReturnsPeriod(
    session.organizationId,
    { period: first(query.period), from: first(query.from), to: first(query.to) },
    now,
    id,
  );
  const [property, workspaceReturns, unit] = await Promise.all([
    propertiesDb(session.organizationId).getProperty(id),
    loadPropertyWorkspaceReturns(session.organizationId, id, period),
    unitId ? propertiesDb(session.organizationId).getUnit(id, unitId) : Promise.resolve(null),
  ]);
  if (!property || !workspaceReturns || (unitId && !unit)) notFound();
  const returns = unit ? workspaceReturns.units.find((row) => row.unitId === unit.id) : workspaceReturns.property;
  if (!returns) notFound();
  return <ReturnsWorkspace returns={returns} propertyId={id} propertyName={property.name} now={now} />;
}

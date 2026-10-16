import { notFound, redirect } from 'next/navigation';
import { Alert } from '@/components/ui';
import { UnitOverview, PropertyOverview } from '@/components/workspace/WorkspaceOverview';
import { AddUnitForm } from '../_components/UnitForm';
import { requireManagerRole } from '@/lib/auth/access';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { propertiesDb } from '@/lib/properties/data';
import { resolvePeriod, periodKeyFrom } from '@/lib/returns/period';
import { first, legacyTabDestination, type WorkspaceSearch } from './routing';
import styles from './workspace.module.css';

export default async function PropertyOverviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  if (first(query.tab) !== undefined) redirect(legacyTabDestination(id, query));
  const unitId = first(query.unit);
  const period = resolvePeriod(periodKeyFrom(first(query.period)), new Date());
  const data = propertiesDb(session.organizationId);
  const [property, owners, workspaceReturns, unit] = await Promise.all([
    data.getProperty(id),
    unitId ? Promise.resolve([]) : data.listOwners(),
    loadPropertyWorkspaceReturns(session.organizationId, id, period),
    unitId ? data.getUnit(id, unitId) : Promise.resolve(null),
  ]);
  if (!property || !workspaceReturns || (unitId && !unit)) notFound();

  if (unit) {
    const canDelete = !unit.isImplicit && unit.leaseHistory.length === 0
      && unit.maintenance.length === 0 && unit.files.length === 0 && unit.photos.length === 0;
    return <UnitOverview unit={unit} canDelete={canDelete} />;
  }

  const notice = first(query.notice);
  return <>
    {notice === 'unit-deleted' && <Alert tone="success">Unit deleted.</Alert>}
    {notice === 'unit-delete-blocked' && <Alert tone="warning">This unit has linked records or is the single-family home unit, so it could not be deleted.</Alert>}
    <PropertyOverview property={property} owners={owners} leaseFacts={workspaceReturns.unitFacts} />
    {!property.archived && property.type !== 'SINGLE_UNIT' && <section className={styles.forms}>
      <AddUnitForm propertyId={property.id} />
    </section>}
  </>;
}

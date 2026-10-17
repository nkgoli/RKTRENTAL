import { notFound, redirect } from 'next/navigation';
import { Alert } from '@/components/ui';
import { UnitOverview, PropertyOverview } from '@/components/workspace/WorkspaceOverview';
import { AddUnitForm } from '../_components/UnitForm';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import { listWorkspacePhotos } from '@/lib/storage/service';
import { loadPaymentsMonth, loadWorkspaceTimeline } from '@/lib/workspace/timeline-data';
import { first, legacyTabDestination, type WorkspaceSearch } from './routing';
import styles from './workspace.module.css';

export default async function PropertyOverviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  if (first(query.tab) !== undefined) redirect(legacyTabDestination(id, query));
  const unitId = first(query.unit);
  const data = propertiesDb(session.organizationId);
  const [property, owners, unit] = await Promise.all([
    data.getProperty(id),
    unitId ? Promise.resolve([]) : data.listOwners(),
    unitId ? data.getUnit(id, unitId) : Promise.resolve(null),
  ]);
  if (!property || (unitId && !unit)) notFound();
  const scope = { propertyId: id, unitId: unit && !unit.isImplicit ? unit.id : undefined };
  const [timeline, payments] = await Promise.all([
    loadWorkspaceTimeline(session.organizationId, scope),
    loadPaymentsMonth(session.organizationId, scope),
  ]);

  if (unit && !unit.isImplicit) {
    const photos = await listWorkspacePhotos(session.organizationId, { kind: 'unit', id: unit.id });
    const canDelete = !unit.isImplicit && unit.leaseHistory.length === 0
      && unit.maintenance.length === 0 && unit.files.length === 0 && unit.photos.length === 0;
    return <UnitOverview unit={{ ...unit, photos }} canDelete={canDelete} timeline={timeline} payments={payments} />;
  }

  const photos = await listWorkspacePhotos(session.organizationId, { kind: 'property', id: property.id });
  const notice = first(query.notice);
  return <>
    {notice === 'unit-deleted' && <Alert tone="success">Unit deleted.</Alert>}
    {notice === 'unit-delete-blocked' && <Alert tone="warning">This unit has linked records or is the single-family home unit, so it could not be deleted.</Alert>}
    <PropertyOverview property={{ ...property, photos }} owners={owners} timeline={timeline} payments={payments} unitsPage={first(query.unitsPage)} />
    {!property.archived && property.type !== 'SINGLE_UNIT' && <section className={styles.forms}>
      <AddUnitForm propertyId={property.id} />
    </section>}
  </>;
}

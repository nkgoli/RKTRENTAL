import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Alert, Card, CardHeader } from '@/components/ui';
import { UnitOverview, PropertyOverview } from '@/components/workspace/WorkspaceOverview';
import { AddUnitForm, EditUnitForm } from '../_components/UnitForm';
import { EditPropertyForm } from '../_components/PropertyForm';
import { requireManagerRole } from '@/lib/auth/access';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { propertiesDb } from '@/lib/properties/data';
import { formatDate } from '@/lib/properties/format';
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
    const unitReturns = workspaceReturns.units.find((item) => item.unitId === unit.id);
    if (!unitReturns) notFound();
    const canDelete = !unit.isImplicit && unit.leaseHistory.length === 0
      && unit.maintenance.length === 0 && unit.files.length === 0 && unit.photos.length === 0;
    return <>
      <UnitOverview unit={unit} returns={unitReturns} canDelete={canDelete} />
      <section className={styles.forms}>
        <Card id="edit-unit">
          <CardHeader title="Edit unit" />
          <EditUnitForm propertyId={id} unitId={unit.id} implicit={unit.isImplicit} hasActiveLease={!!unit.currentLease}
            initial={{
              number: unit.number, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms,
              squareFeet: unit.squareFeet, listedRent: unit.listedRent, marketRent: unit.marketRent,
              floor: unit.floor, amenities: unit.amenities, status: unit.status,
            }} />
        </Card>
        <Card flush>
          <CardHeader title="Maintenance at a glance" action={<Link href={`/properties/${id}/maintenance?unit=${unit.id}`}>View all</Link>} />
          <table className="table">
            <thead><tr><th>Request</th><th>Opened</th><th>Status</th></tr></thead>
            <tbody>
              {unit.maintenance.length === 0 && <tr><td colSpan={3} className="muted">No maintenance requests.</td></tr>}
              {unit.maintenance.slice(0, 5).map((request) => <tr key={request.id}>
                <td>{request.title}</td><td>{formatDate(request.createdAt)}</td>
                <td>{request.status.replaceAll('_', ' ').toLowerCase()}</td>
              </tr>)}
            </tbody>
          </table>
        </Card>
      </section>
    </>;
  }

  const notice = first(query.notice);
  return <>
    {notice === 'unit-deleted' && <Alert tone="success">Unit deleted.</Alert>}
    {notice === 'unit-delete-blocked' && <Alert tone="warning">This unit has linked records or is the single-family home unit, so it could not be deleted.</Alert>}
    <PropertyOverview property={property} returns={workspaceReturns.property} leaseFacts={workspaceReturns.unitFacts} />
    <section className={styles.forms}>
      <EditPropertyForm propertyId={property.id} archived={property.archived} owners={owners}
        initial={{
          name: property.name, type: property.type, street: property.street,
          city: property.city, state: property.state, postalCode: property.postalCode,
          yearBuilt: property.yearBuilt, ownerId: property.owner?.id ?? null,
        }} />
      {!property.archived && property.type !== 'SINGLE_UNIT' && <AddUnitForm propertyId={property.id} />}
    </section>
  </>;
}

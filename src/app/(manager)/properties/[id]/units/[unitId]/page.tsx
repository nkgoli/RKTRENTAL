import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui';
import { RentCompsPanel } from '@/components/rent-comps/RentCompsPanel';
import { ReturnsWorkspace } from '@/components/workspace/ReturnsWorkspace';
import { UnitOverview } from '@/components/workspace/WorkspaceOverview';
import { Workspace, type WorkspaceTab } from '@/components/workspace/Workspace';
import { EditUnitForm } from '../../../_components/UnitForm';
import { propertiesDb } from '@/lib/properties/data';
import { requireManagerRole } from '@/lib/auth/access';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { resolvePeriod, periodKeyFrom } from '@/lib/returns/period';
import { formatDate } from '@/lib/properties/format';
import { previewUrl } from '../../../_components/Media';
import styles from './workspace.module.css';

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const validTab = (value: string | undefined): WorkspaceTab =>
  value === 'listing' || value === 'returns' ? value : 'overview';

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; unitId: string }>;
  searchParams: Promise<Search>;
}) {
  const [session, routeParams, query] = await Promise.all([
    requireManagerRole(),
    params,
    searchParams,
  ]);
  const { id: propertyId, unitId } = routeParams;
  const activeTab = validTab(first(query.tab));
  const period = resolvePeriod(periodKeyFrom(first(query.period)), new Date());
  const [unit, workspaceReturns] = await Promise.all([
    propertiesDb(session.organizationId).getUnit(propertyId, unitId),
    loadPropertyWorkspaceReturns(session.organizationId, propertyId, period),
  ]);
  if (!unit || !workspaceReturns) notFound();

  const unitReturns = workspaceReturns.units.find((item) => item.unitId === unit.id);
  if (!unitReturns) notFound();
  const unitFact = workspaceReturns.unitFacts.find((item) => item.id === unit.id);
  const activeUnitCount = workspaceReturns.unitFacts.filter((item) => item.status !== 'ARCHIVED').length;
  const scope = {
    propertyId: unit.property.id,
    propertyName: unit.property.name,
    propertyType: unit.property.type,
    propertyArchived: unit.property.archived,
    activeUnitCount,
    unitId: unit.id,
    unitNumber: unit.number,
    unitIsImplicit: unit.isImplicit,
    unitStatus: unit.status,
  };
  const canDelete = !unit.isImplicit
    && unit.leaseHistory.length === 0
    && unit.maintenance.length === 0
    && unit.files.length === 0
    && unit.photos.length === 0;
  const firstPhoto = unit.photos[0];

  return <>
    <Workspace
      scope={scope}
      activeTab={activeTab}
      coverKind={unit.isImplicit ? 'house' : 'apartment'}
      coverSrc={firstPhoto ? previewUrl(firstPhoto.id) : undefined}
      actions={[
        { label: 'Edit unit', href: `/properties/${propertyId}/units/${unitId}?tab=overview#edit-unit` },
        { label: 'Rent comps', href: `/rent-comps?unit=${unitId}` },
        ...(!unit.currentLease ? [{ label: 'Create lease', href: `/leases/new?unit=${unit.id}`, primary: true }] : []),
      ]}
    />
    {activeTab === 'listing' ? (
      <RentCompsPanel organizationId={session.organizationId} unitId={unit.id} searchParams={query} />
    ) : activeTab === 'returns' ? (
      <ReturnsWorkspace
        returns={unitReturns}
        propertyId={propertyId}
        propertyName={unit.property.name}
        unitRent={{ listedRent: unitFact?.listedRent ?? unit.listedRent, marketRent: unitFact?.marketRent ?? unit.marketRent }}
      />
    ) : <>
      <UnitOverview unit={unit} returns={unitReturns} canDelete={canDelete} />
      <section className={styles.forms}>
        <Card id="edit-unit">
          <CardHeader title="Edit unit" />
          <EditUnitForm
            propertyId={propertyId}
            unitId={unit.id}
            implicit={unit.isImplicit}
            hasActiveLease={!!unit.currentLease}
            initial={{
              number: unit.number,
              bedrooms: unit.bedrooms,
              bathrooms: unit.bathrooms,
              squareFeet: unit.squareFeet,
              listedRent: unit.listedRent,
              marketRent: unit.marketRent,
              floor: unit.floor,
              amenities: unit.amenities,
              status: unit.status,
            }}
          />
        </Card>
        <Card flush>
          <CardHeader title="Maintenance at a glance" action={<Link href={`/maintenance?propertyId=${propertyId}&unitId=${unitId}`}>View all</Link>} />
          <table className="table">
            <thead><tr><th>Request</th><th>Opened</th><th>Status</th></tr></thead>
            <tbody>
              {unit.maintenance.length === 0 && <tr><td colSpan={3} className="muted">No maintenance requests.</td></tr>}
              {unit.maintenance.slice(0, 5).map((request) => <tr key={request.id}>
                <td>{request.title}</td>
                <td>{formatDate(request.createdAt)}</td>
                <td>{request.status.replaceAll('_', ' ').toLowerCase()}</td>
              </tr>)}
            </tbody>
          </table>
        </Card>
      </section>
    </>}
  </>;
}

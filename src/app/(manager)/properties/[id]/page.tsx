import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui';
import { Workspace, type WorkspaceTab } from '@/components/workspace/Workspace';
import { PropertyListing } from '@/components/workspace/PropertyListing';
import { PropertyOverview } from '@/components/workspace/WorkspaceOverview';
import { ReturnsWorkspace, type ReturnUnitRow } from '@/components/workspace/ReturnsWorkspace';
import { AddUnitForm } from '../_components/UnitForm';
import { EditPropertyForm } from '../_components/PropertyForm';
import { requireManagerRole } from '@/lib/auth/access';
import { loadPropertyWorkspaceReturns } from '@/lib/metrics';
import { propertiesDb } from '@/lib/properties/data';
import { formatAddress } from '@/lib/properties/format';
import { resolvePeriod, periodKeyFrom } from '@/lib/returns/period';
import { previewUrl } from '../_components/Media';
import styles from './workspace.module.css';

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const validTab = (value: string | undefined): WorkspaceTab =>
  value === 'listing' || value === 'returns' ? value : 'overview';

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const [session, routeParams, query] = await Promise.all([
    requireManagerRole(),
    params,
    searchParams,
  ]);
  const propertyId = routeParams.id;
  const activeTab = validTab(first(query.tab));
  const period = resolvePeriod(periodKeyFrom(first(query.period)), new Date());
  const data = propertiesDb(session.organizationId);
  const [property, owners, workspaceReturns] = await Promise.all([
    data.getProperty(propertyId),
    data.listOwners(),
    loadPropertyWorkspaceReturns(session.organizationId, propertyId, period),
  ]);
  if (!property || !workspaceReturns) notFound();

  const activeUnitCount = property.units.filter((unit) => unit.status !== 'ARCHIVED').length;
  const firstPhoto = property.photos[0];
  const scope = {
    propertyId: property.id,
    propertyName: property.name,
    propertyType: property.type,
    propertyArchived: property.archived,
    propertyAddress: formatAddress(property),
    activeUnitCount,
  };
  const returnUnitRows: ReturnUnitRow[] = workspaceReturns.units
    .filter((unitReturn) => unitReturn.unitId !== null)
    .map((unitReturn) => {
      const fact = workspaceReturns.unitFacts.find((unit) => unit.id === unitReturn.unitId);
      return {
        id: unitReturn.unitId!,
        number: fact?.number ?? unitReturn.unitNumber ?? 'Unit',
        returns: unitReturn,
        currentRent: fact?.currentRent ?? null,
        listedRent: fact?.listedRent ?? null,
        marketRent: fact?.marketRent ?? null,
      };
    })
    .filter((row) => workspaceReturns.unitFacts.find((fact) => fact.id === row.id)?.status !== 'ARCHIVED');

  const notice = first(query.notice);

  return <>
    <Workspace
      scope={scope}
      activeTab={activeTab}
      coverKind={activeUnitCount === 1 ? 'house' : 'apartment'}
      coverSrc={firstPhoto ? previewUrl(firstPhoto.id) : undefined}
      actions={[
        { label: 'Edit property', href: `/properties/${property.id}?tab=overview#edit-property` },
        ...(!property.archived && property.type !== 'SINGLE_UNIT'
          ? [{ label: '+ Add unit', href: `/properties/${property.id}?tab=overview#add-unit`, primary: true }]
          : []),
      ]}
    />
    {notice === 'unit-deleted' && <Alert tone="success">Unit deleted.</Alert>}
    {notice === 'unit-delete-blocked' && <Alert tone="warning">This unit has linked records or is the single-family home unit, so it could not be deleted.</Alert>}
    {activeTab === 'listing' ? (
      <PropertyListing property={property} returns={workspaceReturns} organizationId={session.organizationId} searchParams={query} />
    ) : activeTab === 'returns' ? (
      <ReturnsWorkspace returns={workspaceReturns.property} propertyId={property.id} propertyName={property.name} unitRows={returnUnitRows} />
    ) : <>
      <PropertyOverview property={property} returns={workspaceReturns.property} leaseFacts={workspaceReturns.unitFacts} />
      <section className={styles.forms}>
        <EditPropertyForm
          propertyId={property.id}
          archived={property.archived}
          owners={owners}
          initial={{
            name: property.name,
            type: property.type,
            street: property.street,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode,
            yearBuilt: property.yearBuilt,
            ownerId: property.owner?.id ?? null,
          }}
        />
        {!property.archived && property.type !== 'SINGLE_UNIT' && <AddUnitForm propertyId={property.id} />}
      </section>
    </>}
  </>;
}

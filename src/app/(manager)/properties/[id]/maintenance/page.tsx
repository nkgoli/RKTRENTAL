import { notFound } from 'next/navigation';
import { PropertyMaintenanceList } from '@/components/workspace/panels/operations/PropertyMaintenanceList';
import { NewMaintenanceRequestDialog } from '@/components/workspace/panels/operations/NewMaintenanceRequestDialog';
import { requireManagerRole } from '@/lib/auth/access';
import {
  listMaintenancePage,
  listMaintenanceOptions,
  parseMaintenanceQuery,
} from '@/lib/maintenance';
import { withRequestPhotos } from '@/components/maintenance/request-photos';
import { propertiesDb } from '@/lib/properties/data';
import { first, type WorkspaceSearch } from '../routing';
import {
  createPropertyMaintenanceAction,
  assignPropertyMaintenanceAction,
  statusPropertyMaintenanceAction,
  commentPropertyMaintenanceAction,
  photoPropertyMaintenanceAction,
} from './actions';

export default async function PropertyMaintenancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id: propertyId }, queryParams] = await Promise.all([
    requireManagerRole(),
    params,
    searchParams,
  ]);
  const property = await propertiesDb(session.organizationId).getProperty(propertyId);
  if (!property) notFound();

  const unitId = first(queryParams.unit);
  if (unitId && !property.units.some((unit) => unit.id === unitId)) notFound();

  const query = parseMaintenanceQuery(queryParams);
  const list = await listMaintenancePage(
    session.organizationId,
    { propertyId, ...(unitId ? { unitId } : {}) },
    query,
  );
  const selectableUnits = property.units
    .filter((unit) => unit.status !== 'ARCHIVED' && (!unitId || unit.id === unitId))
    .map(({ id, number }) => ({ id, number }));
  const createAction = createPropertyMaintenanceAction.bind(null, propertyId, unitId ?? '');
  const [{ vendors }, requests] = await Promise.all([
    listMaintenanceOptions(session.organizationId),
    withRequestPhotos(session.organizationId, list.requests),
  ]);

  return (
    <div className="stack">
      <PropertyMaintenanceList
        propertyId={propertyId}
        list={{ ...list, requests }}
        vendors={vendors}
        actions={{
          assign: assignPropertyMaintenanceAction.bind(null, propertyId, unitId ?? ''),
          status: statusPropertyMaintenanceAction.bind(null, propertyId, unitId ?? ''),
          comment: commentPropertyMaintenanceAction.bind(null, propertyId, unitId ?? ''),
          photo: photoPropertyMaintenanceAction.bind(null, propertyId, unitId ?? ''),
        }}
        query={query}
        unitId={unitId}
        createRequestControl={
          <NewMaintenanceRequestDialog
            action={createAction}
            propertyName={property.name}
            units={selectableUnits}
            selectedUnitId={unitId}
            triggerLabel={list.isEmpty ? 'Create your first request' : undefined}
          />
        }
      />
    </div>
  );
}

import { notFound } from 'next/navigation';
import { PropertyMaintenanceList } from '@/components/workspace/panels/operations/PropertyMaintenanceList';
import { NewMaintenanceRequestDialog } from '@/components/workspace/panels/operations/NewMaintenanceRequestDialog';
import { requireManagerRole } from '@/lib/auth/access';
import { listMaintenanceBoard } from '@/lib/maintenance';
import { propertiesDb } from '@/lib/properties/data';
import { first, type WorkspaceSearch } from '../routing';
import { createPropertyMaintenanceAction } from './actions';

export default async function PropertyMaintenancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id: propertyId }, query] = await Promise.all([
    requireManagerRole(),
    params,
    searchParams,
  ]);
  const property = await propertiesDb(session.organizationId).getProperty(propertyId);
  if (!property) notFound();

  const unitId = first(query.unit);
  if (unitId && !property.units.some((unit) => unit.id === unitId)) notFound();

  const requests = await listMaintenanceBoard(session.organizationId, {
    propertyId,
    ...(unitId ? { unitId } : {}),
  });
  const selectableUnits = property.units
    .filter((unit) => unit.status !== 'ARCHIVED')
    .map(({ id, number }) => ({ id, number }));
  const createAction = createPropertyMaintenanceAction.bind(null, propertyId, unitId ?? '');

  return (
    <div className="stack">
      <PropertyMaintenanceList
        propertyId={propertyId}
        requests={requests}
        createRequestControl={
          <NewMaintenanceRequestDialog
            action={createAction}
            propertyName={property.name}
            units={selectableUnits}
            selectedUnitId={unitId}
            triggerLabel={requests.length === 0 ? 'Create your first request' : undefined}
          />
        }
      />
    </div>
  );
}

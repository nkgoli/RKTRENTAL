import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { listMaintenanceOptions } from '@/lib/maintenance';
import { getMaintenanceEditor } from '@/lib/maintenance/service';
import { serializeMaintenanceEditor } from '@/lib/maintenance/editor';
import { maintenanceReturn } from '@/lib/maintenance/navigation';
import { MaintenanceEditor } from '@/components/maintenance/MaintenanceEditor';

export default async function EditRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ propertyId?: string; unitId?: string; returnTo?: string }>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  const request = await getMaintenanceEditor(session.organizationId, id, {
    propertyId: query.propertyId,
    unitId: query.unitId,
  });
  if (!request) notFound();
  const { vendors } = await listMaintenanceOptions(session.organizationId);
  return (
    <MaintenanceEditor
      initial={serializeMaintenanceEditor(request)}
      vendors={vendors.map(({ id, name, trade, phone, email }) => ({
        id,
        name,
        trade,
        phone,
        email,
      }))}
      returnTo={maintenanceReturn(query.returnTo)}
    />
  );
}

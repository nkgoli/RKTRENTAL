import styles from '@/components/maintenance/issue-form.module.css';
import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { listMaintenanceOptions } from '@/lib/maintenance';
import { maintenanceReturn } from '@/lib/maintenance/navigation';
import { MaintenanceIssueForm } from '@/components/maintenance/MaintenanceIssueForm';
import { PageHeader } from '@/components/shell/PageHeader';
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; unitId?: string; returnTo?: string }>;
}) {
  const [session, params] = await Promise.all([requireManagerRole(), searchParams]);
  const { properties } = await listMaintenanceOptions(session.organizationId);
  const property = params.propertyId
    ? properties.find((p) => p.id === params.propertyId)
    : undefined;
  if (params.propertyId && !property) notFound();
  const units = (property ? [property] : properties).flatMap((p) =>
    p.units.map((u) => ({ id: u.id, number: `${p.name} / ${u.number}` })),
  );
  if (params.unitId && !units.some((u) => u.id === params.unitId)) notFound();
  const returnTo = maintenanceReturn(params.returnTo);
  return (
    <div className={styles.page}>
      <PageHeader
        title="New repair request"
        eyebrow="Operations / Maintenance"
        back={{ href: returnTo, label: 'Repair requests' }}
      />
      <p className="muted">
        Choose a unit, set a priority and add photos to help the vendor prepare.
      </p>
      <MaintenanceIssueForm
        scope={{ propertyId: params.propertyId, unitId: params.unitId }}
        returnTo={returnTo}
        units={units.filter((u) => !params.unitId || u.id === params.unitId)}
        selectedUnitId={params.unitId}
      />
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { listMaintenanceOptions } from '@/lib/maintenance';
import { maintenanceReturn } from '@/lib/maintenance/navigation';
import { MaintenanceIssueForm } from '@/components/maintenance/MaintenanceIssueForm';
import { createRequest } from '@/components/maintenance/request-actions';
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
  async function save(form: FormData) {
    'use server';
    const result = await createRequest(form, params.propertyId, params.unitId);
    if (result.requestId)
      result.requestHref = `${returnTo.split('#')[0]}#request-${result.requestId}`;
    return result;
  }
  return (
    <>
      <Link href={returnTo}>Back to repair requests</Link>
      <h1>New repair request</h1>
      <p className="muted">
        Choose a unit, set a priority and add photos to help the vendor prepare.
      </p>
      <MaintenanceIssueForm
        action={save}
        returnTo={returnTo}
        units={units.filter((u) => !params.unitId || u.id === params.unitId)}
        selectedUnitId={params.unitId}
      />
    </>
  );
}

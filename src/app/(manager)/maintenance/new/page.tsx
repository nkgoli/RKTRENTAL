import styles from '@/components/maintenance/issue-form.module.css';
import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { listMaintenanceOptions } from '@/lib/maintenance';
import { maintenanceReturn } from '@/lib/maintenance/navigation';
import { MaintenanceIssueForm } from '@/components/maintenance/MaintenanceIssueForm';
import { PageHeader } from '@/components/shell/PageHeader';

const NEXT_STEPS = [
  ['Status starts as New', 'It appears in the New column of the board.'],
  ['Vendor is optional', 'Assign one now or later from the request.'],
  ['Location stays with the request', 'Pick the property, then the unit.'],
] as const;

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; unitId?: string; returnTo?: string }>;
}) {
  const [session, params] = await Promise.all([requireManagerRole(), searchParams]);
  const { properties, vendors } = await listMaintenanceOptions(session.organizationId);
  const property = params.propertyId
    ? properties.find((p) => p.id === params.propertyId)
    : undefined;
  if (params.propertyId && !property) notFound();
  const scoped = property ? [property] : properties;
  if (params.unitId && !scoped.some((p) => p.units.some((u) => u.id === params.unitId))) notFound();
  const returnTo = maintenanceReturn(params.returnTo);
  return (
    <>
      <PageHeader
        title="New repair request"
        eyebrow="Operations"
        meta="Saved requests join the request board as New."
        back={{ href: returnTo, label: 'Maintenance' }}
      />
      <div className={styles.layout}>
        <MaintenanceIssueForm
          scope={{ propertyId: params.propertyId, unitId: params.unitId }}
          returnTo={returnTo}
          properties={scoped}
          vendors={vendors.map(({ id, name }) => ({ id, name }))}
          selectedUnitId={params.unitId}
        />
        <aside className={styles.next} aria-labelledby="next-heading">
          <h2 id="next-heading">What happens next</h2>
          <ul>
            {NEXT_STEPS.map(([title, detail]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

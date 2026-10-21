import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { analysisService } from '@/lib/analysis/service';
import { roiReturnPath } from '@/lib/analysis/return-path';
import { propertiesDb } from '@/lib/properties/data';
import { PropertyForm, type RoiEditContext } from '../../_components/PropertyForm';
import styles from '../../properties.module.css';

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, { id }, query = {}] = await Promise.all([
    requireManagerRole(),
    params,
    searchParams,
  ]);
  const data = propertiesDb(session.organizationId);
  const [property, owners] = await Promise.all([data.getProperty(id), data.listOwners()]);
  if (!property) notFound();
  const returnTo = roiReturnPath(query.returnTo, id);
  // Opened from Returns & ROI: prefill the baseline the analysis actually uses.
  let roi: RoiEditContext | undefined;
  if (returnTo) {
    const analysis = analysisService(session, db);
    const [saved, draft] = await Promise.all([analysis.loadSaved(id), analysis.loadDraft(id)]);
    const payload = (saved.ok && saved.data?.payload) || (draft.ok ? draft.data.payload : null);
    if (payload)
      roi = {
        returnTo,
        payload,
        field: typeof query.field === 'string' ? query.field : undefined,
        saved:
          saved.ok && saved.data
            ? `${saved.data.status.toLowerCase()} revision ${saved.data.revision}`
            : null,
      };
  }
  const cancelHref = roi?.returnTo ?? `/properties/${id}`;
  return (
    <>
      <PageHeader
        title={roi ? 'Edit ROI assumptions' : 'Edit property'}
        eyebrow={`Portfolio / ${property.name}`}
        actions={[]}
      />
      <div className={styles.formPage}>
        <h1 className={styles.formTitle}>{roi ? 'Edit ROI assumptions' : 'Edit property'}</h1>
        <a href={cancelHref} className={styles.backLink}>
          ← Back to {roi ? 'Returns & ROI' : property.name}
        </a>
        <PropertyForm
          key={property.id}
          owners={owners}
          cancelHref={cancelHref}
          roi={roi}
          initial={{
            ...property,
            ownerId: property.owner?.id ?? null,
            unitCount: property.units.filter((unit) => unit.status !== 'ARCHIVED').length,
          }}
        />
      </div>
    </>
  );
}

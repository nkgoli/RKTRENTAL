import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import { PropertyForm } from '../../_components/PropertyForm';
import styles from '../../properties.module.css';

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([requireManagerRole(), params]);
  const data = propertiesDb(session.organizationId);
  const [property, owners] = await Promise.all([data.getProperty(id), data.listOwners()]);
  if (!property) notFound();
  const cancelHref = `/properties/${id}`;
  return (
    <>
      <PageHeader title="Edit property" eyebrow={`Portfolio / ${property.name}`} actions={[]} />
      <div className={styles.formPage}>
        <h1 className={styles.formTitle}>Edit property</h1>
        <Link href={cancelHref} className={styles.backLink}>
          ← Back to {property.name}
        </Link>
        <PropertyForm
          key={property.id}
          owners={owners}
          cancelHref={cancelHref}
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

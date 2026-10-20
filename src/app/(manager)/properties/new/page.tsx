import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import { PropertyForm } from '../_components/PropertyForm';
import { directoryReturn } from '../navigation';
import styles from '../properties.module.css';

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await requireManagerRole();
  const owners = await propertiesDb(session.organizationId).listOwners();
  const cancelHref = directoryReturn((await searchParams).returnTo);
  return (
    <>
      <PageHeader title="Add property" eyebrow="Portfolio / Properties" actions={[]} />
      <div className={styles.formPage}>
        <h1 className={styles.formTitle}>Add property</h1>
        <Link href={cancelHref} className={styles.backLink}>
          ← Back to properties
        </Link>
        <PropertyForm owners={owners} cancelHref={cancelHref} />
      </div>
    </>
  );
}

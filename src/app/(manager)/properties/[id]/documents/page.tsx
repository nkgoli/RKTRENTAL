import { notFound } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import { photoLimitForTarget } from '@/lib/storage/photo-limits';
import { FileList } from '../../_components/Media';
import { FilesUploader } from '../../_components/ManagedUploads';
import { first, type WorkspaceSearch } from '../routing';

export default async function PropertyDocumentsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  const unitId = first(query.unit);
  const data = propertiesDb(session.organizationId);
  const [property, unit] = await Promise.all([
    data.getProperty(id),
    unitId ? data.getUnit(id, unitId) : Promise.resolve(null),
  ]);
  if (!property || (unitId && !unit)) notFound();

  const target = unit ? { kind: 'unit' as const, id: unit.id } : { kind: 'property' as const, id: property.id };
  const files = unit ? unit.files : property.files;
  const photos = unit ? unit.photos : property.photos;

  return <>
    <Card id="photos">
      <CardHeader title="Upload files" />
      <FilesUploader target={target} photos={photos} max={photoLimitForTarget(target)} />
    </Card>
    <Card>
      <CardHeader title={unit ? 'Unit documents' : 'Property documents'} />
      <FileList files={files} empty="No documents yet." />
    </Card>
    {!unit && property.leaseDocuments.length > 0 && <Card>
      <CardHeader title="Lease documents" />
      <FileList files={property.leaseDocuments} empty="No lease documents yet." />
    </Card>}
  </>;
}

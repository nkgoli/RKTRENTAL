import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import { listWorkspacePhotos } from '@/lib/storage/service';
import { Card, CardHeader } from '@/components/ui';
import { WorkspaceMedia } from '@/components/workspace/WorkspaceMedia';

export default async function PropertyMediaPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ unit?: string }>;
}) {
  const [session, { id }, { unit: unitId }] = await Promise.all([requireManagerRole(), params, searchParams]);
  const data = propertiesDb(session.organizationId);
  const record = unitId ? await data.getUnit(id, unitId) : await data.getProperty(id);
  if (!record) notFound();
  const target = unitId ? { kind: 'unit' as const, id: unitId } : { kind: 'property' as const, id };
  const photos = await listWorkspacePhotos(session.organizationId, target);
  return <Card><CardHeader title="Photos & documents" /><WorkspaceMedia target={target} photos={photos} files={record.files} /></Card>;
}

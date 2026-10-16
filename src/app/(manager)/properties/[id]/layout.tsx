import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace/Workspace';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import { formatAddress } from '@/lib/properties/format';
import { previewUrl } from '../_components/Media';

/** Child routes select the tab; ?unit=<unitId> selects a unit within the same property workspace. */
export default async function PropertyWorkspaceLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([requireManagerRole(), params]);
  const property = await propertiesDb(session.organizationId).getProperty(id);
  if (!property) notFound();
  const units = property.units.map((unit) => ({
    id: unit.id, number: unit.number, isImplicit: unit.isImplicit, status: unit.status,
  }));
  const activeUnitCount = units.filter((unit) => unit.status !== 'ARCHIVED').length;
  const firstPhoto = property.photos[0];

  return <>
    <Workspace
      scope={{
        propertyId: property.id,
        propertyName: property.name,
        propertyType: property.type,
        propertyArchived: property.archived,
        propertyAddress: formatAddress(property),
        activeUnitCount,
      }}
      units={units}
      coverKind={activeUnitCount === 1 ? 'house' : 'apartment'}
      coverSrc={firstPhoto ? previewUrl(firstPhoto.id) : undefined}
    />
    {children}
  </>;
}

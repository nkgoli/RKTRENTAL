import { db } from '@/lib/db/client';
import type { MaintenanceBoardRequest } from '@/lib/maintenance';

/** The list service only selects a cover. Details expose every attached photo, in one batch. */
export async function withRequestPhotos(
  organizationId: string,
  requests: MaintenanceBoardRequest[],
) {
  if (!requests.length) return requests;
  const photos = await db.maintenancePhoto.findMany({
    where: {
      organizationId,
      maintenanceRequestId: { in: requests.map((request) => request.id) },
      documentId: { not: null },
    },
    select: { maintenanceRequestId: true, documentId: true },
    orderBy: { createdAt: 'asc' },
  });
  return requests.map((request) => ({
    ...request,
    photos: photos
      .filter((photo) => photo.maintenanceRequestId === request.id)
      .map(({ documentId }) => ({ documentId })),
  }));
}

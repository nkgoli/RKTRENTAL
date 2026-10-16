'use server';

import { MaintenancePriority } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { addRequestPhoto, createRequestAsManager } from '@/lib/maintenance';
import { propertiesDb } from '@/lib/properties/data';

function value(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

export async function createPropertyMaintenanceAction(
  propertyId: string,
  returnUnitId: string,
  form: FormData,
) {
  const session = await requireManagerRole();
  const unitId = value(form, 'unitId');
  const unit = await propertiesDb(session.organizationId).getUnit(propertyId, unitId);
  if (!unit) throw new Error('Choose a unit from this property.');

  const request = await createRequestAsManager(session, {
    unitId,
    title: value(form, 'title'),
    description: value(form, 'description'),
    priority: value(form, 'priority') as MaintenancePriority,
  });
  const photo = form.get('photo');
  if (photo instanceof File && photo.size) await addRequestPhoto(session, request.id, photo);

  revalidatePath('/maintenance');
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/maintenance`);
  const unitQuery = returnUnitId ? `?unit=${encodeURIComponent(returnUnitId)}` : '';
  redirect(`/properties/${propertyId}/maintenance${unitQuery}#request-${request.id}`);
}

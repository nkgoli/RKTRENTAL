import type { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import {
  editRequestDetails,
  addRequestComment,
  addRequestPhoto,
  assignVendor,
  changeRequestStatus,
  createRequestAsManager,
  MaintenanceError,
} from '@/lib/maintenance';
import type { RequestActionResult } from './RequestActionForm';

export const formValue = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

function refresh(propertyId: string) {
  revalidatePath('/maintenance');
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/maintenance`);
}

function failure(error: unknown): RequestActionResult {
  return {
    error:
      error instanceof MaintenanceError
        ? error.message
        : 'The request could not be saved. Your changes are still here. Try again.',
  };
}

export async function createRequest(
  form: FormData,
  propertyId?: string,
  selectedUnitId?: string,
): Promise<RequestActionResult> {
  const session = await requireManagerRole();
  try {
    const unitId = formValue(form, 'unitId');
    if (selectedUnitId && selectedUnitId !== unitId)
      return { error: 'Choose a unit from the current property and unit scope.' };
    if (propertyId) {
      const unit = await db.unit.findFirst({
        where: {
          id: unitId,
          propertyId,
          organizationId: session.organizationId,
          status: { not: 'ARCHIVED' },
        },
        select: { id: true },
      });
      if (!unit || (selectedUnitId && selectedUnitId !== unitId))
        return { error: 'Choose a unit from the current property and unit scope.' };
    }
    const request = await createRequestAsManager(session, {
      unitId,
      title: formValue(form, 'title'),
      description: formValue(form, 'description'),
      priority: formValue(form, 'priority') as MaintenancePriority,
    });
    const photo = form.get('photo');
    let message = 'Repair request created.';
    if (photo instanceof File && photo.size) {
      try {
        await addRequestPhoto(session, request.id, photo);
      } catch {
        message =
          'Repair request created, but the photo could not be uploaded. Open Manage request to add it again.';
      }
    }
    refresh(request.propertyId);
    const destination = propertyId
      ? `/properties/${propertyId}/maintenance${selectedUnitId ? `?unit=${encodeURIComponent(selectedUnitId)}` : ''}`
      : '/maintenance';
    return { message, requestId: request.id, requestHref: `${destination}#request-${request.id}` };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRequest(
  kind: 'assign' | 'status' | 'comment' | 'photo',
  form: FormData,
  propertyId?: string,
  unitId?: string,
): Promise<RequestActionResult> {
  const session = await requireManagerRole();
  try {
    const requestId = formValue(form, 'requestId');
    const request = await db.maintenanceRequest.findFirst({
      where: {
        id: requestId,
        organizationId: session.organizationId,
        ...(propertyId ? { propertyId } : {}),
        ...(unitId ? { unitId } : {}),
      },
      select: { propertyId: true },
    });
    if (!request)
      return {
        error: 'This request is no longer available in this scope. Refresh the list and try again.',
      };
    if (kind === 'assign') await assignVendor(session, requestId, formValue(form, 'vendorId'));
    if (kind === 'status')
      await changeRequestStatus(session, requestId, formValue(form, 'status') as MaintenanceStatus);
    if (kind === 'comment') await addRequestComment(session, requestId, formValue(form, 'comment'));
    if (kind === 'photo') {
      const photo = form.get('photo');
      if (!(photo instanceof File) || !photo.size)
        return { error: 'Choose a photo before uploading.' };
      await addRequestPhoto(session, requestId, photo);
    }
    refresh(request.propertyId);
    return {
      message: {
        assign: 'Vendor assigned.',
        status: 'Status updated.',
        comment: 'Comment added.',
        photo: 'Photo uploaded.',
      }[kind],
    };
  } catch (error) {
    return failure(error);
  }
}

export async function saveRequestDetails(
  form: FormData,
  requestId: string,
  propertyId: string,
  unitId?: string,
): Promise<RequestActionResult> {
  const session = await requireManagerRole();
  try {
    await editRequestDetails(
      session,
      requestId,
      {
        title: formValue(form, 'title'),
        description: formValue(form, 'description'),
        priority: formValue(form, 'priority') as MaintenancePriority,
      },
      { propertyId, ...(unitId ? { unitId } : {}) },
    );
    refresh(propertyId);
    revalidatePath(`/maintenance/${requestId}/edit`);
    return { message: 'Repair request saved.' };
  } catch (error) {
    return failure(error);
  }
}

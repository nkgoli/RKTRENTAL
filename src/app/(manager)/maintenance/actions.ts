'use server';

import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import {
  addRequestComment,
  addRequestPhoto,
  assignVendor,
  changeRequestStatus,
  createRequestAsManager,
} from '@/lib/maintenance';

function value(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

function completed(requestId?: string) {
  revalidatePath('/maintenance');
  redirect(requestId ? `/maintenance#request-${requestId}` : '/maintenance');
}

export async function createMaintenanceAction(form: FormData) {
  const session = await requireManagerRole();
  const request = await createRequestAsManager(session, {
    unitId: value(form, 'unitId'),
    title: value(form, 'title'),
    description: value(form, 'description'),
    priority: value(form, 'priority') as MaintenancePriority,
  });
  const photo = form.get('photo');
  if (photo instanceof File && photo.size) await addRequestPhoto(session, request.id, photo);
  completed(request.id);
}

export async function assignMaintenanceAction(form: FormData) {
  const session = await requireManagerRole();
  const requestId = value(form, 'requestId');
  await assignVendor(session, requestId, value(form, 'vendorId'));
  completed(requestId);
}

export async function setMaintenanceStatusAction(form: FormData) {
  const session = await requireManagerRole();
  const requestId = value(form, 'requestId');
  await changeRequestStatus(session, requestId, value(form, 'status') as MaintenanceStatus);
  completed(requestId);
}

export async function commentMaintenanceAction(form: FormData) {
  const session = await requireManagerRole();
  const requestId = value(form, 'requestId');
  await addRequestComment(session, requestId, value(form, 'comment'));
  completed(requestId);
}

export async function uploadMaintenancePhotoAction(form: FormData) {
  const session = await requireManagerRole();
  const requestId = value(form, 'requestId');
  const photo = form.get('photo');
  if (!(photo instanceof File) || !photo.size) throw new Error('Choose a photo');
  await addRequestPhoto(session, requestId, photo);
  completed(requestId);
}

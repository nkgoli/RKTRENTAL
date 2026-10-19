'use server';
import { createRequest, updateRequest } from '@/components/maintenance/request-actions';
export async function createMaintenanceAction(form: FormData) {
  return createRequest(form);
}
export async function assignMaintenanceAction(form: FormData) {
  return updateRequest('assign', form);
}
export async function setMaintenanceStatusAction(form: FormData) {
  return updateRequest('status', form);
}
export async function commentMaintenanceAction(form: FormData) {
  return updateRequest('comment', form);
}
export async function uploadMaintenancePhotoAction(form: FormData) {
  return updateRequest('photo', form);
}

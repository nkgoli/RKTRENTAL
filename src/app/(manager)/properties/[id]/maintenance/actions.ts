'use server';
import { createRequest, updateRequest } from '@/components/maintenance/request-actions';
export async function createPropertyMaintenanceAction(
  propertyId: string,
  unitId: string,
  form: FormData,
) {
  return createRequest(form, propertyId, unitId);
}
export async function assignPropertyMaintenanceAction(
  propertyId: string,
  unitId: string,
  form: FormData,
) {
  return updateRequest('assign', form, propertyId, unitId);
}
export async function statusPropertyMaintenanceAction(
  propertyId: string,
  unitId: string,
  form: FormData,
) {
  return updateRequest('status', form, propertyId, unitId);
}
export async function commentPropertyMaintenanceAction(
  propertyId: string,
  unitId: string,
  form: FormData,
) {
  return updateRequest('comment', form, propertyId, unitId);
}
export async function photoPropertyMaintenanceAction(
  propertyId: string,
  unitId: string,
  form: FormData,
) {
  return updateRequest('photo', form, propertyId, unitId);
}

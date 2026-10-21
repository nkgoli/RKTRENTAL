'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { propertiesDb } from '@/lib/properties/data';
import { parsePropertyInput, parseUnitInput, type FieldErrors } from '@/lib/properties/validation';
import { parseRoiInputs } from '@/lib/properties/roi-inputs';
import { roiReturnPath } from '@/lib/analysis/return-path';

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  destination?: string;
};

const failed = (errors: FieldErrors): FormState => ({
  errors,
  message: errors._form ?? 'Please fix the highlighted fields.',
});

export async function createPropertyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManagerRole();
  const parsed = parsePropertyInput(formData);
  if (!parsed.ok) return failed(parsed.errors);
  const result = await propertiesDb(session.organizationId).createProperty(parsed.data);
  if (!result.ok) return failed(result.errors);
  revalidatePath('/properties');
  revalidatePath('/roi-analysis');
  return { ok: true, destination: `/properties/${result.id}` };
}

export async function updatePropertyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const session = await requireManagerRole();
  const parsed = parsePropertyInput(formData);
  if (!parsed.ok) return failed(parsed.errors);
  const result = await propertiesDb(session.organizationId).updateProperty(propertyId, parsed.data);
  if (!result.ok) return failed(result.errors);
  revalidatePath('/properties');
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/roi-analysis');
  return { ok: true, message: 'Property saved.' };
}

/** Dedicated Edit Property form submits only changed basics and financial leaf patches. */
export async function savePropertyPageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManagerRole();
  const propertyId = String(formData.get('propertyId') ?? '');
  const parsed = parsePropertyInput(formData);
  if (!parsed.ok) return failed(parsed.errors);
  const allowed = ['name', 'type', 'street', 'city', 'state', 'postalCode', 'yearBuilt', 'ownerId'];
  let changes: string[];
  try {
    const raw: unknown = JSON.parse(String(formData.get('changedBasics')));
    if (
      !Array.isArray(raw) ||
      !raw.every((key) => typeof key === 'string' && allowed.includes(key))
    )
      throw Error();
    changes = raw;
  } catch {
    return failed({ _form: 'Reload this property and try saving again.' });
  }
  // Opened from Returns & ROI: return there, never to an unvalidated address.
  const returnTo = roiReturnPath(formData.get('returnTo'), propertyId);
  const result = await propertiesDb(session.organizationId).updateProperty(
    propertyId,
    parsed.data,
    changes,
    { syncAnalysis: true },
  );
  if (!result.ok) return failed(result.errors);
  revalidatePath('/properties');
  revalidatePath(`/properties/${propertyId}`, 'layout');
  revalidatePath('/roi-analysis');
  return { ok: true, destination: returnTo ?? `/properties/${propertyId}` };
}

export async function updatePropertyRoiAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireManagerRole();
  const propertyId = String(formData.get('propertyId') ?? '');
  const parsed = parseRoiInputs(formData.get('roiInputs'));
  if (!parsed.success) return failed(parsed.errors);
  const result = await propertiesDb(session.organizationId).updateRoiInputs(
    propertyId,
    parsed.data ?? { version: 1, input: {}, options: {} },
  );
  if (!result.ok) return failed(result.errors);
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/roi-analysis');
  return { ok: true, message: 'ROI details saved.' };
}

export async function setPropertyArchivedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const archived = formData.get('archived') === 'true';
  const session = await requireManagerRole();
  const result = await propertiesDb(session.organizationId).setPropertyArchived(
    propertyId,
    archived,
  );
  if (!result.ok) return failed(result.errors);
  revalidatePath('/properties', 'layout');
  if (archived) redirect('/properties?notice=property-archived');
  return { ok: true, message: 'Property restored.' };
}

export async function createUnitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const session = await requireManagerRole();
  const parsed = parseUnitInput(formData);
  if (!parsed.ok) return failed(parsed.errors);
  const result = await propertiesDb(session.organizationId).createUnit(propertyId, parsed.data);
  if (!result.ok) return failed(result.errors);
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true, message: `Unit ${parsed.data.number} added.` };
}

export async function updateUnitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const unitId = String(formData.get('unitId') ?? '');
  const session = await requireManagerRole();
  const parsed = parseUnitInput(formData);
  if (!parsed.ok) return failed(parsed.errors);
  const result = await propertiesDb(session.organizationId).updateUnit(
    propertyId,
    unitId,
    parsed.data,
  );
  if (!result.ok) return failed(result.errors);
  revalidatePath(`/properties/${propertyId}`, 'layout');
  return { ok: true, message: 'Unit saved.' };
}

export async function deleteEmptyUnitAction(formData: FormData): Promise<never> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const unitId = String(formData.get('unitId') ?? '');
  const session = await requireManagerRole();
  if (!propertyId || !unitId) redirect('/properties');

  const result = await db.unit.deleteMany({
    where: {
      id: unitId,
      propertyId,
      organizationId: session.organizationId,
      isImplicit: false,
      leases: { none: {} },
      documents: { none: {} },
      maintenanceRequests: { none: {} },
      applications: { none: {} },
    },
  });
  revalidatePath('/properties');
  revalidatePath(`/properties/${propertyId}`);
  redirect(
    `/properties/${propertyId}?notice=${result.count ? 'unit-deleted' : 'unit-delete-blocked'}`,
  );
}

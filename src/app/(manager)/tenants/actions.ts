'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/access';
import { tenantReturnHref } from './navigation';
import {
  createTenant,
  moveInTenant,
  addTenantNote,
  moveOutTenant,
  TenantServiceError,
  updateTenant,
} from '@/lib/tenants/service';
import {
  parseNewTenantInput,
  parseNoteInput,
  parseTenantInput,
  type FieldErrors,
} from '@/lib/tenants/validation';

export type FormState = { errors: FieldErrors; message?: string; values?: Record<string, string> };

function values(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string') out[key] = value;
  return out;
}

function failure(error: unknown, formData: FormData): FormState {
  if (error instanceof TenantServiceError) {
    return { errors: error.errors, message: error.message, values: values(formData) };
  }
  throw error;
}

/**
 * Route-local document navigation that completes tenant action redirects in production.
 * The result route returns a non-Flight response so the action router falls back to a
 * normal document navigation instead of applying a redirected Flight tree.
 */
function resultHref(tenantId: string, returnTo: string, error?: string) {
  const query = new URLSearchParams({ tenantId, returnTo });
  if (error) query.set('error', error);
  return `/tenants/result?${query}`;
}

export async function addTenantAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('MANAGER');
  const parsed = parseNewTenantInput(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: values(formData) };

  let tenantId: string;
  try {
    ({ tenantId } = await createTenant(session.organizationId, parsed.data));
  } catch (error) {
    return failure(error, formData);
  }
  revalidatePath('/tenants');
  redirect(resultHref(tenantId, tenantReturnHref(formData.get('returnTo'))));
}

export async function updateTenantAction(
  tenantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole('MANAGER');
  const parsed = parseTenantInput(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: values(formData) };

  try {
    await updateTenant(session.organizationId, tenantId, parsed.data);
  } catch (error) {
    return failure(error, formData);
  }
  revalidatePath('/tenants');
  redirect(resultHref(tenantId, tenantReturnHref(formData.get('returnTo'))));
}

export async function addNoteAction(
  tenantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole('MANAGER');
  const parsed = parseNoteInput(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: values(formData) };
  try {
    await addTenantNote(session.organizationId, tenantId, session.name, parsed.data.body);
  } catch (error) {
    return failure(error, formData);
  }
  revalidatePath(`/tenants/${tenantId}`);
  return { errors: {}, message: 'Note added.' };
}

async function leaseAction(
  tenantId: string,
  formData: FormData,
  run: (organizationId: string, leaseId: string) => Promise<void>,
) {
  const session = await requireRole('MANAGER');
  const leaseId = String(formData.get('leaseId') ?? '');
  let message: string | undefined;
  try {
    await run(session.organizationId, leaseId);
  } catch (error) {
    if (!(error instanceof TenantServiceError)) throw error;
    message = error.message;
  }
  revalidatePath('/tenants');
  revalidatePath(`/tenants/${tenantId}`);
  redirect(resultHref(tenantId, tenantReturnHref(formData.get('returnTo')), message));
}

export async function moveInAction(tenantId: string, formData: FormData): Promise<void> {
  await leaseAction(tenantId, formData, (org, leaseId) => moveInTenant(org, tenantId, leaseId));
}

export async function moveOutAction(tenantId: string, formData: FormData): Promise<void> {
  await leaseAction(tenantId, formData, (org, leaseId) => moveOutTenant(org, tenantId, leaseId));
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { parseTerms } from '@/lib/leases/core';
import {
  activateLease,
  createLease,
  LeaseServiceError,
  renewLease,
  terminateLease,
  updateLeaseTerms,
} from '@/lib/leases/service';

export type LeaseFormState = { message?: string; errors?: Record<string, string>; ok?: boolean };
const failure = (error: unknown): LeaseFormState => {
  if (error instanceof LeaseServiceError)
    return { message: error.message, errors: error.field ? { [error.field]: error.message } : {} };
  throw error;
};

export async function saveLeaseAction(
  _prev: LeaseFormState,
  form: FormData,
): Promise<LeaseFormState> {
  const session = await requireManagerRole();
  const parsed = parseTerms(form);
  if (!parsed.ok) return { message: 'Please fix the highlighted fields.', errors: parsed.errors };
  const renewId = String(form.get('renewId') ?? '');
  let id: string;
  try {
    if (renewId) {
      ({ id } = await renewLease(session.organizationId, renewId, parsed.data));
    } else {
      ({ id } = await createLease(
        session.organizationId,
        String(form.get('unitId') ?? ''),
        String(form.get('tenantId') ?? ''),
        parsed.data,
        form.get('status') === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
      ));
    }
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/leases');
  redirect(`/leases/${id}`);
}

export async function editTermsAction(
  _prev: LeaseFormState,
  form: FormData,
): Promise<LeaseFormState> {
  const session = await requireManagerRole();
  const leaseId = String(form.get('leaseId') ?? '');
  const parsed = parseTerms(form);
  if (!parsed.ok) return { message: 'Please fix the highlighted fields.', errors: parsed.errors };
  try {
    await updateLeaseTerms(session.organizationId, leaseId, parsed.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
  return { ok: true, message: 'Lease terms saved.' };
}

export async function activateLeaseAction(
  _prev: LeaseFormState,
  form: FormData,
): Promise<LeaseFormState> {
  const session = await requireManagerRole();
  const leaseId = String(form.get('leaseId') ?? '');
  try {
    await activateLease(session.organizationId, leaseId);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
  return { ok: true, message: 'Lease activated.' };
}

export async function terminateLeaseAction(
  _prev: LeaseFormState,
  form: FormData,
): Promise<LeaseFormState> {
  const session = await requireManagerRole();
  const leaseId = String(form.get('leaseId') ?? '');
  try {
    await terminateLease(session.organizationId, leaseId);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
  return { ok: true, message: 'Lease terminated.' };
}

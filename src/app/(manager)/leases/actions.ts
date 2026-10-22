'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManagerRole, requireManagerWriteRole } from '@/lib/auth/access';
import { deleteLeaseDraft } from '@/lib/lease-create/delete-draft';
import { parseTerms } from '@/lib/leases/core';
import { recordNotice } from '@/lib/leases/events';
import { parseIsoDate } from '@/lib/tenants/validation';
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

export async function recordNoticeAction(
  _prev: LeaseFormState,
  form: FormData,
): Promise<LeaseFormState> {
  const session = await requireManagerRole();
  const leaseId = String(form.get('leaseId') ?? '');
  const noticeGivenAt = parseIsoDate(String(form.get('noticeGivenAt') ?? ''));
  const moveOutText = String(form.get('moveOutDate') ?? '');
  const moveOutDate = moveOutText ? parseIsoDate(moveOutText) : null;
  if (!noticeGivenAt)
    return { message: 'Enter the date notice was given.', errors: { noticeGivenAt: 'Required' } };
  if (moveOutText && !moveOutDate)
    return { message: 'Enter a valid move-out date.', errors: { moveOutDate: 'Invalid date' } };
  try {
    await recordNotice(
      session.organizationId,
      leaseId,
      { noticeGivenAt, moveOutDate },
      session.name,
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
  revalidatePath('/tenants');
  return { ok: true, message: 'Notice recorded.' };
}

export type DeleteDraftState = { message?: string };

/**
 * Deletes an unsent draft. Eligibility, organization scope and locking live in the service. A
 * refusal stays in the dialog; success (or an already-deleted draft) leaves through the
 * draft-deleted route, which rebuilds the destination from the authorized unit.
 */
export async function deleteDraftLeaseAction(
  _prev: DeleteDraftState,
  form: FormData,
): Promise<DeleteDraftState> {
  const session = await requireManagerWriteRole();
  const leaseId = String(form.get('leaseId') ?? '');
  const returnTo = String(form.get('returnTo') ?? '');
  const result = await deleteLeaseDraft(session.organizationId, leaseId);
  if (!result.ok && result.reason === 'ineligible') return { message: result.message };
  const query = new URLSearchParams({ notice: result.ok ? 'draft-deleted' : 'draft-gone' });
  if (result.ok && (returnTo === 'property' || returnTo === 'unit')) {
    query.set('to', returnTo);
    query.set('unit', result.unitId);
  }
  // No revalidatePath here: it would re-render the deleted lease's page as "not found" before
  // navigating. The redirect target is a fresh document load.
  redirect(`/leases/draft-deleted?${query}`);
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

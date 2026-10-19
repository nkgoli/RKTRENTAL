'use server';

import { redirect } from 'next/navigation';
import {
  activateLeaseAction,
  editTermsAction,
  recordNoticeAction,
  terminateLeaseAction,
  type LeaseFormState,
} from '../actions';
import type { LeaseResult } from './feedback';

async function complete(
  action: (previous: LeaseFormState, form: FormData) => Promise<LeaseFormState>,
  result: LeaseResult,
  previous: LeaseFormState,
  form: FormData,
): Promise<LeaseFormState> {
  // Keep the existing authentication, validation, transaction and revalidation.
  const state = await action(previous, form);
  if (!state.ok) return state;
  const query = new URLSearchParams({ saved: result });
  const scope = form.get('returnScope');
  if (scope === 'property' || scope === 'unit') query.set('scope', scope);
  const id = encodeURIComponent(String(form.get('leaseId') ?? ''));
  // A non-Flight result completes the navigation when the production client
  // cannot apply the updated action tree. Invalid input stays in the form.
  redirect(`/leases/${id}/result?${query}`);
}

export async function editDetailTermsAction(previous: LeaseFormState, form: FormData) {
  return complete(editTermsAction, 'terms', previous, form);
}

export async function recordDetailNoticeAction(previous: LeaseFormState, form: FormData) {
  return complete(recordNoticeAction, 'notice', previous, form);
}

export async function activateDetailLeaseAction(previous: LeaseFormState, form: FormData) {
  return complete(activateLeaseAction, 'activated', previous, form);
}

export async function terminateDetailLeaseAction(previous: LeaseFormState, form: FormData) {
  return complete(terminateLeaseAction, 'terminated', previous, form);
}

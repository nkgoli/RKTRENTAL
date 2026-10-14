'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireTenantRole } from '@/lib/auth/access';
import { addRequestComment, MaintenanceError } from '@/lib/maintenance';

/** Tenant comment on their own request; the service refuses requests that are not theirs. */
export async function commentRepairAction(form: FormData) {
  const session = await requireTenantRole();
  const requestId = String(form.get('requestId') ?? '');
  let notice = 'commented';
  try {
    await addRequestComment(session, requestId, String(form.get('comment') ?? ''));
  } catch (error) {
    if (!(error instanceof MaintenanceError)) throw error;
    notice = 'comment-failed';
  }
  revalidatePath('/repairs');
  redirect(`/repairs?notice=${notice}#request-${requestId}`);
}

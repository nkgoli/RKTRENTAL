'use server';

import { revalidatePath } from 'next/cache';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';

export type DocumentActionState = { ok?: boolean; message?: string };

export async function renameLeaseDocumentAction(form: FormData): Promise<DocumentActionState> {
  const session = await requireManagerRole();
  const id = String(form.get('id') ?? '');
  const leaseId = String(form.get('leaseId') ?? '');
  const name = String(form.get('name') ?? '')
    .trim()
    .slice(0, 200);
  if (!id || !leaseId || !name) return { message: 'Enter a document name.' };
  try {
    const result = await db.document.updateMany({
      where: { id, leaseId, organizationId: session.organizationId },
      data: { name },
    });
    if (!result.count) return { message: 'This document is no longer available.' };
  } catch {
    return { message: 'The file could not be renamed. Please try again.' };
  }
  revalidatePath(`/leases/${leaseId}`);
  return { ok: true, message: 'Document renamed.' };
}

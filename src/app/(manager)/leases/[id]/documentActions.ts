'use server';

import { revalidatePath } from 'next/cache';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';

export async function renameLeaseDocumentAction(form: FormData) {
  const session = await requireManagerRole();
  const id = String(form.get('id') ?? '');
  const leaseId = String(form.get('leaseId') ?? '');
  const name = String(form.get('name') ?? '')
    .trim()
    .slice(0, 200);
  if (!id || !leaseId || !name) return;
  await db.document.updateMany({
    where: { id, leaseId, organizationId: session.organizationId },
    data: { name },
  });
  revalidatePath(`/leases/${leaseId}`);
}

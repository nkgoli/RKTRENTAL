import { describe, expect, it, vi } from 'vitest';

const { updateMany, revalidatePath } = vi.hoisted(() => ({
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org-1' }),
}));
vi.mock('@/lib/db/client', () => ({ db: { document: { updateMany } } }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { renameLeaseDocumentAction } from '@/app/(manager)/leases/[id]/documentActions';

describe('lease document rename', () => {
  it('updates only the file on the named lease in the signed-in organization', async () => {
    const form = new FormData();
    form.set('id', 'doc-1');
    form.set('leaseId', 'lease-1');
    form.set('name', '  Signed lease.pdf  ');
    await renameLeaseDocumentAction(form);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'doc-1', leaseId: 'lease-1', organizationId: 'org-1' },
      data: { name: 'Signed lease.pdf' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/leases/lease-1');
  });

  it('does not write a blank name', async () => {
    updateMany.mockClear();
    const form = new FormData();
    form.set('id', 'doc-1');
    form.set('leaseId', 'lease-1');
    form.set('name', '   ');
    await renameLeaseDocumentAction(form);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

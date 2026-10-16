import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { listWorkspacePhotos } from '@/lib/storage/service';

describe('workspace photos', () => {
  it('excludes maintenance-linked photos from property and unit queries', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = { document: { findMany } } as unknown as PrismaClient;
    await listWorkspacePhotos('org-1', { kind: 'property', id: 'elm' }, client);
    await listWorkspacePhotos('org-1', { kind: 'unit', id: '4b' }, client);

    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { organizationId: 'org-1', propertyId: 'elm', kind: 'PHOTO', maintenancePhoto: { is: null } },
    }));
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { organizationId: 'org-1', unitId: '4b', kind: 'PHOTO', maintenancePhoto: { is: null } },
    }));
  });
});

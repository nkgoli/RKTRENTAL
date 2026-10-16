import { describe, expect, it, vi } from 'vitest';
import { FileService } from '../../src/lib/storage/service';
import type { FileActor, StorageAdapter } from '../../src/lib/storage/types';
import { JPG, memoryRepo } from './helpers';

const manager: FileActor = { subjectId: 'manager-1', organizationId: 'org-1', role: 'MANAGER' };
const otherOrg: FileActor = { subjectId: 'manager-2', organizationId: 'org-2', role: 'MANAGER' };
const owner: FileActor = { subjectId: 'owner-1', organizationId: 'org-1', role: 'OWNER' };
const property1 = { kind: 'property' as const, id: 'property-1' };
const property2 = { kind: 'property' as const, id: 'property-2' };

const storage: StorageAdapter = {
  driver: 'memory',
  put: vi.fn(async () => undefined),
  get: vi.fn(async () => null),
  delete: vi.fn(async () => undefined),
  getSignedUrl: vi.fn(async () => null),
};

function makeService() {
  const repo = memoryRepo();
  const access = {
    canAccessTarget: async (actor: FileActor, target: { kind: string; id: string }) =>
      actor.organizationId === 'org-1' && ['property-1', 'property-2', 'unit-1'].includes(target.id),
    canAccessDocument: async () => true,
  };
  return { repo, service: new FileService(storage, repo, access, {}) };
}

async function seedPhoto(
  repo: ReturnType<typeof memoryRepo>,
  name: string,
  target: typeof property1 = property1,
  sortOrder = 0,
) {
  return repo.create({
    organizationId: 'org-1',
    leaseId: null,
    propertyId: target.kind === 'property' ? target.id : null,
    unitId: null,
    kind: 'PHOTO',
    name,
    storageKey: name,
    sizeBytes: JPG.byteLength,
    mimeType: 'image/jpeg',
    sortOrder,
  });
}

describe('photo ordering and cover', () => {
  it('appends new photos to the end and lists them in sortOrder', async () => {
    const { service } = makeService();
    const first = await service.upload(manager, {
      target: property1,
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      kind: 'PHOTO',
      body: JPG,
    });
    const second = await service.upload(manager, {
      target: property1,
      fileName: 'b.jpg',
      mimeType: 'image/jpeg',
      kind: 'PHOTO',
      body: JPG,
    });
    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);
    expect((await service.list(manager, property1)).map((d) => d.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('reorderPhotos persists the given order', async () => {
    const { repo, service } = makeService();
    const a = await seedPhoto(repo, 'a.jpg', property1, 0);
    const b = await seedPhoto(repo, 'b.jpg', property1, 1);
    const c = await seedPhoto(repo, 'c.jpg', property1, 2);
    const reordered = await service.reorderPhotos(manager, property1, [c.id, a.id, b.id]);
    expect(reordered.map((d) => d.id)).toEqual([c.id, a.id, b.id]);
    expect(reordered.map((d) => d.sortOrder)).toEqual([0, 1, 2]);
    expect((await service.list(manager, property1)).map((d) => d.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
    const appended = await service.upload(manager, {
      target: property1,
      fileName: 'd.jpg',
      mimeType: 'image/jpeg',
      kind: 'PHOTO',
      body: JPG,
    });
    expect(appended.sortOrder).toBe(3);
    expect((await service.list(manager, property1)).map((d) => d.id)).toEqual([
      c.id,
      a.id,
      b.id,
      appended.id,
    ]);
  });

  it('setCover leaves exactly one cover and lists it first', async () => {
    const { repo, service } = makeService();
    const a = await seedPhoto(repo, 'a.jpg', property1, 0);
    const b = await seedPhoto(repo, 'b.jpg', property1, 1);
    await service.setCover(manager, property1, a.id);
    const after = await service.setCover(manager, property1, b.id);
    expect(after.filter((d) => d.isCover).map((d) => d.id)).toEqual([b.id]);
    expect(after[0].id).toBe(b.id);
    expect(repo.rows.filter((d) => d.isCover)).toHaveLength(1);
  });

  it('rejects cross-target ids in reorder and cover', async () => {
    const { repo, service } = makeService();
    const mine = await seedPhoto(repo, 'mine.jpg', property1, 0);
    const foreign = await seedPhoto(repo, 'foreign.jpg', property2, 0);
    await expect(
      service.reorderPhotos(manager, property1, [mine.id, foreign.id]),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.setCover(manager, property1, foreign.id)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects non-photos, duplicates, and cross-org access', async () => {
    const { repo, service } = makeService();
    const photo = await seedPhoto(repo, 'a.jpg', property1, 0);
    const doc = await repo.create({
      organizationId: 'org-1',
      leaseId: null,
      propertyId: 'property-1',
      unitId: null,
      kind: 'OTHER',
      name: 'notes.pdf',
      storageKey: 'notes',
      sizeBytes: 3,
      mimeType: 'application/pdf',
      sortOrder: null,
    });
    await expect(service.reorderPhotos(manager, property1, [doc.id])).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.setCover(manager, property1, doc.id)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.reorderPhotos(manager, property1, [photo.id, photo.id]),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.reorderPhotos(otherOrg, property1, [photo.id])).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.setCover(otherOrg, property1, photo.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.reorderPhotos(manager, property1, [])).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.reorderPhotos(owner, property1, [photo.id])).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.setCover(owner, property1, photo.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects an incomplete reorder without changing stored order', async () => {
    const { repo, service } = makeService();
    const a = await seedPhoto(repo, 'a.jpg', property1, 0);
    const b = await seedPhoto(repo, 'b.jpg', property1, 1);
    await expect(service.reorderPhotos(manager, property1, [b.id])).rejects.toMatchObject({
      status: 400,
    });
    expect((await service.list(manager, property1)).map((d) => d.id)).toEqual([a.id, b.id]);
  });
});

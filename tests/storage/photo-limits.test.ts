import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileService } from '../../src/lib/storage/service';
import {
  DEFAULT_PHOTO_LIMIT_PER_PROPERTY,
  DEFAULT_PHOTO_LIMIT_PER_UNIT,
  photoLimitForTarget,
} from '../../src/lib/storage/photo-limits';
import type { FileActor, StorageAdapter } from '../../src/lib/storage/types';
import { JPG, PDF, memoryRepo } from './helpers';

const manager: FileActor = { subjectId: 'manager-1', organizationId: 'org-1', role: 'MANAGER' };

const allowAll = {
  canAccessTarget: async () => true,
  canAccessDocument: async () => true,
};

function memoryStorage(): StorageAdapter & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    driver: 'memory',
    objects,
    put: vi.fn(async (key: string, body: Uint8Array) => {
      objects.set(key, body);
    }),
    get: vi.fn(async (key: string) => {
      const body = objects.get(key);
      return body ? { body, contentType: 'image/jpeg' } : null;
    }),
    delete: vi.fn(async (key: string) => {
      objects.delete(key);
    }),
    getSignedUrl: vi.fn(async () => 'https://uploads.example.test/put'),
  };
}

async function seedPhotos(
  repo: ReturnType<typeof memoryRepo>,
  target: { kind: 'property' | 'unit'; id: string },
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    await repo.create({
      organizationId: 'org-1',
      leaseId: null,
      propertyId: target.kind === 'property' ? target.id : null,
      unitId: target.kind === 'unit' ? target.id : null,
      kind: 'PHOTO',
      name: `photo-${index}.jpg`,
      storageKey: `seed/${target.kind}/${target.id}/${index}`,
      sizeBytes: JPG.byteLength,
      mimeType: 'image/jpeg',
    });
  }
}

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

describe('photo limits', () => {
  it('defaults to 20 per property and 10 per unit, with no limit for leases', () => {
    expect(photoLimitForTarget({ kind: 'property', id: 'p1' }, {})).toBe(
      DEFAULT_PHOTO_LIMIT_PER_PROPERTY,
    );
    expect(photoLimitForTarget({ kind: 'unit', id: 'u1' }, {})).toBe(DEFAULT_PHOTO_LIMIT_PER_UNIT);
    expect(photoLimitForTarget({ kind: 'lease', id: 'l1' }, {})).toBeNull();
    expect(DEFAULT_PHOTO_LIMIT_PER_PROPERTY).toBe(20);
    expect(DEFAULT_PHOTO_LIMIT_PER_UNIT).toBe(10);
  });

  it('rejects a property photo upload once 20 photos exist, with a 4xx error naming the limit', async () => {
    const repo = memoryRepo();
    await seedPhotos(repo, { kind: 'property', id: 'property-1' }, 20);
    const service = new FileService(memoryStorage(), repo, allowAll, {});
    await expect(
      service.upload(manager, {
        target: { kind: 'property', id: 'property-1' },
        fileName: 'one-more.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        body: JPG,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.upload(manager, {
        target: { kind: 'property', id: 'property-1' },
        fileName: 'one-more.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        body: JPG,
      }),
    ).rejects.toThrow(/Photo limit reached.*20/);
    expect(repo.rows.filter((row) => row.kind === 'PHOTO')).toHaveLength(20);
  });

  it('rejects a unit photo upload once 10 photos exist', async () => {
    const repo = memoryRepo();
    await seedPhotos(repo, { kind: 'unit', id: 'unit-1' }, 10);
    const service = new FileService(memoryStorage(), repo, allowAll, {});
    await expect(
      service.upload(manager, {
        target: { kind: 'unit', id: 'unit-1' },
        fileName: 'one-more.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        body: JPG,
      }),
    ).rejects.toThrow(/Photo limit reached.*10/);
    await expect(
      service.createSignedUpload(manager, {
        target: { kind: 'unit', id: 'unit-1' },
        fileName: 'one-more.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        sizeBytes: JPG.byteLength,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('honours PHOTO_LIMIT_PER_PROPERTY and PHOTO_LIMIT_PER_UNIT overrides', async () => {
    const repo = memoryRepo();
    await seedPhotos(repo, { kind: 'property', id: 'property-1' }, 2);
    await seedPhotos(repo, { kind: 'unit', id: 'unit-1' }, 1);
    const env = { PHOTO_LIMIT_PER_PROPERTY: '2', PHOTO_LIMIT_PER_UNIT: '1' };
    const service = new FileService(memoryStorage(), repo, allowAll, env);
    expect(await service.getPhotoUsage(manager, { kind: 'property', id: 'property-1' })).toEqual({
      used: 2,
      max: 2,
    });
    expect(await service.getPhotoUsage(manager, { kind: 'unit', id: 'unit-1' })).toEqual({
      used: 1,
      max: 1,
    });
    await expect(
      service.upload(manager, {
        target: { kind: 'property', id: 'property-1' },
        fileName: 'extra.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        body: JPG,
      }),
    ).rejects.toThrow(/limit.*2/);
  });

  it('reads the limits from process.env when no env is injected', async () => {
    process.env.PHOTO_LIMIT_PER_PROPERTY = '1';
    const repo = memoryRepo();
    await seedPhotos(repo, { kind: 'property', id: 'property-1' }, 1);
    const service = new FileService(memoryStorage(), repo, allowAll);
    await expect(
      service.upload(manager, {
        target: { kind: 'property', id: 'property-1' },
        fileName: 'extra.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        body: JPG,
      }),
    ).rejects.toThrow(/Photo limit reached/);
  });

  it('does not limit documents (non-photo kinds) on a full property', async () => {
    const repo = memoryRepo();
    await seedPhotos(repo, { kind: 'property', id: 'property-1' }, 20);
    const service = new FileService(memoryStorage(), repo, allowAll, {});
    const doc = await service.upload(manager, {
      target: { kind: 'property', id: 'property-1' },
      fileName: 'lease.pdf',
      mimeType: 'application/pdf',
      kind: 'OTHER',
      body: PDF,
    });
    expect(doc.kind).toBe('OTHER');
    const signed = await service.createSignedUpload(manager, {
      target: { kind: 'property', id: 'property-1' },
      fileName: 'notice.pdf',
      mimeType: 'application/pdf',
      kind: 'OTHER',
      sizeBytes: PDF.byteLength,
    });
    expect(signed.uploadUrl).toContain('https://');
  });

  it('allows concurrent photo uploads only up to the limit', async () => {
    const repo = memoryRepo();
    await seedPhotos(repo, { kind: 'property', id: 'property-1' }, 19);
    const service = new FileService(memoryStorage(), repo, allowAll, {});
    const attempts = await Promise.allSettled([
      service.upload(manager, {
        target: { kind: 'property', id: 'property-1' },
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        body: JPG,
      }),
      service.upload(manager, {
        target: { kind: 'property', id: 'property-1' },
        fileName: 'b.jpg',
        mimeType: 'image/jpeg',
        kind: 'PHOTO',
        body: JPG,
      }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(repo.rows.filter((row) => row.kind === 'PHOTO')).toHaveLength(20);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  createPrismaFileService: vi.fn(),
}));

vi.mock('../../src/lib/storage/http', () => ({
  requireActor: routeMocks.requireActor,
  publicDocument: (document: unknown) => document,
  errorResponse: (error: unknown) =>
    Response.json({ error: error instanceof Error ? error.message : 'error' }, { status: 500 }),
}));

vi.mock('../../src/lib/storage/service', () => ({
  createPrismaFileService: routeMocks.createPrismaFileService,
}));

import { POST as beginUpload } from '../../src/app/api/files/upload-url/route';
import { POST as completeUpload } from '../../src/app/api/files/upload-url/complete/route';

const actor = { subjectId: 'manager-1', organizationId: 'org-1', role: 'MANAGER' as const };
const input = {
  fileName: 'notice.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 12,
  targetType: 'lease',
  targetId: 'lease-1',
  kind: 'NOTICE',
  storageKey: 'org/org-1/lease/lease-1/00000000-0000-4000-8000-000000000000-notice.pdf',
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/files/upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('signed upload routes', () => {
  const service = {
    createSignedUpload: vi.fn(),
    completeSignedUpload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.requireActor.mockResolvedValue(actor);
    routeMocks.createPrismaFileService.mockResolvedValue(service);
  });

  it('starts a signed upload without returning or creating a Document', async () => {
    service.createSignedUpload.mockResolvedValue({
      uploadUrl: 'https://storage.example.test/signed-put',
      storageKey: input.storageKey,
    });

    const response = await beginUpload(post(input));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      uploadUrl: 'https://storage.example.test/signed-put',
      storageKey: input.storageKey,
    });
    expect(service.createSignedUpload).toHaveBeenCalledWith(actor, {
      target: { kind: 'lease', id: 'lease-1' },
      fileName: 'notice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      kind: 'NOTICE',
    });
    expect(service.completeSignedUpload).not.toHaveBeenCalled();
  });

  it('records the file only through the authenticated completion route', async () => {
    service.completeSignedUpload.mockResolvedValue({
      id: 'document-1',
      mimeType: 'application/pdf',
    });

    const response = await completeUpload(post(input));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      file: { id: 'document-1', mimeType: 'application/pdf' },
    });
    expect(service.completeSignedUpload).toHaveBeenCalledWith(actor, {
      target: { kind: 'lease', id: 'lease-1' },
      storageKey: input.storageKey,
      fileName: 'notice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      kind: 'NOTICE',
    });
    expect(service.createSignedUpload).not.toHaveBeenCalled();
  });

  it('requires authentication before either route reaches the storage service', async () => {
    routeMocks.requireActor.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const start = await beginUpload(post(input));
    const complete = await completeUpload(post(input));

    expect(start.status).toBe(401);
    expect(complete.status).toBe(401);
    expect(routeMocks.createPrismaFileService).not.toHaveBeenCalled();
  });
});

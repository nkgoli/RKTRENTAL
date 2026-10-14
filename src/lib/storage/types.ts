export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type FileTargetKind = 'lease' | 'property' | 'unit';
export interface FileTarget {
  kind: FileTargetKind;
  id: string;
}
export type DocumentKindValue = 'LEASE' | 'NOTICE' | 'INSPECTION' | 'ID' | 'PHOTO' | 'OTHER';

export interface AllowedType {
  extensions: string[];
  mimeTypes: string[];
  canonicalMime: string;
}
export const ALLOWED_TYPES: Record<string, AllowedType> = {
  pdf: { extensions: ['.pdf'], mimeTypes: ['application/pdf'], canonicalMime: 'application/pdf' },
  jpg: {
    extensions: ['.jpg', '.jpeg'],
    mimeTypes: ['image/jpeg'],
    canonicalMime: 'image/jpeg',
  },
  png: { extensions: ['.png'], mimeTypes: ['image/png'], canonicalMime: 'image/png' },
  heic: {
    extensions: ['.heic', '.heif'],
    mimeTypes: ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'],
    canonicalMime: 'image/heic',
  },
  doc: {
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
    canonicalMime: 'application/msword',
  },
  docx: {
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    canonicalMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
};
export const ALLOWED_EXTENSIONS = Object.values(ALLOWED_TYPES).flatMap((t) => t.extensions);

export interface FileActor {
  subjectId: string;
  organizationId: string;
  role: 'MANAGER' | 'OWNER' | 'TENANT' | 'ADMIN';
  tenantId?: string;
}

export interface StoredDocument {
  id: string;
  organizationId: string;
  leaseId: string | null;
  propertyId: string | null;
  unitId: string | null;
  kind: DocumentKindValue;
  name: string;
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: Date;
}

export interface StorageObject {
  body: Uint8Array;
  contentType?: string;
}

export interface StorageAdapter {
  readonly driver: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  /** Signed URL for direct client transfer; null when the driver cannot sign (local dev). */
  getSignedUrl(
    key: string,
    opts: {
      method: 'GET' | 'PUT';
      expiresInSeconds?: number;
      contentType?: string;
      contentLength?: number;
    },
  ): Promise<string | null>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFIG' | 'STORAGE' = 'VALIDATION',
    readonly status = 400,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
export function validationError(m: string) {
  return new StorageError(m, 'VALIDATION', 400);
}
export function forbiddenError(m = 'Forbidden') {
  return new StorageError(m, 'FORBIDDEN', 403);
}
export function notFoundError(m = 'Not found') {
  return new StorageError(m, 'NOT_FOUND', 404);
}

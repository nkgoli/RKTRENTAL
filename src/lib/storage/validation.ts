import { ALLOWED_TYPES, MAX_FILE_BYTES, validationError } from './types';

export function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i).toLowerCase() : '';
}
export function sanitizeFileName(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? 'file').trim();
  const cleaned = base
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
  return cleaned || 'file';
}
function typeForExtension(ext: string) {
  return Object.values(ALLOWED_TYPES).find((t) => t.extensions.includes(ext));
}

export interface UploadMeta {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}
/** Type + size validation (no body). Throws StorageError(400) on rejection. */
export function validateUploadMeta(meta: UploadMeta): { canonicalMime: string; extension: string } {
  if (!meta.fileName?.trim()) throw validationError('File name is required');
  if (!Number.isFinite(meta.sizeBytes) || meta.sizeBytes <= 0)
    throw validationError('File is empty');
  if (meta.sizeBytes > MAX_FILE_BYTES)
    throw validationError(`File exceeds the 25 MB limit (${MAX_FILE_BYTES} bytes)`);
  const ext = extensionOf(meta.fileName);
  const allowed = typeForExtension(ext);
  if (!allowed) throw validationError(`File type "${ext || '(none)'}" is not allowed`);
  const mime = (meta.mimeType || '').split(';')[0].trim().toLowerCase();
  // Browsers sometimes send empty/generic mime; extension governs, but a
  // concrete mismatched mime is rejected.
  if (mime && mime !== 'application/octet-stream' && !allowed.mimeTypes.includes(mime))
    throw validationError(`MIME type "${mime}" does not match extension "${ext}"`);
  return { canonicalMime: allowed.canonicalMime, extension: ext };
}

function sniffKind(body: Uint8Array): string | null {
  if (
    body.length >= 4 &&
    body[0] === 0x25 &&
    body[1] === 0x50 &&
    body[2] === 0x44 &&
    body[3] === 0x46
  )
    return 'pdf';
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'jpg';
  if (
    body.length >= 4 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47
  )
    return 'png';
  if (
    body.length >= 8 &&
    body[0] === 0xd0 &&
    body[1] === 0xcf &&
    body[2] === 0x11 &&
    body[3] === 0xe0
  )
    return 'doc';
  if (body.length >= 2 && body[0] === 0x50 && body[1] === 0x4b) return 'docx'; // zip container
  if (body.length >= 12) {
    const brand = String.fromCharCode(...body.slice(4, 12));
    if (brand.startsWith('ftyp') || /heic|heix|hevc|mif1|msf1|heim|heis/.test(brand)) return 'heic';
    const box = String.fromCharCode(...body.slice(4, 8));
    if (box === 'ftyp') {
      const major = String.fromCharCode(...body.slice(8, 12));
      if (/heic|heix|hevc|mif1|msf1/.test(major)) return 'heic';
    }
  }
  return null;
}
/** Also verifies magic bytes when a body is available. */
export function validateUpload(meta: UploadMeta & { body?: Uint8Array }): {
  canonicalMime: string;
  extension: string;
} {
  const result = validateUploadMeta(meta);
  if (meta.body) {
    if (meta.body.byteLength !== meta.sizeBytes)
      throw validationError('File size does not match the uploaded body');
    const sniffed = sniffKind(meta.body);
    const expected =
      result.extension === '.pdf'
        ? 'pdf'
        : result.extension === '.png'
          ? 'png'
          : result.extension === '.doc'
            ? 'doc'
            : result.extension === '.docx'
              ? 'docx'
              : result.extension === '.heic' || result.extension === '.heif'
                ? 'heic'
                : 'jpg';
    if (sniffed !== expected) throw validationError('File content does not match its extension');
  }
  return result;
}

export function targetFromIds(ids: {
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
}): { kind: 'lease' | 'property' | 'unit'; id: string } {
  const list: Array<readonly ['lease' | 'property' | 'unit', string]> = [];
  if (ids.leaseId) list.push(['lease', ids.leaseId] as const);
  if (ids.propertyId) list.push(['property', ids.propertyId] as const);
  if (ids.unitId) list.push(['unit', ids.unitId] as const);
  if (list.length !== 1)
    throw validationError('Exactly one of leaseId, propertyId or unitId is required');
  return { kind: list[0][0], id: list[0][1] };
}

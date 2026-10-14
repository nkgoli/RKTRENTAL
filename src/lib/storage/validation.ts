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

function ascii(body: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...body.subarray(start, start + length));
}

function isDocx(body: Uint8Array): boolean {
  if (body.byteLength < 22 || body[0] !== 0x50 || body[1] !== 0x4b || body[2] !== 0x03 || body[3] !== 0x04)
    return false;
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const minEocd = Math.max(0, body.byteLength - 22 - 0xffff);
  let eocd = -1;
  for (let offset = body.byteLength - 22; offset >= minEocd; offset -= 1) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === body.byteLength
    ) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) return false;
  const disk = view.getUint16(eocd + 4, true);
  const directoryDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (
    disk !== 0 ||
    directoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount < 2 ||
    entryCount === 0xffff ||
    directoryOffset + directorySize > eocd
  )
    return false;

  const required = new Set(['[Content_Types].xml', 'word/document.xml']);
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > directoryOffset + directorySize || view.getUint32(offset, true) !== 0x02014b50)
      return false;
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const recordEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (
      recordEnd > directoryOffset + directorySize ||
      (flags & 0x0001) !== 0 ||
      (method !== 0 && method !== 8) ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset + 30 > directoryOffset ||
      view.getUint32(localOffset, true) !== 0x04034b50
    )
      return false;
    const name = ascii(body, offset + 46, nameLength);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localFlags = view.getUint16(localOffset + 6, true);
    const localMethod = view.getUint16(localOffset + 8, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (
      localNameLength !== nameLength ||
      localFlags !== flags ||
      localMethod !== method ||
      ascii(body, localOffset + 30, localNameLength) !== name ||
      dataOffset + compressedSize > directoryOffset ||
      (required.has(name) && uncompressedSize === 0)
    )
      return false;
    if ((flags & 0x0008) === 0) {
      if (
        view.getUint32(localOffset + 18, true) !== compressedSize ||
        view.getUint32(localOffset + 22, true) !== uncompressedSize
      )
        return false;
    }
    if (required.has(name)) required.delete(name);
    offset = recordEnd;
  }
  return offset === directoryOffset + directorySize && required.size === 0;
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis', 'hevm', 'hevs']);

function isHeic(body: Uint8Array): boolean {
  if (body.byteLength < 24) return false;
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let offset = 0;
  let validFileType = false;
  let hasMeta = false;
  let hasMediaData = false;
  while (offset + 8 <= body.byteLength) {
    const size32 = view.getUint32(offset, false);
    const boxType = ascii(body, offset + 4, 4);
    let headerSize = 8;
    let boxSize = size32;
    if (size32 === 1) {
      if (offset + 16 > body.byteLength) return false;
      const extended = view.getBigUint64(offset + 8, false);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      boxSize = Number(extended);
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = body.byteLength - offset;
    }
    if (boxSize < headerSize || offset + boxSize > body.byteLength) return false;
    if (offset === 0 && boxType === 'ftyp' && boxSize >= 16 && (boxSize - 16) % 4 === 0) {
      const majorBrand = ascii(body, offset + 8, 4);
      const compatible = new Set<string>();
      for (let brandOffset = offset + 16; brandOffset < offset + boxSize; brandOffset += 4)
        compatible.add(ascii(body, brandOffset, 4));
      validFileType = HEIF_BRANDS.has(majorBrand) || [...compatible].some((brand) => HEIF_BRANDS.has(brand));
    } else if (boxType === 'meta') {
      hasMeta = boxSize >= headerSize + 4;
    } else if (boxType === 'mdat') {
      hasMediaData = boxSize > headerSize;
    }
    offset += boxSize;
    if (size32 === 0) break;
  }
  return offset === body.byteLength && validFileType && hasMeta && hasMediaData;
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
  if (isDocx(body)) return 'docx';
  if (isHeic(body)) return 'heic';
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

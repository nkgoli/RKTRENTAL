import type { DocumentRepository } from '../../src/lib/storage/service';
import type { StoredDocument } from '../../src/lib/storage/types';

export const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 1, 2, 3]);
export const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 1, 2]);
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

function zipStored(entries: Record<string, string>): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const [name, contents] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(contents, 'utf8');
    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    data.copy(local, 30 + nameBytes.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    nameBytes.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, end]));
}

function heicContainer(): Uint8Array {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(ftyp.length, 0);
  ftyp.write('ftyp', 4, 'ascii');
  ftyp.write('heic', 8, 'ascii');
  ftyp.writeUInt32BE(0, 12);
  ftyp.write('mif1', 16, 'ascii');
  const meta = Buffer.from([0, 0, 0, 12, 0x6d, 0x65, 0x74, 0x61, 0, 0, 0, 0]);
  const mdat = Buffer.from([0, 0, 0, 9, 0x6d, 0x64, 0x61, 0x74, 0x01]);
  return new Uint8Array(Buffer.concat([ftyp, meta, mdat]));
}

export const DOCX = zipStored({
  '[Content_Types].xml': '<Types/>',
  'word/document.xml': '<w:document/>',
});
export const HEIC = heicContainer();

export function memoryRepo(): DocumentRepository & { rows: StoredDocument[] } {
  const rows: StoredDocument[] = [];
  let n = 0;
  return {
    rows,
    async create(input) {
      const doc: StoredDocument = {
        isCover: false,
        sortOrder: null,
        ...input,
        id: `doc-${++n}`,
        createdAt: new Date(1700000000000 + n),
      };
      rows.push(doc);
      return doc;
    },
    async update(id, patch) {
      const doc = rows.find((r) => r.id === id);
      if (!doc) throw new Error(`Document ${id} not found`);
      Object.assign(doc, patch);
      return doc;
    },
    async listByTarget(orgId, target) {
      return rows.filter(
        (r) =>
          r.organizationId === orgId &&
          ((target.kind === 'lease' && r.leaseId === target.id) ||
            (target.kind === 'property' && r.propertyId === target.id) ||
            (target.kind === 'unit' && r.unitId === target.id)),
      );
    },
    async findById(orgId, id) {
      return rows.find((r) => r.id === id && r.organizationId === orgId) ?? null;
    },
    async delete(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
  };
}

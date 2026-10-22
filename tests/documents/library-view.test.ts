import { describe, expect, it } from 'vitest';
import type { LibraryDocument } from '@/lib/documents/library';
import {
  isSignedDocument,
  leaseFileSections,
  librarySummary,
  photoSummary,
  previewDocument,
  sortByName,
  sortFromParam,
} from '@/app/(manager)/documents/library-view';

const maple = { id: 'maple', name: 'Maple Court' };
const elm = { id: 'elm', name: '18 Elm Street' };
const unit = { id: 'u4b', number: '4B', isImplicit: false, property: maple };
const lease = {
  id: 'lease',
  unit,
  tenants: [
    { id: 't2', name: 'Sam Lee', isPrimary: false },
    { id: 't1', name: 'Alex Rivera', isPrimary: true },
  ],
};

let sequence = 0;
function file(values: Partial<LibraryDocument>): LibraryDocument {
  sequence += 1;
  return {
    id: `f${sequence}`,
    name: `File ${sequence}.pdf`,
    kind: 'OTHER',
    mimeType: 'application/pdf',
    sizeBytes: 100,
    createdAt: new Date(Date.UTC(2025, 10, sequence)),
    leaseId: null,
    propertyId: null,
    unitId: null,
    lease: null,
    property: null,
    unit: null,
    ...values,
  };
}
const leaseFile = (values: Partial<LibraryDocument>) =>
  file({ leaseId: lease.id, lease, ...values });
const signed = (signedAt: Date | null) => [
  {
    agreementId: 'a',
    slot: 'LEASE',
    sha256: 'x',
    agreement: { version: 1, signedAt, supersededAt: null, archiveStatus: 'ARCHIVED' },
  },
];

describe('documents library view helpers', () => {
  it('marks a file signed only when an executed agreement pins it', () => {
    expect(isSignedDocument(leaseFile({ kind: 'LEASE', name: 'Signed lease.pdf' }))).toBe(false);
    expect(isSignedDocument(leaseFile({ kind: 'LEASE', agreementFiles: signed(null) }))).toBe(
      false,
    );
    expect(isSignedDocument(leaseFile({ kind: 'LEASE', agreementFiles: signed(new Date()) }))).toBe(
      true,
    );
  });

  it('splits lease files into agreement, addendum, inspection/ID and other sections', () => {
    const files = [
      leaseFile({ kind: 'LEASE' }),
      leaseFile({ kind: 'ADDENDUM' }),
      leaseFile({ kind: 'DISCLOSURE' }),
      leaseFile({ kind: 'INSPECTION' }),
      leaseFile({ kind: 'ID' }),
      leaseFile({ kind: 'NOTICE' }),
    ];
    const sections = leaseFileSections(files);
    expect(sections.agreement).toHaveLength(1);
    expect(sections.addendums.map((entry) => entry.kind)).toEqual(['ADDENDUM', 'DISCLOSURE']);
    expect(sections.inspections.map((entry) => entry.kind)).toEqual(['INSPECTION', 'ID']);
    expect(sections.other.map((entry) => entry.kind)).toEqual(['NOTICE']);
  });

  it('summarises portfolio counts from live files', () => {
    const id = leaseFile({ kind: 'ID', name: 'Photo ID.pdf', sizeBytes: 756 });
    const files = [
      id,
      leaseFile({ kind: 'LEASE', sizeBytes: 1000, agreementFiles: signed(new Date()) }),
      file({ kind: 'NOTICE', propertyId: maple.id, property: maple, sizeBytes: 44 }),
      file({ kind: 'PHOTO', propertyId: maple.id, property: maple, sizeBytes: 200 }),
    ];
    const summary = librarySummary(files);
    expect(summary).toMatchObject({
      total: 4,
      bytes: 2000,
      leaseDocuments: 2,
      propertyFiles: 1,
      signed: { count: 1 },
      restricted: { count: 1, first: id },
    });
    expect(summary.latestLease?.leaseId).toBe('lease');
    expect(librarySummary([]).signed).toEqual({ count: 0, first: null });
  });

  it('counts photos per property, largest first', () => {
    const photos = [
      file({ kind: 'PHOTO', property: elm }),
      file({ kind: 'PHOTO', property: maple }),
      file({ kind: 'PHOTO', unit }),
      file({ kind: 'LEASE', property: maple }),
    ];
    expect(photoSummary(photos)).toEqual({
      total: 3,
      properties: [
        { name: 'Maple Court', count: 2 },
        { name: '18 Elm Street', count: 1 },
      ],
      text: 'Maple Court ×2 · 18 Elm Street',
    });
  });

  it('previews the requested non-photo file, else the first fallback', () => {
    const first = leaseFile({ kind: 'LEASE' });
    const second = leaseFile({ kind: 'INSPECTION' });
    const photo = file({ kind: 'PHOTO' });
    const files = [first, second, photo];
    expect(previewDocument(files, second.id, [first])).toBe(second);
    expect(previewDocument(files, photo.id, [first])).toBe(first);
    expect(previewDocument(files, 'missing', [])).toBeNull();
  });

  it('parses sort params and orders by name', () => {
    expect(sortFromParam('name')).toBe('name');
    expect(sortFromParam('oldest')).toBe('oldest');
    expect(sortFromParam('other')).toBe('newest');
    const names = sortByName([
      file({ name: 'b.pdf' }),
      file({ name: 'A.pdf' }),
      file({ name: 'c.pdf' }),
    ]).map((entry) => entry.name);
    expect(names).toEqual(['A.pdf', 'b.pdf', 'c.pdf']);
  });
});

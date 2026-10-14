import { describe, expect, it } from 'vitest';
import {
  filterLibraryDocuments,
  groupLeaseDocuments,
  photoDocuments,
  propertyDocuments,
  type LibraryDocument,
} from './library';

const mapleLease = {
  id: 'lease-maple',
  unit: {
    id: 'unit-4b',
    number: '4B',
    isImplicit: false,
    property: { id: 'maple', name: 'Maple Court' },
  },
  tenants: [{ id: 'alex', name: 'Alex Rivera', isPrimary: true }],
};

function file(id: string, overrides: Partial<LibraryDocument> = {}): LibraryDocument {
  return {
    id,
    name: `${id}.pdf`,
    kind: 'LEASE',
    mimeType: 'application/pdf',
    sizeBytes: 100,
    createdAt: new Date(`2026-10-${id === 'older' ? '01' : '10'}T12:00:00Z`),
    leaseId: 'lease-maple',
    propertyId: null,
    unitId: null,
    lease: mapleLease,
    property: null,
    unit: null,
    ...overrides,
  };
}

describe('document library helpers', () => {
  it('groups lease files by lease and keeps the newest lease group first', () => {
    const groups = groupLeaseDocuments([
      file('newest'),
      file('older', { createdAt: new Date('2026-10-01T12:00:00Z') }),
      file('cedar', {
        leaseId: 'lease-cedar',
        lease: {
          ...mapleLease,
          id: 'lease-cedar',
          unit: {
            ...mapleLease.unit,
            property: { id: 'cedar', name: 'Cedar Row' },
          },
        },
      }),
      file('maple-photo', { kind: 'PHOTO' }),
      file('property-only', { leaseId: null, propertyId: 'maple', lease: null }),
    ]);

    expect(groups.map((group) => group.leaseId)).toEqual(['lease-maple', 'lease-cedar']);
    expect(groups[0]?.files.map((entry) => entry.id)).toEqual(['newest', 'older']);
    expect(groups[0]?.lease?.tenants[0]?.name).toBe('Alex Rivera');
  });

  it('filters by filename, tenant, property, kind and sort order', () => {
    const newest = file('newest');
    const notice = file('notice', {
      name: 'Move-in inspection.pdf',
      kind: 'INSPECTION',
      createdAt: new Date('2026-10-12T12:00:00Z'),
    });
    const cedar = file('cedar', {
      lease: {
        ...mapleLease,
        unit: { ...mapleLease.unit, property: { id: 'cedar', name: 'Cedar Row' } },
      },
    });

    expect(filterLibraryDocuments([newest, notice, cedar], { query: 'alex rivera' })).toHaveLength(
      3,
    );
    expect(
      filterLibraryDocuments([newest, notice, cedar], {
        query: 'inspection',
        kind: 'INSPECTION',
      }).map((entry) => entry.id),
    ).toEqual(['notice']);
    expect(
      filterLibraryDocuments([newest, cedar], { propertyId: 'cedar' }).map((entry) => entry.id),
    ).toEqual(['cedar']);
    expect(filterLibraryDocuments([newest, notice], { sort: 'oldest' }).map((x) => x.id)).toEqual([
      'newest',
      'notice',
    ]);
  });

  it('keeps property files and photos out of lease groups', () => {
    const leaseFile = file('lease');
    const propertyFile = file('property', {
      leaseId: null,
      propertyId: 'maple',
      lease: null,
      property: { id: 'maple', name: 'Maple Court' },
    });
    const photo = file('photo', { kind: 'PHOTO' });

    expect(propertyDocuments([leaseFile, propertyFile, photo])).toEqual([propertyFile]);
    expect(photoDocuments([leaseFile, propertyFile, photo])).toEqual([photo]);
    expect(groupLeaseDocuments([leaseFile, propertyFile, photo])).toHaveLength(1);
  });
});

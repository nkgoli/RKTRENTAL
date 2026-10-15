export const DOCUMENT_KINDS = ['LEASE', 'NOTICE', 'INSPECTION', 'ID', 'PHOTO'] as const;

export type LibraryDocumentKind = (typeof DOCUMENT_KINDS)[number] | 'OTHER';
export type LibrarySort = 'newest' | 'oldest';

export interface LibraryProperty {
  id: string;
  name: string;
}

export interface LibraryUnit {
  id: string;
  number: string;
  isImplicit: boolean;
  property: LibraryProperty;
}

export interface LibraryTenant {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface LibraryLease {
  id: string;
  unit: LibraryUnit;
  tenants: LibraryTenant[];
}

export interface LibraryDocument {
  id: string;
  name: string;
  kind: LibraryDocumentKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  leaseId: string | null;
  propertyId: string | null;
  unitId: string | null;
  lease: LibraryLease | null;
  property: LibraryProperty | null;
  unit: LibraryUnit | null;
}

export interface LibraryFilters {
  query?: string;
  kind?: LibraryDocumentKind | 'ALL';
  propertyId?: string;
  unitId?: string;
  sort?: LibrarySort;
}

export interface LeaseDocumentGroup {
  leaseId: string;
  lease: LibraryLease | null;
  files: LibraryDocument[];
}

export function documentProperty(file: LibraryDocument): LibraryProperty | null {
  return file.lease?.unit.property ?? file.unit?.property ?? file.property;
}

export function documentUnit(file: LibraryDocument): LibraryUnit | null {
  return file.lease?.unit ?? file.unit;
}

function searchText(file: LibraryDocument): string {
  const property = documentProperty(file);
  const unit = documentUnit(file);
  return [
    file.name,
    file.kind,
    property?.name,
    unit?.number,
    ...(file.lease?.tenants.map((tenant) => tenant.name) ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export function filterLibraryDocuments(
  files: LibraryDocument[],
  filters: LibraryFilters = {},
): LibraryDocument[] {
  const query = filters.query?.trim().toLocaleLowerCase();
  return files
    .filter((file) => !query || searchText(file).includes(query))
    .filter((file) => !filters.kind || filters.kind === 'ALL' || file.kind === filters.kind)
    .filter((file) => !filters.propertyId || documentProperty(file)?.id === filters.propertyId)
    .filter((file) => !filters.unitId || documentUnit(file)?.id === filters.unitId)
    .sort((left, right) => {
      const delta = left.createdAt.getTime() - right.createdAt.getTime();
      return filters.sort === 'oldest' ? delta : -delta;
    });
}

export function groupLeaseDocuments(files: LibraryDocument[]): LeaseDocumentGroup[] {
  const groups = new Map<string, LeaseDocumentGroup>();
  for (const file of files) {
    if (!file.leaseId || file.kind === 'PHOTO') continue;
    let group = groups.get(file.leaseId);
    if (!group) {
      group = { leaseId: file.leaseId, lease: file.lease, files: [] };
      groups.set(file.leaseId, group);
    }
    group.files.push(file);
    if (!group.lease && file.lease) group.lease = file.lease;
  }
  return [...groups.values()].sort((left, right) => {
    const latestLeft = left.files[0]?.createdAt.getTime() ?? 0;
    const latestRight = right.files[0]?.createdAt.getTime() ?? 0;
    return latestRight - latestLeft;
  });
}

export function propertyDocuments(files: LibraryDocument[]): LibraryDocument[] {
  return files.filter((file) => !file.leaseId && file.kind !== 'PHOTO');
}

export function photoDocuments(files: LibraryDocument[]): LibraryDocument[] {
  return files.filter((file) => file.kind === 'PHOTO');
}

import {
  documentAgreementMetadata,
  documentProperty,
  groupLeaseDocuments,
  photoDocuments,
  propertyDocuments,
  type LeaseDocumentGroup,
  type LibraryDocument,
} from '@/lib/documents/library';

/** File type filters, in tab order. */
export const KIND_FILTERS = [
  { value: 'ALL', label: 'All files' },
  { value: 'LEASE', label: 'Leases' },
  { value: 'NOTICE', label: 'Notices' },
  { value: 'INSPECTION', label: 'Inspections' },
  { value: 'ID', label: 'IDs' },
  { value: 'PHOTO', label: 'Photos' },
] as const;

/** Kinds tenants can never open; the file endpoints enforce this, the library only labels it. */
export function isRestrictedDocument(file: Pick<LibraryDocument, 'kind'>) {
  return file.kind === 'ID';
}

/**
 * A file counts as signed only when an executed agreement pins it. File kind and name are never
 * signing proof.
 */
export function isSignedDocument(file: LibraryDocument) {
  return documentAgreementMetadata(file).some(
    (entry) =>
      entry.signatureStatus === 'SIGNED' ||
      entry.signatureStatus === 'INCLUDED_IN_SIGNED_AGREEMENT',
  );
}

export function primaryTenant(group: Pick<LeaseDocumentGroup, 'lease'>) {
  const tenants = group.lease?.tenants ?? [];
  return tenants.find((tenant) => tenant.isPrimary) ?? tenants[0] ?? null;
}

export function unitLabel(unit: { number: string; isImplicit: boolean } | null | undefined) {
  if (!unit) return '';
  return unit.isImplicit ? 'Whole property' : `Unit ${unit.number}`;
}

/** "Maple Court · Unit 4B" for a lease group, from its lease or its first file. */
export function leaseLocation(group: LeaseDocumentGroup) {
  const unit = group.lease?.unit ?? group.files[0]?.unit ?? null;
  const property = unit?.property ?? (group.files[0] ? documentProperty(group.files[0]) : null);
  return [property?.name ?? 'Property', unitLabel(unit)].filter(Boolean).join(' · ');
}

export type LeaseFileSections = {
  agreement: LibraryDocument[];
  addendums: LibraryDocument[];
  inspections: LibraryDocument[];
  other: LibraryDocument[];
};

/** Splits one lease's files into the agreement, addendum, inspection/ID and remaining groups. */
export function leaseFileSections(files: LibraryDocument[]): LeaseFileSections {
  const sections: LeaseFileSections = { agreement: [], addendums: [], inspections: [], other: [] };
  for (const file of files) {
    if (file.kind === 'LEASE') sections.agreement.push(file);
    else if (file.kind === 'ADDENDUM' || file.kind === 'DISCLOSURE') sections.addendums.push(file);
    else if (file.kind === 'INSPECTION' || file.kind === 'ID') sections.inspections.push(file);
    else sections.other.push(file);
  }
  return sections;
}

export type LibrarySummary = {
  total: number;
  bytes: number;
  leaseDocuments: number;
  propertyFiles: number;
  /** Lease with the most recent file: the one a manager most likely wants next. */
  latestLease: LeaseDocumentGroup | null;
  signed: { count: number; first: LeaseDocumentGroup | null };
  restricted: { count: number; first: LibraryDocument | null };
};

export function librarySummary(files: LibraryDocument[]): LibrarySummary {
  const groups = groupLeaseDocuments(files);
  const signedGroups = groups.filter((group) =>
    group.files.some((file) => file.kind === 'LEASE' && isSignedDocument(file)),
  );
  const restricted = files.filter(isRestrictedDocument);
  return {
    total: files.length,
    bytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    leaseDocuments: groups.reduce((total, group) => total + group.files.length, 0),
    propertyFiles: propertyDocuments(files).length,
    latestLease: groups[0] ?? null,
    signed: { count: signedGroups.length, first: signedGroups[0] ?? null },
    restricted: { count: restricted.length, first: restricted[0] ?? null },
  };
}

/** "Maple Court ×2 · 18 Elm Street" — photo counts per property, largest first. */
export function photoSummary(files: LibraryDocument[]) {
  const counts = new Map<string, number>();
  for (const photo of photoDocuments(files)) {
    const name = documentProperty(photo)?.name ?? 'Portfolio';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const properties = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  return {
    total: properties.reduce((total, entry) => total + entry.count, 0),
    properties,
    text: properties
      .map((entry) => (entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name))
      .join(' · '),
  };
}

/** The requested file when it is in view, otherwise the first lease file, then property file. */
export function previewDocument(
  files: LibraryDocument[],
  selectedId: string | undefined,
  fallbacks: LibraryDocument[],
) {
  const candidates = files.filter((file) => file.kind !== 'PHOTO');
  return (
    (selectedId ? candidates.find((file) => file.id === selectedId) : undefined) ??
    fallbacks[0] ??
    null
  );
}

export type DocumentSort = 'newest' | 'oldest' | 'name';

export function sortFromParam(value?: string): DocumentSort {
  return value === 'oldest' || value === 'name' ? value : 'newest';
}

/** Name order applied after the library's date filter; dates break ties newest first. */
export function sortByName(files: LibraryDocument[]) {
  return [...files].sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
      right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

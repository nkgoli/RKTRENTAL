import type { BadgeTone } from '@/components/ui/Badge';

const DAY = 86_400_000;

/** Whole UTC days from `now` until `end` (negative once the end has passed). */
export function daysUntil(end: Date, now: Date): number {
  const utc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((utc(end) - utc(now)) / DAY);
}

const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'Active',
  DRAFT: 'Draft',
  ENDED: 'Ended',
  TERMINATED: 'Terminated',
};

/** Header status pill: an active lease ending within 60 days reads "Active · ends in N days". */
export function leaseStatusBadge(
  lease: { status: string; endDate: Date },
  now: Date,
): { tone: BadgeTone; label: string } {
  const label = STATUS_TEXT[lease.status] ?? lease.status;
  if (lease.status === 'ACTIVE') {
    const days = daysUntil(lease.endDate, now);
    if (days >= 0 && days < 60)
      return {
        tone: 'warning',
        label:
          days === 0
            ? 'Active · ends today'
            : `Active · ends in ${days} day${days === 1 ? '' : 's'}`,
      };
    return { tone: 'success', label };
  }
  return { tone: lease.status === 'DRAFT' ? 'info' : 'neutral', label };
}

export type AgreementState = {
  signedAt: Date | null;
  supersededAt: Date | null;
  archiveStatus: string;
  archiveError: string | null;
  version: number;
  parties: { role: string; expectedName: string; signedAt: Date | null }[];
  files: { slot: string; documentId: string }[];
};

export type SignatureSummary = {
  /** done = signed PDF on file, pending = waiting on signers or the PDF, attention = act now. */
  state: 'done' | 'pending' | 'attention';
  headline: string;
  caption: string;
  /** Stored signed PDF, when there is one. */
  signedFileId: string | null;
  /** The signed PDF should exist but does not: offer the retry path. */
  pdfMissing: boolean;
  /**
   * The lease is marked signed without a RocketRental signing record, so the stored file is not
   * proof of who signed. Its rows show what to verify instead of per-signer signatures.
   */
  historical?: boolean;
  /** `note` replaces the Signed/Awaiting badge where no signature was recorded per person. */
  signers: { key: string; label: string; signed: boolean; note?: string }[];
};

const roleLabel = (role: string) => (role === 'OWNER' ? 'Owner / lessor' : 'Tenant');

/**
 * The signature panel's state from the stored lease fields and its latest signing version. Reads
 * only stored state; the agreement tab is where status checks and PDF retries run.
 */
export function signatureSummary(input: {
  eSignStatus: string;
  signedAt: Date | null;
  agreement: AgreementState | null;
  /** A stored lease document of kind LEASE (an uploaded or seeded signed agreement). */
  leaseFile: { id: string; name: string } | null;
  tenants: { id: string; name: string }[];
  formatDate: (date: Date) => string;
}): SignatureSummary {
  const { eSignStatus, agreement, leaseFile, tenants, formatDate } = input;
  const current = agreement && !agreement.supersededAt ? agreement : null;
  if (current) {
    const signers = current.parties.map((p, index) => ({
      key: `${p.role}-${index}`,
      label: `${roleLabel(p.role)} · ${p.expectedName}`,
      signed: Boolean(p.signedAt),
    }));
    const archived = current.files.find((f) => f.slot === 'LEASE')?.documentId ?? null;
    if (current.signedAt) {
      const when = `All parties signed ${formatDate(current.signedAt)} · version ${current.version}`;
      if (current.archiveStatus === 'ARCHIVED' && archived)
        return {
          state: 'done',
          headline: 'Signed agreement on file',
          caption: `${when} · Signed lease agreement.pdf`,
          signedFileId: archived,
          pdfMissing: false,
          signers,
        };
      if (current.archiveStatus === 'PDF_FAILED')
        return {
          state: 'attention',
          headline: 'Signed PDF unavailable',
          caption: `${when}. ${current.archiveError || 'The signed PDF could not be stored yet.'} Signatures are saved; no one signs again.`,
          signedFileId: null,
          pdfMissing: true,
          signers,
        };
      return {
        state: 'pending',
        headline: 'Signed · preparing the PDF',
        caption: `${when}. The final PDF is processing.`,
        signedFileId: null,
        pdfMissing: false,
        signers,
      };
    }
    const signedCount = signers.filter((s) => s.signed).length;
    return {
      state: 'pending',
      headline: 'Awaiting signatures',
      caption: `${signedCount} of ${signers.length} signed · version ${current.version}. Each person signs from their own account.`,
      signedFileId: null,
      pdfMissing: false,
      signers,
    };
  }
  const tenantSigners = (signed: boolean) =>
    tenants.map((t) => ({ key: t.id, label: `Tenant · ${t.name}`, signed }));
  if (eSignStatus === 'SIGNED') {
    // Historical status only: no signing record says who signed, so name the tenants instead.
    const signers = [
      ...tenants.map((t) => ({
        key: t.id,
        label: t.name,
        signed: false,
        note: 'Named tenant',
      })),
      { key: 'verify', label: 'Signer details', signed: false, note: 'Review in PDF' },
    ];
    const when = input.signedAt
      ? `Historical status: signed ${formatDate(input.signedAt)}`
      : 'Historical status: marked signed';
    return leaseFile
      ? {
          state: 'done',
          headline: 'Signed agreement on file',
          caption: `${when} · ${leaseFile.name} is on file · the signed agreement is locked; changes go in an addendum`,
          signedFileId: leaseFile.id,
          pdfMissing: false,
          historical: true,
          signers,
        }
      : {
          state: 'attention',
          headline: 'Signed PDF unavailable',
          caption: `${when}. Verify it against the original agreement; no signed PDF is stored on this lease yet.`,
          signedFileId: null,
          pdfMissing: true,
          historical: true,
          signers,
        };
  }
  if (eSignStatus === 'DECLINED')
    return {
      state: 'attention',
      headline: 'Signature declined',
      caption: 'Review the agreement and prepare a new signing version.',
      signedFileId: null,
      pdfMissing: false,
      signers: tenantSigners(false),
    };
  if (eSignStatus === 'SENT' || eSignStatus === 'PARTIALLY_SIGNED')
    return {
      state: 'pending',
      headline: 'Awaiting signatures',
      caption: 'Sent for signature. Each person signs from their own account.',
      signedFileId: null,
      pdfMissing: false,
      signers: tenantSigners(false),
    };
  return {
    state: 'attention',
    headline: 'Agreement not sent for signature',
    caption: 'Prepare the agreement from the Agreement tab, then share the signing page.',
    signedFileId: null,
    pdfMissing: false,
    signers: [],
  };
}

export type DocumentGroupKey = 'signed' | 'addendums' | 'inspections' | 'other';
export const DOCUMENT_GROUPS: { key: DocumentGroupKey; title: string }[] = [
  { key: 'signed', title: 'Signed agreement' },
  { key: 'addendums', title: 'Addendums' },
  { key: 'inspections', title: 'Inspections & IDs' },
  { key: 'other', title: 'Other lease files' },
];

/**
 * A lease document's group in the Lease documents card. Only the executed agreement is "Signed
 * agreement"; other uploads of kind LEASE stay with the other lease files.
 */
export function documentGroup(kind: string, signed = false): DocumentGroupKey {
  const k = kind.toUpperCase();
  if (signed) return 'signed';
  if (k === 'ADDENDUM') return 'addendums';
  if (k === 'INSPECTION' || k === 'ID') return 'inspections';
  return 'other';
}

/** "24 KB", "1.2 MB". */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The ledger's danger line: "October rent is past the 5-day grace period" or "October rent and 1
 * more charge are past …". Null when nothing is late.
 */
export function lateLine(
  rows: { status: string; description: string; balanceCents: number }[],
  graceDays: number,
): string | null {
  // Rows are newest first; name the oldest late charge.
  const late = rows.filter((r) => r.status === 'LATE' && r.balanceCents > 0).reverse();
  if (!late.length) return null;
  const more = late.length - 1;
  const grace = `past the ${graceDays}-day grace period`;
  return more
    ? `${late[0].description} and ${more} more ${more === 1 ? 'charge' : 'charges'} are ${grace}`
    : `${late[0].description} is ${grace}`;
}

/** Document kinds whose files carry personal identity data. */
export const isRestrictedKind = (kind: string) => kind.toUpperCase() === 'ID';

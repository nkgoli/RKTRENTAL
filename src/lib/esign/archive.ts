import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { getStorage } from '@/lib/storage/config';
import { MAX_FILE_BYTES, type StorageAdapter } from '@/lib/storage/types';
import { buildSignedAgreementPdf } from './pdf';
import { agreementAddendums, sha256 } from './attachments';

export type ArchiveResult = 'ARCHIVED' | 'PDF_PENDING' | 'PDF_FAILED' | 'AWAITING_SIGNATURES';
export interface ArchiveOptions {
  storage?: StorageAdapter;
  now?: Date;
}

/** Durable queue = fully signed, unarchived agreement rows. No signatures are written here. */
export async function archiveSignedAgreement(
  organizationId: string,
  agreementId: string,
  client: PrismaClient = db,
  options: ArchiveOptions = {},
): Promise<ArchiveResult> {
  const now = options.now ?? new Date();
  try {
    return await client.$transaction(
      async (tx) => {
        // A transaction-scoped lock releases on process death, without abandoned worker claims.
        const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${`lease-archive:${agreementId}`}, 0)) AS acquired`;
        if (!lock.acquired) return 'PDF_PENDING';
        const agreement = await tx.leaseAgreement.findFirst({
          where: { id: agreementId, organizationId },
          include: { parties: { orderBy: { id: 'asc' } }, files: { include: { document: true } } },
        });
        if (!agreement || !agreement.signedAt) return 'AWAITING_SIGNATURES';
        if (agreement.archiveStatus === 'ARCHIVED') return 'ARCHIVED';
        if (agreement.archiveNextAttemptAt && agreement.archiveNextAttemptAt > now)
          return agreement.archiveStatus === 'PDF_FAILED' ? 'PDF_FAILED' : 'PDF_PENDING';
        if (!agreement.parties.length || agreement.parties.some((party) => !party.signedAt))
          throw new Error('Incomplete signature evidence');
        const storage = options.storage ?? getStorage();
        // Verify the actual originals, not names or the current wizard/template/account data.
        for (const addendum of agreementAddendums(agreement.snapshot)) {
          const reference = agreement.files.find(
            (file) => file.slot === `ADDENDUM:${addendum.documentId}`,
          );
          if (!reference || reference.sha256 !== addendum.sha256)
            throw new Error('Missing pinned addendum');
          const original = await storage.get(reference.document.storageKey);
          if (
            !original ||
            original.body.byteLength !== addendum.sizeBytes ||
            sha256(original.body) !== addendum.sha256
          )
            throw new Error('Addendum storage verification failed');
        }
        const body = await buildSignedAgreementPdf(agreement);
        if (body.byteLength > MAX_FILE_BYTES) throw new Error('Signed PDF exceeds storage limit');
        const digest = sha256(body);
        const storageKey = `org/${organizationId}/lease/${agreement.leaseId}/agreements/${agreement.id}/v${agreement.version}/lease.pdf`;
        const existing = await storage.get(storageKey);
        if (!existing || sha256(existing.body) !== digest)
          await storage.put(storageKey, body, 'application/pdf');
        const persisted = await storage.get(storageKey);
        if (!persisted || sha256(persisted.body) !== digest)
          throw new Error('PDF storage verification failed');
        // Bytes may survive a rolled back transaction; stable key + uniqueness make retry safe.
        const document = await tx.document.create({
          data: {
            organizationId,
            leaseId: agreement.leaseId,
            kind: 'LEASE',
            name: `Signed lease agreement - v${agreement.version}.pdf`,
            storageKey,
            mimeType: 'application/pdf',
            sizeBytes: BigInt(body.byteLength),
            contentSha256: digest,
          },
        });
        await tx.leaseAgreementFile.create({
          data: {
            organizationId,
            agreementId,
            documentId: document.id,
            slot: 'LEASE',
            sha256: digest,
          },
        });
        await tx.leaseAgreement.update({
          where: { id: agreementId },
          data: {
            archiveStatus: 'ARCHIVED',
            archivedAt: now,
            archiveAttempts: { increment: 1 },
            archiveLastError: null,
            archiveNextAttemptAt: null,
          },
        });
        return 'ARCHIVED';
      },
      { maxWait: 10000, timeout: 120000 },
    );
  } catch {
    // The signatures committed before this attempt. Do not expose provider errors or lose retryability.
    await client.leaseAgreement
      .updateMany({
        where: {
          id: agreementId,
          organizationId,
          signedAt: { not: null },
          archiveStatus: { not: 'ARCHIVED' },
        },
        data: {
          archiveStatus: 'PDF_FAILED',
          archiveAttempts: { increment: 1 },
          archiveLastError: 'Document archival could not be verified. Automatic retry is pending.',
          archiveNextAttemptAt: new Date(now.getTime() + 60000),
        },
      })
      .catch(() => undefined); // DB outage leaves the durable PDF_PENDING row available next request/job.
    return 'PDF_FAILED';
  }
}

/** Bounded organization-scoped job, used by requests and the existing authenticated sweep. */
export async function runLeaseArchiveSweep(
  organizationId: string,
  client: PrismaClient = db,
  options: ArchiveOptions & { leaseId?: string; limit?: number } = {},
) {
  const now = options.now ?? new Date();
  const pending = await client.leaseAgreement.findMany({
    where: {
      organizationId,
      ...(options.leaseId ? { leaseId: options.leaseId } : {}),
      signedAt: { not: null },
      archiveStatus: { in: ['PDF_PENDING', 'PDF_FAILED'] },
      OR: [{ archiveNextAttemptAt: null }, { archiveNextAttemptAt: { lte: now } }],
    },
    orderBy: [{ archiveNextAttemptAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    take: Math.min(25, Math.max(1, options.limit ?? 10)),
    select: { id: true },
  });
  const results = [];
  for (const agreement of pending)
    results.push({
      agreementId: agreement.id,
      status: await archiveSignedAgreement(organizationId, agreement.id, client, {
        ...options,
        now,
      }),
    });
  return results;
}

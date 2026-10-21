import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { getStorage } from '@/lib/storage/config';
import { EsignError } from './types';

export type AgreementAddendum = {
  documentId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export const sha256 = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');

/** Called with the lease lock held. Names typed into the wizard are not stored files. */
export async function snapshotAddendums(
  tx: Prisma.TransactionClient,
  organizationId: string,
  leaseId: string,
  freeze = false,
): Promise<AgreementAddendum[]> {
  const documents = await tx.document.findMany({
    where: { organizationId, leaseId, kind: 'ADDENDUM' },
    orderBy: { id: 'asc' },
  });
  const result: AgreementAddendum[] = [];
  for (const document of documents) {
    let hash = document.contentSha256;
    if (!hash || freeze) {
      const stored = await getStorage().get(document.storageKey);
      if (!stored || stored.body.byteLength !== Number(document.sizeBytes))
        throw new EsignError(
          'An addendum is unavailable. Restore its original file before sending.',
        );
      const actualHash = sha256(stored.body);
      if (hash && hash !== actualHash)
        throw new EsignError(
          'An addendum changed in storage. Restore its original file before sending.',
        );
      hash = actualHash;
      // Outstanding direct-upload PUT URLs must never overwrite the reviewed bytes.
      // Preserve the original document ID/name, but pin its bytes outside the upload key namespace.
      const storageKey = freeze
        ? `org/${organizationId}/lease/${leaseId}/reviewed-addendums/${document.id}/${hash}`
        : document.storageKey;
      if (storageKey !== document.storageKey) {
        await getStorage().put(storageKey, stored.body, document.mimeType);
        const pinned = await getStorage().get(storageKey);
        if (!pinned || sha256(pinned.body) !== hash)
          throw new EsignError(
            'Addendum preservation could not be verified. Please retry sending.',
          );
      }
      if (hash !== document.contentSha256 || storageKey !== document.storageKey)
        await tx.document.update({
          where: { id: document.id },
          data: { contentSha256: hash, storageKey },
        });
    }
    result.push({
      documentId: document.id,
      name: document.name,
      mimeType: document.mimeType,
      sizeBytes: Number(document.sizeBytes),
      sha256: hash,
    });
  }
  return result;
}

export function agreementAddendums(snapshot: unknown): AgreementAddendum[] {
  const value = (snapshot as { addendums?: unknown } | null)?.addendums;
  if (value === undefined) return []; // Existing immutable signing versions predate file manifests.
  if (!Array.isArray(value)) throw new Error('Invalid agreement file manifest');
  return value.map((item: AgreementAddendum) => {
    if (
      !item ||
      typeof item.documentId !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.mimeType !== 'string' ||
      !Number.isSafeInteger(item.sizeBytes) ||
      item.sizeBytes < 0 ||
      typeof item.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(item.sha256)
    )
      throw new Error('Invalid agreement file manifest');
    return item;
  });
}

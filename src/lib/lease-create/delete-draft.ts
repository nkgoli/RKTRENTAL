import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';

/** What a draft carries that decides whether it may be deleted. */
export type DraftDeletionFacts = {
  status: string;
  eSignStatus: string;
  signedAt: Date | null;
  agreements: number;
  charges: number;
  payments: number;
  reminders: number;
  autopay: number;
  /** Lease files pinned by any signed or sent agreement version. */
  pinnedDocuments: number;
  /** Other drafts that name this lease as the lease they renew. */
  dependentRenewals: number;
};

/**
 * The reason a lease cannot be deleted as a draft, or null when it can. Only an unsent draft with
 * no agreement, ledger, reminder or payment-setting history qualifies; everything else is kept.
 */
export function draftDeletionBlocker(facts: DraftDeletionFacts): string | null {
  if (facts.status !== 'DRAFT')
    return 'This lease is no longer a draft, so it can’t be deleted. Its history is kept.';
  if (facts.eSignStatus !== 'NOT_SENT' || facts.signedAt || facts.agreements)
    return 'This draft has been sent for signature, so its agreement history is kept.';
  if (facts.charges || facts.payments || facts.reminders || facts.autopay)
    return 'This draft has ledger or payment activity, so it can’t be deleted.';
  if (facts.pinnedDocuments)
    return 'A file on this draft is part of a signing record and must be kept.';
  if (facts.dependentRenewals)
    return 'Another draft depends on this lease, so it can’t be deleted.';
  return null;
}

export type DeleteDraftResult =
  | {
      ok: true;
      leaseId: string;
      propertyId: string;
      unitId: string;
      removedFiles: number;
    }
  | { ok: false; reason: 'not-found' | 'ineligible'; message: string };

const NOT_FOUND = {
  ok: false,
  reason: 'not-found',
  message: 'This draft was already deleted or isn’t available.',
} as const;

/**
 * Deletes an unsent draft lease and only what belongs to it: wizard state, tenant links, its own
 * events and its uploaded files. Tenants, the unit, a renewal's source lease and any agreement,
 * ledger or payment history are never touched; a draft that has any of them is refused.
 *
 * Locks the unit and then the lease row (the same order and locks that saving, activating, sending
 * and signing use), so a concurrent send or activation either finishes first and makes the draft
 * ineligible, or waits and finds the draft gone. Storage bytes are removed after commit.
 */
export async function deleteLeaseDraft(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
  removeBytes?: (storageKey: string) => Promise<void>,
): Promise<DeleteDraftResult> {
  if (!organizationId || !leaseId) return NOT_FOUND;
  const result = await client.$transaction(async (tx) => {
    const target = await tx.lease.findFirst({
      where: { id: leaseId, organizationId },
      select: { unitId: true },
    });
    if (!target) return NOT_FOUND;
    await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${target.unitId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Lease" WHERE "id" = ${leaseId} AND "organizationId" = ${organizationId} FOR UPDATE`;

    const lease = await tx.lease.findFirst({
      where: { id: leaseId, organizationId },
      select: {
        status: true,
        eSignStatus: true,
        signedAt: true,
        unitId: true,
        unit: { select: { propertyId: true } },
        documents: { select: { id: true, storageKey: true } },
        _count: {
          select: {
            agreements: true,
            charges: true,
            payments: true,
            reminderPreviews: true,
            autopaySettings: true,
          },
        },
      },
    });
    if (!lease) return NOT_FOUND;
    const documentIds = lease.documents.map((d) => d.id);
    const [pinnedDocuments, dependentRenewals] = await Promise.all([
      documentIds.length
        ? tx.leaseAgreementFile.count({ where: { documentId: { in: documentIds } } })
        : 0,
      tx.leaseDraft.count({
        where: {
          organizationId,
          leaseId: { not: leaseId },
          data: { path: ['renewId'], equals: leaseId },
        },
      }),
    ]);
    const blocker = draftDeletionBlocker({
      status: lease.status,
      eSignStatus: lease.eSignStatus,
      signedAt: lease.signedAt,
      agreements: lease._count.agreements,
      charges: lease._count.charges,
      payments: lease._count.payments,
      reminders: lease._count.reminderPreviews,
      autopay: lease._count.autopaySettings,
      pinnedDocuments,
      dependentRenewals,
    });
    if (blocker) return { ok: false, reason: 'ineligible', message: blocker } as const;

    // Document → Lease is RESTRICT, so the draft's own uploads go first. Agreement-pinned files
    // were refused above and are also guarded by the Document_agreement_retention trigger.
    if (documentIds.length)
      await tx.document.deleteMany({
        where: { id: { in: documentIds }, organizationId, leaseId },
      });
    // LeaseDraft, LeaseTenant and LeaseEvent cascade; charges, payments and agreements RESTRICT.
    const { count } = await tx.lease.deleteMany({
      where: { id: leaseId, organizationId, status: 'DRAFT', eSignStatus: 'NOT_SENT' },
    });
    if (count !== 1) throw new Error('Draft lease changed during deletion.');
    return {
      ok: true,
      leaseId,
      propertyId: lease.unit.propertyId,
      unitId: lease.unitId,
      removedFiles: documentIds.length,
      storageKeys: lease.documents.map((d) => d.storageKey),
    } as const;
  });
  if (!result.ok) return result;
  const { storageKeys, ...deleted } = result;
  if (storageKeys.length) {
    const remove = removeBytes ?? (await defaultRemover());
    // Unreferenced bytes are harmless; a failed removal must not undo a committed delete.
    await Promise.all(storageKeys.map((key) => remove(key).catch(() => undefined)));
  }
  return deleted;
}

/** Draft lease ID → the lease it renews, for drafts saved by the renewal wizard. */
export async function draftRenewalSources(
  organizationId: string,
  leaseIds: string[],
  client: PrismaClient = db,
): Promise<Map<string, string>> {
  if (!leaseIds.length) return new Map();
  const rows = await client.$queryRaw<{ leaseId: string; renewId: string | null }[]>`
    SELECT "leaseId", "data"->>'renewId' AS "renewId" FROM "LeaseDraft"
    WHERE "organizationId" = ${organizationId} AND "leaseId" = ANY(${leaseIds})`;
  return new Map(
    rows.filter((row) => row.renewId).map((row) => [row.leaseId, row.renewId as string]),
  );
}

async function defaultRemover() {
  const { getStorage } = await import('@/lib/storage/config');
  const storage = getStorage();
  return (key: string) => storage.delete(key);
}

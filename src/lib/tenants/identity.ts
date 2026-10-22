import type { Prisma } from '@prisma/client';

/** Serialize tenant contact writes with application promotion, including different applications. */
export async function lockTenantContacts(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`tenant-contacts:${organizationId}`}, 0))`;
}

export async function matchingTenantContacts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  email: string,
) {
  // Legacy addresses may contain mixed case or surrounding whitespace. Never silently merge them.
  return tx.$queryRaw<
    Array<{ id: string; name: string; email: string | null; phone: string | null }>
  >`
    SELECT id, name, email, phone FROM "Tenant"
    WHERE "organizationId" = ${organizationId} AND lower(btrim(email)) = ${email.trim().toLowerCase()}
    ORDER BY id LIMIT 2`;
}

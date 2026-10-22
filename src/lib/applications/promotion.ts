import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import type { AuthSession } from '@/lib/auth/session';
import { lockTenantContacts, matchingTenantContacts } from '@/lib/tenants/identity';
import { validEmail } from '@/lib/notifications/reminder-content';

export class PromotionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

export const promotionInput = z
  .object({ existingTenantId: z.string().min(1).max(100).optional() })
  .strict();
type Actor = Pick<AuthSession, 'role' | 'organizationId' | 'subjectId'>;
export type PromotionResult =
  | { status: 'promoted'; tenantId: string; reused: boolean }
  | {
      status: 'confirmation-required';
      tenant: { id: string; name: string; email: string | null; phone: string | null };
    };

/** Promotion is deliberately separate from createTenant: it must never draft a lease. */
export async function promoteApplication(
  actor: Actor,
  applicationId: string,
  raw: unknown,
  client: PrismaClient = db,
): Promise<PromotionResult> {
  if (actor.role !== 'MANAGER' || !actor.organizationId || !actor.subjectId)
    throw new PromotionError('Manager access required.', 403);
  const input = promotionInput.parse(raw);
  const organizationId = actor.organizationId;
  return client.$transaction(async (tx) => {
    // Same lock order for every tenant contact writer; the application lock fences lifecycle changes.
    await lockTenantContacts(tx, organizationId);
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${applicationId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    const application = await tx.application.findFirst({
      where: { id: applicationId, organizationId },
    });
    if (!application) throw new PromotionError('Application not found.', 404);
    if (application.status !== 'APPROVED')
      throw new PromotionError('Only approved applicants can be promoted to tenants.');
    if (application.promotedTenantId)
      return { status: 'promoted', tenantId: application.promotedTenantId, reused: true };

    const name = application.applicantName.trim();
    const email = application.applicantEmail.trim().toLowerCase();
    if (!name || !validEmail(email))
      throw new PromotionError(
        'This application needs a valid applicant name and email before promotion.',
      );
    const matches = await matchingTenantContacts(tx, organizationId, email);
    if (matches.length > 1)
      throw new PromotionError(
        'Multiple tenants use this email. Resolve the duplicate contacts in Tenants before promoting.',
      );
    const existing = matches[0];
    if (input.existingTenantId && input.existingTenantId !== existing?.id)
      throw new PromotionError(
        'The matching tenant changed. Reload and review the match before promoting.',
      );
    if (existing && !input.existingTenantId)
      return { status: 'confirmation-required', tenant: existing };

    const tenant =
      existing ??
      (await tx.tenant.create({
        data: {
          organizationId,
          name,
          email,
          emailRemindersEnabled: false,
          smsRemindersEnabled: false,
        },
        select: { id: true },
      }));
    await tx.application.update({
      where: { id: application.id },
      data: { promotedTenantId: tenant.id, promotedAt: new Date(), promotedBy: actor.subjectId },
    });
    return { status: 'promoted', tenantId: tenant.id, reused: Boolean(existing) };
  });
}

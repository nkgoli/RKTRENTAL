import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { AuthSession } from '@/lib/auth/session';
import {
  boundedSend,
  reminderTransport,
  type ReminderTransport,
} from '@/lib/notifications/reminder-transport';
import {
  applicantInput,
  createInvitationInput,
  createInvitationToken,
  invitationLink,
  invitationOrigin,
  InvitationError,
  INVITATION_LIFETIME_MS,
  managerInvitationInput,
  tokenHash,
  type InvitationEnvironment,
} from './invitation-policy';

export type Manager = Pick<AuthSession, 'role' | 'organizationId' | 'subjectId'>;
function manager(actor: Manager) {
  if (actor.role !== 'MANAGER' || !actor.organizationId || !actor.subjectId)
    throw new InvitationError('Manager access required.', 403);
}
const include = {
  unit: { include: { property: true } },
  attempts: { orderBy: { createdAt: 'desc' as const }, take: 10 },
};
export async function getManagerInvitation(actor: Manager, id: string, client: PrismaClient = db) {
  manager(actor);
  const row = await client.applicationInvitation.findFirst({
    where: { id, organizationId: actor.organizationId },
    include,
  });
  if (!row) throw new InvitationError('Invitation not found.', 404);
  return row;
}
async function lock(tx: Prisma.TransactionClient, id: string, organizationId?: string) {
  if (organizationId)
    await tx.$queryRaw`SELECT id FROM "ApplicationInvitation" WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM "ApplicationInvitation" WHERE id = ${id} FOR UPDATE`;
}
export async function createInvitation(
  actor: Manager,
  raw: unknown,
  client: PrismaClient = db,
  env: InvitationEnvironment = process.env,
) {
  manager(actor);
  const input = createInvitationInput.parse(raw);
  invitationOrigin(env);
  const token = createInvitationToken(env);
  return client.$transaction(async (tx) => {
    // Serialize duplicate creation for this organization; unique constraints remain the final guard.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.organizationId}))`;
    const unit = await tx.unit.findFirst({
      where: {
        id: input.unitId,
        propertyId: input.propertyId,
        organizationId: actor.organizationId,
        property: { archivedAt: null, organizationId: actor.organizationId },
      },
    });
    if (!unit)
      throw new InvitationError('Choose a unit in an active property in your organization.', 404);
    const replay = await tx.applicationInvitation.findUnique({
      where: {
        organizationId_requestKey: {
          organizationId: actor.organizationId,
          requestKey: input.requestKey,
        },
      },
    });
    if (replay) {
      if (
        replay.unitId !== input.unitId ||
        replay.applicantEmail !== input.email ||
        replay.applicantName !== input.fullName
      )
        throw new InvitationError('This request was already used. Reload the form.', 409);
      return replay;
    }
    return tx.applicationInvitation.upsert({
      where: {
        organizationId_unitId_applicantEmail: {
          organizationId: actor.organizationId,
          unitId: unit.id,
          applicantEmail: input.email,
        },
      },
      update: {},
      create: {
        organizationId: actor.organizationId,
        unitId: unit.id,
        applicantName: input.fullName,
        applicantEmail: input.email,
        createdBy: actor.subjectId,
        requestKey: input.requestKey,
        ...token,
        expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
      },
    });
  });
}
export function invitationMessage(
  row: Awaited<ReturnType<typeof getManagerInvitation>>,
  env: InvitationEnvironment = process.env,
) {
  const location = `${row.unit.property.name} · ${row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`}`;
  return {
    subject: `Your rental application for ${location}`,
    body: `Hello ${row.applicantName},\n\nYou are invited to apply for ${location}.\n\nReview and submit your application: ${invitationLink(row.tokenCipher, env)}\n\nThis private link expires ${row.expiresAt.toISOString()}. Keep it private; anyone with this link can complete this application.\n\nSubmitting does not authorize screening or guarantee approval. If you did not expect this invitation, contact the property manager.`,
  };
}
export async function manageInvitation(
  actor: Manager,
  id: string,
  raw: unknown,
  client: PrismaClient = db,
  env: InvitationEnvironment = process.env,
  transportFactory = reminderTransport,
) {
  manager(actor);
  const input = managerInvitationInput.parse(raw);
  let transport: ReminderTransport | undefined;
  const prepared = await client.$transaction(async (tx) => {
    await lock(tx, id, actor.organizationId);
    const row = await tx.applicationInvitation.findFirst({
      where: { id, organizationId: actor.organizationId },
      include,
    });
    if (!row) throw new InvitationError('Invitation not found.', 404);
    const replay = await tx.applicationInvitationAttempt.findUnique({
      where: { invitationId_requestKey: { invitationId: id, requestKey: input.requestKey } },
    });
    if (replay) return { attempt: replay, dispatch: false, row };
    if (row.generation !== input.generation)
      throw new InvitationError('The invitation changed. Reload before continuing.', 409);
    if (row.submittedAt)
      throw new InvitationError('This application has already been submitted.', 409);
    if (row.unit.property.archivedAt)
      throw new InvitationError('This property is no longer accepting applications.', 409);
    const latest = row.attempts.find((a) => a.generation === row.generation);
    if (latest && ['SENDING', 'UNCERTAIN'].includes(latest.status))
      throw new InvitationError(
        'The email outcome is unknown. Confirm the provider outcome before any further send.',
        409,
      );
    if (input.intent === 'renew') {
      if (row.expiresAt > new Date())
        throw new InvitationError(
          'This link is still active. Copy or resend the existing invitation.',
          409,
        );
      invitationOrigin(env);
      await tx.applicationInvitation.update({
        where: { id },
        data: {
          ...createInvitationToken(env),
          generation: { increment: 1 },
          expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
        },
      });
      return null;
    }
    if (row.expiresAt <= new Date())
      throw new InvitationError('This link has expired. Renew it before sending.', 410);
    if (
      latest &&
      !['UNCONFIGURED', 'FAILED'].includes(latest.status) &&
      Date.now() - latest.createdAt.getTime() < 60_000
    )
      throw new InvitationError(
        'Wait one minute before intentionally resending this invitation.',
        429,
      );
    const count = await tx.applicationInvitationAttempt.count({
      where: { invitationId: id, generation: row.generation },
    });
    if (count >= 10)
      throw new InvitationError(
        'The email attempt limit has been reached. Copy the existing link instead.',
        429,
      );
    const message = invitationMessage(row, env);
    let unavailable = false;
    try {
      transport = await transportFactory(actor.organizationId, 'EMAIL', client, env);
    } catch {
      unavailable = true;
    }
    const attempt = await tx.applicationInvitationAttempt.create({
      data: {
        invitationId: id,
        generation: row.generation,
        requestKey: input.requestKey,
        createdBy: actor.subjectId,
        status: unavailable ? 'UNCONFIGURED' : 'SENDING',
        provider: transport?.name,
        errorCode: unavailable ? 'TRANSPORT_UNAVAILABLE' : null,
        finishedAt: unavailable ? new Date() : null,
      },
    });
    return { attempt, dispatch: !unavailable, row, message };
  });
  if (!prepared?.dispatch || !transport || !prepared.message) return;
  // A committed claim precedes the external effect. Crashes/ambiguous outcomes never auto-retry.
  const result = await boundedSend(transport, {
    id: prepared.attempt.id,
    recipient: prepared.row.applicantEmail,
    ...prepared.message,
  });
  await client.applicationInvitationAttempt.update({
    where: { id: prepared.attempt.id },
    data: {
      status: result.status === 'DELIVERED' ? 'ACCEPTED' : result.status,
      providerId: result.providerId,
      errorCode: result.errorCode,
      finishedAt: new Date(),
    },
  });
}
export async function getApplicantInvitation(token: string, client: PrismaClient = db) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await client.applicationInvitation.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { unit: { include: { property: true } } },
  });
  if (!row || row.expiresAt <= new Date() || row.unit.property.archivedAt) return null;
  return row;
}
export async function completeInvitation(raw: unknown, client: PrismaClient = db) {
  const input = applicantInput.parse(raw);
  if (input.intent === 'submit' && !input.confirmed)
    throw new InvitationError('Confirm that your application details are accurate.');
  return client.$transaction(async (tx) => {
    const found = await tx.applicationInvitation.findUnique({
      where: { tokenHash: tokenHash(input.token) },
      select: { id: true },
    });
    if (!found) throw new InvitationError('This invitation is invalid or has expired.', 410);
    await lock(tx, found.id);
    const row = await tx.applicationInvitation.findUniqueOrThrow({
      where: { id: found.id },
      include: { unit: { include: { property: true } } },
    });
    // Recheck after taking the lock: renewal may have rotated the token while this request waited.
    if (
      row.tokenHash !== tokenHash(input.token) ||
      row.expiresAt <= new Date() ||
      row.unit.property.archivedAt
    )
      throw new InvitationError('This invitation is invalid or has expired.', 410);
    if (row.submittedAt) return { submitted: true };
    if (input.intent === 'save') {
      await tx.applicationInvitation.update({
        where: { id: row.id },
        data: { draftName: input.fullName, draftSavedAt: new Date() },
      });
      return { submitted: false };
    }
    const application = await tx.application.create({
      data: {
        organizationId: row.organizationId,
        unitId: row.unitId,
        applicantName: input.fullName,
        applicantEmail: row.applicantEmail,
        status: 'SUBMITTED',
      },
    });
    await tx.applicationInvitation.update({
      where: { id: row.id },
      data: { applicationId: application.id, submittedAt: new Date(), draftName: input.fullName },
    });
    // Screening consent is deliberately absent: submitting an application is not screening authorization.
    return { submitted: true };
  });
}

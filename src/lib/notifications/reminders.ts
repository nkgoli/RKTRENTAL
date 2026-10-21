import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { AuthSession } from '@/lib/auth/session';
import { hash, reminderContent, type Channel } from './reminder-content';
import {
  boundedSend,
  ReminderError,
  reminderTransport,
  type ReminderTransport,
  type TransportResult,
} from './reminder-transport';

export type ReminderActor = Pick<AuthSession, 'subjectId' | 'organizationId' | 'role'>;
type Tx = Prisma.TransactionClient;
type TransportFactory = (
  organizationId: string,
  channel: Channel,
  client: PrismaClient,
) => Promise<ReminderTransport>;

async function transaction<T>(client: PrismaClient, work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let retry = 0; ; retry++) {
    try {
      return await client.$transaction(work, { isolationLevel: 'Serializable', timeout: 10_000 });
    } catch (e) {
      if (
        retry >= 3 ||
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        !['P2034', 'P2002'].includes(e.code)
      )
        throw e;
    }
  }
}

async function authorize(actor: ReminderActor, client: PrismaClient) {
  if (actor.role !== 'MANAGER') throw new ReminderError('MANAGER_REQUIRED', 403);
  const manager = await client.user.findFirst({
    where: { id: actor.subjectId, organizationId: actor.organizationId, role: 'MANAGER' },
  });
  if (!manager) throw new ReminderError('MANAGER_REQUIRED', 403);
}

async function loadLease(tx: Tx, organizationId: string, leaseId: string) {
  const lease = await tx.lease.findFirst({
    where: { id: leaseId, organizationId, status: { not: 'DRAFT' } },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: { include: { user: true } } } },
      charges: { orderBy: { id: 'asc' } },
      payments: { orderBy: { id: 'asc' } },
    },
  });
  if (!lease) throw new ReminderError('LEASE_NOT_FOUND', 404);
  return lease;
}

/** Never returns secrets or raw provider errors. Rendered content is an immutable audit snapshot. */
export class PaymentReminders {
  constructor(
    private readonly client: PrismaClient = db,
    private readonly factory: TransportFactory = reminderTransport,
    private readonly clock = () => new Date(),
  ) {}

  async preview(actor: ReminderActor, leaseId: string, channel: Channel) {
    await authorize(actor, this.client);
    return transaction(this.client, async (tx) => {
      const now = this.clock();
      const lease = await loadLease(tx, actor.organizationId, leaseId);
      const { snapshot, fingerprint } = reminderContent(lease, channel, now);
      if (snapshot.amountCents <= 0) throw new ReminderError('NOT_OVERDUE', 422);
      if (!snapshot.recipients.length) throw new ReminderError('NO_ELIGIBLE_RECIPIENTS', 422);
      return tx.paymentReminderPreview.create({
        data: {
          organizationId: actor.organizationId,
          managerId: actor.subjectId,
          leaseId,
          propertyId: lease.unit.propertyId,
          unitId: lease.unitId,
          channel,
          fingerprint,
          snapshot,
          createdAt: now,
          expiresAt: new Date(now.getTime() + 10 * 60_000),
        },
      });
    });
  }

  async dispatch(actor: ReminderActor, previewId: string, key: string) {
    await authorize(actor, this.client);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(key))
      throw new ReminderError('INVALID_IDEMPOTENCY_KEY', 400);
    const preview = await this.client.paymentReminderPreview.findFirst({
      where: { id: previewId, organizationId: actor.organizationId, managerId: actor.subjectId },
    });
    if (!preview) throw new ReminderError('PREVIEW_NOT_FOUND', 404);
    // An already reserved operation is returned even if configuration/ledger state later changes.
    if (preview.dispatchedAt) {
      if (preview.idempotencyKey !== key) throw new ReminderError('PREVIEW_ALREADY_DISPATCHED');
      const ready = await this.client.paymentReminderAttempt.count({
        where: { previewId, organizationId: actor.organizationId, status: 'READY' },
      });
      if (!ready) return this.operation(actor.organizationId, preview.id);
    }
    const transport = await this.factory(actor.organizationId, preview.channel, this.client);
    const operation = preview.dispatchedAt
      ? preview
      : await transaction(this.client, async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reminder:${actor.organizationId}:${preview.leaseId}:${preview.channel}`}))`;
          const priorKey = await tx.paymentReminderPreview.findUnique({
            where: {
              organizationId_idempotencyKey: {
                organizationId: actor.organizationId,
                idempotencyKey: key,
              },
            },
          });
          if (priorKey) {
            if (priorKey.id !== preview.id) throw new ReminderError('IDEMPOTENCY_KEY_REUSED');
            return priorKey;
          }
          const current = await tx.paymentReminderPreview.findUniqueOrThrow({
            where: { id: preview.id },
          });
          if (current.dispatchedAt) throw new ReminderError('PREVIEW_ALREADY_DISPATCHED');
          const now = this.clock();
          const lease = await loadLease(tx, actor.organizationId, preview.leaseId);
          const fresh = reminderContent(lease, preview.channel, now);
          if (current.expiresAt <= now || fresh.fingerprint !== current.fingerprint)
            throw new ReminderError('STALE_PREVIEW');
          const dedupeKey = hash([
            actor.organizationId,
            lease.id,
            preview.channel,
            fresh.fingerprint,
          ]);
          const duplicate = await tx.paymentReminderPreview.findUnique({ where: { dedupeKey } });
          if (duplicate) throw new ReminderError('REMINDER_ALREADY_DISPATCHED');
          const unresolved = await tx.paymentReminderAttempt.findFirst({
            where: {
              organizationId: actor.organizationId,
              preview: { leaseId: lease.id, channel: preview.channel },
              status: { in: ['READY', 'SENDING', 'UNCERTAIN'] },
            },
          });
          if (unresolved) throw new ReminderError('UNRESOLVED_DISPATCH');
          return tx.paymentReminderPreview.update({
            where: { id: preview.id },
            data: {
              dispatchedAt: now,
              idempotencyKey: key,
              dedupeKey,
              attempts: {
                create: fresh.snapshot.recipients.map((r) => ({ ...r, provider: transport.name })),
              },
            },
          });
        });
    const attempts = await this.client.paymentReminderAttempt.findMany({
      where: { previewId: operation.id, organizationId: actor.organizationId },
    });
    for (const attempt of attempts) {
      // CAS + durable SENDING before I/O gives one sender, including concurrent requests/processes.
      const claimed = await transaction(this.client, async (tx) => {
        const now = this.clock();
        const lease = await tx.lease.findFirst({
          where: {
            id: preview.leaseId,
            organizationId: actor.organizationId,
            status: { not: 'DRAFT' },
          },
          include: {
            unit: { include: { property: true } },
            tenants: { include: { tenant: { include: { user: true } } } },
            charges: { orderBy: { id: 'asc' } },
            payments: { orderBy: { id: 'asc' } },
          },
        });
        const manager = await tx.user.findFirst({
          where: { id: actor.subjectId, organizationId: actor.organizationId, role: 'MANAGER' },
        });
        const stale =
          attempt.provider !== transport.name ||
          !lease ||
          !manager ||
          preview.expiresAt <= now ||
          reminderContent(lease, preview.channel, now).fingerprint !== preview.fingerprint;
        const result = await tx.paymentReminderAttempt.updateMany({
          where: { id: attempt.id, status: 'READY' },
          data: {
            status: stale ? 'CANCELLED' : 'SENDING',
            startedAt: now,
            errorCode: stale ? 'STALE_PREVIEW_OR_TRANSPORT' : null,
          },
        });
        return result.count === 1 && !stale;
      });
      if (!claimed) continue;
      const result = await boundedSend(transport, attempt);
      await this.applyResult(attempt.id, result);
      if (result.errorCode === 'SMS_OPTED_OUT')
        await this.client.tenant.updateMany({
          where: { id: attempt.tenantId, organizationId: actor.organizationId },
          data: { smsRemindersEnabled: false },
        });
    }
    return this.operation(actor.organizationId, operation.id);
  }

  private async operation(organizationId: string, id: string) {
    // Crash recovery is observation only; an orphaned sender is never automatically retried.
    await this.client.paymentReminderAttempt.updateMany({
      where: {
        organizationId,
        previewId: id,
        status: 'SENDING',
        startedAt: { lt: new Date(this.clock().getTime() - 60_000) },
      },
      data: { status: 'UNCERTAIN', errorCode: 'INTERRUPTED_ATTEMPT' },
    });
    return this.client.paymentReminderPreview.findFirstOrThrow({
      where: { id, organizationId },
      include: { attempts: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async history(actor: ReminderActor, leaseId: string) {
    await authorize(actor, this.client);
    await loadLease(this.client, actor.organizationId, leaseId);
    const previews = await this.client.paymentReminderPreview.findMany({
      where: { organizationId: actor.organizationId, leaseId, dispatchedAt: { not: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return Promise.all(previews.map((p) => this.operation(actor.organizationId, p.id)));
  }

  async reconcile(actor: ReminderActor, attemptId: string) {
    await authorize(actor, this.client);
    const attempt = await this.client.paymentReminderAttempt.findFirst({
      where: { id: attemptId, organizationId: actor.organizationId },
      include: { preview: true },
    });
    if (!attempt) throw new ReminderError('ATTEMPT_NOT_FOUND', 404);
    if (['DELIVERED', 'FAILED', 'CANCELLED', 'MOCK_RECORDED'].includes(attempt.status))
      return attempt;
    const transport = await this.factory(
      actor.organizationId,
      attempt.preview.channel,
      this.client,
    );
    if (transport.name !== attempt.provider || !attempt.providerId || !transport.reconcile)
      throw new ReminderError('MANUAL_RECONCILIATION_REQUIRED');
    try {
      await this.applyResult(attempt.id, await transport.reconcile(attempt.providerId));
    } catch {
      throw new ReminderError('RECONCILIATION_UNAVAILABLE', 503);
    }
    return this.client.paymentReminderAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  }

  async applyResult(id: string, result: TransportResult) {
    const now = this.clock();
    // Terminal observations cannot be overwritten by late responses or out-of-order callbacks.
    await this.client.paymentReminderAttempt.updateMany({
      where: {
        id,
        status: {
          in: result.status === 'UNCERTAIN' ? ['SENDING'] : ['SENDING', 'UNCERTAIN', 'ACCEPTED'],
        },
      },
      data: {
        status: result.status,
        providerId: result.providerId,
        errorCode: result.errorCode ?? null,
        ...(['ACCEPTED', 'DELIVERED'].includes(result.status) ? { acceptedAt: now } : {}),
        ...(result.status === 'DELIVERED' ? { deliveredAt: now } : {}),
      },
    });
  }
}

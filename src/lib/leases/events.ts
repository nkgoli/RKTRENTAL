import type { LeaseEventKind, Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { LeaseServiceError } from './service';

type EventClient = Pick<PrismaClient, 'leaseEvent'> | Prisma.TransactionClient;

export type LeaseEventInput = {
  kind: LeaseEventKind;
  tenantId?: string | null;
  actorName?: string | null;
  message?: string | null;
  createdAt?: Date;
};

/** Appends lease activity (including per-signer e-sign events); always scoped to the organization. */
export async function recordLeaseEvents(
  client: EventClient,
  organizationId: string,
  leaseId: string,
  events: LeaseEventInput[],
) {
  if (!events.length) return;
  await client.leaseEvent.createMany({
    data: events.map((event) => ({
      organizationId,
      leaseId,
      kind: event.kind,
      tenantId: event.tenantId ?? null,
      actorName: event.actorName ?? null,
      message: event.message ?? null,
      ...(event.createdAt ? { createdAt: event.createdAt } : {}),
    })),
  });
}

export const EVENT_LABEL: Record<LeaseEventKind, string> = {
  CREATED: 'Lease created',
  SENT: 'Sent for signature',
  SIGNED: 'Signed',
  DECLINED: 'Declined to sign',
  COMPLETED: 'Lease fully signed',
  RENEWED: 'Renewal created',
  NOTICE_GIVEN: 'Notice given',
  NOTE: 'Note',
};

export type NoticeInput = { noticeGivenAt: Date; moveOutDate: Date | null };

/** Records a tenant's notice to vacate (and the planned move-out date) on an active lease. */
export async function recordNotice(
  organizationId: string,
  leaseId: string,
  input: NoticeInput,
  actorName: string,
  client: PrismaClient = db,
) {
  await client.$transaction(async (tx) => {
    const lease = await tx.lease.findFirst({
      where: { id: leaseId, organizationId },
      select: { id: true, status: true, startDate: true },
    });
    if (!lease) throw new LeaseServiceError('Lease not found.');
    if (lease.status !== 'ACTIVE')
      throw new LeaseServiceError('Notice can only be recorded on an active lease.');
    if (input.moveOutDate && input.moveOutDate < input.noticeGivenAt)
      throw new LeaseServiceError(
        'The move-out date cannot be before the notice date.',
        'moveOutDate',
      );
    await tx.lease.updateMany({
      where: { id: leaseId, organizationId },
      data: { noticeGivenAt: input.noticeGivenAt, moveOutDate: input.moveOutDate },
    });
    await recordLeaseEvents(tx, organizationId, leaseId, [
      {
        kind: 'NOTICE_GIVEN',
        actorName,
        message: input.moveOutDate
          ? `Planned move-out ${input.moveOutDate.toISOString().slice(0, 10)}`
          : 'No move-out date set',
      },
    ]);
  });
}

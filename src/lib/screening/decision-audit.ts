import { db } from '@/lib/db/client';
import { syncApplicationGroupStatus } from './groups';

export type ApplicationDecision = 'APPROVED' | 'DECLINED';

export type DecisionAuditInput = {
  applicationId: string;
  organizationId: string;
  decision: ApplicationDecision;
  reason: string;
  actorId: string;
};

export type DecisionAuditEvent = DecisionAuditInput & {
  occurredAt: Date;
};

export interface DecisionAuditRecorder {
  recordDecision(input: DecisionAuditInput): Promise<void>;
}

export function createDecisionAuditRecorder(
  write: (event: DecisionAuditEvent) => void | Promise<void>,
  now: () => Date = () => new Date(),
): DecisionAuditRecorder {
  return {
    async recordDecision(input) {
      await write({ ...input, occurredAt: now() });
    },
  };
}

const persistentDecisionAudit = createDecisionAuditRecorder(async (event) => {
  const result = await db.application.updateMany({
    where: {
      id: event.applicationId,
      organizationId: event.organizationId,
      status: 'REVIEW',
    },
    data: {
      status: event.decision,
      decisionReason: event.reason,
      decidedBy: event.actorId,
      decidedAt: event.occurredAt,
    },
  });
  if (result.count !== 1) throw new Error('Application decision could not be recorded');
  await syncApplicationGroupStatus(db, event.applicationId);
});

export function recordDecision(input: DecisionAuditInput): Promise<void> {
  return persistentDecisionAudit.recordDecision(input);
}

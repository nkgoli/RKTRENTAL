export type ApplicationDecision = 'APPROVED' | 'DECLINED';

export type DecisionAuditInput = {
  applicationId: string;
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

// Temporary adapter until the follow-up schema adds durable decision audit fields.
const temporaryDecisionAudit = createDecisionAuditRecorder((event) => {
  console.info(JSON.stringify({ event: 'application.screening.decision', ...event }));
});

export function recordDecision(input: DecisionAuditInput): Promise<void> {
  return temporaryDecisionAudit.recordDecision(input);
}

import { describe, expect, it, vi } from 'vitest';
import {
  createDecisionAuditRecorder,
  type DecisionAuditEvent,
} from '../../src/lib/screening/decision-audit';

describe('screening decision audit', () => {
  it('records the application, decision, reason, actor, and timestamp through the audit interface', async () => {
    const write = vi.fn<(event: DecisionAuditEvent) => void>();
    const occurredAt = new Date('2026-10-14T12:30:00.000Z');
    const recorder = createDecisionAuditRecorder(write, () => occurredAt);

    await recorder.recordDecision({
      applicationId: 'application-olivia',
      organizationId: 'organization-1',
      decision: 'APPROVED',
      reason: 'criteria-met',
      actorId: 'manager-jordan',
    });

    expect(write).toHaveBeenCalledWith({
      applicationId: 'application-olivia',
      organizationId: 'organization-1',
      decision: 'APPROVED',
      reason: 'criteria-met',
      actorId: 'manager-jordan',
      occurredAt,
    });
  });
});

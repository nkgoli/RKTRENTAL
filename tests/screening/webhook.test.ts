import { describe, expect, it, vi } from 'vitest';
import {
  createScreeningWebhookHandler,
  screeningWebhookTransition,
  type ScreeningWebhookEvent,
} from '../../src/lib/screening/webhook';

describe('screening webhook status transitions', () => {
  it('moves a submitted application through screening to review when a report is complete', () => {
    expect(screeningWebhookTransition('pending', 'SUBMITTED', 'complete')).toEqual({
      reportStatus: 'complete',
      applicationStatus: 'REVIEW',
    });
  });

  it('moves a pending report to screening and a failed report to review', () => {
    expect(screeningWebhookTransition('pending', 'SUBMITTED', 'pending')).toEqual({
      reportStatus: 'pending',
      applicationStatus: 'SCREENING',
    });
    expect(screeningWebhookTransition('pending', 'SCREENING', 'failed')).toEqual({
      reportStatus: 'failed',
      applicationStatus: 'REVIEW',
    });
  });

  it('preserves final application decisions and does not regress a completed report', () => {
    expect(screeningWebhookTransition('complete', 'APPROVED', 'failed')).toEqual({
      reportStatus: 'complete',
      applicationStatus: 'APPROVED',
    });
    expect(screeningWebhookTransition('pending', 'REVIEW', 'pending')).toEqual({
      reportStatus: 'pending',
      applicationStatus: 'REVIEW',
    });
  });

  it('forwards a validated normalized provider event to the persistence adapter', async () => {
    const event: ScreeningWebhookEvent = {
      externalEventId: 'event-123',
      organizationId: 'organization-1',
      applicationId: 'application-olivia',
      provider: 'transunion',
      providerReference: 'report-123',
      status: 'complete',
      creditScore: 742,
      background: 'clear',
      eviction: 'clear',
    };
    const applyReport = vi.fn().mockResolvedValue({
      reportStatus: 'complete',
      applicationStatus: 'REVIEW',
    });
    const handle = createScreeningWebhookHandler({ applyReport });

    await expect(handle(event)).resolves.toEqual({
      reportStatus: 'complete',
      applicationStatus: 'REVIEW',
    });
    expect(applyReport).toHaveBeenCalledWith(event);
  });

  it('rejects provider results outside the approved screening summary fields', async () => {
    const applyReport = vi.fn();
    const handle = createScreeningWebhookHandler({ applyReport });

    await expect(
      handle({
        externalEventId: 'event-123',
        organizationId: 'organization-1',
        applicationId: 'application-olivia',
        provider: 'transunion',
        providerReference: 'report-123',
        status: 'complete',
        creditScore: 920,
      }),
    ).rejects.toThrow('Screening credit score is invalid');
    expect(applyReport).not.toHaveBeenCalled();
  });
});

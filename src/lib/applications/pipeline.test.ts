import { describe, expect, it } from 'vitest';
import {
  applicationStage,
  currentScreeningConsent,
  invitationDeliveryState,
  pipelineCounts,
  pipelineDetail,
  reviewSteps,
  screeningProviderStatus,
} from './pipeline';

const now = new Date('2026-10-20T12:00:00Z');
const consent = (provider: string, revokedAt: Date | null = null) => ({
  provider,
  consentedAt: new Date('2026-10-08T00:00:00Z'),
  consentVersion: 'demo-2026',
  revokedAt,
});

describe('application pipeline', () => {
  it('accepts only current consent for a configured provider, else the development mock', () => {
    expect(currentScreeningConsent([consent('transunion')], ['transunion'], now)?.provider).toBe(
      'transunion',
    );
    expect(currentScreeningConsent([consent('transunion')], [], now)).toBeUndefined();
    expect(currentScreeningConsent([consent('mock')], [], now)?.provider).toBe('mock');
    expect(currentScreeningConsent([consent('transunion', now)], ['transunion'], now)).toBe(
      undefined,
    );
  });

  it('maps the seeded applications to the reference pipeline', () => {
    const stages = [
      applicationStage({ status: 'REVIEW', consent: true, reportStatus: 'complete' }),
      applicationStage({ status: 'SCREENING', consent: true, reportStatus: 'pending' }),
      applicationStage({ status: 'REVIEW', consent: true, reportStatus: 'complete' }),
      applicationStage({ status: 'SUBMITTED', consent: false }),
    ];
    const counts = pipelineCounts(stages);
    expect(counts).toEqual({
      toReview: 4,
      awaitingConsent: 1,
      readyToScreen: 0,
      screening: 1,
      ready: 2,
    });
    expect(pipelineDetail(counts)).toBe(
      '2 ready for decision · 1 in screening · 1 awaiting consent',
    );
  });

  it('excludes decisions and never treats a failed report or missing consent as ready', () => {
    expect(applicationStage({ status: 'REVIEW', consent: true, reportStatus: 'failed' })).toBe(
      'ready-to-screen',
    );
    expect(applicationStage({ status: 'REVIEW', consent: false, reportStatus: 'complete' })).toBe(
      'awaiting-consent',
    );
    expect(applicationStage({ status: 'DECLINED', consent: false })).toBe('declined');
    const counts = pipelineCounts(['approved', 'declined', 'ready-to-screen']);
    expect(counts.toReview).toBe(1);
    expect(pipelineDetail(counts)).toContain('1 ready to screen');
  });

  it('marks the current review step', () => {
    expect(reviewSteps('awaiting-consent', false).current).toBe(1);
    expect(reviewSteps('ready', false).current).toBe(3);
    expect(reviewSteps('approved', false).current).toBe(4);
    expect(reviewSteps('approved', true).current).toBe(5);
    expect(reviewSteps('declined', false)).toEqual({
      steps: ['Submitted', 'Consent', 'Screened', 'Decision'],
      current: 4,
    });
  });
});

describe('invitation delivery state', () => {
  const row = { submittedAt: null, expiresAt: new Date('2026-10-25T00:00:00Z'), generation: 2 };
  it('reports only the current link generation and never claims delivery', () => {
    expect(invitationDeliveryState(row, undefined, now).key).toBe('not-sent');
    expect(invitationDeliveryState(row, { generation: 1, status: 'ACCEPTED' }, now).key).toBe(
      'not-sent',
    );
    expect(invitationDeliveryState(row, { generation: 2, status: 'ACCEPTED' }, now).label).toBe(
      'Accepted by provider',
    );
    expect(invitationDeliveryState(row, { generation: 2, status: 'FAILED' }, now).key).toBe(
      'failed',
    );
    expect(invitationDeliveryState(row, { generation: 2, status: 'UNCERTAIN' }, now).key).toBe(
      'uncertain',
    );
    expect(invitationDeliveryState(row, { generation: 2, status: 'SENDING' }, now).key).toBe(
      'uncertain',
    );
    expect(
      invitationDeliveryState(
        { ...row, expiresAt: new Date('2026-10-01T00:00:00Z') },
        undefined,
        now,
      ).key,
    ).toBe('expired');
    expect(invitationDeliveryState({ ...row, submittedAt: now }, undefined, now).key).toBe(
      'submitted',
    );
  });
});

describe('screening provider status', () => {
  const rows = [
    { provider: 'settings', status: 'CONNECTED' },
    { provider: 'transunion', status: 'CONNECTED' },
  ];
  it('says sandbox instead of connected while requests use the sandbox adapter', () => {
    expect(screeningProviderStatus(rows, true)).toEqual({
      name: 'TransUnion SmartMove',
      state: 'sandbox',
      label: 'TransUnion SmartMove · sandbox',
    });
    expect(screeningProviderStatus(rows, false).state).toBe('unavailable');
    expect(screeningProviderStatus([rows[0]], false).state).toBe('not-configured');
    expect(
      screeningProviderStatus([{ provider: 'transunion', status: 'DISCONNECTED' }], true),
    ).toMatchObject({ state: 'sandbox', name: 'Screening provider' });
  });
});

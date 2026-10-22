import { hasCurrentConsent, type ApplicationStatus } from '@/lib/screening/policy';
import { findProvider } from '@/lib/integrations/catalog';
import { SETTINGS_PROVIDER } from '@/lib/integrations/settings';

/**
 * Pure read-only helpers for the Applications & invitations screen. They describe state that the
 * screening policy and invitation records already hold; none of them grants or changes a transition.
 */

type ConsentRow = {
  provider: string;
  consentedAt: Date;
  consentVersion: string;
  revokedAt: Date | null;
};

/**
 * The consent the review actions accept: a current consent for a configured screening provider,
 * otherwise a current development-mock consent (same order as recordDecision/requestScreening).
 */
export function currentScreeningConsent<C extends ConsentRow>(
  consents: readonly C[],
  providers: readonly string[],
  now = new Date(),
): C | undefined {
  return (
    consents.find((item) => providers.includes(item.provider) && hasCurrentConsent(item, now)) ??
    consents.find((item) => item.provider === 'mock' && hasCurrentConsent(item, now))
  );
}

export type ApplicationStage =
  'awaiting-consent' | 'ready-to-screen' | 'screening' | 'ready' | 'approved' | 'declined';

/** Where a submitted application sits in review, from its status, consent and latest report. */
export function applicationStage({
  status,
  consent,
  reportStatus,
}: {
  status: ApplicationStatus;
  consent: boolean;
  reportStatus?: string | null;
}): ApplicationStage {
  if (status === 'APPROVED') return 'approved';
  if (status === 'DECLINED') return 'declined';
  if (!consent) return 'awaiting-consent';
  if (status === 'SCREENING') return 'screening';
  if (status === 'REVIEW' && reportStatus === 'complete') return 'ready';
  // Consent recorded, but no usable report yet (never run, or a failed report to run again).
  return 'ready-to-screen';
}

export type PipelineCounts = {
  /** Undecided submitted applications. Invitations and drafts never count. */
  toReview: number;
  awaitingConsent: number;
  readyToScreen: number;
  screening: number;
  ready: number;
};

export function pipelineCounts(stages: readonly ApplicationStage[]): PipelineCounts {
  const counts: PipelineCounts = {
    toReview: 0,
    awaitingConsent: 0,
    readyToScreen: 0,
    screening: 0,
    ready: 0,
  };
  for (const stage of stages) {
    if (stage === 'approved' || stage === 'declined') continue;
    counts.toReview += 1;
    if (stage === 'awaiting-consent') counts.awaitingConsent += 1;
    if (stage === 'ready-to-screen') counts.readyToScreen += 1;
    if (stage === 'screening') counts.screening += 1;
    if (stage === 'ready') counts.ready += 1;
  }
  return counts;
}

/** "2 ready for decision · 1 in screening · 1 awaiting consent" (+ ready to screen when present). */
export function pipelineDetail(counts: PipelineCounts) {
  return [
    `${counts.ready} ready for decision`,
    `${counts.screening} in screening`,
    `${counts.awaitingConsent} awaiting consent`,
    ...(counts.readyToScreen ? [`${counts.readyToScreen} ready to screen`] : []),
  ].join(' · ');
}

export const REVIEW_STEPS = ['Submitted', 'Consent', 'Screened', 'Decision', 'Promote'] as const;

/** Review steps for one application; `current === steps.length` means every step is done. */
export function reviewSteps(stage: ApplicationStage, promoted: boolean) {
  const steps: string[] = [...REVIEW_STEPS];
  switch (stage) {
    case 'awaiting-consent':
      return { steps, current: 1 };
    case 'ready-to-screen':
    case 'screening':
      return { steps, current: 2 };
    case 'ready':
      return { steps, current: 3 };
    case 'approved':
      return { steps, current: promoted ? steps.length : 4 };
    case 'declined':
      // A declined application never reaches promotion.
      return { steps: steps.slice(0, 4), current: 4 };
  }
}

export type DeliveryTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type InvitationDeliveryState = {
  key: 'submitted' | 'expired' | 'not-sent' | 'sandbox' | 'accepted' | 'failed' | 'uncertain';
  label: string;
  tone: DeliveryTone;
};

/**
 * Email/link state for an invitation's current link generation. Provider acceptance never claims
 * delivery; "uncertain" covers in-flight and unknown outcomes, which block automatic retry.
 */
export function invitationDeliveryState(
  row: { submittedAt: Date | null; expiresAt: Date; generation: number },
  latest: { generation: number; status: string } | undefined,
  now = new Date(),
): InvitationDeliveryState {
  if (row.submittedAt) return { key: 'submitted', label: 'Application submitted', tone: 'success' };
  if (row.expiresAt <= now) return { key: 'expired', label: 'Link expired', tone: 'neutral' };
  const attempt = latest?.generation === row.generation ? latest : undefined;
  switch (attempt?.status) {
    case undefined:
      return { key: 'not-sent', label: 'Not sent yet', tone: 'info' };
    case 'MOCK_RECORDED':
      return { key: 'sandbox', label: 'Sandbox recorded · no email sent', tone: 'neutral' };
    case 'ACCEPTED':
      return { key: 'accepted', label: 'Accepted by provider', tone: 'success' };
    case 'FAILED':
    case 'UNCONFIGURED':
      return { key: 'failed', label: 'Failed · retry available', tone: 'danger' };
    default:
      return { key: 'uncertain', label: 'Uncertain · retry blocked', tone: 'warning' };
  }
}

export type ScreeningProviderStatus = {
  name: string;
  state: 'sandbox' | 'unavailable' | 'not-configured';
  /** "TransUnion SmartMove · sandbox" */
  label: string;
};

/**
 * What the screening provider can honestly be called. Requests run through the sandbox adapter
 * whenever sandbox mode is on (lib/providers screeningProvider), so a stored CONNECTED row is
 * shown as sandbox there, and as unavailable outside sandbox because no live adapter exists yet.
 */
export function screeningProviderStatus(
  connections: readonly { provider: string; status: string }[],
  sandbox: boolean,
): ScreeningProviderStatus {
  const connected = connections.filter(
    (row) => row.provider !== SETTINGS_PROVIDER && row.status === 'CONNECTED',
  );
  const connection =
    ['transunion', 'checkr', 'mock']
      .map((provider) => connected.find((row) => row.provider === provider))
      .find(Boolean) ??
    connected[0] ??
    null;
  const name = connection
    ? connection.provider === 'mock'
      ? 'Development screening'
      : (findProvider('SCREENING', connection.provider)?.name ?? connection.provider)
    : 'Screening provider';
  if (sandbox) return { name, state: 'sandbox', label: `${name} · sandbox` };
  if (connection) return { name, state: 'unavailable', label: `${name} · not available yet` };
  return { name, state: 'not-configured', label: 'Screening provider not configured' };
}

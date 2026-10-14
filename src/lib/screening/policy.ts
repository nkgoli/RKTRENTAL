export type ApplicationStatus = 'SUBMITTED' | 'SCREENING' | 'REVIEW' | 'APPROVED' | 'DECLINED';
export type ReportStatus = 'pending' | 'complete' | 'failed';

export type ConsentRecord = {
  consentedAt: Date;
  consentVersion: string;
  revokedAt: Date | null;
};

const applicationTransitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  SUBMITTED: ['SCREENING', 'DECLINED'],
  SCREENING: ['REVIEW', 'DECLINED'],
  REVIEW: ['SCREENING', 'APPROVED', 'DECLINED'],
  APPROVED: [],
  DECLINED: [],
};

export function hasCurrentConsent(
  consent: ConsentRecord | null | undefined,
  now = new Date(),
): consent is ConsentRecord {
  return Boolean(
    consent &&
      consent.consentVersion.trim() &&
      Number.isFinite(consent.consentedAt.getTime()) &&
      consent.consentedAt.getTime() <= now.getTime() &&
      !consent.revokedAt,
  );
}

export function requireCurrentConsent(
  consent: ConsentRecord | null | undefined,
  now = new Date(),
): asserts consent is ConsentRecord {
  if (!hasCurrentConsent(consent, now)) throw new Error('Current applicant consent required');
}

export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return from === to || applicationTransitions[from].includes(to);
}

export function requireApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): void {
  if (!canTransitionApplication(from, to)) {
    throw new Error(`Invalid application status transition: ${from} to ${to}`);
  }
}

export function applicationStatusForReport(
  current: ApplicationStatus,
  report: ReportStatus,
): ApplicationStatus {
  if (current === 'APPROVED' || current === 'DECLINED') return current;
  if (report === 'pending') return 'SCREENING';
  return 'REVIEW';
}

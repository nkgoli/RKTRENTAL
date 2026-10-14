import { describe, expect, it } from 'vitest';
import {
  applicationStatusForReport,
  canTransitionApplication,
  hasCurrentConsent,
  requireApplicationTransition,
  requireCurrentConsent,
} from '../../src/lib/screening/policy';

describe('screening consent policy', () => {
  const now = new Date('2026-10-14T12:00:00.000Z');

  it('requires recorded, current, unrevoked FCRA consent before screening', () => {
    const consent = {
      consentedAt: new Date('2026-10-08T12:00:00.000Z'),
      consentVersion: 'fcra-2026-01',
      revokedAt: null,
    };

    expect(hasCurrentConsent(consent, now)).toBe(true);
    expect(() => requireCurrentConsent(null, now)).toThrow('Current applicant consent required');
    expect(() =>
      requireCurrentConsent({ ...consent, revokedAt: new Date('2026-10-09T12:00:00.000Z') }, now),
    ).toThrow('Current applicant consent required');
    expect(() =>
      requireCurrentConsent({ ...consent, consentedAt: new Date('2026-10-15T12:00:00.000Z') }, now),
    ).toThrow('Current applicant consent required');
  });
});

describe('application and report status transitions', () => {
  it('allows screening, review, and a final decision in order', () => {
    expect(canTransitionApplication('SUBMITTED', 'SCREENING')).toBe(true);
    expect(canTransitionApplication('SCREENING', 'REVIEW')).toBe(true);
    expect(canTransitionApplication('REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionApplication('REVIEW', 'DECLINED')).toBe(true);
    expect(() => requireApplicationTransition('APPROVED', 'SCREENING')).toThrow(
      'Invalid application status transition',
    );
    expect(() => requireApplicationTransition('DECLINED', 'APPROVED')).toThrow(
      'Invalid application status transition',
    );
  });

  it('keeps webhook report results in the correct application state', () => {
    expect(applicationStatusForReport('SUBMITTED', 'pending')).toBe('SCREENING');
    expect(applicationStatusForReport('SCREENING', 'complete')).toBe('REVIEW');
    expect(applicationStatusForReport('SCREENING', 'failed')).toBe('REVIEW');
    expect(applicationStatusForReport('APPROVED', 'complete')).toBe('APPROVED');
    expect(applicationStatusForReport('DECLINED', 'pending')).toBe('DECLINED');
  });
});

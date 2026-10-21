import { describe, expect, it } from 'vitest';
import { documentAgreementMetadata } from '@/lib/documents/library';

describe('document signing metadata', () => {
  it('keeps unsigned superseded addendums distinct from active requests and signed history', () => {
    const signedAt = new Date('2026-10-01T12:00:00Z');
    const supersededAt = new Date('2026-10-02T12:00:00Z');
    const reference = {
      agreementId: 'version-one',
      slot: 'ADDENDUM:original',
      sha256: 'a'.repeat(64),
    };
    const result = documentAgreementMetadata({
      agreementFiles: [
        {
          ...reference,
          agreement: {
            version: 1,
            signedAt: null,
            supersededAt,
            archiveStatus: 'AWAITING_SIGNATURES',
          },
        },
        {
          ...reference,
          agreementId: 'version-two',
          agreement: {
            version: 2,
            signedAt: null,
            supersededAt: null,
            archiveStatus: 'AWAITING_SIGNATURES',
          },
        },
        {
          ...reference,
          agreementId: 'signed-history',
          agreement: { version: 3, signedAt, supersededAt, archiveStatus: 'ARCHIVED' },
        },
      ],
    });
    expect(result.map((item) => item.signatureStatus)).toEqual([
      'SUPERSEDED',
      'AWAITING_SIGNATURES',
      'INCLUDED_IN_SIGNED_AGREEMENT',
    ]);
    expect(result[0].supersededAt).toBe(supersededAt.toISOString());
    expect(result[2].signedAt).toBe(signedAt.toISOString());
  });

  it('never infers signatures from a filename or document kind', () => {
    expect(documentAgreementMetadata({})).toEqual([]);
  });
});

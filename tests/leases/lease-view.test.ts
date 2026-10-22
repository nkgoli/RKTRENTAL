import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  documentGroup,
  formatFileSize,
  isRestrictedKind,
  lateLine,
  leaseStatusBadge,
  signatureSummary,
  type AgreementState,
} from '@/app/(manager)/leases/[id]/lease-view';
import { ledgerSummary } from '@/app/(manager)/leases/[id]/ledger/ledger-summary';

const day = (date: string) => new Date(`${date}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const base = {
  eSignStatus: 'SIGNED',
  signedAt: day('2025-11-18'),
  agreement: null,
  leaseFile: null,
  tenants: [{ id: 't1', name: 'Alex Rivera' }],
  formatDate: fmt,
};
const agreement = (over: Partial<AgreementState> = {}): AgreementState => ({
  signedAt: day('2026-10-02'),
  supersededAt: null,
  archiveStatus: 'ARCHIVED',
  archiveError: null,
  version: 3,
  parties: [
    { role: 'TENANT', expectedName: 'Alex Rivera', signedAt: day('2026-10-01') },
    { role: 'OWNER', expectedName: 'Morgan Owner', signedAt: day('2026-10-02') },
  ],
  files: [{ slot: 'LEASE', documentId: 'doc-archived' }],
  ...over,
});

describe('lease header status', () => {
  const now = new Date('2026-10-22T15:00:00Z');
  it('warns when an active lease ends within 60 days', () => {
    expect(daysUntil(day('2026-11-30'), now)).toBe(39);
    expect(leaseStatusBadge({ status: 'ACTIVE', endDate: day('2026-11-30') }, now)).toEqual({
      tone: 'warning',
      label: 'Active · ends in 39 days',
    });
    expect(leaseStatusBadge({ status: 'ACTIVE', endDate: day('2026-10-23') }, now).label).toBe(
      'Active · ends in 1 day',
    );
    expect(leaseStatusBadge({ status: 'ACTIVE', endDate: day('2027-06-30') }, now)).toEqual({
      tone: 'success',
      label: 'Active',
    });
    expect(leaseStatusBadge({ status: 'ENDED', endDate: day('2026-01-01') }, now).tone).toBe(
      'neutral',
    );
  });
});

describe('signature summary', () => {
  it('reports an archived signed PDF as on file with both signers', () => {
    const s = signatureSummary({ ...base, agreement: agreement() });
    expect(s.state).toBe('done');
    expect(s.headline).toBe('Signed agreement on file');
    expect(s.signedFileId).toBe('doc-archived');
    expect(s.signers.map((x) => [x.label, x.signed])).toEqual([
      ['Tenant · Alex Rivera', true],
      ['Owner / lessor · Morgan Owner', true],
    ]);
  });

  it('flags a failed PDF without asking anyone to sign again', () => {
    const s = signatureSummary({
      ...base,
      agreement: agreement({ archiveStatus: 'PDF_FAILED', archiveError: 'Storage offline.' }),
    });
    expect(s.state).toBe('attention');
    expect(s.headline).toBe('Signed PDF unavailable');
    expect(s.pdfMissing).toBe(true);
    expect(s.caption).toContain('Storage offline.');
    expect(s.caption).toContain('no one signs again');
  });

  it('counts signers while awaiting signatures and ignores superseded versions', () => {
    const waiting = agreement({
      signedAt: null,
      archiveStatus: 'AWAITING_SIGNATURES',
      parties: [
        { role: 'TENANT', expectedName: 'Alex Rivera', signedAt: day('2026-10-01') },
        { role: 'OWNER', expectedName: 'Morgan Owner', signedAt: null },
      ],
    });
    expect(signatureSummary({ ...base, agreement: waiting }).caption).toMatch(/^1 of 2 signed/);
    const old = signatureSummary({
      ...base,
      eSignStatus: 'NOT_SENT',
      agreement: agreement({ supersededAt: day('2026-10-03') }),
    });
    expect(old.headline).toBe('Agreement not sent for signature');
  });

  it('uses a stored lease file for leases signed before signing versions existed', () => {
    const withFile = signatureSummary({ ...base, leaseFile: { id: 'doc-1', name: 'Signed.pdf' } });
    expect(withFile.headline).toBe('Signed agreement on file');
    expect(withFile.caption).toBe(
      'Historical status: signed 2025-11-18 · Signed.pdf is on file · the signed agreement is locked; changes go in an addendum',
    );
    // Without a signing record the file is not proof of who signed.
    expect(withFile.historical).toBe(true);
    expect(withFile.signers.map((x) => [x.label, x.signed, x.note])).toEqual([
      ['Alex Rivera', false, 'Named tenant'],
      ['Signer details', false, 'Review in PDF'],
    ]);
    const without = signatureSummary(base);
    expect(without.headline).toBe('Signed PDF unavailable');
    expect(without.historical).toBe(true);
    expect(without.signers.map((x) => x.label)).toEqual(['Alex Rivera', 'Signer details']);
  });
});

describe('late line', () => {
  const r = (description: string, status: string, balanceCents = 100) => ({
    description,
    status,
    balanceCents,
  });
  it('names the oldest late charge and counts the rest', () => {
    expect(lateLine([r('November rent', 'SCHEDULED'), r('October rent', 'LATE')], 5)).toBe(
      'October rent is past the 5-day grace period',
    );
    expect(
      lateLine([r('October rent', 'LATE'), r('Late fee', 'LATE'), r('September rent', 'LATE')], 3),
    ).toBe('September rent and 2 more charges are past the 3-day grace period');
    expect(lateLine([r('October rent', 'DUE'), r('Paid', 'LATE', 0)], 5)).toBeNull();
  });
});

describe('lease documents', () => {
  it('groups files and keeps unsigned lease uploads out of Signed agreement', () => {
    expect(documentGroup('lease', true)).toBe('signed');
    expect(documentGroup('lease')).toBe('other');
    expect(documentGroup('addendum')).toBe('addendums');
    expect(documentGroup('inspection')).toBe('inspections');
    expect(documentGroup('id')).toBe('inspections');
    expect(isRestrictedKind('id')).toBe(true);
    expect(isRestrictedKind('inspection')).toBe(false);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(24_576)).toBe('24 KB');
    expect(formatFileSize(1_572_864)).toBe('1.5 MB');
    expect(formatFileSize(Number.NaN)).toBe('');
  });
});

describe('ledger summary band', () => {
  it('keeps balance, credit, late, open and pending separate', () => {
    const s = ledgerSummary(
      {
        balanceCents: 260_000,
        rows: [
          { status: 'LATE', balanceCents: 185_000 },
          { status: 'PARTIAL', balanceCents: 75_000 },
          { status: 'SCHEDULED', balanceCents: 185_000 },
          { status: 'PAID', balanceCents: 0 },
        ],
        payments: [
          { status: 'PENDING', amountCents: 50_000 },
          { status: 'SUCCEEDED', amountCents: 185_000 },
        ],
      },
      new Date('2026-10-22T12:00:00Z'),
    );
    expect(s).toEqual({
      asOfLabel: 'Oct 22, 2026',
      balanceDueCents: 260_000,
      creditCents: 0,
      lateCount: 1,
      lateCents: 185_000,
      openCount: 1,
      openCents: 75_000,
      pendingCents: 50_000,
    });
    const credit = ledgerSummary({ balanceCents: -2_500, rows: [], payments: [] }, new Date());
    expect([credit.balanceDueCents, credit.creditCents]).toEqual([0, 2_500]);
  });
});

import { describe, expect, it } from 'vitest';
import { draftNotice } from '@/components/lease-create/draft-notice';
import { draftDeletionBlocker, type DraftDeletionFacts } from '@/lib/lease-create/delete-draft';

const draft: DraftDeletionFacts = {
  status: 'DRAFT',
  eSignStatus: 'NOT_SENT',
  signedAt: null,
  agreements: 0,
  charges: 0,
  payments: 0,
  reminders: 0,
  autopay: 0,
  pinnedDocuments: 0,
  dependentRenewals: 0,
};

describe('draft deletion eligibility', () => {
  it('allows only an unsent draft with no protected history', () => {
    expect(draftDeletionBlocker(draft)).toBeNull();
  });

  it.each<[string, Partial<DraftDeletionFacts>, RegExp]>([
    ['active lease', { status: 'ACTIVE' }, /no longer a draft/],
    ['ended lease', { status: 'ENDED' }, /no longer a draft/],
    ['sent draft', { eSignStatus: 'SENT' }, /sent for signature/],
    ['signed draft', { eSignStatus: 'SIGNED', signedAt: new Date() }, /sent for signature/],
    // Editing a sent draft resets eSignStatus, but the superseded versions are still history.
    ['draft with a superseded agreement', { agreements: 1 }, /agreement history/],
    ['draft with charges', { charges: 1 }, /ledger or payment/],
    ['draft with payments', { payments: 2 }, /ledger or payment/],
    ['draft with reminders', { reminders: 1 }, /ledger or payment/],
    ['draft with autopay', { autopay: 1 }, /ledger or payment/],
    ['draft with a pinned file', { pinnedDocuments: 1 }, /signing record/],
    ['renewal source', { dependentRenewals: 1 }, /depends on this lease/],
  ])('refuses a %s', (_name, facts, message) => {
    expect(draftDeletionBlocker({ ...draft, ...facts })).toMatch(message);
  });

  it('maps only known deletion notices', () => {
    expect(draftNotice('draft-deleted')).toBe('Draft lease deleted.');
    expect(draftNotice(['draft-gone'])).toBe('That draft was already deleted.');
    expect(draftNotice('role')).toBeNull();
    expect(draftNotice('__proto__')).toBeNull();
    expect(draftNotice(undefined)).toBeNull();
  });
});

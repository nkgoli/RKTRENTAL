import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  selection: vi.fn(),
  draft: vi.fn(),
  saved: vi.fn(),
  save: vi.fn(),
  service: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: mocks.read,
  requireManagerWriteRole: mocks.write,
}));
vi.mock('@/lib/db/client', () => ({ db: { marker: 'database' } }));
vi.mock('@/lib/analysis/service', () => ({ analysisService: mocks.service }));
import {
  loadAnalysisSelectionAction,
  loadRoiDraftAction,
  loadSavedRoiAnalysisAction,
  saveRoiAnalysisAction,
} from '../../src/app/(manager)/roi-analysis/actions';

describe('analysis server actions', () => {
  it('uses authenticated session for every read and write', async () => {
    const session = { organizationId: 'trusted-org', role: 'MANAGER' };
    mocks.read.mockResolvedValue(session);
    mocks.write.mockResolvedValue(session);
    mocks.service.mockReturnValue({
      selection: mocks.selection,
      loadDraft: mocks.draft,
      loadSaved: mocks.saved,
      save: mocks.save,
    });
    await loadAnalysisSelectionAction();
    await loadRoiDraftAction('property-a');
    await loadSavedRoiAnalysisAction('property-a');
    const untrusted = { organizationId: 'forged-org' };
    await saveRoiAnalysisAction(untrusted);
    expect(mocks.read).toHaveBeenCalledTimes(3);
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.service).toHaveBeenCalledTimes(4);
    for (const [actual] of mocks.service.mock.calls) expect(actual).toBe(session);
    expect(mocks.save).toHaveBeenCalledWith(untrusted); // Schema rejects this; never used as auth context.
    expect(mocks.draft).toHaveBeenCalledWith('property-a');
  });
  it('does not reach data service when authentication rejects', async () => {
    mocks.service.mockClear();
    mocks.read.mockRejectedValue(new Error('sign-in redirect'));
    await expect(loadRoiDraftAction('forged')).rejects.toThrow('sign-in redirect');
    expect(mocks.service).not.toHaveBeenCalled();
  });
});

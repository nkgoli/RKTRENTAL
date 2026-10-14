import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../../src/lib/auth/session';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn((): never => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('../../src/lib/auth/server-session', () => ({ getSession: mocks.getSession }));
vi.mock('../../src/lib/db/client', () => ({ db: {} }));

import {
  findLeaseAccess,
  requireManagerRole,
  requireManagerWriteRole,
} from '../../src/lib/auth/access';

const ownerSession: AuthSession = {
  subjectId: 'owner-1',
  organizationId: 'org-1',
  authVersion: 100,
  email: 'owner@example.com',
  name: 'Owner',
  role: 'OWNER',
  issuedAt: 100,
  expiresAt: 200,
};

describe('OWNER manager access guards', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue(ownerSession);
    mocks.redirect.mockClear();
  });

  it('refuses an OWNER session for manager reads', async () => {
    await expect(requireManagerRole()).rejects.toThrow('redirect:/sign-out');
    expect(mocks.redirect).toHaveBeenCalledWith('/sign-out');
  });

  it('refuses an OWNER session for manager writes', async () => {
    await expect(requireManagerWriteRole()).rejects.toThrow('redirect:/sign-out');
    expect(mocks.redirect).toHaveBeenCalledWith('/sign-out');
  });

  it('wires the applications page and mutations through the manager guards', () => {
    const page = readFileSync(
      path.join(process.cwd(), 'src/app/(manager)/applications/page.tsx'),
      'utf8',
    );
    const actions = readFileSync(
      path.join(process.cwd(), 'src/app/(manager)/applications/actions.ts'),
      'utf8',
    );

    expect(page).toContain('requireManagerRole');
    expect(page).not.toMatch(/getSession|OWNER/);
    expect(actions).toContain('requireManagerWriteRole');
    expect(actions).not.toMatch(/getSession|OWNER/);
  });

  it('does not return an owner lease through the shared API access guard', async () => {
    await expect(findLeaseAccess(ownerSession, 'lease-1')).resolves.toBeNull();
  });
});

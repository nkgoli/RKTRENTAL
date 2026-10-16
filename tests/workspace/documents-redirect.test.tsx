import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/access', () => ({ requireManagerRole: vi.fn(async () => ({ organizationId: 'org-1' })) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));

import PropertyDocumentsPage from '@/app/(manager)/properties/[id]/documents/page';

describe('legacy workspace Documents route', () => {
  it('redirects property and unit URLs to Overview without losing unit scope', async () => {
    const params = Promise.resolve({ id: 'elm' });
    await expect(PropertyDocumentsPage({ params, searchParams: Promise.resolve({}) }))
      .rejects.toThrow('redirect:/properties/elm');
    await expect(PropertyDocumentsPage({ params, searchParams: Promise.resolve({ unit: 'home', notice: 'saved' }) }))
      .rejects.toThrow('redirect:/properties/elm?notice=saved&unit=home');
  });
});

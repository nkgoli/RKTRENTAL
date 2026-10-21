import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';

const verify = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/session', () => ({ SESSION_COOKIE: 'rr_session', verifySessionToken: verify }));

import { middleware } from '@/middleware';

afterEach(() => vi.restoreAllMocks());

it.each([
  ['TENANT', '/dashboard', '/home'],
  ['MANAGER', '/lease', '/dashboard'],
])(
  'explains a role redirect for %s and logs only route context',
  async (role, from, destination) => {
    verify.mockResolvedValue({ role });
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await middleware(
      new NextRequest(`https://rentals.example${from}`, {
        headers: { cookie: 'rr_session=test' },
      }),
    );
    expect(response.headers.get('location')).toBe(
      `https://rentals.example${destination}?notice=role`,
    );
    expect(log).toHaveBeenCalledWith(
      'Role access denied',
      expect.objectContaining({ pathname: from, role }),
    );
  },
);

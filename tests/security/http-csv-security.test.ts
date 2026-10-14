import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import nextConfig from '../../next.config';
import { isAllowedRequestOrigin, isSameOrigin, middleware } from '../../src/middleware';
import { buildReturnsCsv, type ReturnsCsvRow } from '../../src/lib/returns/csv';

const metrics = {
  incomeCents: 100_000,
  expensesCents: 25_000,
  debtServiceCents: 10_000,
  noiCents: 75_000,
  cashFlowCents: 65_000,
  expenseRatio: 0.25,
  capRate: 0.08,
  cashOnCash: 0.1,
  roi: 0.12,
  yieldRate: 0.09,
  cashInvestedCents: 500_000,
  appreciationCents: 10_000,
};

describe('cookie request origin checks', () => {
  it('accepts same-origin requests and rejects missing, malformed, or hostile origins', () => {
    expect(isSameOrigin('https://rentals.example/path', 'https://rentals.example')).toBe(true);
    expect(isSameOrigin('https://attacker.example', 'https://rentals.example')).toBe(false);
    expect(isSameOrigin('not a URL', 'https://rentals.example')).toBe(false);
  });

  it('accepts the public host origin when a proxy normalizes the request URL', () => {
    expect(
      isAllowedRequestOrigin(
        'https://rentals.example',
        'http://internal:3000',
        'rentals.example',
        'https',
      ),
    ).toBe(true);
    expect(
      isAllowedRequestOrigin(
        'https://attacker.example',
        'http://internal:3000',
        'rentals.example',
        'https',
      ),
    ).toBe(false);
  });

  it('blocks cookie-authenticated non-GET requests with a hostile origin', async () => {
    const request = new NextRequest('https://rentals.example/api/files', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        cookie: 'rr_session=present',
      },
    });
    const response = await middleware(request);
    expect(response.status).toBe(403);
  });

  it('leaves non-cookie requests alone for signed webhook routes', async () => {
    const request = new NextRequest('https://rentals.example/api/webhooks/stripe', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    });
    const response = await middleware(request);
    expect(response.status).toBe(200);
  });
});

describe('application security headers', () => {
  it('sets CSP, frame denial, referrer policy and nosniff on every route', async () => {
    const rules = await nextConfig.headers?.();
    const rule = rules?.find((item) => item.source === '/:path*');
    const headers = new Map(rule?.headers.map(({ key, value }) => [key.toLowerCase(), value]));
    expect(headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('returns CSV formula protection', () => {
  it('escapes dangerous formula prefixes in property and period text', () => {
    const row: ReturnsCsvRow = {
      propertyName: '=HYPERLINK("https://attacker.example", "click")',
      metrics,
    };
    const csv = buildReturnsCsv([row], null, '\t@SUM(1+1)');
    expect(csv).toContain("'=HYPERLINK(");
    expect(csv).toContain("'\t@SUM");
    expect(csv).toContain('1000.00');
  });
});

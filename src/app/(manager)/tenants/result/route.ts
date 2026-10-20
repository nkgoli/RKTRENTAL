import { NextRequest, NextResponse } from 'next/server';
import { requireManagerRole } from '@/lib/auth/access';
import { tenantReturnHref } from '../navigation';

/**
 * Finish tenant actions with a document navigation. On this Next version,
 * applying the redirected Flight tree can discard the tenant page body.
 * A non-Flight response makes the action router use its normal document fallback;
 * the browser then follows this same-origin 303 to the existing tenant URL.
 */
export async function GET(request: NextRequest) {
  await requireManagerRole();
  if (request.headers.get('rsc') === '1') {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store', Vary: 'RSC' },
    });
  }
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const returnTo = tenantReturnHref(request.nextUrl.searchParams.get('returnTo'));
  const error = request.nextUrl.searchParams.get('error');
  const note = request.nextUrl.searchParams.get('note') === '1';
  const query = new URLSearchParams({ returnTo });
  if (error) query.set('error', error);
  if (note) query.set('note', '1');
  const location = tenantId
    ? `/tenants/${encodeURIComponent(tenantId)}?${query}`
    : `/tenants?view=directory`;
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: location },
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Vary', 'RSC');
  return response;
}
